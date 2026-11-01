import { Router } from 'express';
import { z } from 'zod';
import { all, get, run, now, uid } from '../db.js';
import { parseBody, asyncHandler, notFound, conflict, forbidden, badRequest } from '../helpers.js';

const router = Router();

const schema = z.object({
  firstName: z.string().min(2, 'Prénom requis.').max(60),
  lastName: z.string().min(2, 'Nom requis.').max(60),
  email: z.string().min(5, 'E-mail requis.').max(160),
  phone: z.string().max(40).nullable().optional(),
  subject: z.string().min(2, 'Matière requise.').max(60),
  status: z.enum(['actif', 'conge', 'parti']).default('actif'),
  hiredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format AAAA-MM-JJ.').nullable().optional(),
  notes: z.string().max(600).nullable().optional(),
});

router.get('/', asyncHandler(async (req, res) => {
  if (req.user.role === 'parent') throw forbidden();
  const { search = '', status = '', subject = '' } = req.query;
  const filters = ['1 = 1'];
  const params = [];
  if (search) {
    filters.push('(t.first_name LIKE ? OR t.last_name LIKE ? OR t.email LIKE ?)');
    const q = `%${search}%`;
    params.push(q, q, q);
  }
  if (status) { filters.push('t.status = ?'); params.push(status); }
  if (subject) { filters.push('t.subject = ?'); params.push(subject); }

  const items = all(
    `SELECT t.id, t.first_name AS firstName, t.last_name AS lastName, t.email, t.phone, t.subject,
            t.status, t.hired_at AS hiredAt, t.notes, t.created_at AS createdAt,
            (SELECT COUNT(*) FROM classes c WHERE c.teacher_id = t.id) AS classCount,
            (SELECT COUNT(*) FROM courses co WHERE co.teacher_id = t.id) AS courseCount
       FROM teachers t WHERE ${filters.join(' AND ')}
      ORDER BY t.last_name COLLATE NOCASE`,
    ...params,
  );
  res.json({
    items,
    stats: {
      total: items.length,
      actifs: items.filter((t) => t.status === 'actif').length,
      conge: items.filter((t) => t.status === 'conge').length,
      matieres: new Set(items.map((t) => t.subject)).size,
    },
  });
}));

router.post('/', asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw forbidden();
  const data = parseBody(schema, req.body);
  const id = uid('tch');
  const ts = now();
  run(
    `INSERT INTO teachers (id, first_name, last_name, email, phone, subject, status, hired_at, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, data.firstName, data.lastName, data.email.toLowerCase(), data.phone ?? null, data.subject,
    data.status, data.hiredAt ?? null, data.notes ?? null, ts, ts,
  );
  res.status(201).json({ teacher: get('SELECT * FROM teachers WHERE id = ?', id) });
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw forbidden();
  if (!get('SELECT id FROM teachers WHERE id = ?', req.params.id)) throw notFound('Enseignant introuvable.');
  const data = parseBody(schema.partial(), req.body);
  const map = {
    firstName: 'first_name', lastName: 'last_name', email: 'email', phone: 'phone', subject: 'subject',
    status: 'status', hiredAt: 'hired_at', notes: 'notes',
  };
  const fields = [];
  const params = [];
  for (const [key, column] of Object.entries(map)) {
    if (data[key] !== undefined) {
      fields.push(`${column} = ?`);
      params.push(data[key] ?? null);
    }
  }
  if (!fields.length) throw badRequest('Aucune modification fournie.');
  fields.push('updated_at = ?');
  params.push(now(), req.params.id);
  run(`UPDATE teachers SET ${fields.join(', ')} WHERE id = ?`, ...params);
  res.json({ teacher: get('SELECT * FROM teachers WHERE id = ?', req.params.id) });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw forbidden();
  if (!get('SELECT id FROM teachers WHERE id = ?', req.params.id)) throw notFound('Enseignant introuvable.');
  const cls = get('SELECT COUNT(*) AS c FROM classes WHERE teacher_id = ?', req.params.id).c;
  if (cls > 0) throw conflict(`Cet enseignant est titulaire de ${cls} classe(s). Désignez un remplaçant d'abord.`);
  run('DELETE FROM teachers WHERE id = ?', req.params.id);
  res.json({ ok: true });
}));

export default router;
