import { Router } from 'express';
import { all, get } from '../db.js';
import { asyncHandler, parentScope, termNow } from '../helpers.js';

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  const user = req.user;
  const scope = parentScope(user);

  const classes = all(
    `SELECT c.id, c.name, c.level, c.capacity, c.tuition_fee AS tuitionFee,
            (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id AND s.status = 'actif') AS studentCount
       FROM classes c ORDER BY c.name COLLATE NOCASE`,
  );

  const teachers = user.role === 'parent' ? [] : all(
    `SELECT id, first_name || ' ' || last_name AS name, subject, status
       FROM teachers WHERE status = 'actif' ORDER BY last_name COLLATE NOCASE`,
  );

  const students = all(
    `SELECT s.id, s.first_name || ' ' || s.last_name AS name, s.matricule,
            s.class_id AS classId, c.name AS className, s.status,
            s.student_type AS studentType, s.program_id AS programId,
            s.academic_level AS academicLevel, p.name AS programName
       FROM students s
       LEFT JOIN classes c ON c.id = s.class_id
       LEFT JOIN programs p ON p.id = s.program_id
      WHERE ${scope.sql}
      ORDER BY s.last_name COLLATE NOCASE`,
    ...scope.params,
  );

  const faculties = user.role === 'parent' ? [] : all(
    'SELECT id, name, code FROM faculties ORDER BY name COLLATE NOCASE',
  );
  const programs = user.role === 'parent' ? [] : all(
    `SELECT p.id, p.name, p.code, p.degree, p.faculty_id AS facultyId, p.tuition_fee AS tuitionFee,
            p.total_credits AS totalCredits, f.name AS facultyName,
            (SELECT COUNT(*) FROM students s WHERE s.program_id = p.id AND s.status = 'actif') AS studentCount
       FROM programs p LEFT JOIN faculties f ON f.id = p.faculty_id
      ORDER BY p.name COLLATE NOCASE`,
  );

  const subjects = all('SELECT DISTINCT subject FROM teachers ORDER BY subject').map((r) => r.subject);

  res.json({
    classes,
    teachers,
    students,
    subjects: [...new Set([...subjects,
      'Mathématiques', 'Français', 'Anglais', 'Physique-Chimie', 'SVT', 'Histoire-Géographie',
      'Informatique', 'Philosophie', 'Éducation civique', 'EPS'])].sort(),
    levels: ['6ème', '5ème', '4ème', '3ème', '2nde', '1ère', 'Terminale'],
    terms: ['Trimestre 1', 'Trimestre 2', 'Trimestre 3'],
    currentTerm: termNow(),
    paymentTypes: ['Scolarité', 'Inscription', 'Cantine', 'Transport', "Frais d'examen"],
    paymentMethods: ['Mobile Money', 'Espèces', 'Virement bancaire', 'Chèque'],
    admissionSources: ['Site web', 'Formulaire papier', 'Recommandation', 'Visite sur place'],
    faculties,
    programs,
    degrees: ['Licence', 'Master', 'Doctorat', 'BTS', 'Certificat'],
    academicLevels: ['L1', 'L2', 'L3', 'M1', 'M2', 'D1', 'D2'],
    days: ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'],
    attendanceSessions: ['Journée', '08:00', '10:00', '14:00'],
    scheduleKinds: ['Cours', 'TD', 'TP', 'Examen', 'Soutenance'],
    school: get("SELECT name, title FROM users WHERE role = 'admin' LIMIT 1") ?? null,
  });
}));

export default router;
