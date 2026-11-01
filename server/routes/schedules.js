import { Router } from 'express';
import { z } from 'zod';
import { all, get, run, now, uid } from '../db.js';
import { parseBody, asyncHandler, notFound, forbidden, badRequest } from '../helpers.js';

const router = Router();

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

const schema = z.object({
  title: z.string().min(2, 'Intitulé de la séance requis.').max(160),
  classId: z.string().nullable().optional(),
  programId: z.string().nullable().optional(),
  teacherId: z.string().nullable().optional(),
  room: z.string().max(60).nullable().optional(),
  day: z.enum(DAYS),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Heure attendue au format HH:MM.'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Heure attendue au format HH:MM.'),
  kind: z.enum(['Cours', 'TD', 'TP', 'Examen', 'Soutenance']).default('Cours'),
});

const SELECT = `SELECT s.id, s.title, s.class_id AS classId, s.program_id AS programId,
       s.teacher_id AS teacherId, s.room, s.day, s.start_time AS startTime, s.end_time AS endTime,
       s.kind, s.created_at AS createdAt,
       c.name AS className, p.name AS programName, p.degree,
       t.first_name || ' ' || t.last_name AS teacherName
  FROM schedules s
  LEFT JOIN classes c ON c.id = s.class_id
  LEFT JOIN programs p ON p.id = s.program_id
  LEFT JOIN teachers t ON t.id = s.teacher_id`;

router.get('/', asyncHandler(async (req, res) => {
  const { day = '', classId = '', programId = '', teacherId = '' } = req.query;
  const filters = ['1 = 1'];
  const params = [];
  if (day) { filters.push('s.day = ?'); params.push(day); }
  if (classId) { filters.push('s.class_id = ?'); params.push(classId); }
  if (programId) { filters.push('s.program_id = ?'); params.push(programId); }
  if (teacherId) { filters.push('s.teacher_id = ?'); params.push(teacherId); }

  const items = all(`${SELECT} WHERE ${filters.join(' AND ')} ORDER BY s.start_time`, ...params);
  const byDay = DAYS.reduce((acc, label) => {
    acc[label] = items.filter((item) => item.day === label).length;
    return acc;
  }, {});

  res.json({
    items,
    days: DAYS,
    stats: { total: items.length, byDay, rooms: new Set(items.map((item) => item.room).filter(Boolean)).size },
  });
}));

router.post('/', asyncHandler(async (req, res) => {
  if (req.user.role === 'parent') throw forbidden();
  const data = parseBody(schema, req.body);
  if (!data.classId && !data.programId) throw badRequest('Sélectionnez une classe ou une filière.');
  if (data.endTime <= data.startTime) throw badRequest("L'heure de fin doit être postérieure à l'heure de début.");
  const id = uid('sch');
  const ts = now();
  run(
    `INSERT INTO schedules (id, title, class_id, program_id, teacher_id, room, day, start_time, end_time,
       kind, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, data.title, data.classId || null, data.programId || null, data.teacherId || null,
    data.room ?? null, data.day, data.startTime, data.endTime, data.kind, ts, ts,
  );
  res.status(201).json({ schedule: get(`${SELECT} WHERE s.id = ?`, id) });
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  if (req.user.role === 'parent') throw forbidden();
  if (!get('SELECT id FROM schedules WHERE id = ?', req.params.id)) throw notFound('Séance introuvable.');
  const data = parseBody(schema.partial(), req.body);
  const map = {
    title: 'title', classId: 'class_id', programId: 'program_id', teacherId: 'teacher_id',
    room: 'room', day: 'day', startTime: 'start_time', endTime: 'end_time', kind: 'kind',
  };
  const fields = [];
  const params = [];
  for (const [key, column] of Object.entries(map)) {
    if (data[key] !== undefined) {
      const nullable = ['classId', 'programId', 'teacherId'].includes(key);
      fields.push(`${column} = ?`);
      params.push(nullable ? data[key] || null : data[key] ?? null);
    }
  }
  if (!fields.length) throw badRequest('Aucune modification fournie.');
  fields.push('updated_at = ?');
  params.push(now(), req.params.id);
  run(`UPDATE schedules SET ${fields.join(', ')} WHERE id = ?`, ...params);
  res.json({ schedule: get(`${SELECT} WHERE s.id = ?`, req.params.id) });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  if (req.user.role === 'parent') throw forbidden();
  if (!get('SELECT id FROM schedules WHERE id = ?', req.params.id)) throw notFound('Séance introuvable.');
  run('DELETE FROM schedules WHERE id = ?', req.params.id);
  res.json({ ok: true });
}));

export default router;
