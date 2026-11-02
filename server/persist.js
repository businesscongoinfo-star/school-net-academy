/**
 * Persistance de l'état applicatif dans Supabase.
 *
 * Sur Vercel, le système de fichiers est éphémère : la base SQLite vit dans /tmp
 * et chaque instance repart de zéro. On conserve donc un instantané compressé
 * de la base dans la table Supabase `app_state` (colonne `payload`, base64+zlib) :
 *
 *   • au démarrage  → `restore()` réécrit le fichier local avant l'ouverture ;
 *   • après écriture → `flush()` renvoie l'instantané (débounce + waitUntil).
 *
 * Le mode est transparent : sans Supabase configuré, l'application fonctionne
 * exactement comme avant (SQLite locale).
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { rest, supabaseConfigured, logEvent } from './supabase.js';
import { db, dbFile, isDirty, clearDirty } from './db.js';

const STATE_ID = 'main';
let localVersion = 0;
let restoredOnce = false;
let timer = null;
let flushing = null;
let lastSyncAt = null;
let lastError = null;

const TMP_SNAPSHOT = () => path.join(path.dirname(dbFile()), `.snapshot-${process.pid}.db`);

export const persistenceMode = () => (supabaseConfigured ? 'supabase' : 'local');

async function fetchState(timeout) {
  const rows = await rest(`/app_state?id=eq.${STATE_ID}&select=version,payload,updated_at`, timeout ? { timeout } : {});
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

/** Version distante seule (contrôle anti-écrasement, réponse minuscule). */
async function remoteVersion(timeout) {
  const rows = await rest(`/app_state?id=eq.${STATE_ID}&select=version`, timeout ? { timeout } : {});
  return Array.isArray(rows) && rows[0] ? Number(rows[0].version ?? 0) : 0;
}

/** Recharge l'instantané distant dans le fichier SQLite local (avant ouverture). */
export async function restore() {
  if (!supabaseConfigured) return { restored: false, mode: 'local' };
  try {
    // Le premier appel réseau d'une instance à froid est parfois très lent :
    // une requête minuscule « réchauffe » la connexion, puis l'instantané est
    // téléchargé avec un délai généreux. Budget total 25 s, sous la limite
    // d'exécution de la fonction serverless (60 s).
    const deadline = Date.now() + 25_000;
    const attempts = [];
    try {
      const started = Date.now();
      await remoteVersion(Math.min(6_000, Math.max(3_000, deadline - Date.now())));
      attempts.push(`réchauffement : ${Date.now() - started} ms`);
    } catch (error) {
      attempts.push(`réchauffement : ${error.message}`);
    }
    let state = null;
    for (let attempt = 1; attempt <= 2 && !state && Date.now() < deadline; attempt += 1) {
      const started = Date.now();
      try {
        state = await fetchState(Math.min(15_000, Math.max(5_000, deadline - Date.now())));
        if (!state?.payload) attempts.push(`essai ${attempt} : instantané absent (${Date.now() - started} ms)`);
      } catch (error) {
        attempts.push(`essai ${attempt} : ${error.message} (${Date.now() - started} ms)`);
      }
    }
    if (!state?.payload) {
      lastError = attempts.join(' · ') || 'instantané distant introuvable';
      console.error('[persist] restauration impossible :', lastError);
      return { restored: false, mode: 'supabase', version: 0, attempts };
    }
    const buffer = zlib.gunzipSync(Buffer.from(state.payload, 'base64'));
    fs.mkdirSync(path.dirname(dbFile()), { recursive: true });
    for (const suffix of ['', '-wal', '-shm']) fs.rmSync(`${dbFile()}${suffix}`, { force: true });
    fs.writeFileSync(dbFile(), buffer);
    localVersion = Number(state.version ?? 0);
    restoredOnce = true;
    lastSyncAt = new Date().toISOString();
    return { restored: true, mode: 'supabase', version: localVersion, bytes: buffer.length };
  } catch (error) {
    lastError = String(error.message);
    console.error('[persist] restauration impossible :', error.message);
    return { restored: false, mode: 'supabase', error: lastError };
  }
}

/** Produit un instantané cohérent de la base (VACUUM INTO) et le téléverse. */
async function pushSnapshot() {
  if (!supabaseConfigured || !isDirty()) return { saved: false };

  /**
   * Anti-écrasement : si un instantané distant existe et que cette instance ne
   * l'a pas restauré (démarrage dégradé), on n'envoie rien plutôt que de
   * remplacer des données récentes par une base de démonstration.
   */
  try {
    const version = await remoteVersion();
    if (version > localVersion && !restoredOnce) {
      lastError = `instantané distant plus récent (v${version}) : écriture différée`;
      return { saved: false, error: lastError };
    }
  } catch {
    /* contrôle impossible : on tente la sauvegarde */
  }

  const target = TMP_SNAPSHOT();
  try {
    fs.rmSync(target, { force: true });
    db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
    const raw = fs.readFileSync(target);
    const payload = zlib.gzipSync(raw, { level: 6 }).toString('base64');
    const version = Math.max(Date.now(), localVersion + 1);
    await rest(`/app_state?on_conflict=id`, {
      method: 'POST',
      body: { id: STATE_ID, version, payload, updated_at: new Date().toISOString() },
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    });
    localVersion = version;
    restoredOnce = true;
    lastSyncAt = new Date().toISOString();
    lastError = null;
    clearDirty();
    await logEvent('snapshot', { bytes: raw.length, gz: payload.length, version });
    return { saved: true, bytes: raw.length };
  } catch (error) {
    lastError = String(error.message);
    console.error('[persist] sauvegarde impossible :', error.message);
    return { saved: false, error: lastError };
  } finally {
    fs.rmSync(target, { force: true });
  }
}

/** Déclenche une sauvegarde différée (regroupement des écritures d'une requête). */
export function scheduleSync(delay = 1200) {
  if (!supabaseConfigured) return;
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    void flush();
  }, delay);
  timer.unref?.();
}

/** Sauvegarde immédiate (sérialisée). */
export async function flush() {
  if (!supabaseConfigured) return { saved: false };
  if (flushing) return flushing;
  flushing = pushSnapshot().finally(() => { flushing = null; });
  return flushing;
}

export function persistenceStatus() {
  return {
    mode: persistenceMode(),
    version: localVersion || null,
    lastSyncAt,
    lastError,
    dirty: isDirty(),
  };
}
