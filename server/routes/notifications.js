import { Router } from 'express';
import { z } from 'zod';
import { all, get, run, now, uid } from '../db.js';
import { parseBody, asyncHandler, notFound } from '../helpers.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

const row = (item) => ({
  id: item.id,
  kind: item.kind,
  title: item.title,
  body: item.body,
  link: item.link,
  readAt: item.read_at,
  createdAt: item.created_at,
});

router.get('/', asyncHandler(async (req, res) => {
  const items = all(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 40',
    req.user.id,
  );
  const unread = get('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read_at IS NULL', req.user.id);
  res.json({ items: items.map(row), unread: unread?.c ?? 0 });
}));

router.post('/:id/read', asyncHandler(async (req, res) => {
  const item = get('SELECT * FROM notifications WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
  if (!item) throw notFound('Notification introuvable.');
  run('UPDATE notifications SET read_at = ? WHERE id = ?', item.read_at ?? now(), item.id);
  res.json({ ok: true });
}));

router.post('/read-all', asyncHandler(async (req, res) => {
  run('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL', now(), req.user.id);
  res.json({ ok: true });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  run('DELETE FROM notifications WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
  res.json({ ok: true });
}));

export default router;
