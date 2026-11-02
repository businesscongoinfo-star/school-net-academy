import { Router } from 'express';
import { z } from 'zod';
import { all, get, run, now, uid } from '../db.js';
import { parseBody, asyncHandler, notFound, conflict, forbidden, badRequest, termNow } from '../helpers.js';

const router = Router();

const schema = z.object({
  name: z.string().min(2, 'Nom de classe requis.').max(40),
  level: z.string().min(1, 'Niveau requis.').max(30),
  room: z.string().max(40).nullable().optional(),
  teacherId: z.string().nullable().optional(),
  capacity: z.coerce.number().int().min(1).max(120).default(40),
  tuitionFee: z.coerce.number().int().min(0).max(10_000_000).default(150000),
  schedule: z.string().max(60).nullable().optional(),
});

const LEVEL_ORDER = ["6ème", "5ème", "4ème", "3ème", "2nde", "1ère", "Terminale"];

router.get('/', asyncHandler(async (req, res) => {
  const items = all(
    `SELECT c.id, c.name, c.level, c.room, c.teacher_id AS teacherId, c.capacity,
            c.tuition_fee AS tuitionFee, c.schedule, c.created_at AS createdAt,
            t.first_name || ' ' || t.last_name AS teacherName,
            (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id AND s.status = 'actif') AS studentCount,
            COALESCE((SELECT SUM(p.amount) FROM payments p JOIN students s2 ON s2.id = p.student_id
                       WHERE s2.class_id = c.id AND p.status = 'paye'), 0) AS collected,
            COALESCE((SELECT ROUND(SUM(g.score * g.coefficient) * 1.0 / NULLIF(SUM(g.coefficient), 0), 2)
                        FROM grades g JOIN students s3 ON s3.id = g.student_id
                       WHERE s3.class_id = c.id AND g.term = ?), NULL) AS average
       FROM classes c LEFT JOIN teachers t ON t.id = c.teacher_id
      ORDER BY c.name COLLATE NOCASE`,
    typeof req.query.term === 'string' && req.query.term ? req.query.term : termNow(),
  );
  items.sort((a, b) => {
    const ai = LEVEL_ORDER.indexOf(a.level);
    const bi = LEVEL_ORDER.indexOf(b.level);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.name.localeCompare(b.name);
  });
  res.json({
    items,
    stats: {
      total: items.length,
      students: items.reduce((s, c) => s + c.studentCount, 0),
      places: items.reduce((s, c) => s + Math.max(0, c.capacity - c.studentCount), 0),
      collected: items.reduce((s, c) => s + c.collected, 0),
    },
  });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  if (req.user.role === 'parent') throw forbidden();
  const cls = get(
    `SELECT c.id, c.name, c.level, c.room, c.teacher_id AS teacherId, c.capacity,
            c.tuition_fee AS tuitionFee, c.schedule,
            t.first_name || ' ' || t.last_name AS teacherName
       FROM classes c LEFT JOIN teachers t ON t.id = c.teacher_id WHERE c.id = ?`,
    req.params.id,
  );
  if (!cls) throw notFound('Classe introuvable.');
  const students = all(
    `SELECT id, matricule, first_name AS firstName, last_name AS lastName, gender, status,
            guardian_name AS guardianName, guardian_phone AS guardianPhone
       FROM students WHERE class_id = ? ORDER BY last_name COLLATE NOCASE`,
    cls.id,
  );
  res.json({ class: { ...cls, studentCount: students.filter((s) => s.status === 'actif').length }, students });
}));

router.post('/', asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw forbidden();
  const data = parseBody(schema, req.body);
  const id = uid('cls');
  const ts = now();
  run(
    `INSERT INTO classes (id, name, level, room, teacher_id, capacity, tuition_fee, schedule, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, data.name, data.level, data.room ?? null, data.teacherId || null, data.capacity, data.tuitionFee,
    data.schedule ?? null, ts, ts,
  );
  res.status(201).json({ class: get('SELECT * FROM classes WHERE id = ?', id) });
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw forbidden();
  if (!get('SELECT id FROM classes WHERE id = ?', req.params.id)) throw notFound('Classe introuvable.');
  const data = parseBody(schema.partial(), req.body);
  const map = {
    name: 'name', level: 'level', room: 'room', teacherId: 'teacher_id', capacity: 'capacity',
    tuitionFee: 'tuition_fee', schedule: 'schedule',
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
  run(`UPDATE classes SET ${fields.join(', ')} WHERE id = ?`, ...params);
  res.json({ class: get('SELECT * FROM classes WHERE id = ?', req.params.id) });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw forbidden();
  if (!get('SELECT id FROM classes WHERE id = ?', req.params.id)) throw notFound('Classe introuvable.');
  const count = get("SELECT COUNT(*) AS c FROM students WHERE class_id = ? AND status = 'actif'", req.params.id).c;
  if (count > 0) throw conflict(`Cette classe accueille encore ${count} élève(s). Réaffectez-les avant de la supprimer.`);
  run('DELETE FROM classes WHERE id = ?', req.params.id);
  res.json({ ok: true });
}));

export default router;
