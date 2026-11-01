/**
 * Seed de démonstration — School Net Academy.
 * Données déterministes et réalistes (contexte scolaire congolais).
 *
 *   npm run seed:reset   -> efface et régénère tout
 */
import { db, migrate, run, get, isEmpty, now } from './db.js';
import { hashPassword } from './auth.js';

const DEMO_PASSWORD = 'demo1234';

/* ------------------------------------------------------------------ */
/* Utilitaires                                                         */
/* ------------------------------------------------------------------ */

function mulberry32(seed) {
  let a = seed;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20261101);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const int = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const chance = (p) => rand() < p;

const TODAY = new Date();
TODAY.setUTCHours(9, 0, 0, 0);

function iso(daysFromToday, hour = 9) {
  const d = new Date(TODAY.getTime() + daysFromToday * 86400000);
  d.setUTCHours(hour, int(0, 59), 0, 0);
  return d.toISOString();
}
const dateOnly = (daysFromToday = 0) => iso(daysFromToday).slice(0, 10);
const num = (n) => String(n).padStart(3, '0');
const pad2 = (n) => String(n).padStart(2, '0');

const FIRST_F = ['Aya', 'Grâce', 'Merveille', 'Nadège', 'Rosine', 'Chimène', 'Aurélie', 'Christelle',
  'Gaëlle', 'Ida', 'Kelly', 'Mireille', 'Ornella', 'Rachel', 'Thérèse', 'Vanessa', 'Léa', 'Gloria',
  'Bénédicte', 'Dorcas', 'Elvire', 'Gertrude', 'Irène', 'Divine', 'Exaucée', 'Prisca', 'Sarah',
  'Blandine', 'Carine', 'Jemima', 'Lauriane', 'Marthe', 'Natacha', 'Olga', 'Perrine', 'Sylvie'];
const FIRST_M = ['Prince', 'Chancel', 'Divin', 'Jean-Baptiste', 'Exaucé', 'Félix', 'Prosper', 'Brice',
  'Dieudonné', 'Emmanuel', 'Fabrice', 'Hervé', 'Joël', 'Landry', 'Noël', 'Patrick', 'Samuel', 'Urbain',
  'Wilfrid', 'Yannick', 'Jordy', 'Anicet', 'Cyriaque', 'Fortuné', 'Hippolyte', 'Juvénal', 'Alphonse',
  'Blaise', 'Christian', 'Davy', 'Éric', 'Franck', 'Guillaume', 'Horace', 'Ismaël', 'Jonathan'];
const LAST = ['Mbemba', 'Okemba', 'Loubaki', 'Ondongo', 'Nkodia', 'Bakala', 'Mabiala', 'Ndinga',
  'Otsali', 'Mouanda', 'Tsiba', 'Ndzaba', 'Biyoudi', 'Massamba', 'Mbama', 'Kimbembé', 'Ngoma',
  'Samba', 'Moukoko', 'Nzaba', 'Elenga', 'Bouanga', 'Kayiba', 'Mavoungou', 'Nkounkou', 'Itoua',
  'Bantsimba', 'Malonga', 'Ngatsé', 'Ossibi', 'Poaty', 'Tchicaya', 'Gouala', 'Mouyabi'];

const SUBJECTS = ['Mathématiques', 'Français', 'Anglais', 'Physique-Chimie', 'SVT',
  'Histoire-Géographie', 'Informatique', 'Philosophie', 'Éducation civique', 'EPS'];

const LEVELS = [
  { level: '6ème', classes: ['6ème A', '6ème B'], fee: 145000 },
  { level: '5ème', classes: ['5ème A', '5ème B'], fee: 150000 },
  { level: '4ème', classes: ['4ème A'], fee: 155000 },
  { level: '3ème', classes: ['3ème A'], fee: 165000 },
  { level: '2nde', classes: ['2nde C'], fee: 180000 },
  { level: '1ère', classes: ['1ère D'], fee: 190000 },
  { level: 'Terminale', classes: ['Terminale D'], fee: 210000 },
];

const ROOMS = ['Salle 101', 'Salle 102', 'Salle 103', 'Salle 201', 'Salle 202', 'Salle 203',
  'Salle 301', 'Labo B'];
const METHODS = ['Mobile Money', 'Espèces', 'Virement bancaire', 'Chèque'];
const PAY_TYPES = ['Scolarité', 'Inscription', 'Cantine', 'Transport', 'Frais d\'examen'];
const SCHOOLS = ['École Saint-Joseph de Bacongo', 'Complexe scolaire La Grâce', 'Lycée de la Révolution',
  'Collège Chaminade', 'École primaire de Makélékélé', 'Institut Savorgnan de Brazza',
  'Complexe scolaire Betsaleel', 'École Notre-Dame de l\'Assomption'];

const slug = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]+/g, '.');

/* ------------------------------------------------------------------ */
/* Seed                                                               */
/* ------------------------------------------------------------------ */

