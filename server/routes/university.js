import { Router } from 'express';
import { z } from 'zod';
import { all, get, run, now, uid } from '../db.js';
import { parseBody, asyncHandler, notFound, forbidden, conflict, badRequest } from '../helpers.js';

/* ------------------------------- Facultés -------------------------------- */

export const facultiesRouter = Router();

const facultySchema = z.object({
  name: z.string().min(3, 'Nom de la faculté requis.').max(120),
  code: z.string().min(2, 'Sigle requis.').max(12),
  dean: z.string().max(120).nullable().optional(),
  building: z.string().max(60).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  email: z.string().max(160).nullable().optional(),
  description: z.string().max(600).nullable().optional(),
});

facultiesRouter.get('/', asyncHandler(async (req, res) => {
  if (req.user.role === 'parent') throw forbidden();
  const items = all(
    `SELECT f.id, f.name, f.code, f.dean, f.building, f.phone, f.email, f.description,
            f.created_at AS createdAt,
            (SELECT COUNT(*) FROM programs p WHERE p.faculty_id = f.id) AS programCount,
            (SELECT COUNT(*) FROM course_units u JOIN programs p2 ON p2.id = u.program_id
              WHERE p2.faculty_id = f.id) AS unitCount,
            (SELECT COUNT(*) FROM students s JOIN programs p3 ON p3.id = s.program_id
              WHERE p3.faculty_id = f.id AND s.status = 'actif') AS studentCount
       FROM faculties f ORDER BY f.name COLLATE NOCASE`,
  );
  res.json({
    items,
    stats: {
      total: items.length,
      programs: items.reduce((sum, faculty) => sum + faculty.programCount, 0),
      students: items.reduce((sum, faculty) => sum + faculty.studentCount, 0),
    },
  });
}));

facultiesRouter.get('/:id', asyncHandler(async (req, res) => {
  if (req.user.role === 'parent') throw forbidden();
  const faculty = get('SELECT * FROM faculties WHERE id = ?', req.params.id);
  if (!faculty) throw notFound('Faculté introuvable.');
  const programs = all(
    `SELECT p.id, p.name, p.code, p.degree, p.duration_years AS durationYears, p.total_credits AS totalCredits,
            p.tuition_fee AS tuitionFee, p.status,
            (SELECT COUNT(*) FROM students s WHERE s.program_id = p.id AND s.status = 'actif') AS studentCount,
            (SELECT COUNT(*) FROM course_units u WHERE u.program_id = p.id) AS unitCount
       FROM programs p WHERE p.faculty_id = ? ORDER BY p.name`,
    faculty.id,
  );
  res.json({ faculty, programs });
}));

facultiesRouter.post('/', asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw forbidden();
  const data = parseBody(facultySchema, req.body);
  const id = uid('fac');
  const ts = now();
  run(
    `INSERT INTO faculties (id, name, code, dean, building, phone, email, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, data.name, data.code.toUpperCase(), data.dean ?? null, data.building ?? null,
    data.phone ?? null, data.email ?? null, data.description ?? null, ts, ts,
  );
  res.status(201).json({ faculty: get('SELECT * FROM faculties WHERE id = ?', id) });
}));

facultiesRouter.patch('/:id', asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw forbidden();
  if (!get('SELECT id FROM faculties WHERE id = ?', req.params.id)) throw notFound('Faculté introuvable.');
  const data = parseBody(facultySchema.partial(), req.body);
  const map = { name: 'name', code: 'code', dean: 'dean', building: 'building', phone: 'phone', email: 'email', description: 'description' };
  const fields = [];
  const params = [];
  for (const [key, column] of Object.entries(map)) {
    if (data[key] !== undefined) { fields.push(`${column} = ?`); params.push(data[key] ?? null); }
  }
  if (!fields.length) throw badRequest('Aucune modification fournie.');
  fields.push('updated_at = ?');
  params.push(now(), req.params.id);
  run(`UPDATE faculties SET ${fields.join(', ')} WHERE id = ?`, ...params);
  res.json({ faculty: get('SELECT * FROM faculties WHERE id = ?', req.params.id) });
}));

facultiesRouter.delete('/:id', asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw forbidden();
  if (!get('SELECT id FROM faculties WHERE id = ?', req.params.id)) throw notFound('Faculté introuvable.');
  const count = get('SELECT COUNT(*) AS c FROM programs WHERE faculty_id = ?', req.params.id).c;
  if (count > 0) throw conflict(`Cette faculté contient ${count} filière(s). Supprimez-les d'abord.`);
  run('DELETE FROM faculties WHERE id = ?', req.params.id);
  res.json({ ok: true });
}));

/* ------------------------------- Filières -------------------------------- */

export const programsRouter = Router();

