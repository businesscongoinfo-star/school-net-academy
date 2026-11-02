import crypto from 'node:crypto';
import { get, run, now } from './db.js';

const SESSION_COOKIE = 'sna_session';
const SESSION_DAYS = 30;

/**
 * En serverless (Vercel), chaque instance a sa propre base SQLite : les sessions
 * doivent donc être vérifiables sans lecture en base. `SESSION_MODE=stateless`
 * signe le jeton (HMAC-SHA256) avec `SESSION_SECRET`, partagé par toutes les instances.
 */
const STATELESS = process.env.SESSION_MODE === 'stateless';
const SECRET = process.env.SESSION_SECRET || 'school-net-academy-stateless-secret';

function signToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${mac}`;
}

function verifyToken(token) {
  const [body, mac] = String(token).split('.');
  if (!body || !mac) return null;
  const expected = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  if (mac.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload?.uid || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function selectUser(userId) {
  return get(
    `SELECT id, email, name, role, phone, title, avatar_color, platform_role, tenant_id
       FROM users WHERE id = ?`,
    userId,
  );
}

function toUser(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    phone: row.phone,
    title: row.title,
    avatarColor: row.avatar_color,
    platformRole: row.platform_role ?? null,
    tenantId: row.tenant_id ?? null,
  };
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

export function createSession(userId) {
  const created = new Date();
  const expires = new Date(created.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  if (STATELESS) {
    const token = signToken({ uid: userId, exp: expires.getTime() });
    return { token, expiresAt: expires.toISOString() };
  }
  const token = crypto.randomBytes(32).toString('hex');
  run(
    'INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
    token,
    userId,
    created.toISOString(),
    expires.toISOString(),
  );
  return { token, expiresAt: expires.toISOString() };
}

export function destroySession(token) {
  if (token && !STATELESS) run('DELETE FROM sessions WHERE token = ?', token);
}

export function parseCookies(header = '') {
  return header.split(';').reduce((acc, part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return acc;
    const key = part.slice(0, idx).trim();
    if (!key) return acc;
    acc[key] = decodeURIComponent(part.slice(idx + 1).trim());
    return acc;
  }, {});
}

export function sessionCookie(token, maxAgeSeconds = SESSION_DAYS * 24 * 60 * 60) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

export function clearCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function userFromRequest(req) {
  const token = parseCookies(req.headers.cookie).sna_session;
  if (!token) return null;

  if (STATELESS) {
    const payload = verifyToken(token);
    if (!payload) return null;
    const user = selectUser(payload.uid);
    return user ? toUser(user) : null;
  }

  const row = get(
    `SELECT u.id, u.email, u.name, u.role, u.phone, u.title, u.avatar_color,
            u.platform_role, u.tenant_id, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token = ?`,
    token,
  );
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    destroySession(token);
    return null;
  }
  return { ...toUser(row), token };
}

export function requireAuth(req, res, next) {
  const user = userFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Session expirée. Veuillez vous reconnecter.' });
  req.user = user;
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Non authentifié.' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Votre profil n'a pas accès à cette action." });
    }
    next();
  };
}

export { SESSION_COOKIE };
