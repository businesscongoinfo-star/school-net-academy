import { Router } from 'express';
import { z } from 'zod';
import { all, get, run, now, uid } from '../db.js';
import { parseBody, asyncHandler, notFound, conflict, parentScope, termNow, forbidden, badRequest } from '../helpers.js';
import { issueCard } from './cards.js';
import { notifyGuardian } from '../platform.js';

const router = Router();

const studentSchema = z.object({
  firstName: z.string().min(2, 'Prénom requis.').max(60),
  lastName: z.string().min(2, 'Nom requis.').max(60),
  gender: z.enum(['F', 'M']).default('F'),
  birthDate: z.string().max(10).nullable().optional(),
  classId: z.string().nullable().optional(),
  guardianName: z.string().max(120).nullable().optional(),
  guardianPhone: z.string().max(40).nullable().optional(),
  guardianEmail: z.string().max(160).nullable().optional(),
  address: z.string().max(240).nullable().optional(),
  status: z.enum(['actif', 'suspendu', 'diplome', 'parti']).default('actif'),
  studentType: z.enum(['eleve', 'etudiant']).default('eleve'),
  programId: z.string().nullable().optional(),
  academicLevel: z.string().max(10).nullable().optional(),
  notes: z.string().max(600).nullable().optional(),
  matricule: z.string().max(40).optional(),
  // Photo : data URL JPEG/PNG produite par le navigateur (≤ 400 ko) ou URL externe.
  photo: z.string().max(400_000).nullable().optional(),
  photoThumb: z.string().max(80_000).nullable().optional(),
});

const toRow = (s, enrolledAt, ts) => [
  s.firstName, s.lastName, s.gender, s.birthDate ?? null, s.classId || null,
  s.guardianName ?? null, s.guardianPhone ?? null, s.guardianEmail ?? null,
  s.address ?? null, s.status, s.studentType ?? 'eleve', s.programId || null,
  s.academicLevel || null, enrolledAt, s.notes ?? null,
  s.photo ?? null, s.photoThumb ?? null, ts, ts,
];

/** Une photo doit être une image (data URL ou URL http) : on refuse le reste. */
function cleanPhoto(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const photo = String(value).trim();
  if (/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/.test(photo)) return photo;
  if (/^https?:\/\/\S+$/.test(photo) && photo.length <= 600) return photo;
  throw badRequest('Photo invalide : utilisez une image JPG, PNG ou WebP.');
}

export function nextMatricule() {
  const year = new Date().getFullYear();
  const row = get("SELECT COUNT(*) AS c FROM students WHERE matricule LIKE ?", `SNA-${year}-%`);
  let n = (row?.c ?? 0) + 1;
  let code = `SNA-${year}-${String(n).padStart(3, '0')}`;
  while (get('SELECT 1 AS x FROM students WHERE matricule = ?', code)) {
    n += 1;
    code = `SNA-${year}-${String(n).padStart(3, '0')}`;
  }
  return code;
}

