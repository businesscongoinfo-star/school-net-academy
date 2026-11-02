import { Router } from 'express';
import { z } from 'zod';
import { all, get, run, now, uid } from '../db.js';
import { parseBody, asyncHandler, forbidden, badRequest, notFound } from '../helpers.js';

const router = Router();

const STATUSES = ['present', 'absent', 'retard', 'excuse'];
const today = () => new Date().toISOString().slice(0, 10);

const baseSelect = `SELECT a.id, a.student_id AS studentId, a.class_id AS classId, a.program_id AS programId,
       a.date, a.session, a.status, a.note, a.created_at AS createdAt,
       s.first_name AS firstName, s.last_name AS lastName, s.matricule,
       s.first_name || ' ' || s.last_name AS studentName,
       c.name AS className, p.name AS programName
  FROM attendance a
  JOIN students s ON s.id = a.student_id
  LEFT JOIN classes c ON c.id = a.class_id
  LEFT JOIN programs p ON p.id = a.program_id`;

router.get('/', asyncHandler(async (req, res) => {
  if (req.user.role === 'parent') throw forbidden();
  const { date = today(), classId = '', programId = '', session = '', status = '' } = req.query;
  const filters = ['a.date = ?'];
  const params = [date];
  if (classId) { filters.push('a.class_id = ?'); params.push(classId); }
  if (programId) { filters.push('a.program_id = ?'); params.push(programId); }
  if (session) { filters.push('a.session = ?'); params.push(session); }
  if (status) { filters.push('a.status = ?'); params.push(status); }

  const items = all(`${baseSelect} WHERE ${filters.join(' AND ')} ORDER BY s.last_name COLLATE NOCASE`, ...params);
  const counts = STATUSES.reduce((acc, key) => {
    acc[key] = items.filter((item) => item.status === key).length;
    return acc;
  }, {});
  const total = items.length;

  res.json({
    date,
    items,
    stats: {
      total,
      ...counts,
      tauxPresence: total ? Math.round(((counts.present + counts.retard) / total) * 100) : null,
    },
  });
}));

/** Pointage d'un élève (création ou mise à jour pour une date + séance). */
router.post('/mark', asyncHandler(async (req, res) => {
  if (req.user.role === 'parent') throw forbidden();
  const data = parseBody(z.object({
    studentId: z.string().min(1, 'Élève requis.'),
    date: z.string().min(8).max(10),
    session: z.string().max(20).nullable().optional(),
    status: z.enum(STATUSES),
    note: z.string().max(300).nullable().optional(),
  }), req.body);

  const student = get('SELECT id, class_id, program_id FROM students WHERE id = ?', data.studentId);
  if (!student) throw badRequest('Élève introuvable.');
  const session = data.session || 'Journée';
  const existing = get(
    'SELECT id FROM attendance WHERE student_id = ? AND date = ? AND COALESCE(session, ?) = ?',
    data.studentId, data.date, session, session,
  );

  if (existing) {
    run('UPDATE attendance SET status = ?, note = ?, updated_at = ? WHERE id = ?',
      data.status, data.note ?? null, now(), existing.id);
  } else {
    run(
      `INSERT INTO attendance (id, student_id, class_id, program_id, date, session, status, note,
         created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      uid('att'), data.studentId, student.class_id, student.program_id, data.date, session,
      data.status, data.note ?? null, now(), now(),
    );
  }

  const item = get(`${baseSelect} WHERE a.student_id = ? AND a.date = ? AND COALESCE(a.session, ?) = ?`,
    data.studentId, data.date, session, session);
  res.json({ item });
}));

/** Pointage en masse (« tout le monde présent »). */
router.post('/bulk', asyncHandler(async (req, res) => {
  if (req.user.role === 'parent') throw forbidden();
  const data = parseBody(z.object({
    date: z.string().min(8).max(10),
    session: z.string().max(20).nullable().optional(),
    status: z.enum(STATUSES),
    studentIds: z.array(z.string()).min(1, 'Aucun élève sélectionné.'),
  }), req.body);

  const session = data.session || 'Journée';
  const ts = now();
  let updated = 0;
  for (const studentId of data.studentIds) {
    const student = get('SELECT id, class_id, program_id FROM students WHERE id = ?', studentId);
    if (!student) continue;
    const existing = get(
      'SELECT id FROM attendance WHERE student_id = ? AND date = ? AND COALESCE(session, ?) = ?',
      studentId, data.date, session, session,
    );
    if (existing) {
      run('UPDATE attendance SET status = ?, updated_at = ? WHERE id = ?', data.status, ts, existing.id);
    } else {
      run(
        `INSERT INTO attendance (id, student_id, class_id, program_id, date, session, status, note,
           created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
        uid('att'), studentId, student.class_id, student.program_id, data.date, session, data.status, ts, ts,
      );
    }
    updated += 1;
  }
  res.json({ ok: true, updated });
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  if (req.user.role === 'parent') throw forbidden();
  if (!get('SELECT id FROM attendance WHERE id = ?', req.params.id)) throw notFound('Pointage introuvable.');
  const data = parseBody(z.object({
    status: z.enum(STATUSES).optional(),
    note: z.string().max(300).nullable().optional(),
  }), req.body);
  const fields = [];
  const params = [];
  if (data.status !== undefined) { fields.push('status = ?'); params.push(data.status); }
  if (data.note !== undefined) { fields.push('note = ?'); params.push(data.note ?? null); }
  if (!fields.length) throw badRequest('Aucune modification fournie.');
  fields.push('updated_at = ?');
  params.push(now(), req.params.id);
  run(`UPDATE attendance SET ${fields.join(', ')} WHERE id = ?`, ...params);
  res.json({ item: get(`${baseSelect} WHERE a.id = ?`, req.params.id) });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  if (req.user.role === 'parent') throw forbidden();
  if (!get('SELECT id FROM attendance WHERE id = ?', req.params.id)) throw notFound('Pointage introuvable.');
  run('DELETE FROM attendance WHERE id = ?', req.params.id);
  res.json({ ok: true });
}));

export default router;
