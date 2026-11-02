import { Router } from 'express';
import { z } from 'zod';
import { all, get, run, now, uid } from '../db.js';
import { parseBody, asyncHandler, notFound, forbidden, badRequest } from '../helpers.js';

const router = Router();

const schema = z.object({
  title: z.string().min(4, 'Titre du cours requis.').max(140),
  subject: z.string().min(2, 'Matière requise.').max(60),
  level: z.string().min(1, 'Niveau requis.').max(30),
  teacherId: z.string().nullable().optional(),
  status: z.enum(['publie', 'brouillon', 'archive']).default('brouillon'),
  lessonsCount: z.coerce.number().int().min(0).max(300).default(0),
  durationHours: z.coerce.number().int().min(0).max(500).default(0),
  description: z.string().max(1000).nullable().optional(),
  color: z.string().max(20).nullable().optional(),
});

router.get('/', asyncHandler(async (req, res) => {
  const { search = '', status = '', level = '' } = req.query;
  const filters = ['1 = 1'];
  const params = [];
  const isTeacher = req.user.role === 'teacher';
  if (search) {
    filters.push('(c.title LIKE ? OR c.subject LIKE ?)');
    const q = `%${search}%`;
    params.push(q, q);
  }
  if (status) { filters.push('c.status = ?'); params.push(status); }
  if (level) { filters.push('c.level = ?'); params.push(level); }

  const items = all(
    `SELECT c.id, c.title, c.subject, c.level, c.teacher_id AS teacherId, c.status,
            c.lessons_count AS lessonsCount, c.duration_hours AS durationHours,
            c.enrolled_count AS enrolledCount, c.description, c.color, c.created_at AS createdAt,
            t.first_name || ' ' || t.last_name AS teacherName
       FROM courses c LEFT JOIN teachers t ON t.id = c.teacher_id
      WHERE ${filters.join(' AND ')}
      ORDER BY c.updated_at DESC`,
    ...params,
  );

  res.json({
    items,
    canManage: req.user.role === 'admin' || isTeacher,
    stats: {
      total: items.length,
      publies: items.filter((c) => c.status === 'publie').length,
      brouillons: items.filter((c) => c.status === 'brouillon').length,
      apprenants: items.filter((c) => c.status === 'publie').reduce((s, c) => s + c.enrolledCount, 0),
    },
  });
}));

function canEdit(user) {
  return user.role === 'admin' || user.role === 'teacher';
}

router.post('/', asyncHandler(async (req, res) => {
  if (!canEdit(req.user)) throw forbidden();
  const data = parseBody(schema, req.body);
  let teacherId = data.teacherId || null;
  if (!teacherId && req.user.role === 'teacher') {
    const owner = get(
      "SELECT id FROM teachers WHERE first_name || ' ' || last_name = ? LIMIT 1",
      req.user.name,
    );
    teacherId = owner?.id ?? null;
  }
  const id = uid('crs');
  const ts = now();
  const palette = ['#0f766e', '#b45309', '#2563eb', '#7c3aed', '#15803d', '#0891b2', '#be123c', '#ca8a04'];
  run(
    `INSERT INTO courses (id, title, subject, level, teacher_id, status, lessons_count, duration_hours,
       enrolled_count, description, color, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
    id, data.title, data.subject, data.level, teacherId, data.status,
    data.lessonsCount, data.durationHours, data.description ?? null,
    data.color || palette[Math.floor(Math.random() * palette.length)], ts, ts,
  );
  res.status(201).json({ course: get('SELECT * FROM courses WHERE id = ?', id) });
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  if (!canEdit(req.user)) throw forbidden();
  if (!get('SELECT id FROM courses WHERE id = ?', req.params.id)) throw notFound('Cours introuvable.');
  const data = parseBody(schema.partial(), req.body);
  const map = {
    title: 'title', subject: 'subject', level: 'level', teacherId: 'teacher_id', status: 'status',
    lessonsCount: 'lessons_count', durationHours: 'duration_hours', description: 'description',
    color: 'color',
  };
  const fields = [];
  const params = [];
  for (const [key, column] of Object.entries(map)) {
    if (data[key] !== undefined) {
      fields.push(`${column} = ?`);
      params.push(key === 'teacherId' ? data[key] || null : data[key] ?? null);
    }
  }
  if (!fields.length) throw badRequest('Aucune modification fournie.');
  fields.push('updated_at = ?');
  params.push(now(), req.params.id);
  run(`UPDATE courses SET ${fields.join(', ')} WHERE id = ?`, ...params);
  res.json({ course: get('SELECT * FROM courses WHERE id = ?', req.params.id) });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  if (!canEdit(req.user)) throw forbidden();
  if (!get('SELECT id FROM courses WHERE id = ?', req.params.id)) throw notFound('Cours introuvable.');
  run('DELETE FROM courses WHERE id = ?', req.params.id);
  res.json({ ok: true });
}));

export default router;
