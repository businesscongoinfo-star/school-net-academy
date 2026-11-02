import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { get, run, now, uid } from '../db.js';
import {
  verifyPassword, createSession, destroySession, sessionCookie, clearCookie, requireAuth, parseCookies,
} from '../auth.js';
import { parseBody, asyncHandler, HttpError, badRequest } from '../helpers.js';
import { tenantPublic, accessState, tenantOf } from '../platform.js';
import {
  supabaseAuthEnabled, requestPasswordRecovery, userFromAccessToken, setPasswordWithAccessToken,
  syncAuthUser, updateAuthPassword, logEvent,
} from '../supabase.js';
import { sendMail, resetEmail, passwordChangedEmail } from '../mailer.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().min(3, 'Adresse e-mail requise.').max(160),
  password: z.string().min(1, 'Mot de passe requis.'),
});

const attempts = new Map();

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = parseBody(loginSchema, req.body);
  const key = email.toLowerCase().trim();
  const record = attempts.get(key) ?? { count: 0, since: Date.now() };
  if (record.count >= 8 && Date.now() - record.since < 5 * 60 * 1000) {
    throw new HttpError(429, 'Trop de tentatives. Réessayez dans quelques minutes.');
  }

  const user = get('SELECT * FROM users WHERE lower(email) = ?', key);
  if (!user || !verifyPassword(password, user.password_hash)) {
    attempts.set(key, { count: record.count + 1, since: record.count ? record.since : Date.now() });
    throw new HttpError(401, 'Identifiants incorrects. Vérifiez votre e-mail et votre mot de passe.');
  }
  attempts.delete(key);

  run('UPDATE users SET last_login_at = ? WHERE id = ?', now(), user.id);
  // Miroir Supabase Auth (asynchrone) : garantit qu'un e-mail de réinitialisation
  // pourra être envoyé à ce compte, même s'il a été créé avant l'intégration.
  if (supabaseAuthEnabled) {
    syncAuthUser({ email: user.email, password, name: user.name }).catch(() => {});
    logEvent('login', { email: user.email, platform: process.env.VERCEL ? 'vercel' : 'node' });
  }
  const { token, expiresAt } = createSession(user.id);
  res.setHeader('Set-Cookie', sessionCookie(token));
  const tenant = tenantOf(user) ? tenantPublic(tenantOf(user)) : null;
  res.json({
    user: {
      id: user.id, email: user.email, name: user.name, role: user.role,
      phone: user.phone, title: user.title, avatarColor: user.avatar_color,
      platformRole: user.platform_role ?? null,
      tenant,
    },
    access: accessState(tenant ? tenantOf(user) : null),
    expiresAt,
  });
}));

router.post('/logout', (req, res) => {
  const cookie = req.headers.cookie ?? '';
  const match = cookie.match(/sna_session=([^;]+)/);
  if (match) destroySession(decodeURIComponent(match[1]));
  res.setHeader('Set-Cookie', clearCookie());
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  const { token, ...user } = req.user;
  void token;
  const tenant = user.tenantId ? tenantOf(user) : null;
  res.json({
    user: { ...user, tenant: tenantPublic(tenant) },
    access: accessState(tenant),
  });
});

/**
 * Mot de passe oublié — envoi d'un e-mail réel.
 *  1. Supabase Auth envoie son e-mail de récupération (fonctionne sans SMTP propre,
 *     quota du service intégré).
 *  2. Si un fournisseur e-mail est configuré (Resend/SMTP), on envoie aussi notre
 *     gabarit de marque avec un jeton maison (30 min, usage unique).
 * Le lien n'est JAMAIS renvoyé dans la réponse HTTP en production.
 */
router.post('/forgot', asyncHandler(async (req, res) => {
  const data = parseBody(z.object({ email: z.string().min(4).max(160) }), req.body);
  const email = data.email.toLowerCase().trim();
  const user = get('SELECT id, email, name FROM users WHERE lower(email) = ?', email);
  const generic = {
    ok: true,
    message: "Si un compte existe pour cette adresse, un lien de réinitialisation vient d'être envoyé par e-mail.",
  };
  if (!user) { res.json(generic); return; }

  const origin = baseUrl(req);
  const token = crypto.randomBytes(24).toString('hex');
  const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  run('INSERT INTO password_resets (token, user_id, expires_at, used_at, created_at) VALUES (?, ?, ?, NULL, ?)',
    token, user.id, expires, now());

  const localLink = `${origin}/reinitialiser?token=${token}`;
  const results = { sent: false, supabase: false, mail: false };

  if (supabaseAuthEnabled) {
    const recovery = await requestPasswordRecovery(email, `${origin}/reinitialiser`);
    results.supabase = recovery.sent;
    results.sent = results.sent || recovery.sent;
  }

  const mail = await sendMail({
    to: email,
    kind: 'reinitialisation',
    ...resetEmail({ name: user.name, link: localLink, minutes: 30 }),
  });
  results.mail = mail.status === 'envoye';
  results.sent = results.sent || results.mail;
  await logEvent('password_recovery', { email, ...results });

  // Lien de secours uniquement hors production (développement local / démo).
  const allowLink = process.env.NODE_ENV !== 'production' || process.env.ALLOW_RESET_LINK === '1';
  res.json({
    ...generic,
    delivered: results.sent,
    channels: results,
    ...(allowLink ? { resetPath: `/reinitialiser?token=${token}`, expiresAt: expires } : {}),
  });
}));

