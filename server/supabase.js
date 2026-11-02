/**
 * Intégration Supabase (projet « school-net-academy »).
 *
 * Trois usages :
 *  1. Persistance de l'état applicatif (table `app_state`, voir persist.js) ;
 *  2. Authentification déléguée : envoi réel des e-mails de réinitialisation
 *     (GoTrue /auth/v1/recover), création des utilisateurs côté Supabase Auth ;
 *  3. Journal d'accès (`access_events`).
 *
 * Les clés ne sont JAMAIS dans le dépôt : elles viennent des variables
 * d'environnement (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
 * `SUPABASE_PUBLISHABLE_KEY`).
 */

const RAW_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
export const SUPABASE_URL = RAW_URL.replace(/\/+$/, '');
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';

export const supabaseConfigured = Boolean(SUPABASE_URL && SERVICE_KEY);
export const supabaseAuthEnabled = Boolean(SUPABASE_URL && (SERVICE_KEY || SUPABASE_PUBLISHABLE_KEY));

const TIMEOUT = Number(process.env.SUPABASE_TIMEOUT_MS || 15_000);

async function request(path, { method = 'GET', body, headers = {}, key = SERVICE_KEY } = {}) {
  if (!SUPABASE_URL) throw new Error('Supabase non configuré (SUPABASE_URL manquant).');
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const message = typeof data === 'object' && data ? (data.message || data.msg || data.error_description || data.error) : data;
    throw new Error(`Supabase ${res.status} ${path}: ${message || 'erreur inconnue'}`);
  }
  return data;
}

/** Appel PostgREST (clé service : contourne les politiques RLS). */
export function rest(path, options = {}) {
  return request(`/rest/v1${path}`, options);
}

/* ------------------------------ Supabase Auth ----------------------------- */

export function gotrue(path, options = {}) {
  return request(`/auth/v1${path}`, { ...options, key: options.key || SERVICE_KEY || SUPABASE_PUBLISHABLE_KEY });
}

/** Crée (ou met à jour) l'utilisateur correspondant dans Supabase Auth. */
export async function syncAuthUser({ email, password, name, metadata = {} }) {
  if (!supabaseAuthEnabled || !email) return null;
  try {
    const created = await gotrue('/admin/users', {
      method: 'POST',
      body: {
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: name ?? null, ...metadata },
        app_metadata: { provider: 'email', providers: ['email'] },
      },
    });
    return created?.id ?? null;
  } catch (error) {
    // 422 : l'utilisateur existe déjà → on resynchronise le mot de passe.
    const existing = await findAuthUser(email);
    if (!existing) throw error;
    if (password) await updateAuthPassword(existing, password);
    return existing;
  }
}

export async function findAuthUser(email) {
  if (!supabaseAuthEnabled || !email) return null;
  try {
    const users = await gotrue(`/admin/users?filter=${encodeURIComponent(email)}&per_page=20`);
    const list = Array.isArray(users) ? users : users?.users ?? [];
    const match = list.find((user) => String(user.email ?? '').toLowerCase() === String(email).toLowerCase());
    return match?.id ?? null;
  } catch {
    return null;
  }
}

export async function updateAuthPassword(userId, password) {
  if (!supabaseAuthEnabled || !userId) return false;
  try {
    await gotrue(`/admin/users/${userId}`, { method: 'PUT', body: { password } });
    return true;
  } catch {
    return false;
  }
}

export async function deleteAuthUser(userId) {
  if (!supabaseAuthEnabled || !userId) return false;
  try {
    await gotrue(`/admin/users/${userId}`, { method: 'DELETE' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Demande l'envoi d'un e-mail de réinitialisation **réel** par Supabase.
 * Supabase envoie un lien qui revient sur `redirectTo` avec les jetons
 * en fragment (#access_token=…&type=recovery).
 */
export async function requestPasswordRecovery(email, redirectTo) {
  if (!supabaseAuthEnabled) return { sent: false, reason: 'supabase-not-configured' };
  const query = redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : '';
  try {
    await gotrue(`/recover${query}`, { method: 'POST', body: { email } });
    return { sent: true };
  } catch (error) {
    return { sent: false, reason: error.message };
  }
}

/** Vérifie un jeton d'accès Supabase et renvoie l'utilisateur associé. */
export async function userFromAccessToken(accessToken) {
  if (!supabaseAuthEnabled || !accessToken) return null;
  try {
    return await gotrue('/user', { headers: { Authorization: `Bearer ${accessToken}` } });
  } catch {
    return null;
  }
}

export async function setPasswordWithAccessToken(accessToken, password) {
  if (!supabaseAuthEnabled) return false;
  try {
    await gotrue('/user', {
      method: 'PUT',
      body: { password },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return true;
  } catch {
    return false;
  }
}

/* -------------------------------- Journal -------------------------------- */

export async function logEvent(kind, detail = {}) {
  if (!supabaseConfigured) return;
  try {
    await rest('/access_events', {
      method: 'POST',
      body: { kind, detail },
      headers: { Prefer: 'return=minimal' },
    });
  } catch {
    /* le journal ne doit jamais bloquer une requête */
  }
}

export function supabaseStatus() {
  return {
    configured: supabaseConfigured,
    url: SUPABASE_URL || null,
    project: SUPABASE_URL ? SUPABASE_URL.replace(/^https?:\/\//, '').split('.')[0] : null,
    auth: supabaseAuthEnabled,
    storage: supabaseConfigured,
  };
}
