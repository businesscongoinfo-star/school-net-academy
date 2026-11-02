import { Router } from 'express';
import { z } from 'zod';
import { all, get, run, now, uid } from '../db.js';
import {
  parseBody, asyncHandler, notFound, forbidden, badRequest, makeReference, conflict, stamp,
} from '../helpers.js';
import { nextMatricule } from './students.js';

const router = Router();

const STATUSES = ['en_attente', 'en_revue', 'acceptee', 'refusee', 'inscrite'];

const schema = z.object({
  studentName: z.string().min(3, "Nom de l'élève requis.").max(120),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format AAAA-MM-JJ.').nullable().optional(),
  gender: z.enum(['F', 'M']).default('F'),
  level: z.string().min(1, 'Niveau souhaité requis.').max(30),
  guardianName: z.string().min(2, 'Nom du parent/tuteur requis.').max(120),
  guardianPhone: z.string().max(40).nullable().optional(),
  guardianEmail: z.string().max(160).nullable().optional(),
  previousSchool: z.string().max(160).nullable().optional(),
  status: z.enum(STATUSES).default('en_attente'),
  source: z.string().max(60).nullable().optional(),
  notes: z.string().max(600).nullable().optional(),
});

router.get('/', asyncHandler(async (req, res) => {
  if (req.user.role === 'parent') throw forbidden();
  const { search = '', status = '' } = req.query;
  const filters = ['1 = 1'];
  const params = [];
  if (search) {
    filters.push('(a.student_name LIKE ? OR a.reference LIKE ? OR a.guardian_name LIKE ?)');
    const q = `%${search}%`;
    params.push(q, q, q);
  }
  if (status) { filters.push('a.status = ?'); params.push(status); }

  const items = all(
    `SELECT a.id, a.reference, a.student_name AS studentName, a.birth_date AS birthDate, a.gender,
            a.level, a.guardian_name AS guardianName, a.guardian_phone AS guardianPhone,
            a.guardian_email AS guardianEmail, a.previous_school AS previousSchool, a.status,
            a.source, a.submitted_at AS submittedAt, a.decision_at AS decisionAt, a.notes
       FROM admissions a WHERE ${filters.join(' AND ')}
      ORDER BY a.submitted_at DESC`,
    ...params,
  );

  const stats = STATUSES.reduce((acc, s) => {
    acc[s] = items.filter((i) => i.status === s).length;
    return acc;
  }, {});

  res.json({
    items,
    stats: {
      ...stats,
      total: items.length,
      traitees: items.filter((i) => ['acceptee', 'refusee', 'inscrite'].includes(i.status)).length,
      enCours: items.filter((i) => ['en_attente', 'en_revue'].includes(i.status)).length,
    },
  });
}));