router.post('/reset', asyncHandler(async (req, res) => {
  const data = parseBody(z.object({
    token: z.string().min(10, 'Lien invalide.'),
    password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères.').max(120),
  }), req.body);
  const row = get('SELECT * FROM password_resets WHERE token = ?', data.token);
  if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) {
    throw badRequest('Ce lien de réinitialisation est invalide ou expiré. Demandez-en un nouveau.');
  }
  const { hashPassword } = await import('../auth.js');
  run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', hashPassword(data.password), now(), row.user_id);
  run('UPDATE password_resets SET used_at = ? WHERE token = ?', now(), data.token);
  const owner = get('SELECT email, name FROM users WHERE id = ?', row.user_id);
  if (owner) {
    await sendMail({ to: owner.email, kind: 'securite', ...passwordChangedEmail({ name: owner.name }) });
    if (supabaseAuthEnabled) {
      const authId = await syncAuthUser({ email: owner.email, password: data.password, name: owner.name }).catch(() => null);
      if (authId) await updateAuthPassword(authId, data.password);
    }
  }
  res.json({ ok: true, message: 'Mot de passe mis à jour. Vous pouvez vous connecter.' });
}));

/**
 * Finalise une réinitialisation initiée par Supabase : le lien reçu par e-mail
 * revient sur `/reinitialiser#access_token=…`. Le client transmet ce jeton, le
 * serveur vérifie l'identité auprès de Supabase puis met à jour le mot de passe
 * applicatif ET celui de Supabase Auth.
 */
router.post('/reset-supabase', asyncHandler(async (req, res) => {
  const data = parseBody(z.object({
    accessToken: z.string().min(20, 'Jeton invalide.'),
    password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères.').max(120),
  }), req.body);

  const supaUser = await userFromAccessToken(data.accessToken);
  const email = String(supaUser?.email ?? '').toLowerCase().trim();
  if (!email) throw badRequest('Ce lien de réinitialisation est invalide ou a expiré. Demandez-en un nouveau.');

  const user = get('SELECT * FROM users WHERE lower(email) = ?', email);
  if (!user) throw badRequest("Aucun compte School Net Academy n'est associé à cette adresse.");

  const { hashPassword } = await import('../auth.js');
  run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', hashPassword(data.password), now(), user.id);
  await setPasswordWithAccessToken(data.accessToken, data.password);
  await updateAuthPassword(supaUser.id, data.password);
  await logEvent('password_reset', { email, channel: 'supabase' });
  res.json({ ok: true, email, message: 'Mot de passe mis à jour. Vous pouvez vous connecter.' });
}));

/**
 * Connexion sociale (OAuth 2.0).
 * - `GET /auth/oauth/:provider` renvoie l'URL d'autorisation (JSON) et redirige le navigateur.
 * - `GET /auth/oauth/:provider/callback` échange le code, récupère l'e-mail puis ouvre la session.
 * Les identifiants restent en variables d'environnement :
 *   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET, FACEBOOK_APP_ID / FACEBOOK_APP_SECRET.
 */

const OAUTH = {
  google: {
    label: 'Google',
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile',
    clientId: () => process.env.GOOGLE_CLIENT_ID,
    clientSecret: () => process.env.GOOGLE_CLIENT_SECRET,
    envHint: 'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET',
  },
  facebook: {
    label: 'Facebook',
    authorize: 'https://www.facebook.com/v19.0/dialog/oauth',
    token: 'https://graph.facebook.com/v19.0/oauth/access_token',
    scope: 'email public_profile',
    clientId: () => process.env.FACEBOOK_APP_ID,
    clientSecret: () => process.env.FACEBOOK_APP_SECRET,
    envHint: 'FACEBOOK_APP_ID / FACEBOOK_APP_SECRET',
  },
};