const programSchema = z.object({
  name: z.string().min(3, 'Nom de la filière requis.').max(120),
  code: z.string().min(2, 'Sigle requis.').max(12),
  facultyId: z.string().min(1, 'Faculté requise.'),
  degree: z.enum(['Licence', 'Master', 'Doctorat', 'BTS', 'Certificat']).default('Licence'),
  durationYears: z.coerce.number().int().min(1).max(8).default(3),
  totalCredits: z.coerce.number().int().min(1).max(600).default(180),
  tuitionFee: z.coerce.number().int().min(0).max(100_000_000).default(600000),
  status: z.enum(['ouverte', 'fermee', 'brouillon']).default('ouverte'),
  description: z.string().max(800).nullable().optional(),
});

programsRouter.get('/', asyncHandler(async (req, res) => {
  if (req.user.role === 'parent') throw forbidden();
  const { search = '', facultyId = '', degree = '' } = req.query;
  const filters = ['1 = 1'];
  const params = [];
  if (search) {
    filters.push('(p.name LIKE ? OR p.code LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (facultyId) { filters.push('p.faculty_id = ?'); params.push(facultyId); }
  if (degree) { filters.push('p.degree = ?'); params.push(degree); }

  const items = all(
    `SELECT p.id, p.name, p.code, p.faculty_id AS facultyId, p.degree,
            p.duration_years AS durationYears, p.total_credits AS totalCredits,
            p.tuition_fee AS tuitionFee, p.status, p.description, p.created_at AS createdAt,
            f.name AS facultyName, f.code AS facultyCode,
            (SELECT COUNT(*) FROM students s WHERE s.program_id = p.id AND s.status = 'actif') AS studentCount,
            (SELECT COUNT(*) FROM course_units u WHERE u.program_id = p.id) AS unitCount,
            COALESCE((SELECT SUM(u2.credits) FROM course_units u2 WHERE u2.program_id = p.id), 0) AS creditedUnits
       FROM programs p LEFT JOIN faculties f ON f.id = p.faculty_id
      WHERE ${filters.join(' AND ')}
      ORDER BY p.degree, p.name COLLATE NOCASE`,
    ...params,
  );
  res.json({
    items,
    stats: {
      total: items.length,
      students: items.reduce((sum, program) => sum + program.studentCount, 0),
      credits: items.reduce((sum, program) => sum + program.totalCredits, 0),
      masters: items.filter((program) => program.degree === 'Master').length,
    },
  });
}));

programsRouter.get('/:id', asyncHandler(async (req, res) => {
  if (req.user.role === 'parent') throw forbidden();
  const program = get(
    `SELECT p.*, f.name AS facultyName FROM programs p LEFT JOIN faculties f ON f.id = p.faculty_id WHERE p.id = ?`,
    req.params.id,
  );
  if (!program) throw notFound('Filière introuvable.');
  const units = all(
    `SELECT u.id, u.code, u.title, u.semester, u.credits, u.hours, u.status,
            t.first_name || ' ' || t.last_name AS teacherName
       FROM course_units u LEFT JOIN teachers t ON t.id = u.teacher_id
      WHERE u.program_id = ? ORDER BY u.semester, u.code`,
    program.id,
  );
  const students = all(
    `SELECT id, matricule, first_name AS firstName, last_name AS lastName, academic_level AS academicLevel, status
       FROM students WHERE program_id = ? ORDER BY last_name COLLATE NOCASE`,
    program.id,
  );
  res.json({ program, units, students });
}));

programsRouter.post('/', asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw forbidden();
  const data = parseBody(programSchema, req.body);
  if (!get('SELECT id FROM faculties WHERE id = ?', data.facultyId)) throw badRequest('Faculté introuvable.');
  const id = uid('prg');
  const ts = now();
  run(
    `INSERT INTO programs (id, faculty_id, name, code, degree, duration_years, total_credits, tuition_fee,
       status, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, data.facultyId, data.name, data.code.toUpperCase(), data.degree, data.durationYears,
    data.totalCredits, data.tuitionFee, data.status, data.description ?? null, ts, ts,
  );
  res.status(201).json({ program: get('SELECT * FROM programs WHERE id = ?', id) });
}));

programsRouter.patch('/:id', asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw forbidden();
  if (!get('SELECT id FROM programs WHERE id = ?', req.params.id)) throw notFound('Filière introuvable.');
  const data = parseBody(programSchema.partial(), req.body);
  const map = {
    name: 'name', code: 'code', facultyId: 'faculty_id', degree: 'degree',
    durationYears: 'duration_years', totalCredits: 'total_credits', tuitionFee: 'tuition_fee',
    status: 'status', description: 'description',
  };
  const fields = [];
  const params = [];
  for (const [key, column] of Object.entries(map)) {
    if (data[key] !== undefined) { fields.push(`${column} = ?`); params.push(data[key] ?? null); }
  }
  if (!fields.length) throw badRequest('Aucune modification fournie.');
  fields.push('updated_at = ?');
  params.push(now(), req.params.id);
  run(`UPDATE programs SET ${fields.join(', ')} WHERE id = ?`, ...params);
  res.json({ program: get('SELECT * FROM programs WHERE id = ?', req.params.id) });
}));

programsRouter.delete('/:id', asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw forbidden();
  if (!get('SELECT id FROM programs WHERE id = ?', req.params.id)) throw notFound('Filière introuvable.');
  const count = get("SELECT COUNT(*) AS c FROM students WHERE program_id = ? AND status = 'actif'", req.params.id).c;
  if (count > 0) throw conflict(`Cette filière compte ${count} étudiant(s) actif(s). Réaffectez-les avant suppression.`);
  run('DELETE FROM programs WHERE id = ?', req.params.id);
  res.json({ ok: true });
}));

/* -------------------------- Unités d'enseignement ------------------------ */

export const unitsRouter = Router();

const unitSchema = z.object({
  programId: z.string().min(1, 'Filière requise.'),
  code: z.string().min(2, 'Code requis.').max(20),
  title: z.string().min(3, "Intitulé de l'unité requis.").max(160),
  semester: z.coerce.number().int().min(1).max(12).default(1),
  credits: z.coerce.number().int().min(0).max(60).default(6),
  hours: z.coerce.number().int().min(0).max(500).default(45),
  teacherId: z.string().nullable().optional(),
  description: z.string().max(600).nullable().optional(),
  status: z.enum(['actif', 'archive']).default('actif'),
});

unitsRouter.get('/', asyncHandler(async (req, res) => {
  if (req.user.role === 'parent') throw forbidden();
  const { search = '', programId = '', semester = '' } = req.query;
  const filters = ['1 = 1'];
  const params = [];
  if (search) {
    filters.push('(u.title LIKE ? OR u.code LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (programId) { filters.push('u.program_id = ?'); params.push(programId); }
  if (semester) { filters.push('u.semester = ?'); params.push(semester); }

  const items = all(
    `SELECT u.id, u.program_id AS programId, u.code, u.title, u.semester, u.credits, u.hours,
            u.teacher_id AS teacherId, u.description, u.status, u.created_at AS createdAt,
            p.name AS programName, p.degree, f.code AS facultyCode,
            t.first_name || ' ' || t.last_name AS teacherName
       FROM course_units u
       LEFT JOIN programs p ON p.id = u.program_id
       LEFT JOIN faculties f ON f.id = p.faculty_id
       LEFT JOIN teachers t ON t.id = u.teacher_id
      WHERE ${filters.join(' AND ')}
      ORDER BY p.name, u.semester, u.code`,
    ...params,
  );
  res.json({
    items,
    stats: {
      total: items.length,
      credits: items.reduce((sum, unit) => sum + unit.credits, 0),
      hours: items.reduce((sum, unit) => sum + unit.hours, 0),
      programs: new Set(items.map((unit) => unit.programId)).size,
    },
  });
}));

unitsRouter.post('/', asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw forbidden();
  const data = parseBody(unitSchema, req.body);
  if (!get('SELECT id FROM programs WHERE id = ?', data.programId)) throw badRequest('Filière introuvable.');
  const id = uid('unt');
  const ts = now();
  run(
    `INSERT INTO course_units (id, program_id, code, title, semester, credits, hours, teacher_id,
       description, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, data.programId, data.code.toUpperCase(), data.title, data.semester, data.credits,
    data.hours, data.teacherId || null, data.description ?? null, data.status, ts, ts,
  );
  res.status(201).json({ unit: get('SELECT * FROM course_units WHERE id = ?', id) });
}));

unitsRouter.patch('/:id', asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw forbidden();
  if (!get('SELECT id FROM course_units WHERE id = ?', req.params.id)) throw notFound('Unité introuvable.');
  const data = parseBody(unitSchema.partial(), req.body);
  const map = {
    programId: 'program_id', code: 'code', title: 'title', semester: 'semester', credits: 'credits',
    hours: 'hours', teacherId: 'teacher_id', description: 'description', status: 'status',
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
  run(`UPDATE course_units SET ${fields.join(', ')} WHERE id = ?`, ...params);
  res.json({ unit: get('SELECT * FROM course_units WHERE id = ?', req.params.id) });
}));

unitsRouter.delete('/:id', asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw forbidden();
  if (!get('SELECT id FROM course_units WHERE id = ?', req.params.id)) throw notFound('Unité introuvable.');
  run('DELETE FROM course_units WHERE id = ?', req.params.id);
  res.json({ ok: true });
}));
