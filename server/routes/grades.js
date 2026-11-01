import { Router } from 'express';
import { z } from 'zod';
import { all, get, run, now, uid } from '../db.js';
import { parseBody, asyncHandler, notFound, forbidden, parentScope, termNow, badRequest } from '../helpers.js';

const router = Router();

const schema = z.object({
  studentId: z.string().min(1, 'Élève requis.'),
  subject: z.string().min(2, 'Matière requise.').max(60),
  term: z.string().min(3, 'Trimestre requis.').max(30),
  score: z.coerce.number().min(0, 'Note invalide.').max(20, 'La note doit être comprise entre 0 et 20.'),
  coefficient: z.coerce.number().int().min(1).max(10).default(1),
  teacherId: z.string().nullable().optional(),
  comment: z.string().max(400).nullable().optional(),
  evaluatedAt: z.string().max(30).nullable().optional(),
});

const appreciation = (avg) => {
  if (avg === null) return 'Non évalué';
  if (avg >= 16) return 'Excellent';
  if (avg >= 14) return 'Très bien';
  if (avg >= 12) return 'Bien';
  if (avg >= 10) return 'Passable';
  return 'Insuffisant';
};

/** Résultats consolidés par élève pour un trimestre. */
router.get('/results', asyncHandler(async (req, res) => {
  const term = typeof req.query.term === 'string' && req.query.term ? req.query.term : termNow();
  const classId = typeof req.query.classId === 'string' ? req.query.classId : '';
  const scope = parentScope(req.user);
  const filters = [scope.sql, 's.status = ?'];
  const params = [term, ...scope.params, 'actif'];
  if (classId) { filters.push('s.class_id = ?'); params.push(classId); }

  const rows = all(
    `SELECT g.id AS gradeId, g.student_id AS studentId, s.first_name AS firstName, s.last_name AS lastName,
            s.matricule, c.name AS className, c.level, g.subject, g.score, g.coefficient, g.comment
       FROM grades g
       JOIN students s ON s.id = g.student_id
       LEFT JOIN classes c ON c.id = s.class_id
      WHERE g.term = ? AND ${filters.join(' AND ')}
      ORDER BY s.last_name COLLATE NOCASE, g.subject`,
    ...params,
  );

  const byStudent = new Map();
  const subjectSet = new Set();
  for (const row of rows) {
    subjectSet.add(row.subject);
    let entry = byStudent.get(row.studentId);
    if (!entry) {
      entry = {
        studentId: row.studentId, studentName: `${row.firstName} ${row.lastName}`,
        matricule: row.matricule, className: row.className, level: row.level,
        subjects: {}, total: 0, coef: 0,
      };
      byStudent.set(row.studentId, entry);
    }
    entry.subjects[row.subject] = {
      id: row.gradeId, score: row.score, coefficient: row.coefficient, comment: row.comment ?? null,
    };
    entry.total += row.score * row.coefficient;
    entry.coef += row.coefficient;
  }

  const subjects = [...subjectSet].sort();
  const items = [...byStudent.values()].map((s) => {
    const average = s.coef ? Math.round((s.total / s.coef) * 100) / 100 : null;
    return {
      studentId: s.studentId, studentName: s.studentName, matricule: s.matricule,
      className: s.className, level: s.level, subjects: s.subjects, average,
      appreciation: appreciation(average),
    };
  });
  items.sort((a, b) => (b.average ?? -1) - (a.average ?? -1));

  const evaluated = items.filter((i) => i.average !== null);
  const classAverage = evaluated.length
    ? Math.round((evaluated.reduce((sum, i) => sum + i.average, 0) / evaluated.length) * 100) / 100
    : null;

  res.json({
    term,
    items,
    subjects,
    stats: {
      eleves: items.length,
      moyenne: classAverage,
      reussite: evaluated.length
        ? Math.round((evaluated.filter((i) => i.average >= 10).length / evaluated.length) * 100)
        : 0,
      meilleure: evaluated[0]?.average ?? null,
    },
  });
}));

router.get('/', asyncHandler(async (req, res) => {
  const scope = parentScope(req.user);
  const filters = [scope.sql];
  const params = [...scope.params];
  if (req.query.studentId) { filters.push('g.student_id = ?'); params.push(req.query.studentId); }
  if (req.query.term) { filters.push('g.term = ?'); params.push(req.query.term); }
  const items = all(
    `SELECT g.id, g.student_id AS studentId, g.subject, g.term, g.score, g.coefficient,
            g.evaluated_at AS evaluatedAt, g.comment,
            s.first_name || ' ' || s.last_name AS studentName
       FROM grades g JOIN students s ON s.id = g.student_id
      WHERE ${filters.join(' AND ')}
      ORDER BY g.evaluated_at DESC LIMIT 300`,
    ...params,
  );
  res.json({ items });
}));

router.post('/', asyncHandler(async (req, res) => {
  if (req.user.role === 'parent') throw forbidden();
  const data = parseBody(schema, req.body);
  if (!get('SELECT id FROM students WHERE id = ?', data.studentId)) throw badRequest('Élève introuvable.');
  const id = uid('grd');
  const ts = now();
  run(
    `INSERT INTO grades (id, student_id, subject, term, score, max_score, coefficient, evaluated_at,
       teacher_id, comment, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 20, ?, ?, ?, ?, ?, ?)`,
    id, data.studentId, data.subject, data.term, data.score, data.coefficient,
    data.evaluatedAt || new Date().toISOString(), data.teacherId || null, data.comment ?? null, ts, ts,
  );
  res.status(201).json({ grade: get('SELECT * FROM grades WHERE id = ?', id) });
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  if (req.user.role === 'parent') throw forbidden();
  if (!get('SELECT id FROM grades WHERE id = ?', req.params.id)) throw notFound('Note introuvable.');
  const data = parseBody(schema.partial(), req.body);
  const map = {
    studentId: 'student_id', subject: 'subject', term: 'term', score: 'score',
    coefficient: 'coefficient', teacherId: 'teacher_id', comment: 'comment', evaluatedAt: 'evaluated_at',
  };
  const fields = [];
  const params = [];
  for (const [key, column] of Object.entries(map)) {
    if (data[key] !== undefined) {
      if (key === 'score' && (data.score < 0 || data.score > 20)) throw badRequest('La note doit être comprise entre 0 et 20.');
      fields.push(`${column} = ?`);
      params.push(key === 'teacherId' ? data[key] || null : data[key] ?? null);
    }
  }
  if (!fields.length) throw badRequest('Aucune modification fournie.');
  fields.push('updated_at = ?');
  params.push(now(), req.params.id);
  run(`UPDATE grades SET ${fields.join(', ')} WHERE id = ?`, ...params);
  res.json({ grade: get('SELECT * FROM grades WHERE id = ?', req.params.id) });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  if (req.user.role === 'parent') throw forbidden();
  if (!get('SELECT id FROM grades WHERE id = ?', req.params.id)) throw notFound('Note introuvable.');
  run('DELETE FROM grades WHERE id = ?', req.params.id);
  res.json({ ok: true });
}));

export default router;