const baseUrl = (req) => (process.env.APP_URL ?? `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');

function providerConfig(provider) {
  const config = OAUTH[provider];
  if (!config) return null;
  const clientId = config.clientId();
  const clientSecret = config.clientSecret();
  return clientId && clientSecret ? { ...config, clientId, clientSecret } : { ...config, clientId: null, clientSecret: null };
}

function oauthRedirectUri(req, provider) {
  return `${baseUrl(req)}/api/auth/oauth/${provider}/callback`;
}

function oauthStateCookie(state) {
  return `sna_oauth=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}

function authorizeUrl(req, provider, config) {
  const state = crypto.randomBytes(16).toString('hex');
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: oauthRedirectUri(req, provider),
    response_type: 'code',
    scope: config.scope,
    state,
  });
  if (provider === 'google') {
    params.set('access_type', 'offline');
    params.set('prompt', 'select_account');
  }
  return { url: `${config.authorize}?${params.toString()}`, state };
}

/**
 * Entrée dans l'espace d'un établissement depuis la super administration
 * (jeton à usage unique de 15 minutes). Ouvre une session au nom du responsable
 * pour accompagner le paramétrage initial ou le support.
 */
router.get('/impersonate', asyncHandler(async (req, res) => {
  const token = String(req.query.token ?? '');
  const row = token ? get('SELECT * FROM impersonation_tokens WHERE token = ?', token) : null;
  if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) {
    res.status(410).send(`<!doctype html><meta charset="utf-8"><title>Lien expiré</title>
      <body style="font-family:system-ui;padding:48px;max-width:520px;margin:auto">
        <h1 style="font-size:20px">Lien expiré</h1>
        <p>Ce lien d'accès est invalide ou a déjà été utilisé. Relancez l'action depuis la super administration.</p>
        <p><a href="/plateforme">Retour à la super administration</a></p>
      </body>`);
    return;
  }
  run('UPDATE impersonation_tokens SET used_at = ? WHERE token = ?', now(), token);
  run('UPDATE users SET last_login_at = ? WHERE id = ?', now(), row.user_id);
  const { token: session } = createSession(row.user_id);
  res.setHeader('Set-Cookie', sessionCookie(session));
  await logEvent('impersonation_used', { tenantId: row.tenant_id, user: row.user_id, by: row.created_by });
  res.redirect('/app');
}));

router.get('/oauth/:provider', (req, res) => {
  const provider = String(req.params.provider);
  const config = providerConfig(provider);
  if (!config) {
    res.status(404).json({ error: 'Fournisseur de connexion inconnu.', configured: false });
    return;
  }
  if (!config.clientId) {
    const hint = `Renseignez ${config.envHint} sur le serveur (ou dans les variables d'environnement Vercel), puis réessayez. En attendant, la connexion par e-mail reste disponible.`;
    res.status(501).json({
      error: `La connexion ${config.label} n'est pas encore configurée sur cette installation.`,
      hint,
      details: { hint },
      configured: false,
      provider,
    });
    return;
  }
  const { url, state } = authorizeUrl(req, provider, config);
  res.setHeader('Set-Cookie', oauthStateCookie(state));
  if (String(req.query.redirect ?? '') === '1') {
    res.redirect(url);
    return;
  }
  res.json({ ok: true, provider, url, configured: true });
});

/** Variante POST utilisée par le formulaire de connexion (évite la navigation directe). */
router.post('/oauth/:provider', (req, res) => {
  const provider = String(req.params.provider);
  const config = providerConfig(provider);
  if (!config) {
    res.status(404).json({ error: 'Fournisseur de connexion inconnu.', configured: false });
    return;
  }
  if (!config.clientId) {
    const hint = `Renseignez ${config.envHint} sur le serveur (ou dans les variables d'environnement Vercel), puis réessayez. En attendant, la connexion par e-mail reste disponible.`;
    res.status(501).json({
      error: `La connexion ${config.label} n'est pas encore configurée sur cette installation.`,
      hint,
      details: { hint },
      configured: false,
      provider,
    });
    return;
  }
  const { url, state } = authorizeUrl(req, provider, config);
  res.setHeader('Set-Cookie', oauthStateCookie(state));
  res.json({ ok: true, provider, url, configured: true });
});

async function fetchProfile(provider, config, code, req) {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: oauthRedirectUri(req, provider),
  });
  const tokenRes = await fetch(config.token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
  });
  const token = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !token.access_token) {
    throw new Error(token.error_description ?? token.error ?? 'Échange du jeton impossible.');
  }

  if (provider === 'google') {
    const info = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!info.ok) throw new Error('Profil Google illisible.');
    const profile = await info.json();
    return { email: profile.email, name: profile.name ?? profile.email, avatar: null };
  }

  const info = await fetch(
    `https://graph.facebook.com/me?fields=id,name,email&access_token=${encodeURIComponent(token.access_token)}`,
  );
  if (!info.ok) throw new Error('Profil Facebook illisible.');
  const profile = await info.json();
  if (!profile.email) throw new Error("Facebook n'a pas partagé d'adresse e-mail.");
  return { email: profile.email, name: profile.name ?? profile.email, avatar: null };
}

