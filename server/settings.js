/**
 * Réglages applicatifs modifiables depuis l'espace super administrateur
 * (fournisseur e-mail, expéditeur, intégrations). Stockés en base
 * (table `app_settings`) et donc persistés avec l'état de l'application.
 */
import { all, get, run, now } from './db.js';

export function getSetting(key, fallback = null) {
  const row = get('SELECT value FROM app_settings WHERE key = ?', key);
  if (!row) return fallback;
  try { return JSON.parse(row.value); } catch { return row.value; }
}

export function setSetting(key, value) {
  run(
    `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    key, JSON.stringify(value ?? null), now(),
  );
  return value;
}

export function deleteSetting(key) {
  run('DELETE FROM app_settings WHERE key = ?', key);
}

export function publicSettings() {
  const rows = all('SELECT key, value, updated_at FROM app_settings ORDER BY key');
  return rows.map((row) => {
    let value = null;
    try { value = JSON.parse(row.value); } catch { value = row.value; }
    return { key: row.key, value: redact(value), updatedAt: row.updated_at };
  });
}

const SECRET_FIELDS = ['pass', 'password', 'apiKey', 'secret', 'token'];

function redact(value) {
  if (!value || typeof value !== 'object') return value;
  const out = { ...value };
  for (const field of SECRET_FIELDS) {
    if (out[field]) out[field] = `•••${String(out[field]).slice(-4)}`;
  }
  return out;
}

/**
 * Réglages e-mail : la base (interface d'administration) est prioritaire sur
 * les variables d'environnement, pour permettre une mise en route sans redéploiement.
 */
export function mailConfig() {
  const stored = getSetting('mail', {}) || {};
  const envFrom = process.env.MAIL_FROM || stored.from || 'School Net Academy <no-reply@schoolnet.academy>';
  const provider = stored.provider
    || (stored.smtpHost || process.env.SMTP_HOST ? 'smtp' : '')
    || (stored.apiKey || process.env.RESEND_API_KEY ? 'resend' : '');

  return {
    provider,
    from: envFrom,
    replyTo: process.env.MAIL_REPLY_TO || stored.replyTo || 'businesscongo.inf@gmail.com',
    resendApiKey: stored.apiKey || process.env.RESEND_API_KEY || '',
    smtp: {
      host: stored.smtpHost || process.env.SMTP_HOST || '',
      port: Number(stored.smtpPort || process.env.SMTP_PORT || 587),
      secure: Boolean(stored.smtpSecure ?? Number(process.env.SMTP_PORT || 587) === 465),
      user: stored.smtpUser || process.env.SMTP_USER || '',
      pass: stored.smtpPass || process.env.SMTP_PASS || '',
    },
  };
}

export function smsConfig() {
  const stored = getSetting('sms', {}) || {};
  return {
    url: stored.url || process.env.SMS_API_URL || '',
    apiKey: stored.apiKey || process.env.SMS_API_KEY || '',
    sender: stored.sender || process.env.SMS_SENDER || 'SchoolNet',
  };
}

/**
 * Assistant IA : clé OpenAI + modèle. La clé saisie dans l'interface prend le
 * pas sur `OPENAI_API_KEY`, ce qui permet d'activer l'assistant sans redéploiement.
 */
export function aiConfig() {
  const stored = getSetting('ai', {}) || {};
  const apiKey = stored.apiKey || process.env.OPENAI_API_KEY || '';
  return {
    apiKey,
    // Empreinte affichable (jamais la clé complète) : « ••••nSQA ».
    hint: apiKey ? `••••${String(apiKey).slice(-4)}` : null,
    model: stored.model || process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: Number(stored.temperature ?? 0.5),
    maxTokens: Number(stored.maxTokens ?? 400),
    lastCheck: stored.lastCheck || null,
    source: stored.apiKey ? 'interface' : (process.env.OPENAI_API_KEY ? 'environnement' : null),
    origin: stored.apiKey ? 'settings' : (process.env.OPENAI_API_KEY ? 'env' : null),
  };
}

export function aiReady() {
  return Boolean(aiConfig().apiKey);
}

/** SMTP « prêt » = hôte + identifiants (ou Resend avec clé). */
export function mailReady() {
  const config = mailConfig();
  if (config.provider === 'resend') return Boolean(config.resendApiKey);
  if (config.provider === 'smtp') return Boolean(config.smtp.host && config.smtp.user && config.smtp.pass);
  return false;
}
