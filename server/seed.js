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

  return {
    users: users.length + 0,
    teachers: teachers.length,
    classes: classes.length,
    students: students.length,
    payments: payIndex,
  };
}

/* ------------------------------------------------------------------ */

export function resetDatabase() {
  const tables = ['grades', 'payments', 'admissions', 'courses', 'announcements', 'students',
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