router.get('/oauth/:provider/callback', asyncHandler(async (req, res) => {
  const provider = String(req.params.provider);
  const config = providerConfig(provider);
  const page = (message) => `<!doctype html><meta charset="utf-8"><title>Connexion…</title>
    <body style="font-family:system-ui;padding:48px;max-width:520px;margin:auto">
      <h1 style="font-size:20px">Connexion sociale</h1><p>${message}</p>
      <p><a href="/connexion">Retour à la connexion</a></p>
      <script>setTimeout(function(){location.href='/connexion'},3500)</script>
    </body>`;

  if (!config?.clientId) {
    res.status(501).send(page(`${config?.label ?? 'Ce fournisseur'} n'est pas configuré sur cette installation.`));
    return;
  }
  if (req.query.error) {
    res.status(400).send(page('Autorisation refusée.'));
    return;
  }
  const cookies = parseCookies(req.headers.cookie);
  if (!req.query.state || req.query.state !== cookies.sna_oauth) {
    res.status(400).send(page('État OAuth invalide. Relancez la connexion.'));
    return;
  }
  if (!req.query.code) {
    res.status(400).send(page('Code d’autorisation manquant.'));
    return;
  }

  try {
    const profile = await fetchProfile(provider, config, String(req.query.code), req);
    const email = String(profile.email ?? '').toLowerCase().trim();
    const user = email ? get('SELECT * FROM users WHERE lower(email) = ?', email) : null;
    if (!user) {
      res.redirect(`${baseUrl(req)}/inscription?email=${encodeURIComponent(email)}&social=${provider}`);
      return;
    }
    const session = createSession(user.id);
    run('UPDATE users SET last_login_at = ? WHERE id = ?', now(), user.id);
    res.setHeader('Set-Cookie', [sessionCookie(session.token), 'sna_oauth=; Path=/; HttpOnly; Max-Age=0']);
    res.redirect(`${baseUrl(req)}/app`);
  } catch (error) {
    res.status(502).send(page(`Connexion impossible : ${String(error.message ?? error)}`));
  }
}));

router.patch('/profile', requireAuth, asyncHandler(async (req, res) => {
  const data = parseBody(z.object({
    name: z.string().min(2, 'Nom trop court.').max(80).optional(),
    email: z.string().min(5).max(160).optional(),
    phone: z.string().max(40).nullable().optional(),
    title: z.string().max(80).nullable().optional(),
  }), req.body);

  if (data.email) {
    const existing = get('SELECT id FROM users WHERE lower(email) = ? AND id <> ?', data.email.toLowerCase(), req.user.id);
    if (existing) throw badRequest('Cette adresse e-mail est déjà utilisée.');
  }

  const fields = [];
  const params = [];
  if (data.name !== undefined) { fields.push('name = ?'); params.push(data.name); }
  if (data.email !== undefined) { fields.push('email = ?'); params.push(data.email.toLowerCase()); }
  if (data.phone !== undefined) { fields.push('phone = ?'); params.push(data.phone); }
  if (data.title !== undefined) { fields.push('title = ?'); params.push(data.title); }
  fields.push('updated_at = ?'); params.push(now());
  params.push(req.user.id);
  run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, ...params);

  const user = get('SELECT id, email, name, role, phone, title, avatar_color AS avatarColor FROM users WHERE id = ?', req.user.id);
  res.json({ user });
}));

router.post('/password', requireAuth, asyncHandler(async (req, res) => {
  const data = parseBody(z.object({
    currentPassword: z.string().min(1, 'Mot de passe actuel requis.'),
    newPassword: z.string().min(8, 'Le nouveau mot de passe doit contenir au moins 8 caractères.'),
  }), req.body);

  const row = get('SELECT password_hash FROM users WHERE id = ?', req.user.id);
  if (!verifyPassword(data.currentPassword, row.password_hash)) {
    throw badRequest('Le mot de passe actuel est incorrect.');
  }
  const { hashPassword } = await import('../auth.js');
  run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', hashPassword(data.newPassword), now(), req.user.id);
  if (supabaseAuthEnabled) {
    const authId = await syncAuthUser({ email: req.user.email, password: data.newPassword, name: req.user.name }).catch(() => null);
    if (!authId) await updateAuthPassword(authId, data.newPassword);
  }
  await sendMail({ to: req.user.email, kind: 'securite', ...passwordChangedEmail({ name: req.user.name }) });
  res.json({ ok: true });
}));

export default router;
