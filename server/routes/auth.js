import { Router } from 'express';
import { z } from 'zod';
import { get, run, now } from '../db.js';
import {
  verifyPassword, createSession, destroySession, sessionCookie, clearCookie, requireAuth,
} from '../auth.js';
import { parseBody, asyncHandler, HttpError, badRequest } from '../helpers.js';

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

  const { token, expiresAt } = createSession(user.id);
  res.setHeader('Set-Cookie', sessionCookie(token));
  res.json({
    user: {
      id: user.id, email: user.email, name: user.name, role: user.role,
      phone: user.phone, title: user.title, avatarColor: user.avatar_color,
    },
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
  res.json({ user });
});

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
  res.json({ ok: true });
}));

export default router;
