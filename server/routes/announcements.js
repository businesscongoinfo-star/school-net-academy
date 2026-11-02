import { Router } from 'express';
import { z } from 'zod';
import { all, get, run, now, uid } from '../db.js';
import { parseBody, asyncHandler, notFound, forbidden, badRequest } from '../helpers.js';

const router = Router();

const schema = z.object({
  title: z.string().min(4, "Titre de l'annonce requis.").max(160),
  body: z.string().min(10, 'Le message doit contenir au moins 10 caractères.').max(4000),
  audience: z.enum(['tous', 'parents', 'enseignants', 'eleves']).default('tous'),
  status: z.enum(['publie', 'brouillon']).default('publie'),
});

const AUDIENCE_FOR_ROLE = { parent: ['tous', 'parents'], teacher: ['tous', 'enseignants'], admin: null };

router.get('/', asyncHandler(async (req, res) => {
  const { search = '', status = '' } = req.query;
  const filters = ['1 = 1'];
  const params = [];
  if (search) {
    filters.push('(a.title LIKE ? OR a.body LIKE ?)');
    const q = `%${search}%`;
    params.push(q, q);
  }
  if (status && req.user.role !== 'parent') { filters.push('a.status = ?'); params.push(status); }

  const allowed = AUDIENCE_FOR_ROLE[req.user.role];
  if (allowed) {
    filters.push(`a.status = 'publie' AND a.audience IN (${allowed.map(() => '?').join(',')})`);
    params.push(...allowed);
  }

  const items = all(
    `SELECT a.id, a.title, a.body, a.audience, a.status, a.published_at AS publishedAt,
            a.created_at AS createdAt, u.name AS authorName, u.avatar_color AS authorColor
       FROM announcements a LEFT JOIN users u ON u.id = a.author_id
      WHERE ${filters.join(' AND ')}
      ORDER BY COALESCE(a.published_at, a.created_at) DESC`,
    ...params,
  );

  res.json({
    items,
    canManage: req.user.role === 'admin',
    stats: {
      total: items.length,
      publies: items.filter((a) => a.status === 'publie').length,
      brouillons: items.filter((a) => a.status === 'brouillon').length,
    },
  });
}));

router.post('/', asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw forbidden();
  const data = parseBody(schema, req.body);
  const id = uid('ann');
  const ts = now();
  run(
    `INSERT INTO announcements (id, title, body, audience, status, author_id, published_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, data.title, data.body, data.audience, data.status, req.user.id,
    data.status === 'publie' ? ts : null, ts, ts,
  );
  res.status(201).json({ announcement: get('SELECT * FROM announcements WHERE id = ?', id) });
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw forbidden();
  const existing = get('SELECT * FROM announcements WHERE id = ?', req.params.id);
  if (!existing) throw notFound('Annonce introuvable.');
  const data = parseBody(schema.partial(), req.body);
  const fields = [];
  const params = [];
  for (const key of ['title', 'body', 'audience', 'status']) {
    if (data[key] !== undefined) { fields.push(`${key} = ?`); params.push(data[key]); }
  }
  if (data.status === 'publie' && !existing.published_at) { fields.push('published_at = ?'); params.push(now()); }
  if (data.status === 'brouillon') { fields.push('published_at = ?'); params.push(null); }
  if (!fields.length) throw badRequest('Aucune modification fournie.');
  fields.push('updated_at = ?');
  params.push(now(), req.params.id);
  run(`UPDATE announcements SET ${fields.join(', ')} WHERE id = ?`, ...params);
  res.json({ announcement: get('SELECT * FROM announcements WHERE id = ?', req.params.id) });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw forbidden();
  if (!get('SELECT id FROM announcements WHERE id = ?', req.params.id)) throw notFound('Annonce introuvable.');
  run('DELETE FROM announcements WHERE id = ?', req.params.id);
  res.json({ ok: true });
}));

export default router;