router.get('/', asyncHandler(async (req, res) => {
  const { search = '', classId = '', status = '', level = '', type = '', programId = '' } = req.query;
  const scope = parentScope(req.user);
  const filters = [scope.sql];
  const params = [...scope.params];

  if (search) {
    filters.push('(s.first_name LIKE ? OR s.last_name LIKE ? OR s.matricule LIKE ? OR s.guardian_name LIKE ?)');
    const q = `%${search}%`;
    params.push(q, q, q, q);
  }
  if (classId) { filters.push('s.class_id = ?'); params.push(classId); }
  if (status) { filters.push('s.status = ?'); params.push(status); }
  if (level) { filters.push('c.level = ?'); params.push(level); }
  if (type) { filters.push('s.student_type = ?'); params.push(type); }
  if (programId) { filters.push('s.program_id = ?'); params.push(programId); }

  const term = typeof req.query.term === 'string' && req.query.term ? req.query.term : termNow();
  const items = all(
    `SELECT s.id, s.matricule, s.first_name AS firstName, s.last_name AS lastName, s.gender,
            s.birth_date AS birthDate, s.class_id AS classId, s.guardian_name AS guardianName,
            s.guardian_phone AS guardianPhone, s.guardian_email AS guardianEmail, s.address,
            s.status, s.enrolled_at AS enrolledAt, s.notes, s.created_at AS createdAt,
            s.student_type AS studentType, s.program_id AS programId, s.academic_level AS academicLevel,
            s.photo_thumb AS photoThumb,
            c.name AS className, c.level, c.tuition_fee AS tuitionFee,
            p.name AS programName, p.tuition_fee AS programFee,
            COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.student_id = s.id AND p.status = 'paye'), 0) AS paidTotal,
            COALESCE((SELECT ROUND(SUM(g.score * g.coefficient) * 1.0 / NULLIF(SUM(g.coefficient), 0), 2)
                        FROM grades g WHERE g.student_id = s.id AND g.term = ?), NULL) AS average
       FROM students s LEFT JOIN classes c ON c.id = s.class_id
       LEFT JOIN programs p ON p.id = s.program_id
      WHERE ${filters.join(' AND ')}
      ORDER BY s.last_name COLLATE NOCASE, s.first_name COLLATE NOCASE`,
    term, ...params,
  );

  const stats = {
    total: items.length,
    actifs: items.filter((s) => s.status === 'actif').length,
    eleves: items.filter((s) => s.studentType !== 'etudiant').length,
    etudiants: items.filter((s) => s.studentType === 'etudiant').length,
    nouveaux: items.filter((s) => s.enrolledAt && s.enrolledAt > new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)).length,
    soldeDu: items.reduce((sum, s) => sum + Math.max(0, (s.tuitionFee ?? s.programFee ?? 0) + 25000 - s.paidTotal), 0),
  };

  res.json({ items, stats, term });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const scope = parentScope(req.user);
  const student = get(
    `SELECT s.photo_url AS photo, s.photo_thumb AS photoThumb, s.*,
            c.name AS className, c.level, c.tuition_fee AS tuitionFee,
            p.name AS programName, p.degree, p.tuition_fee AS programFee, f.name AS facultyName,
            t.first_name || ' ' || t.last_name AS mainTeacher
       FROM students s
       LEFT JOIN classes c ON c.id = s.class_id
       LEFT JOIN programs p ON p.id = s.program_id
       LEFT JOIN faculties f ON f.id = p.faculty_id
       LEFT JOIN teachers t ON t.id = c.teacher_id
      WHERE s.id = ? AND ${scope.sql}`,
    req.params.id, ...scope.params,
  );
  if (!student) throw notFound('Élève introuvable.');

  const payments = all(
    `SELECT id, reference, amount, currency, type, method, status, paid_at AS paidAt,
            due_date AS dueDate, term, note
       FROM payments WHERE student_id = ? ORDER BY COALESCE(paid_at, due_date) DESC LIMIT 50`,
    student.id,
  );
  const grades = all(
    `SELECT g.id, g.subject, g.term, g.score, g.max_score AS maxScore, g.coefficient,
            g.evaluated_at AS evaluatedAt, g.comment,
            t.first_name || ' ' || t.last_name AS teacherName
       FROM grades g LEFT JOIN teachers t ON t.id = g.teacher_id
      WHERE g.student_id = ? ORDER BY g.term DESC, g.subject`,
    student.id,
  );
  const paidTotal = payments.filter((p) => p.status === 'paye').reduce((s, p) => s + p.amount, 0);
  const outstanding = payments.filter((p) => p.status === 'en_attente' || p.status === 'retard')
    .reduce((s, p) => s + p.amount, 0);

  const byTerm = {};
  for (const g of grades) {
    byTerm[g.term] ??= { subjects: {}, total: 0, coef: 0 };
    const bucket = byTerm[g.term].subjects[g.subject] ?? (byTerm[g.term].subjects[g.subject] = { scores: [], coef: 0 });
    bucket.scores.push(g.score);
    bucket.coef = g.coefficient;
    byTerm[g.term].total += g.score * g.coefficient;
    byTerm[g.term].coef += g.coefficient;
  }
  const averages = Object.entries(byTerm).map(([term, value]) => ({
    term,
    average: value.coef ? Math.round((value.total / value.coef) * 100) / 100 : null,
    subjects: Object.entries(value.subjects).map(([subject, b]) => ({
      subject,
      average: Math.round((b.scores.reduce((s, x) => s + x, 0) / b.scores.length) * 100) / 100,
      count: b.scores.length,
      coefficient: b.coef,
    })),
  }));

  res.json({
    student: {
      ...student,
      paidTotal,
      outstanding,
      annualFee: (student.tuitionFee ?? student.programFee ?? 0) + 25000,
    },
    payments,
    grades,
    averages,
  });
}));