export function seed() {
  const stamp = now();
  const password = hashPassword(DEMO_PASSWORD);
  const insertUser = db.prepare(`INSERT INTO users
    (id, email, password_hash, name, role, phone, title, avatar_color, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertTeacher = db.prepare(`INSERT INTO teachers
    (id, first_name, last_name, email, phone, subject, status, hired_at, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertClass = db.prepare(`INSERT INTO classes
    (id, name, level, room, teacher_id, capacity, tuition_fee, schedule, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertStudent = db.prepare(`INSERT INTO students
    (id, matricule, first_name, last_name, gender, birth_date, class_id, guardian_name, guardian_phone,
     guardian_email, guardian_user_id, address, status, enrolled_at, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertPayment = db.prepare(`INSERT INTO payments
    (id, reference, student_id, amount, currency, type, method, status, paid_at, due_date, term, note,
     created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertAdmission = db.prepare(`INSERT INTO admissions
    (id, reference, student_name, birth_date, gender, level, guardian_name, guardian_phone,
     guardian_email, previous_school, status, source, submitted_at, decision_at, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertCourse = db.prepare(`INSERT INTO courses
    (id, title, subject, level, teacher_id, status, lessons_count, duration_hours, enrolled_count,
     description, color, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertAnnouncement = db.prepare(`INSERT INTO announcements
    (id, title, body, audience, status, author_id, published_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertFaculty = db.prepare(`INSERT INTO faculties
    (id, name, code, dean, building, phone, email, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertProgram = db.prepare(`INSERT INTO programs
    (id, faculty_id, name, code, degree, duration_years, total_credits, tuition_fee, status, description,
     created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertUnit = db.prepare(`INSERT INTO course_units
    (id, program_id, code, title, semester, credits, hours, teacher_id, description, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertSchedule = db.prepare(`INSERT INTO schedules
    (id, title, class_id, program_id, teacher_id, room, day, start_time, end_time, kind, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertBook = db.prepare(`INSERT INTO books
    (id, title, author, isbn, category, copies_total, copies_available, shelf, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertLoan = db.prepare(`INSERT INTO loans
    (id, book_id, student_id, loaned_at, due_at, returned_at, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertAttendance = db.prepare(`INSERT INTO attendance
    (id, student_id, class_id, program_id, date, session, status, note, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertUniversityStudent = db.prepare(`INSERT INTO students
    (id, matricule, first_name, last_name, gender, birth_date, class_id, guardian_name, guardian_phone,
     guardian_email, guardian_user_id, address, status, student_type, program_id, academic_level,
     enrolled_at, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, NULL, ?, ?, 'etudiant', ?, ?, ?, NULL, ?, ?)`);
  const insertGrade = db.prepare(`INSERT INTO grades
    (id, student_id, subject, term, score, max_score, coefficient, evaluated_at, teacher_id, comment,
     created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  let counter = 0;
  const id = (prefix) => `${prefix}_${(++counter).toString(36).padStart(4, '0')}${Math.floor(rand() * 1e6).toString(36)}`;

  const users = [
    {
      email: 'direction@schoolnet.academy', name: 'Chancelle Mabiala', role: 'admin',
      phone: '+242 06 512 44 18', title: 'Directrice générale', color: '#0f766e',
    },
    {
      email: 'prof.mbemba@schoolnet.academy', name: 'Prosper Mbemba', role: 'teacher',
      phone: '+242 05 330 71 02', title: 'Enseignant — Mathématiques', color: '#b45309',
    },
    {
      email: 'parent.ondongo@schoolnet.academy', name: 'Nadège Ondongo', role: 'parent',
      phone: '+242 06 774 12 90', title: 'Parent de 2 élèves', color: '#7c3aed',
    },
  ];

  const userIds = {};
  for (const u of users) {
    const uid = id('usr');
    userIds[u.role] = uid;
    insertUser.run(uid, u.email, password, u.name, u.role, u.phone, u.title, u.color, stamp, stamp);
  }

  /* --- Enseignants --- */
  const teacherSpecs = [
    ['Prosper', 'Mbemba', 'Mathématiques', 'actif', 1240],
    ['Christelle', 'Loubaki', 'Français', 'actif', 890],
    ['Fabrice', 'Ndinga', 'Anglais', 'actif', 640],
    ['Mireille', 'Otsali', 'Physique-Chimie', 'actif', 1520],
    ['Anicet', 'Massamba', 'SVT', 'actif', 410],
    ['Gaëlle', 'Mouanda', 'Histoire-Géographie', 'actif', 980],
    ['Juvénal', 'Tsiba', 'Informatique', 'actif', 260],
    ['Irène', 'Bakala', 'Philosophie', 'conge', 1700],
    ['Yannick', 'Nkodia', 'Éducation civique', 'actif', 720],
    ['Blandine', 'Ngoma', 'EPS', 'actif', 1350],
    ['Hervé', 'Bouanga', 'Mathématiques', 'actif', 560],
    ['Prisca', 'Elenga', 'Français', 'parti', 2100],
  ];
  const teachers = [];
  teacherSpecs.forEach(([first, last, subject, status, days]) => {
    const tid = id('tch');
    const email = `${slug(first)}.${slug(last)}@schoolnet.academy`;
    insertTeacher.run(tid, first, last, email, `+242 0${int(5, 6)} ${int(100, 999)} ${int(10, 99)} ${int(10, 99)}`,
      subject, status, dateOnly(-days), null, stamp, stamp);
    teachers.push({ id: tid, first, last, subject, status });
  });
  // l'enseignant de démo correspond au profil connecté
  const demoTeacher = get('SELECT id FROM teachers WHERE first_name = ? AND last_name = ?', 'Prosper', 'Mbemba');

  /* --- Classes --- */
  const classes = [];
  LEVELS.forEach(({ level, classes: names, fee }) => {
    names.forEach((name) => {
      const cid = id('cls');
      const teacher = pick(teachers.filter((t) => t.status === 'actif'));
      insertClass.run(cid, name, level, pick(ROOMS), teacher.id, int(30, 36), fee,
        `${pick(['07:30', '08:00', '13:30'])} — ${pick(['12:00', '12:30', '17:00'])}`, stamp, stamp);
      classes.push({ id: cid, name, level, fee });
    });
  });

  /* --- Élèves --- */
  const students = [];
  const firstNameFor = (gender) => (gender === 'F' ? pick(FIRST_F) : pick(FIRST_M));
  const usedNames = new Set();
  classes.forEach((cls) => {
    const count = int(18, 25);
    for (let i = 0; i < count; i++) {
      const gender = chance(0.52) ? 'F' : 'M';
      let first = firstNameFor(gender);
      const last = pick(LAST);
      let guard = 0;
      while (usedNames.has(`${first} ${last}`) && guard++ < 20) first = firstNameFor(gender);
      usedNames.add(`${first} ${last}`);
      const sid = id('stu');
      const levelIndex = LEVELS.findIndex((l) => l.level === cls.level);
      const age = 11 + levelIndex + int(0, 1);
      const year = TODAY.getUTCFullYear() - age;
      const guardianFirst = chance(0.6) ? pick(FIRST_F) : pick(FIRST_M);
      insertStudent.run(
        sid, `SNA-${TODAY.getUTCFullYear()}-${num(students.length + 1)}`,
        first, last, gender, `${year}-${pad2(int(1, 12))}-${pad2(int(1, 27))}`,
        cls.id, `${guardianFirst} ${last}`,
        `+242 0${int(5, 6)} ${int(100, 999)} ${int(10, 99)} ${int(10, 99)}`,
        `${slug(guardianFirst)}.${slug(last)}@gmail.com`, null,
        `${int(1, 240)} rue ${pick(['de la Paix', 'Mbochi', 'Kimbangu', 'des Écoles', 'de l\'Indépendance', 'Djoué'])}, ${pick(['Bacongo', 'Makélékélé', 'Poto-Poto', 'Moungali', 'Talangaï', 'Ouenzé'])}`,
        chance(0.94) ? 'actif' : pick(['suspendu', 'diplome', 'parti']),
        dateOnly(students.length % 11 === 0 ? -int(0, 12) : -int(30, 900)),
        null, stamp, stamp,
      );
      students.push({ id: sid, first, last, gender, classId: cls.id, lastName: last });
    }
  });

  // rattache deux élèves au compte parent de démo
  const parentKid1 = students[2];
  const parentKid2 = students[20];
  db.prepare('UPDATE students SET guardian_user_id = ? WHERE id IN (?, ?)')
    .run(userIds.parent, parentKid1.id, parentKid2.id);
  db.prepare("UPDATE users SET name = ?, title = ? WHERE id = ?")
    .run(`Nadège ${parentKid1.last}`, 'Parent de 2 élèves', userIds.parent);
  db.prepare('UPDATE students SET guardian_name = ?, guardian_email = ? WHERE guardian_user_id = ?')
    .run(get('SELECT name FROM users WHERE id = ?', userIds.parent).name,
      'parent.ondongo@schoolnet.academy', userIds.parent);

  /* --- Paiements --- */
  const termFor = (offsetDays) => {
    const d = new Date(TODAY.getTime() + offsetDays * 86400000);
    const m = d.getUTCMonth();
    return m >= 8 ? 'Trimestre 1' : m >= 0 && m <= 2 ? 'Trimestre 2' : 'Trimestre 3';
  };
  let payIndex = 0;
  students.forEach((s, si) => {
    const cls = classes.find((c) => c.id === s.classId);
    const paidTerms = si % 5 === 0 ? 1 : si % 9 === 0 ? 2 : 3;
    for (let t = 0; t < paidTerms; t++) {
      const offset = -(t * 55) - int(2, 52);
      const roll = rand();
      const status = roll < 0.82 ? 'paye' : roll < 0.9 ? 'en_attente' : roll < 0.97 ? 'retard' : 'rembourse';
      const method = pick(METHODS);
      insertPayment.run(
        id('pay'), `PAY-${TODAY.getUTCFullYear()}-${num(++payIndex)}`, s.id,
        cls.fee, 'FCFA', 'Scolarité', method, status,
        status === 'paye' || status === 'rembourse' ? iso(offset, int(9, 17)) : null,
        dateOnly(offset + 10), termFor(offset),
        null, stamp, stamp,
      );
    }
    // frais d'inscription
    insertPayment.run(
      id('pay'), `PAY-${TODAY.getUTCFullYear()}-${num(++payIndex)}`, s.id,
      25000, 'FCFA', 'Inscription', pick(METHODS), 'paye',
      iso(-int(180, 900), int(9, 17)), dateOnly(-int(170, 890)), 'Trimestre 1',
      'Frais d\'inscription annuels', stamp, stamp,
    );
    // quelques extras
    if (chance(0.45)) {
      insertPayment.run(
        id('pay'), `PAY-${TODAY.getUTCFullYear()}-${num(++payIndex)}`, s.id,
        pick([15000, 20000, 35000, 45000]), 'FCFA',
        pick(['Cantine', 'Transport', "Frais d'examen"]), pick(METHODS),
        chance(0.7) ? 'paye' : pick(['en_attente', 'retard']),
        chance(0.7) ? iso(-int(5, 120), int(9, 17)) : null,
        dateOnly(int(-10, 20)), termFor(-int(5, 120)), null, stamp, stamp,
      );
    }
  });
  // échéances à venir pour la fin de mois
  students.slice(0, 6).forEach((s) => {
    const cls = classes.find((c) => c.id === s.classId);
    insertPayment.run(id('pay'), `PAY-${TODAY.getUTCFullYear()}-${num(++payIndex)}`, s.id,
      Math.round(cls.fee / 3 / 500) * 500, 'FCFA', 'Scolarité', pick(METHODS), 'en_attente', null,
      dateOnly(int(3, 21)), 'Trimestre 2', 'Prochaine échéance', stamp, stamp);
  });

  /* --- Inscriptions (admissions) --- */
  const admissionStatuses = ['en_attente', 'en_attente', 'en_revue', 'en_revue', 'acceptee', 'acceptee',
    'refusee', 'inscrite', 'inscrite', 'en_attente', 'en_revue', 'acceptee', 'en_attente', 'refusee',
    'inscrite', 'en_revue', 'en_attente', 'acceptee'];
  admissionStatuses.forEach((status, i) => {
    const gender = chance(0.5) ? 'F' : 'M';
    const first = firstNameFor(gender);
    const last = pick(LAST);
    const submitted = -int(0, 45);
    insertAdmission.run(
      id('adm'), `INS-${TODAY.getUTCFullYear()}-${num(i + 1)}`, `${first} ${last}`,
      `${TODAY.getUTCFullYear() - int(11, 18)}-${pad2(int(1, 12))}-${pad2(int(1, 27))}`,
      gender, pick(LEVELS).level, `${pick(FIRST_F)} ${last}`,
      `+242 0${int(5, 6)} ${int(100, 999)} ${int(10, 99)} ${int(10, 99)}`,
      `${slug(first)}.${slug(last)}@gmail.com`, pick(SCHOOLS), status,
      pick(['Site web', 'Formulaire papier', 'Recommandation', 'Visite sur place']),
      iso(submitted, int(8, 18)),
      ['acceptee', 'refusee', 'inscrite'].includes(status) ? iso(submitted + int(1, 5), int(8, 18)) : null,
      chance(0.3) ? 'Dossier à compléter (acte de naissance).' : null,
      stamp, stamp,
    );
  });

  /* --- Cours en ligne --- */
  const courseSpecs = [
    ['Mathématiques — Fonctions et dérivées', 'Mathématiques', 'Terminale', 'publie', 18, 12, 42, '#0f766e'],
    ['Français — Analyse littéraire', 'Français', '1ère', 'publie', 14, 9, 38, '#b45309'],
    ['Anglais — Grammar essentials', 'Anglais', '3ème', 'publie', 12, 8, 51, '#2563eb'],
    ['Physique — Électricité et circuits', 'Physique-Chimie', '2nde', 'publie', 16, 11, 29, '#7c3aed'],
    ['SVT — Génétique et hérédité', 'SVT', 'Terminale', 'brouillon', 10, 7, 0, '#15803d'],
    ['Informatique — Bureautique et Internet', 'Informatique', '4ème', 'publie', 20, 15, 47, '#0891b2'],
    ['Philosophie — Introduction à la pensée critique', 'Philosophie', 'Terminale', 'brouillon', 8, 6, 0, '#be123c'],
    ['Histoire — Le Congo et l\'Afrique centrale', 'Histoire-Géographie', '5ème', 'publie', 11, 9, 33, '#ca8a04'],
    ['Mathématiques — Géométrie appliquée', 'Mathématiques', '5ème', 'archive', 9, 7, 24, '#475569'],
    ['Éducation civique — Citoyenneté active', 'Éducation civique', '3ème', 'publie', 7, 5, 26, '#0d9488'],
  ];
  courseSpecs.forEach(([title, subject, level, status, lessons, hours, enrolled, color]) => {
    const teacher = teachers.find((t) => t.subject === subject && t.status === 'actif') || teachers[0];
    insertCourse.run(
      id('crs'), title, subject, level,
      subject === 'Mathématiques' && demoTeacher ? demoTeacher.id : teacher.id,
      status, lessons, hours, enrolled,
      `Support de cours en ligne pour les élèves de ${level}. Exercices corrigés, quiz et ressources téléchargeables.`,
      color, stamp, stamp,
    );
  });

  /* --- Annonces --- */
  const announcements = [
    ['Réunion parents — Trimestre 2', "Chers parents, une réunion d'information se tiendra samedi à 9h00 dans la grande salle. Ordre du jour : résultats du premier trimestre, discipline et calendrier des examens. Votre présence est vivement souhaitée.", 'parents', -2],
    ['Rappel : paiement de la scolarité', "Les échéances du trimestre 2 arrivent à terme le 30 de ce mois. Les paiements peuvent être effectués par Mobile Money ou au secrétariat. Merci de vous rapprocher de la comptabilité en cas de difficulté.", 'tous', -5],
    ['Nouveaux cours en ligne disponibles', "Les cours de Mathématiques (Terminale) et d'Informatique (4ème) sont désormais accessibles depuis votre espace élève. Les devoirs sont attendus avant vendredi.", 'eleves', -8],
    ['Conseil de classe — 3ème A', "Le conseil de classe de la 3ème A se tiendra mardi à 14h. Les enseignants sont invités à préparer leurs appréciations dans l'interface.", 'enseignants', -11],
    ['Journée portes ouvertes', "Nous organisons une journée portes ouvertes le samedi 22. Les familles pourront visiter les laboratoires et rencontrer les enseignants. Inscription gratuite via le formulaire d'admission.", 'tous', -16],
    ['Rentrée décalée des 6ème', "La rentrée des classes de 6ème est décalée d'une journée pour permettre la finalisation des inscriptions. Les cours reprennent normalement le lendemain.", 'parents', -24],
    ['Brouillon — Calendrier des examens', "Calendrier provisoire des examens du second trimestre. À valider par la direction avant publication.", 'eleves', -1, 'brouillon'],
  ];
  announcements.forEach(([title, body, audience, days, status]) => {
    const isDraft = status === 'brouillon';
    insertAnnouncement.run(
      id('ann'), title, body, audience, isDraft ? 'brouillon' : 'publie', userIds.admin,
      isDraft ? null : iso(days, 10), stamp, stamp,
    );
  });

  /* --- Notes --- */
  const currentTerm = (() => {
    const m = TODAY.getUTCMonth();
    return m >= 8 ? 'Trimestre 1' : m <= 2 ? 'Trimestre 2' : 'Trimestre 3';
  })();
  const previousTerm = currentTerm === 'Trimestre 1' ? 'Trimestre 3'
    : currentTerm === 'Trimestre 2' ? 'Trimestre 1' : 'Trimestre 2';

  const gradeSubjects = ['Mathématiques', 'Français', 'Anglais', 'Physique-Chimie', 'SVT'];
  students.forEach((s, si) => {
    const strongIn = pick(SUBJECTS.slice(0, 7));
    gradeSubjects.forEach((subject) => {
      const base = subject === strongIn ? 14.5 : 10.5;
      const score = Math.min(20, Math.max(4, Math.round((base + rand() * 5.5 - 2.5) * 2) / 2));
      insertGrade.run(
        id('grd'), s.id, subject, currentTerm, score, 20,
        subject === 'Mathématiques' || subject === 'Français' ? 3 : 2,
        iso(-int(2, 38), int(9, 16)),
        teachers.find((t) => t.subject === subject)?.id || teachers[0].id,
        score >= 16 ? 'Excellent travail.' : score < 10 ? 'Doit fournir plus d\'efforts.' : null,
        stamp, stamp,
      );
      if (si % 4 !== 0) {
        const past = Math.min(20, Math.max(3, Math.round((score + rand() * 4 - 2) * 2) / 2));
        insertGrade.run(
          id('grd'), s.id, subject, previousTerm, past, 20,
          subject === 'Mathématiques' || subject === 'Français' ? 3 : 2,
          iso(-int(120, 200), int(9, 16)),
          teachers.find((t) => t.subject === subject)?.id || teachers[0].id,
          null, stamp, stamp,
        );
      }
    });
  });


  /* --- Université : facultés & filières --- */
  const faculties = [
    ['Faculté des Sciences et Techniques', 'FST', 'Dr Prosper Mbemba', 'Bâtiment A',
      'Sciences et ingénierie : informatique, mathématiques, physique appliquée.'],
    ['Faculté des Lettres et Sciences Humaines', 'FLSH', 'Pr Christelle Loubaki', 'Bâtiment B',
      'Lettres modernes, langues, communication et sciences sociales.'],
    ['Faculté de Droit et Sciences Politiques', 'FDSP', 'Pr Juvénal Tsiba', 'Bâtiment C',
      'Droit privé, droit public et sciences politiques.'],
    ['Faculté des Sciences Économiques et de Gestion', 'FSEG', 'Dr Mireille Otsali', 'Bâtiment D',
      'Comptabilité, finance, management et économie appliquée.'],
  ].map(([name, code, dean, building, description]) => {
    const fid = id('fac');
    insertFaculty.run(fid, name, code, dean, building,
      `+242 06 ${int(100, 999)} ${int(10, 99)} ${int(10, 99)}`,
      `secretariat.${code.toLowerCase()}@schoolnet.academy`, description, stamp, stamp);
    return { id: fid, name, code, dean };
  });

  const programSpecs = [
    ['Informatique', 'INF', 0, 'Licence', 3, 180, 780000],
    ['Mathématiques appliquées', 'MAT', 0, 'Licence', 3, 180, 650000],
    ['Lettres modernes', 'LET', 1, 'Licence', 3, 180, 520000],
    ['Communication et médias', 'COM', 1, 'Master', 2, 120, 890000],
    ['Droit privé', 'DRP', 2, 'Licence', 3, 180, 700000],
    ['Sciences politiques', 'SPO', 2, 'Master', 2, 120, 950000],
    ['Comptabilité et finance', 'CFI', 3, 'Licence', 3, 180, 720000],
    ['Management des organisations', 'MGT', 3, 'Master', 2, 120, 980000],
  ];
  const programs = programSpecs.map(([name, code, facultyIndex, degree, years, credits, fee]) => {
    const pid = id('prg');
    insertProgram.run(pid, faculties[facultyIndex].id, name, code, degree, years, credits, fee, 'ouverte',
      `Parcours ${degree} en ${name.toLowerCase()} — ${years} ans, ${credits} crédits.`, stamp, stamp);
    return { id: pid, name, code, degree, years, credits, fee, facultyId: faculties[facultyIndex].id };
  });

  /* --- Étudiants (université) --- */
  const uniStudents = [];
  const LEVELS_BY_DEGREE = { Licence: ['L1', 'L2', 'L3'], Master: ['M1', 'M2'], Doctorat: ['D1'], BTS: ['BTS1'], Certificat: ['C1'] };
  programs.forEach((program) => {
    for (let i = 0; i < 6; i++) {
      const gender = chance(0.5) ? 'F' : 'M';
      let first = firstNameFor(gender);
      const last = pick(LAST);
      let guard = 0;
      while (usedNames.has(`${first} ${last}`) && guard++ < 20) first = firstNameFor(gender);
      usedNames.add(`${first} ${last}`);
      const sid = id('stu');
      const levels = LEVELS_BY_DEGREE[program.degree] || ['L1'];
      const level = levels[int(0, levels.length - 1)];
      const age = program.degree === 'Master' ? int(22, 27) : int(18, 23);
      insertUniversityStudent.run(
        sid, `UNI-${TODAY.getUTCFullYear()}-${num(uniStudents.length + 1)}`,
        first, last, gender, `${TODAY.getUTCFullYear() - age}-${pad2(int(1, 12))}-${pad2(int(1, 27))}`,
        `${pick(FIRST_F)} ${last}`,
        `+242 0${int(5, 6)} ${int(100, 999)} ${int(10, 99)} ${int(10, 99)}`,
        `${slug(first)}.${slug(last)}@etu.schoolnet.academy`,
        `${int(1, 180)} avenue ${pick(['de l\'Université', 'Marien Ngouabi', 'de la Science', 'des Étudiants'])}, ${pick(['Bacongo', 'Moungali', 'Talangaï', 'Makélékélé'])}`,
        chance(0.95) ? 'actif' : pick(['suspendu', 'diplome']),
        program.id, level, dateOnly(-int(30, 1200)), stamp, stamp,
      );
      uniStudents.push({ id: sid, first, last, programId: program.id, level });
    }
  });

  /* --- Unités d'enseignement (maquette LMD complète) --- */
  const unitTitles = {
    INF: ['Algorithmique et programmation', 'Bases de données', 'Développement web', 'Réseaux et systèmes', 'Mathématiques pour l’informatique'],
    MAT: ['Analyse mathématique', 'Algèbre linéaire', 'Probabilités et statistiques', 'Analyse numérique', 'Modélisation appliquée'],
    LET: ['Littérature africaine', 'Linguistique générale', 'Méthodologie du commentaire', 'Littérature comparée', 'Expression écrite et orale'],
    COM: ['Théories de la communication', 'Production audiovisuelle', 'Communication institutionnelle', 'Journalisme et médias', 'Communication numérique'],
    DRP: ['Droit civil', 'Droit des obligations', 'Procédure pénale', 'Droit du travail', 'Droit OHADA des affaires'],
    SPO: ['Science politique comparée', 'Relations internationales', 'Politiques publiques', 'Sociologie politique', 'Histoire des idées politiques'],
    CFI: ['Comptabilité générale', 'Analyse financière', 'Fiscalité congolaise', 'Comptabilité OHADA', 'Contrôle de gestion'],
    MGT: ['Management stratégique', 'Gestion des ressources humaines', 'Marketing et marchés', 'Gestion de projet', 'Éthique des affaires'],
  };
  const units = [];
  programs.forEach((program) => {
    const titles = unitTitles[program.code] ?? ['Introduction au programme', 'Méthodologie', 'Séminaire de recherche', 'Langue et communication', 'Projet tutoré'];
    const semesters = program.degree === 'Master' ? 4 : program.years * 2;
    const programTeachers = teachers.filter((t) => t.status === 'actif');
    for (let sem = 1; sem <= semesters; sem++) {
      for (let i = 0; i < 5; i++) {
        const base = titles[i % titles.length];
        const title = sem > semesters / 2 ? `${base} II` : base;
        const teacher = programTeachers[(sem * 5 + i + program.code.charCodeAt(0)) % programTeachers.length];
        const uidv = id('unt');
        insertUnit.run(
          uidv, program.id, `${program.code}-${sem}0${i + 1}`, title, sem, 6, 45,
          teacher.id, `Unité d'enseignement « ${title} » — ${program.name}, semestre ${sem}.`, 'actif', stamp, stamp,
        );
        units.push({ id: uidv, programId: program.id, title, semester: sem });
      }
    }
  });

  /* --- Emploi du temps --- */
  const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
  const SLOTS = [['07:30', '09:30'], ['09:45', '11:45'], ['13:00', '15:00'], ['15:15', '17:15']];
  classes.forEach((cls, ci) => {
    for (let i = 0; i < 2; i++) {
      const slot = SLOTS[(ci + i) % SLOTS.length];
      insertSchedule.run(
        id('sch'), `Cours de ${pick(SUBJECTS.slice(0, 6))}`, cls.id, null,
        pick(teachers.filter((t) => t.status === 'actif')).id, pick(ROOMS), DAYS[(ci + i) % 5],
        slot[0], slot[1], pick(['Cours', 'TD']), stamp, stamp,
      );
    }
  });
  programs.forEach((program, pi) => {
    const programUnits = units.filter((u) => u.programId === program.id && u.semester === 1).slice(0, 3);
    programUnits.forEach((unit, ui) => {
      const slot = SLOTS[(pi + ui) % SLOTS.length];
      insertSchedule.run(
        id('sch'), unit.title, null, program.id,
        pick(teachers.filter((t) => t.status === 'actif')).id, `Amphi ${String.fromCharCode(65 + (pi % 4))}`,
        DAYS[(pi + ui) % 5], slot[0], slot[1], pick(['Cours', 'TD', 'TP']), stamp, stamp,
      );
    });
  });

  /* --- Bibliothèque --- */
  const bookSpecs = [
    ['Une saison blanche et sèche', 'André Brink', 'Roman', 'Littérature', 4],
    ["L'Enfant noir", 'Camara Laye', 'Roman', 'Littérature', 5],
    ['Le Pleurer-Rire', 'Henri Lopes', 'Roman', 'Littérature', 3],
    ['Les Bouts de bois de Dieu', 'Sembène Ousmane', 'Roman', 'Littérature', 3],
    ['Mathématiques pour l’ingénieur', 'Prosper Mbemba', 'Manuel', 'Sciences', 6],
    ['Analyse numérique et algorithmes', 'Collectif FST', 'Manuel', 'Sciences', 4],
    ['Introduction aux bases de données', 'C. J. Date', 'Manuel', 'Informatique', 4],
    ['Apprendre Python en 30 jours', 'A. Bouanga', 'Manuel', 'Informatique', 7],
    ['Droit civil congolais', 'J. Tsiba', 'Manuel', 'Droit', 3],
    ['Droit constitutionnel comparé', 'M. Ndinga', 'Manuel', 'Droit', 2],
    ['Économie générale', 'Mireille Otsali', 'Manuel', 'Économie', 5],
    ['Comptabilité OHADA', 'Collectif FSEG', 'Manuel', 'Économie', 6],
    ['Histoire de l’Afrique centrale', 'Gaëlle Mouanda', 'Essai', 'Histoire', 4],
    ['Philosophie africaine', 'Irène Bakala', 'Essai', 'Philosophie', 3],
    ['Atlas du Congo', 'Institut géographique', 'Atlas', 'Géographie', 2],
    ['Physique expérimentale', 'Mireille Otsali', 'Manuel', 'Sciences', 3],
    ['Communication et société', 'Christelle Loubaki', 'Essai', 'Communication', 3],
    ['Management des organisations', 'Collectif FSEG', 'Manuel', 'Gestion', 4],
  ];
  const books = bookSpecs.map(([title, author, isbn, category, copies]) => {
    const bid = id('bok');
    insertBook.run(bid, title, author, `978-2-${int(100000, 999999)}-${int(10, 99)}-${int(1, 9)}`,
      category, copies, copies, `Rayon ${pick(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])}`, stamp, stamp);
    return { id: bid, title, copies };
  });

  const borrowers = [...students.slice(0, 12), ...uniStudents.slice(0, 8)];
  borrowers.forEach((student, index) => {
    const book = books[index % books.length];
    const loaned = -int(3, 40);
    const due = loaned + 14;
    const returned = due < -2 && chance(0.7);
    const status = returned ? 'rendu' : due < -1 ? 'retard' : 'en_cours';
    insertLoan.run(
      id('lon'), book.id, student.id, iso(loaned, int(8, 16)), dateOnly(due),
      returned ? iso(due + int(0, 2), 12) : null, status, stamp, stamp,
    );
  });
  // disponibilité = exemplaires - emprunts en cours
  db.exec(`UPDATE books SET copies_available = copies_total - (
    SELECT COUNT(*) FROM loans l WHERE l.book_id = books.id AND l.status <> 'rendu')`);

  /* --- Présences --- */
  const SESSIONS = ['08:00', '10:00', '14:00'];
  for (let d = 0; d < 10; d++) {
    const dayOffset = -d;
    const date = new Date(TODAY.getTime() + dayOffset * 86400000);
    if ([0, 6].includes(date.getUTCDay())) continue;
    students.slice(0, 40).forEach((student) => {
      if (!chance(0.22)) return;
      const roll = rand();
      const status = roll < 0.72 ? 'present' : roll < 0.85 ? 'absent' : roll < 0.94 ? 'retard' : 'excuse';
      insertAttendance.run(
        id('att'), student.id, student.classId, null, dateOnly(dayOffset),
        pick(SESSIONS), status, status === 'excuse' ? 'Justificatif remis au secrétariat.' : null, stamp, stamp,
      );
    });
  uniStudents.slice(0, 16).forEach((student) => {
      if (!chance(0.2)) return;
      const roll = rand();
      const status = roll < 0.78 ? 'present' : roll < 0.9 ? 'absent' : 'retard';
      insertAttendance.run(
        id('att'), student.id, null, student.programId, dateOnly(dayOffset),
        pick(SESSIONS), status, null, stamp, stamp,
      );
    });
  }

  /* --- Cartes scolaires (QR + code-barres + badge NFC) --- */
  const CARD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const usedCards = new Set();
  const cardCode = () => {
    let code = '';
    do {
      let suffix = '';
      for (let i = 0; i < 6; i += 1) suffix += CARD_ALPHABET[int(0, CARD_ALPHABET.length - 1)];
      code = `SNA-${String(TODAY.getUTCFullYear()).slice(2)}-${suffix}`;
    } while (usedCards.has(code));
    usedCards.add(code);
    return code;
  };
  const badge = (n) => `04:${pad2(11 + (n % 5))}:${pad2(20 + (n % 40))}:${pad2(30 + (n % 60))}:${pad2(n % 90)}:${pad2((n * 7) % 90)}`;
  const setCard = db.prepare('UPDATE students SET card_code = ?, card_issued_at = ?, nfc_tag = ?, updated_at = ? WHERE id = ?');
  [...students, ...uniStudents].forEach((student, index) => {
    setCard.run(cardCode(), stamp, index < 12 ? badge(index) : null, stamp, student.id);
  });

  return {
    users: users.length + 0,
    teachers: teachers.length,
    classes: classes.length,
    students: students.length + uniStudents.length,
    universityStudents: uniStudents.length,
    faculties: faculties.length,
    programs: programs.length,
    courseUnits: units.length,
    books: books.length,
    payments: payIndex,
  };
}

/* ------------------------------------------------------------------ */

export function resetDatabase() {
  const tables = ['attendance', 'loans', 'books', 'schedules', 'course_units', 'programs', 'faculties',
    'grades', 'payments', 'admissions', 'courses', 'announcements', 'students',
    'classes', 'teachers', 'sessions', 'users'];
  db.exec('PRAGMA foreign_keys = OFF;');
  for (const t of tables) db.exec(`DELETE FROM ${t};`);
  db.exec('PRAGMA foreign_keys = ON;');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  migrate();
  const reset = process.argv.includes('--reset');
  if (reset) resetDatabase();
  if (isEmpty() || reset) {
    const summary = seed();
    console.log('✔ Base de démonstration initialisée :', summary);
    console.log(`  Comptes disponibles (mot de passe : ${DEMO_PASSWORD}) :`);
    console.log('   • direction@schoolnet.academy  (direction)');
    console.log('   • prof.mbemba@schoolnet.academy (enseignant)');
    console.log('   • parent.ondongo@schoolnet.academy (parent)');
  } else {
    console.log('ℹ La base contient déjà des données (utilisez --reset pour régénérer).');
  }
}