router.post('/', asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw forbidden();
  const data = parseBody(schema, req.body);
  const id = uid('adm');
  const { createdAt, updatedAt } = stamp();
  const isDecided = ['acceptee', 'refusee', 'inscrite'].includes(data.status);
  run(
    `INSERT INTO admissions (id, reference, student_name, birth_date, gender, level, guardian_name,
       guardian_phone, guardian_email, previous_school, status, source, submitted_at, decision_at, notes,
       created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, makeReference('INS', 'admissions'), data.studentName, data.birthDate ?? null, data.gender,
    data.level, data.guardianName, data.guardianPhone ?? null, data.guardianEmail ?? null,
    data.previousSchool ?? null, data.status, data.source ?? 'Site web', now(),
    isDecided ? now() : null, data.notes ?? null, createdAt, updatedAt,
  );
  res.status(201).json({ admission: get('SELECT * FROM admissions WHERE id = ?', id) });
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw forbidden();
  const existing = get('SELECT * FROM admissions WHERE id = ?', req.params.id);
  if (!existing) throw notFound('Dossier introuvable.');
  const data = parseBody(schema.partial(), req.body);
  const map = {
    studentName: 'student_name', birthDate: 'birth_date', gender: 'gender', level: 'level',
    guardianName: 'guardian_name', guardianPhone: 'guardian_phone', guardianEmail: 'guardian_email',
    previousSchool: 'previous_school', status: 'status', source: 'source', notes: 'notes',
  };
  const fields = [];
  const params = [];
  for (const [key, column] of Object.entries(map)) {
    if (data[key] !== undefined) {
      fields.push(`${column} = ?`);
      params.push(data[key] ?? null);
    }
  }
  if (data.status && data.status !== existing.status) {
    fields.push('decision_at = ?');
    params.push(['acceptee', 'refusee', 'inscrite'].includes(data.status) ? now() : null);
  }
  if (!fields.length) throw badRequest('Aucune modification fournie.');
  fields.push('updated_at = ?');
  params.push(now(), req.params.id);
  run(`UPDATE admissions SET ${fields.join(', ')} WHERE id = ?`, ...params);
  res.json({ admission: get('SELECT * FROM admissions WHERE id = ?', req.params.id) });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw forbidden();
  if (!get('SELECT id FROM admissions WHERE id = ?', req.params.id)) throw notFound('Dossier introuvable.');
  run('DELETE FROM admissions WHERE id = ?', req.params.id);
  res.json({ ok: true });
}));

/** Transforme un dossier accepté en élève inscrit. */
router.post('/:id/enroll', asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw forbidden();
  const admission = get('SELECT * FROM admissions WHERE id = ?', req.params.id);
  if (!admission) throw notFound('Dossier introuvable.');
  if (admission.status === 'inscrite') throw conflict('Ce dossier a déjà été converti en inscription.');

  const { classId } = parseBody(z.object({ classId: z.string().min(1, 'Classe requise.') }), req.body);
  const target = get('SELECT * FROM classes WHERE id = ?', classId);
  if (!target) throw badRequest('Classe introuvable.');

  const count = get("SELECT COUNT(*) AS c FROM students WHERE class_id = ? AND status = 'actif'", classId).c;
  if (count >= target.capacity) throw conflict(`La classe ${target.name} est complète (${target.capacity} places).`);

  const names = admission.student_name.trim().split(/\s+/);
  const firstName = names[0];
  const lastName = names.slice(1).join(' ') || names[0];
  const studentId = uid('stu');
  const ts = now();
  const year = new Date().getFullYear();
  const matricule = nextMatricule();

  run(
    `INSERT INTO students (id, matricule, first_name, last_name, gender, birth_date, class_id,
       guardian_name, guardian_phone, guardian_email, address, status, enrolled_at, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'actif', ?, ?, ?, ?)`,
    studentId, matricule, firstName, lastName, admission.gender, admission.birth_date,
    classId, admission.guardian_name, admission.guardian_phone, admission.guardian_email,
    null, new Date().toISOString().slice(0, 10), `Converti depuis le dossier ${admission.reference}`, ts, ts,
  );

  // frais d'inscription
  const payRow = get('SELECT COUNT(*) AS c FROM payments');
  run(
    `INSERT INTO payments (id, reference, student_id, amount, currency, type, method, status, paid_at,
       due_date, term, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'FCFA', 'Inscription', 'Espèces', 'en_attente', NULL, ?, 'Trimestre 1', ?, ?, ?)`,
    uid('pay'), `PAY-${year}-${String(payRow.c + 1).padStart(3, '0')}`, studentId, 25000,
    new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    "Frais d'inscription — à encaisser", ts, ts,
  );

  run("UPDATE admissions SET status = 'inscrite', decision_at = ?, updated_at = ? WHERE id = ?", ts, ts, admission.id);

  res.status(201).json({
    student: get('SELECT id, matricule, first_name AS firstName, last_name AS lastName FROM students WHERE id = ?', studentId),
    admission: get('SELECT * FROM admissions WHERE id = ?', admission.id),
  });
}));

export default router;