router.post('/', asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw forbidden();
  const data = parseBody(studentSchema, req.body);
  data.photo = cleanPhoto(data.photo);
  data.photoThumb = cleanPhoto(data.photoThumb);
  if (data.classId && !get('SELECT id FROM classes WHERE id = ?', data.classId)) {
    throw badRequest('La classe sélectionnée est introuvable.');
  }
  const id = uid('stu');
  const ts = now();
  run(
    `INSERT INTO students (id, matricule, first_name, last_name, gender, birth_date, class_id,
       guardian_name, guardian_phone, guardian_email, address, status, student_type, program_id,
       academic_level, enrolled_at, notes, photo_url, photo_thumb, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, data.matricule?.trim() || nextMatricule(), ...toRow(data, new Date().toISOString().slice(0, 10), ts),
  );
  // Chaque nouvel élève reçoit immédiatement sa carte (QR + code-barres + badge NFC).
  issueCard(id);
  run('UPDATE students SET tenant_id = ? WHERE id = ?', req.user.tenantId ?? null, id);
  // Les parents sont prévenus par notification et par SMS.
  notifyGuardian(id, {
    kind: 'inscription',
    title: `Nouvelle inscription : ${data.firstName} ${data.lastName}`,
    body: `La fiche de ${data.firstName} ${data.lastName} vient d'être créée. Sa carte scolaire est disponible.`,
    sms: `School Net Academy : ${data.firstName} ${data.lastName} est bien inscrit(e). Consultez l'espace parent pour la suite.`,
  }).catch(() => undefined);
  const created = get('SELECT * FROM students WHERE id = ?', id);
  res.status(201).json({ student: created });
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw forbidden();
  const existing = get('SELECT * FROM students WHERE id = ?', req.params.id);
  if (!existing) throw notFound('Élève introuvable.');
  const data = parseBody(studentSchema.partial(), req.body);
  if (data.photo !== undefined) data.photo = cleanPhoto(data.photo);
  if (data.photoThumb !== undefined) data.photoThumb = cleanPhoto(data.photoThumb);
  if (data.classId && !get('SELECT id FROM classes WHERE id = ?', data.classId)) {
    throw badRequest('La classe sélectionnée est introuvable.');
  }
  const fields = [];
  const params = [];
  const map = {
    firstName: 'first_name', lastName: 'last_name', gender: 'gender', birthDate: 'birth_date',
    classId: 'class_id', guardianName: 'guardian_name', guardianPhone: 'guardian_phone',
    guardianEmail: 'guardian_email', address: 'address', status: 'status', notes: 'notes',
    matricule: 'matricule', studentType: 'student_type', programId: 'program_id',
    academicLevel: 'academic_level', photo: 'photo_url', photoThumb: 'photo_thumb',
  };
  for (const [key, column] of Object.entries(map)) {
    if (data[key] !== undefined) {
      fields.push(`${column} = ?`);
      const nullable = ['classId', 'programId'].includes(key);
      params.push(nullable ? data[key] || null : data[key] ?? null);
    }
  }
  if (!fields.length) throw badRequest('Aucune modification fournie.');
  fields.push('updated_at = ?');
  params.push(now(), req.params.id);
  run(`UPDATE students SET ${fields.join(', ')} WHERE id = ?`, ...params);
  res.json({ student: get('SELECT * FROM students WHERE id = ?', req.params.id) });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw forbidden();
  const existing = get('SELECT id, first_name AS firstName, last_name AS lastName FROM students WHERE id = ?', req.params.id);
  if (!existing) throw notFound('Élève introuvable.');

  // Supprimer une fiche effacerait en cascade les paiements, notes, présences et
  // emprunts : on refuse et on propose l'archivage (statut « Parti »).
  const counts = {
    paiements: get('SELECT COUNT(*) AS c FROM payments WHERE student_id = ?', req.params.id).c,
    notes: get('SELECT COUNT(*) AS c FROM grades WHERE student_id = ?', req.params.id).c,
    présences: get('SELECT COUNT(*) AS c FROM attendance WHERE student_id = ?', req.params.id).c,
    emprunts: get('SELECT COUNT(*) AS c FROM loans WHERE student_id = ?', req.params.id).c,
  };
  const history = Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([label, count]) => `${count} ${label}`);

  if (history.length) {
    throw conflict(
      `La fiche de ${existing.firstName} ${existing.lastName} contient un historique (${history.join(', ')}). `
      + 'Pour la conserver, passez son statut à « Parti » au lieu de la supprimer.',
    );
  }

  run('DELETE FROM students WHERE id = ?', req.params.id);
  res.json({ ok: true });
}));

export default router;
