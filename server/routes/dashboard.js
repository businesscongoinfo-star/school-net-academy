import { Router } from 'express';
import { all, get } from '../db.js';
import { asyncHandler, parentScope, recentActivity, termNow } from '../helpers.js';

const router = Router();

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

router.get('/', asyncHandler(async (req, res) => {
  const user = req.user;
  const scope = parentScope(user);
  const studentFilter = user.role === 'parent' ? `AND ${scope.sql}` : '';
  const studentParams = user.role === 'parent' ? scope.params : [];

  const students = get(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN s.status = 'actif' THEN 1 ELSE 0 END) AS actifs
       FROM students s WHERE 1 = 1 ${studentFilter}`,
    ...studentParams,
  );

  const newStudents = get(
    `SELECT COUNT(*) AS c FROM students s
      WHERE s.enrolled_at >= ? ${studentFilter}`,
    new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10), ...studentParams,
  );

  const payments = get(
    `SELECT
        COALESCE(SUM(CASE WHEN p.status IN ('paye','rembourse') THEN p.amount ELSE 0 END), 0) AS encaisse,
        COALESCE(SUM(CASE WHEN p.status = 'en_attente' THEN p.amount ELSE 0 END), 0) AS attente,
        COALESCE(SUM(CASE WHEN p.status = 'retard' THEN p.amount ELSE 0 END), 0) AS retard,
        COUNT(*) AS transactions
       FROM payments p JOIN students s ON s.id = p.student_id
      WHERE 1 = 1 ${studentFilter}`,
    ...studentParams,
  );

  const day = 86400000;
  const since30 = new Date(Date.now() - 30 * day).toISOString();
  const since60 = new Date(Date.now() - 60 * day).toISOString();

  const collected30d = get(
    `SELECT COALESCE(SUM(p.amount), 0) AS total, COUNT(*) AS count FROM payments p
       JOIN students s ON s.id = p.student_id
      WHERE p.status = 'paye' AND p.paid_at >= ? ${studentFilter}`,
    since30, ...studentParams,
  );
  const collectedPrev30d = get(
    `SELECT COALESCE(SUM(p.amount), 0) AS total FROM payments p
       JOIN students s ON s.id = p.student_id
      WHERE p.status = 'paye' AND p.paid_at >= ? AND p.paid_at < ? ${studentFilter}`,
    since60, since30, ...studentParams,
  ).total;

  const revenueByMonth = all(
    `SELECT substr(p.paid_at, 1, 7) AS month,
            COALESCE(SUM(p.amount), 0) AS total
       FROM payments p JOIN students s ON s.id = p.student_id
      WHERE p.status = 'paye' AND p.paid_at IS NOT NULL AND ${scope.sql}
      GROUP BY month ORDER BY month`,
    ...scope.params,
  ).slice(-6);

  const revenueSeries = revenueByMonth.map((row) => {
    const [year, month] = row.month.split('-');
    return { month: `${MONTHS[Number(month) - 1]} ${year.slice(2)}`, total: row.total };
  });

  const studentsByLevel = all(
    `SELECT COALESCE(c.level, 'Non affecté') AS level, COUNT(*) AS total
       FROM students s LEFT JOIN classes c ON c.id = s.class_id
      WHERE s.status = 'actif' ${studentFilter}
      GROUP BY level
      ORDER BY total DESC`,
    ...studentParams,
  );

  const paymentMethods = all(
    `SELECT p.method, COALESCE(SUM(p.amount), 0) AS total, COUNT(*) AS count
       FROM payments p JOIN students s ON s.id = p.student_id
      WHERE p.status = 'paye' AND ${scope.sql}
      GROUP BY p.method ORDER BY total DESC`,
    ...scope.params,
  );

  const admissionStats = user.role === 'admin'
    ? all(`SELECT status, COUNT(*) AS total FROM admissions GROUP BY status`)
    : [];
  const admissions = admissionStats.reduce((acc, row) => {
    acc[row.status] = row.total;
    return acc;
  }, {});

  const teachers = user.role === 'admin'
    ? get("SELECT COUNT(*) AS c FROM teachers WHERE status = 'actif'").c
    : 0;
  const classes = get('SELECT COUNT(*) AS c FROM classes').c;
  const courses = get("SELECT COUNT(*) AS c FROM courses WHERE status = 'publie'").c;

  const term = termNow();
  const average = get(
    `SELECT ROUND(SUM(g.score * g.coefficient) * 1.0 / NULLIF(SUM(g.coefficient), 0), 2) AS avg
       FROM grades g JOIN students s ON s.id = g.student_id
      WHERE g.term = ? AND ${scope.sql}`,
    term, ...scope.params,
  )?.avg ?? null;

  const upcomingDues = all(
    `SELECT p.id, p.reference, p.amount, p.due_date AS dueDate, p.status, p.type,
            s.first_name || ' ' || s.last_name AS studentName, s.id AS studentId,
            c.name AS className
       FROM payments p JOIN students s ON s.id = p.student_id
       LEFT JOIN classes c ON c.id = s.class_id
      WHERE p.status IN ('en_attente', 'retard') AND ${scope.sql}
      ORDER BY p.due_date ASC LIMIT 6`,
    ...scope.params,
  );

  const topClasses = user.role === 'parent' ? [] : all(
    `SELECT c.id, c.name, c.level,
            COUNT(s.id) AS studentCount,
            COALESCE((SELECT SUM(p.amount) FROM payments p
                        JOIN students s2 ON s2.id = p.student_id
                       WHERE s2.class_id = c.id AND p.status = 'paye'), 0) AS collected
       FROM classes c LEFT JOIN students s ON s.class_id = c.id AND s.status = 'actif'
      GROUP BY c.id ORDER BY studentCount DESC LIMIT 5`,
  );

  /* ----- Volet universitaire ----- */
  const facultyCount = get('SELECT COUNT(*) AS c FROM faculties').c;
  const programCount = get('SELECT COUNT(*) AS c FROM programs').c;
  const unitStats = get('SELECT COUNT(*) AS total, COALESCE(SUM(credits), 0) AS credits FROM course_units');
  const universityStudents = get(
    "SELECT COUNT(*) AS c FROM students WHERE student_type = 'etudiant' AND status = 'actif'",
  ).c;
  const library = {
    books: get('SELECT COUNT(*) AS c FROM books').c,
    copies: get('SELECT COALESCE(SUM(copies_total), 0) AS c FROM books').c,
    available: get('SELECT COALESCE(SUM(copies_available), 0) AS c FROM books').c,
    activeLoans: get("SELECT COUNT(*) AS c FROM loans WHERE status <> 'rendu'").c,
    lateLoans: get("SELECT COUNT(*) AS c FROM loans WHERE status = 'retard'").c,
  };

  const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const todayName = DAY_NAMES[new Date().getDay()];
  const todaySchedule = all(
    `SELECT s.id, s.title, s.room, s.day, s.start_time AS startTime, s.end_time AS endTime, s.kind,
            c.name AS className, p.name AS programName,
            t.first_name || ' ' || t.last_name AS teacherName
       FROM schedules s
       LEFT JOIN classes c ON c.id = s.class_id
       LEFT JOIN programs p ON p.id = s.program_id
       LEFT JOIN teachers t ON t.id = s.teacher_id
      WHERE s.day = ? ORDER BY s.start_time LIMIT 6`,
    todayName,
  );

  const attendanceToday = get(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) AS present,
            SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) AS absent,
            SUM(CASE WHEN status = 'retard' THEN 1 ELSE 0 END) AS late
       FROM attendance WHERE date = ?`,
    new Date().toISOString().slice(0, 10),
  );

  const audience = user.role === 'parent' ? 'parents' : user.role === 'teacher' ? 'enseignants' : null;
  const announcements = user.role === 'admin'
    ? all(
      `SELECT a.id, a.title, a.body, a.audience, a.published_at AS publishedAt, u.name AS authorName
         FROM announcements a LEFT JOIN users u ON u.id = a.author_id
        WHERE a.status = 'publie'
        ORDER BY a.published_at DESC LIMIT 3`,
    )
    : all(
      `SELECT a.id, a.title, a.body, a.audience, a.published_at AS publishedAt, u.name AS authorName
         FROM announcements a LEFT JOIN users u ON u.id = a.author_id
        WHERE a.status = 'publie' AND a.audience IN ('tous', ?)
        ORDER BY a.published_at DESC LIMIT 3`,
      audience,
    );

  const growth = collectedPrev30d > 0
    ? Math.round(((collected30d.total - collectedPrev30d) / collectedPrev30d) * 1000) / 10
    : null;

  res.json({
    role: user.role,
    term,
    kpis: {
      students: students.actifs ?? 0,
      newStudents: newStudents.c,
      teachers,
      classes,
      courses,
      collected: payments.encaisse,
      pending: payments.attente,
      late: payments.retard,
      collected30d: collected30d.total,
      payments30d: collected30d.count,
      growth,
      admissionsPending: (admissions.en_attente ?? 0) + (admissions.en_revue ?? 0),
      average,
      transactions: payments.transactions,
      universityStudents,
      programs: programCount,
      courseUnits: unitStats.total,
      credits: unitStats.credits,
    },
    university: {
      faculties: facultyCount,
      programs: programCount,
      students: universityStudents,
      courseUnits: unitStats.total,
      credits: unitStats.credits,
      library,
    },
    today: {
      day: todayName,
      schedule: todaySchedule,
      attendance: {
        date: new Date().toISOString().slice(0, 10),
        total: attendanceToday.total ?? 0,
        present: attendanceToday.present ?? 0,
        absent: attendanceToday.absent ?? 0,
        late: attendanceToday.late ?? 0,
      },
    },
    revenueSeries,
    studentsByLevel,
    paymentMethods,
    admissions,
    recentActivity: recentActivity(7, user),
    upcomingDues,
    topClasses,
    announcements,
  });
}));

export default router;
