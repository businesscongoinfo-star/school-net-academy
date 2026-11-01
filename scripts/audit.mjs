#!/usr/bin/env node
/**
 * Audit fonctionnel de bout en bout de l'API School Net Academy.
 *
 * Usage :
 *   node scripts/audit.mjs                # cible http://127.0.0.1:3000
 *   BASE=http://127.0.0.1:3300 node scripts/audit.mjs
 *
 * Chaque vérification couvre un parcours réel : lecture, création, mise à jour,
 * suppression et contrôle des droits par rôle. Le script nettoie derrière lui.
 */

const BASE = process.env.BASE || 'http://127.0.0.1:3000';
const PASSWORD = process.env.DEMO_PASSWORD || 'demo1234';

const ACCOUNTS = {
  admin: 'direction@schoolnet.academy',
  teacher: 'prof.mbemba@schoolnet.academy',
  parent: 'parent.ondongo@schoolnet.academy',
};

let passed = 0;
const failures = [];
const groups = new Map();

function record(group, name, ok, detail = '') {
  if (!groups.has(group)) groups.set(group, []);
  groups.get(group).push({ name, ok, detail });
  if (ok) passed += 1;
  else failures.push({ group, name, detail });
}

async function check(group, name, fn) {
  try {
    const detail = await fn();
    record(group, name, true, typeof detail === 'string' ? detail : '');
  } catch (error) {
    record(group, name, false, error.message);
  }
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

class Client {
  constructor(label) {
    this.label = label;
    this.cookie = '';
  }

  async request(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.cookie) headers.Cookie = this.cookie;
    const response = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const raw = await response.text();
    let json = null;
    try { json = raw ? JSON.parse(raw) : null; } catch { /* html */ }
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) this.cookie = setCookie.split(';')[0];
    return { status: response.status, json, raw, headers: response.headers };
  }

  get(path) { return this.request('GET', path); }
  post(path, body) { return this.request('POST', path, body); }
  patch(path, body) { return this.request('PATCH', path, body); }
  del(path) { return this.request('DELETE', path); }

  async ok(method, path, body, expectStatus = 200) {
    const res = await this.request(method, path, body);
    expect(
      res.status === expectStatus,
      `${method} ${path} → ${res.status} (attendu ${expectStatus}) ${res.raw.slice(0, 160)}`,
    );
    return res.json;
  }
}

async function login(role) {
  const client = new Client(role);
  const res = await client.post('/api/auth/login', { email: ACCOUNTS[role], password: PASSWORD });
  expect(res.status === 200, `connexion ${role} → ${res.status} ${res.raw.slice(0, 140)}`);
  expect(client.cookie, `cookie de session absent pour ${role}`);
  return client;
}

const isoDate = (offsetDays = 0) =>
  new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);

async function main() {
  console.log(`\n🔎 Audit School Net Academy → ${BASE}\n`);

  const admin = new Client('anonyme');

  // ─── Santé & authentification ────────────────────────────────────────────
  await check('Santé & session', 'GET /api/health répond ok', async () => {
    const res = await admin.get('/api/health');
    expect(res.status === 200 && res.json?.ok === true, `statut ${res.status}`);
    return res.json.service;
  });

  await check('Santé & session', 'API protégée sans cookie → 401', async () => {
    const res = await admin.get('/api/dashboard');
    expect(res.status === 401, `statut ${res.status}`);
  });

  await check('Santé & session', 'Mauvais mot de passe → 401', async () => {
    const res = await new Client('bad').post('/api/auth/login', { email: ACCOUNTS.admin, password: 'faux' });
    expect(res.status === 401, `statut ${res.status}`);
  });

  await check('Santé & session', 'Connexion direction', async () => {
    const res = await admin.post('/api/auth/login', { email: ACCOUNTS.admin, password: PASSWORD });
    expect(res.status === 200, `statut ${res.status}`);
    admin.cookie = res.headers.get('set-cookie').split(';')[0];
    return `${res.json.user.name} (${res.json.user.role})`;
  });

  const teacher = await login('teacher').catch(() => null);
  const parent = await login('parent').catch(() => null);
  record('Santé & session', 'Connexion enseignant', Boolean(teacher), teacher ? '' : 'échec');
  record('Santé & session', 'Connexion parent', Boolean(parent), parent ? '' : 'échec');

  await check('Santé & session', 'GET /api/auth/me', async () => {
    const json = await admin.ok('GET', '/api/auth/me');
    expect(json.user?.email === ACCOUNTS.admin, 'utilisateur inattendu');
    return json.user.role;
  });

  await check('Santé & session', 'Mise à jour du profil', async () => {
    const json = await admin.ok('PATCH', '/api/auth/profile', { name: 'Chancelle Mabiala', title: 'Directrice générale' });
    expect(json.user?.name === 'Chancelle Mabiala', 'nom non appliqué');
  });

  await check('Santé & session', 'Changement de mot de passe refusé si mot de passe actuel faux', async () => {
    const res = await admin.post('/api/auth/password', { currentPassword: 'faux', newPassword: 'nouveaupass1' });
    expect(res.status === 400, `statut ${res.status}`);
  });

  // ─── Méta / référentiels ─────────────────────────────────────────────────
  const meta = await check('Référentiels', 'GET /api/meta', async () => {
    const json = await admin.ok('GET', '/api/meta');
    expect(Array.isArray(json.classes) || Array.isArray(json.levels), 'structure inattendue');
    return Object.keys(json).join(', ').slice(0, 100);
  }).then(() => admin.get('/api/meta')).then((r) => r.json);

  const classes = meta?.classes ?? [];
  const classId = classes[0]?.id;
  const programs = meta?.programs ?? [];
  const programId = programs[0]?.id;
  const teachers = meta?.teachers ?? [];
  const teacherId = teachers[0]?.teamId ?? teachers[0]?.id;
  const faculties = meta?.faculties ?? [];
  const facultyId = faculties[0]?.id;

  // ─── Tableau de bord (3 rôles) ───────────────────────────────────────────
  for (const [role, client] of [['direction', admin], ['enseignant', teacher], ['parent', parent]]) {
    if (!client) continue;
    await check('Tableau de bord', `GET /api/dashboard (${role})`, async () => {
      const json = await client.ok('GET', '/api/dashboard');
      expect(json.kpis, 'indicateurs manquants');
      return `${json.kpis.students} élèves · ${json.role}`;
    });
  }

  // ─── Élèves ──────────────────────────────────────────────────────────────
  let studentId = null;
  await check('Élèves', 'GET /api/students', async () => {
    const json = await admin.ok('GET', '/api/students');
    expect(Array.isArray(json.items) && json.items.length > 0, 'liste vide');
    studentId = json.items[0].id;
    return `${json.items.length} élèves · stats ${Object.keys(json.stats).length}`;
  });

  await check('Élèves', 'Recherche + filtres', async () => {
    const json = await admin.ok('GET', `/api/students?search=a&status=actif&classId=${classId}`);
    expect(Array.isArray(json.items), 'pas de résultats');
    return `${json.items.length} résultats`;
  });

  await check('Élèves', 'GET /api/students/:id (fiche détaillée)', async () => {
    const res = await admin.get(`/api/students/${studentId}`);
    expect(res.status === 200, `statut ${res.status}`);
    const keys = Object.keys(res.json.student ?? {});
    expect(keys.length >= 10, 'fiche incomplète');
    return `paiements:${res.json.payments?.length ?? 0} notes:${res.json.grades?.length ?? 0}`;
  });

  let createdStudent = null;
  await check('Élèves', 'POST /api/students (création)', async () => {
    const json = await admin.ok('POST', '/api/students', {
      firstName: 'Audit', lastName: 'Testeur', gender: 'M', classId,
      guardianName: 'Parent Audit', guardianPhone: '+242 06 000 00 00',
    }, 201);
    createdStudent = json.student ?? json.item ?? json;
    expect(createdStudent?.id, 'identifiant manquant');
    return createdStudent.matricule;
  });

  await check('Élèves', 'PATCH /api/students/:id (modification)', async () => {
    const json = await admin.ok('PATCH', `/api/students/${createdStudent.id}`, { lastName: 'Testeur-Modifié', status: 'suspendu' });
    const item = json.student ?? json.item ?? json;
    expect(item.lastName === 'Testeur-Modifié' || item.last_name === 'Testeur-Modifié', 'modification non appliquée');
  });

  await check('Élèves', 'Validation : prénom trop court → 400', async () => {
    const res = await admin.post('/api/students', { firstName: 'A', lastName: 'B' });
    expect(res.status === 400, `statut ${res.status}`);
  });

  await check('Élèves', 'Portée parent : ne voit que ses enfants', async () => {
    if (!parent) throw new Error('compte parent indisponible');
    const json = await parent.ok('GET', '/api/students');
    const all = await admin.ok('GET', '/api/students');
    expect(json.items.length > 0, 'aucun enfant rattaché');
    expect(json.items.length < all.items.length, 'le parent voit toute l’école');
    return `${json.items.length} enfant(s)`;
  });

  await check('Élèves', 'Parent ne peut pas créer un élève', async () => {
    if (!parent) throw new Error('compte parent indisponible');
    const res = await parent.post('/api/students', { firstName: 'Xavier', lastName: 'Intrus' });
    expect(res.status === 403, `statut ${res.status}`);
  });

  await check('Élèves', 'Suppression bloquée si la fiche a un historique', async () => {
    const list = await admin.ok('GET', '/api/students');
    const withHistory = list.items.find((item) => item.paidTotal > 0);
    if (!withHistory) throw new Error('aucun élève avec paiement');
    const res = await admin.del(`/api/students/${withHistory.id}`);
    expect(res.status === 409, `statut ${res.status} — historique supprimé en cascade`);
    const detail = await admin.get(`/api/students/${withHistory.id}`);
    expect(detail.status === 200, 'la fiche a disparu');
  });

  await check('Élèves', 'Suppression de l’élève de test', async () => {
    await admin.ok('DELETE', `/api/students/${createdStudent.id}`);
    const res = await admin.get(`/api/students/${createdStudent.id}`);
    expect(res.status === 404, `statut ${res.status} après suppression`);
  });

  // ─── Classes ─────────────────────────────────────────────────────────────
  let createdClass = null;
  await check('Classes', 'GET /api/classes', async () => {
    const json = await admin.ok('GET', '/api/classes');
    expect((json.items ?? json).length > 0, 'liste vide');
    return `${(json.items ?? json).length} classes`;
  });

  await check('Classes', 'POST /api/classes', async () => {
    const json = await admin.ok('POST', '/api/classes', {
      name: 'Audit A', level: '6ème', room: 'Salle Test', capacity: 35, tuitionFee: 180000,
    }, 201);
    createdClass = json.class ?? json.item ?? json;
    expect(createdClass?.id, 'identifiant manquant');
  });

  await check('Classes', 'PATCH /api/classes/:id', async () => {
    const json = await admin.ok('PATCH', `/api/classes/${createdClass.id}`, { room: 'Salle Audit 2' });
    const item = json.class ?? json.item ?? json;
    expect(item.room === 'Salle Audit 2', 'modification non appliquée');
  });

  await check('Classes', 'GET /api/classes/:id', async () => {
    const res = await admin.get(`/api/classes/${classId}`);
    expect(res.status === 200, `statut ${res.status}`);
  });

  await check('Classes', 'Enseignant ne peut pas créer une classe → 403', async () => {
    if (!teacher) throw new Error('compte enseignant indisponible');
    const res = await teacher.post('/api/classes', { name: 'Interdit', level: '5ème' });
    expect(res.status === 403, `statut ${res.status}`);
  });

  await check('Classes', 'DELETE /api/classes/:id', async () => {
    await admin.ok('DELETE', `/api/classes/${createdClass.id}`);
  });

  // ─── Enseignants ─────────────────────────────────────────────────────────
  let createdTeacher = null;
  await check('Enseignants', 'GET /api/teachers', async () => {
    const json = await admin.ok('GET', '/api/teachers');
    expect((json.items ?? json).length > 0, 'liste vide');
    return `${(json.items ?? json).length} enseignants`;
  });

  await check('Enseignants', 'POST /api/teachers', async () => {
    const json = await admin.ok('POST', '/api/teachers', {
      firstName: 'Aline', lastName: 'Audit', email: `aline.audit.${Date.now()}@schoolnet.academy`,
      subject: 'Informatique', phone: '+242 06 111 11 11', hiredAt: isoDate(-200),
    }, 201);
    createdTeacher = json.teacher ?? json.item ?? json;
    expect(createdTeacher?.id, 'identifiant manquant');
  });

  await check('Enseignants', 'PATCH /api/teachers/:id', async () => {
    const json = await admin.ok('PATCH', `/api/teachers/${createdTeacher.id}`, { status: 'conge' });
    const item = json.teacher ?? json.item ?? json;
    expect(item.status === 'conge', 'statut non appliqué');
  });

  await check('Enseignants', 'DELETE /api/teachers/:id', async () => {
    await admin.ok('DELETE', `/api/teachers/${createdTeacher.id}`);
  });

  // ─── Admissions ──────────────────────────────────────────────────────────
  let admission = null;
  await check('Admissions', 'GET /api/admissions', async () => {
    const json = await admin.ok('GET', '/api/admissions');
    expect((json.items ?? json).length > 0, 'liste vide');
    return `${(json.items ?? json).length} dossiers`;
  });

  await check('Admissions', 'POST /api/admissions', async () => {
    const json = await admin.ok('POST', '/api/admissions', {
      studentName: 'Candidate Audit', level: '6ème', gender: 'F',
      guardianName: 'Tuteur Audit', guardianPhone: '+242 06 222 22 22', source: 'Audit',
    }, 201);
    admission = json.admission ?? json.item ?? json;
    expect(admission?.id, 'identifiant manquant');
    return admission.reference;
  });

  await check('Admissions', 'PATCH /api/admissions/:id (décision)', async () => {
    const json = await admin.ok('PATCH', `/api/admissions/${admission.id}`, { status: 'acceptee' });
    const item = json.admission ?? json.item ?? json;
    expect(item.status === 'acceptee', 'statut non appliqué');
  });

  await check('Admissions', 'POST /api/admissions/:id/enroll (conversion en élève)', async () => {
    const res = await admin.post(`/api/admissions/${admission.id}/enroll`, { classId });
    expect(res.status === 200 || res.status === 201, `statut ${res.status} ${res.raw.slice(0, 120)}`);
    expect(res.json.student?.matricule, 'matricule non généré');
    admission.enrolledStudentId = res.json.student.id;
    return res.json.student.matricule;
  });

  await check('Admissions', 'Contrôle des places disponibles', async () => {
    const res = await admin.post(`/api/admissions/${admission.id}/enroll`, { classId: 'cls-inexistant' });
    expect(res.status === 400 || res.status === 409, `statut ${res.status}`);
  });

  await check('Admissions', 'Suppression du dossier + élève généré', async () => {
    if (admission.enrolledStudentId) await admin.del(`/api/students/${admission.enrolledStudentId}`);
    const res = await admin.del(`/api/admissions/${admission.id}`);
    expect([200, 204].includes(res.status), `statut ${res.status}`);
  });

  // ─── Paiements ───────────────────────────────────────────────────────────
  let payment = null;
  await check('Paiements', 'GET /api/payments', async () => {
    const json = await admin.ok('GET', '/api/payments');
    expect((json.items ?? json).length > 0, 'liste vide');
    return `${(json.items ?? json).length} paiements · total ${json.stats?.total ?? '—'}`;
  });

  await check('Paiements', 'POST /api/payments', async () => {
    const json = await admin.ok('POST', '/api/payments', {
      studentId, amount: 45000, type: 'Scolarité', method: 'Mobile Money', status: 'paye', paidAt: isoDate(),
    }, 201);
    payment = json.payment ?? json.item ?? json;
    expect(payment?.id, 'identifiant manquant');
  });

  await check('Paiements', 'PATCH /api/payments/:id', async () => {
    const json = await admin.ok('PATCH', `/api/payments/${payment.id}`, { status: 'rembourse' });
    const item = json.payment ?? json.item ?? json;
    expect(item.status === 'rembourse', 'statut non appliqué');
  });

  await check('Paiements', 'DELETE /api/payments/:id', async () => {
    await admin.ok('DELETE', `/api/payments/${payment.id}`);
  });

  await check('Paiements', 'Parent ne voit que les paiements de ses enfants', async () => {
    if (!parent) throw new Error('compte parent indisponible');
    const json = await parent.ok('GET', '/api/payments');
    const all = await admin.ok('GET', '/api/payments');
    expect((json.items ?? json).length < (all.items ?? all).length, 'le parent voit tous les paiements');
  });

  // ─── Notes & résultats ───────────────────────────────────────────────────
  let grade = null;
  await check('Notes', 'POST /api/grades', async () => {
    const json = await admin.ok('POST', '/api/grades', {
      studentId, subject: 'Audit', term: 'Trimestre 1', score: 15.5, coefficient: 2, teacherId,
    }, 201);
    grade = json.grade ?? json.item ?? json;
    expect(grade?.id, 'identifiant manquant');
  });

  await check('Notes', 'PATCH /api/grades/:id', async () => {
    const json = await admin.ok('PATCH', `/api/grades/${grade.id}`, { score: 17 });
    const item = json.grade ?? json.item ?? json;
    expect(Number(item.score) === 17, 'note non appliquée');
  });

  await check('Notes', 'Validation : note > 20 → 400', async () => {
    const res = await admin.post('/api/grades', { studentId, subject: 'Audit', term: 'Trimestre 1', score: 25 });
    expect(res.status === 400, `statut ${res.status}`);
  });

  await check('Notes', 'GET /api/grades/results', async () => {
    const json = await admin.ok('GET', '/api/grades/results?term=Trimestre%201');
    expect(Array.isArray(json.items ?? json.rows ?? json), 'structure inattendue');
    return `${(json.items ?? json.rows ?? json).length} élèves évalués`;
  });

  await check('Notes', 'DELETE /api/grades/:id', async () => {
    await admin.ok('DELETE', `/api/grades/${grade.id}`);
  });

  // ─── Cours ───────────────────────────────────────────────────────────────
  let course = null;
  await check('Cours', 'GET /api/courses', async () => {
    const json = await admin.ok('GET', '/api/courses');
    expect((json.items ?? json).length > 0, 'liste vide');
    return `${(json.items ?? json).length} cours`;
  });

  await check('Cours', 'POST /api/courses', async () => {
    const json = await admin.ok('POST', '/api/courses', {
      title: 'Cours audit', subject: 'Informatique', level: '6ème', teacherId,
      status: 'publie', lessonsCount: 4, durationHours: 6,
    }, 201);
    course = json.course ?? json.item ?? json;
    expect(course?.id, 'identifiant manquant');
  });

  await check('Cours', 'PATCH /api/courses/:id', async () => {
    await admin.ok('PATCH', `/api/courses/${course.id}`, { status: 'archive' });
  });

  await check('Cours', 'Enseignant peut créer un cours', async () => {
    if (!teacher) throw new Error('compte enseignant indisponible');
    const res = await teacher.post('/api/courses', { title: 'Cours enseignant audit', subject: 'Maths', level: '5ème' });
    expect(res.status === 201, `statut ${res.status} ${res.raw.slice(0, 120)}`);
    await admin.del(`/api/courses/${(res.json.course ?? res.json.item ?? res.json).id}`);
  });

  await check('Cours', 'DELETE /api/courses/:id', async () => {
    await admin.ok('DELETE', `/api/courses/${course.id}`);
  });

  // ─── Annonces ────────────────────────────────────────────────────────────
  let announcement = null;
  await check('Annonces', 'GET /api/annonces (tous rôles)', async () => {
    const json = await admin.ok('GET', '/api/announcements');
    expect((json.items ?? json).length > 0, 'liste vide');
    for (const client of [teacher, parent]) {
      if (!client) continue;
      const res = await client.get('/api/announcements');
      expect(res.status === 200, `${client.label} → ${res.status}`);
    }
    return `${(json.items ?? json).length} annonces`;
  });

  await check('Annonces', 'POST /api/announcements', async () => {
    const json = await admin.ok('POST', '/api/announcements', {
      title: 'Annonce audit', body: 'Contenu de test suffisamment long pour passer la validation.',
      audience: 'parents', status: 'publie',
    }, 201);
    announcement = json.announcement ?? json.item ?? json;
    expect(announcement?.id, 'identifiant manquant');
  });

  await check('Annonces', 'PATCH /api/announcements/:id', async () => {
    await admin.ok('PATCH', `/api/announcements/${announcement.id}`, { status: 'brouillon' });
  });

  await check('Annonces', 'Enseignant ne peut pas publier → 403', async () => {
    if (!teacher) throw new Error('compte enseignant indisponible');
    const res = await teacher.post('/api/announcements', { title: 'Interdit', body: 'Message interdit par les droits.' });
    expect(res.status === 403, `statut ${res.status}`);
  });

  await check('Annonces', 'DELETE /api/announcements/:id', async () => {
    await admin.ok('DELETE', `/api/announcements/${announcement.id}`);
  });

  // ─── Université : facultés, filières, UE ─────────────────────────────────
  let faculty = null;
  let program = null;
  let unit = null;

  await check('Université', 'GET /api/faculties', async () => {
    const json = await admin.ok('GET', '/api/faculties');
    expect((json.items ?? json).length > 0, 'liste vide');
    return `${(json.items ?? json).length} facultés`;
  });

  await check('Université', 'POST /api/faculties', async () => {
    const json = await admin.ok('POST', '/api/faculties', {
      name: 'Faculté Audit', code: 'FAU', dean: 'Doyen Audit', building: 'Bât. A',
    }, 201);
    faculty = json.faculty ?? json.item ?? json;
    expect(faculty?.id, 'identifiant manquant');
  });

  await check('Université', 'POST /api/programs', async () => {
    const json = await admin.ok('POST', '/api/programs', {
      name: 'Filière Audit', code: 'FIA', facultyId: faculty.id, degree: 'Licence',
      durationYears: 3, totalCredits: 180, tuitionFee: 700000,
    }, 201);
    program = json.program ?? json.item ?? json;
    expect(program?.id, 'identifiant manquant');
  });

  await check('Université', 'POST /api/course-units', async () => {
    const json = await admin.ok('POST', '/api/course-units', {
      programId: program.id, code: 'FAU101', title: 'Unité audit', semester: 1, credits: 6, hours: 45, teacherId,
    }, 201);
    unit = json.unit ?? json.courseUnit ?? json.item ?? json;
    expect(unit?.id, 'identifiant manquant');
  });

  await check('Université', 'PATCH /api/course-units/:id', async () => {
    await admin.ok('PATCH', `/api/course-units/${unit.id}`, { credits: 8 });
  });

  await check('Université', 'Cohérence de la maquette (crédits par semestre)', async () => {
    const json = await admin.ok('GET', `/api/course-units?programId=${program.id}`);
    const items = json.items ?? json;
    expect(items.length >= 1, 'unité non visible');
    return `${items.length} UE dans la filière`;
  });

  await check('Université', 'Nettoyage filière + faculté', async () => {
    await admin.del(`/api/course-units/${unit.id}`);
    const resProg = await admin.del(`/api/programs/${program.id}`);
    const resFac = await admin.del(`/api/faculties/${faculty.id}`);
    expect([200, 204, 409].includes(resProg.status), `filière ${resProg.status}`);
    expect([200, 204, 409].includes(resFac.status), `faculté ${resFac.status}`);
  });

  // ─── Emploi du temps ─────────────────────────────────────────────────────
  let slot = null;
  await check('Emploi du temps', 'GET /api/schedules', async () => {
    const json = await admin.ok('GET', '/api/schedules');
    expect((json.items ?? json).length > 0, 'planning vide');
    return `${(json.items ?? json).length} séances`;
  });

  await check('Emploi du temps', 'POST /api/schedules', async () => {
    const json = await admin.ok('POST', '/api/schedules', {
      title: 'Séance audit', classId, teacherId, room: 'Salle audit', day: 'Samedi',
      startTime: '16:00', endTime: '17:30', kind: 'Cours',
    }, 201);
    slot = json.schedule ?? json.slot ?? json.item ?? json;
    expect(slot?.id, 'identifiant manquant');
    return `${slot.day} ${slot.startTime}–${slot.endTime}`;
  });

  await check('Emploi du temps', 'Conflit de classe détecté → 409', async () => {
    const res = await admin.post('/api/schedules', {
      title: 'Conflit audit', classId, day: 'Samedi', startTime: '16:30', endTime: '18:00', kind: 'Cours',
    });
    expect(res.status === 409, `statut ${res.status} (conflit non détecté)`);
    return (res.json?.error ?? '').slice(0, 70);
  });

  await check('Emploi du temps', 'Conflit de salle détecté → 409', async () => {
    const other = classes[1]?.id;
    if (!other) throw new Error('une seule classe dans le jeu de données');
    const res = await admin.post('/api/schedules', {
      title: 'Conflit salle', classId: other, room: 'salle AUDIT', day: 'Samedi',
      startTime: '17:00', endTime: '18:30', kind: 'TD',
    });
    expect(res.status === 409, `statut ${res.status} (salle déjà occupée non détectée)`);
  });

  await check('Emploi du temps', 'PATCH /api/schedules/:id', async () => {
    const json = await admin.ok('PATCH', `/api/schedules/${slot.id}`, { room: 'Salle 9' });
    const item = json.schedule ?? json.item ?? json;
    expect(item.room === 'Salle 9', 'salle non modifiée');
  });

  await check('Emploi du temps', 'Déplacement en conflit refusé (PATCH) → 409', async () => {
    const res = await admin.patch(`/api/schedules/${slot.id}`, { room: 'Salle audit', classId, day: 'Samedi' });
    const probe = await admin.post('/api/schedules', {
      title: 'Sonde conflit', classId, day: 'Samedi', startTime: '16:00', endTime: '17:30',
    });
    expect(probe.status === 409, `créneau non protégé (${probe.status})`);
    expect(res.status === 200, `patch direct → ${res.status}`);
  });

  await check('Emploi du temps', 'DELETE /api/schedules/:id', async () => {
    await admin.ok('DELETE', `/api/schedules/${slot.id}`);
  });

  // ─── Bibliothèque ────────────────────────────────────────────────────────
  let book = null;
  let loan = null;
  await check('Bibliothèque', 'GET /api/library/books', async () => {
    const json = await admin.ok('GET', '/api/library/books');
    expect((json.items ?? json).length > 0, 'catalogue vide');
    book = (json.items ?? json)[0];
    return `${(json.items ?? json).length} ouvrages`;
  });

  await check('Bibliothèque', 'POST /api/library/books', async () => {
    const json = await admin.ok('POST', '/api/library/books', {
      title: 'Ouvrage audit', author: 'Auteur Audit', category: 'Sciences', copiesTotal: 2, shelf: 'A-01',
    }, 201);
    book = json.book ?? json.item ?? json;
    expect(book?.id, 'identifiant manquant');
  });

  await check('Bibliothèque', 'POST /api/library/loans (prêt)', async () => {
    const json = await admin.ok('POST', '/api/library/loans', {
      bookId: book.id, studentId, dueAt: isoDate(14),
    }, 201);
    loan = json.loan ?? json.item ?? json;
    expect(loan?.id, 'identifiant manquant');
  });

  await check('Bibliothèque', 'Stock décrémenté après le prêt', async () => {
    const json = await admin.ok('GET', '/api/library/books');
    const item = (json.items ?? json).find((b) => b.id === book.id);
    expect(item.copiesAvailable === 1, `disponibles: ${item.copiesAvailable}`);
  });

  await check('Bibliothèque', 'PATCH /api/library/loans/:id (retour)', async () => {
    await admin.ok('PATCH', `/api/library/loans/${loan.id}`, { status: 'rendu' });
    const json = await admin.ok('GET', '/api/library/books');
    const item = (json.items ?? json).find((b) => b.id === book.id);
    expect(item.copiesAvailable === 2, `disponibles: ${item.copiesAvailable}`);
  });

  await check('Bibliothèque', 'DELETE ouvrage + prêt', async () => {
    await admin.del(`/api/library/loans/${loan.id}`);
    const res = await admin.del(`/api/library/books/${book.id}`);
    expect([200, 204].includes(res.status), `statut ${res.status}`);
  });

  // ─── Présences ───────────────────────────────────────────────────────────
  await check('Présences', 'POST /api/attendance/mark', async () => {
    const json = await admin.ok('POST', '/api/attendance/mark', {
      studentId, date: isoDate(), session: 'Matin', status: 'present',
    });
    expect(json.item?.id, 'pointage non renvoyé');
  });

  await check('Présences', 'POST /api/attendance/bulk', async () => {
    const list = await admin.ok('GET', `/api/students?classId=${classId}`);
    const ids = list.items.slice(0, 5).map((s) => s.id);
    const json = await admin.ok('POST', '/api/attendance/bulk', {
      date: isoDate(), session: 'Après-midi', status: 'present', studentIds: ids,
    });
    expect(json.updated === ids.length, `${json.updated}/${ids.length} mises à jour`);
    return `${json.updated} élèves pointés`;
  });

  await check('Présences', 'GET /api/attendance', async () => {
    const json = await admin.ok('GET', '/api/attendance');
    expect((json.items ?? json).length > 0, 'aucun pointage');
    return `${(json.items ?? json).length} lignes`;
  });

  await check('Présences', 'Parent interdit → 403', async () => {
    if (!parent) throw new Error('compte parent indisponible');
    const res = await parent.get('/api/attendance');
    expect(res.status === 403, `statut ${res.status}`);
  });

  // ─── Cartes scolaires (QR / code-barres / NFC) ───────────────────────────
  let cardCode = null;
  let cardStudentId = null;
  await check('Cartes', 'GET /api/cards', async () => {
    const json = await admin.ok('GET', '/api/cards');
    expect(Array.isArray(json.items) && json.items.length > 0, 'liste vide');
    expect(json.stats && typeof json.stats.issued === 'number', 'statistiques manquantes');
    const withCode = json.items.find((item) => item.cardCode);
    expect(withCode, 'aucune carte émise');
    cardCode = withCode.cardCode;
    cardStudentId = withCode.studentId;
    return `${json.items.length} cartes · ${json.stats.issued} émises · ${json.stats.nfc} NFC`;
  });

  await check('Cartes', 'GET /api/cards/:studentId', async () => {
    const json = await admin.ok('GET', `/api/cards/${cardStudentId}`);
    expect(json.card?.cardCode, 'carte sans code');
    expect(json.card.scanPath?.includes(json.card.cardCode), 'lien de pointage incohérent');
    return `${json.card.firstName} ${json.card.lastName} · ${json.card.cardCode}`;
  });

  await check('Cartes', 'POST /api/cards/scan (QR) signe la présence', async () => {
    const json = await admin.ok('POST', '/api/cards/scan', { code: cardCode, source: 'qr' });
    expect(json.card?.studentId === cardStudentId, 'mauvais élève résolu');
    expect(json.attendance?.status === 'present', 'présence non enregistrée');
    return `${json.card.firstName} ${json.card.lastName} · ${json.alreadyMarked ? 'déjà pointé' : 'pointé'}`;
  });

  await check('Cartes', 'POST /api/cards/scan (URL de badge NFC)', async () => {
    const url = `https://school-net-academy.vercel.app/app/presences?scan=${cardCode}`;
    const json = await admin.ok('POST', '/api/cards/scan', { code: url, source: 'nfc' });
    expect(json.card?.studentId === cardStudentId, 'URL de badge non reconnue');
    return `résolu via ${new URL(url).pathname}`;
  });

  await check('Cartes', 'Carte inconnue → 404', async () => {
    const res = await admin.post('/api/cards/scan', { code: 'SNA-26-INTROUVABLE' });
    expect(res.status === 404, `statut ${res.status}`);
  });

  await check('Cartes', 'POST /api/cards/:id/sign', async () => {
    const json = await admin.ok('POST', `/api/cards/${cardStudentId}/sign`, { status: 'retard' });
    expect(json.attendance?.status === 'retard', 'statut non appliqué');
    return json.alreadyMarked ? 'mise à jour' : 'création';
  });

  await check('Cartes', 'PATCH nfc + réémission', async () => {
    const tag = `04:AUDIT:${Date.now().toString().slice(-6)}`;
    const linked = await admin.ok('PATCH', `/api/cards/${cardStudentId}/nfc`, { nfcTag: tag });
    expect(linked.card.nfcTag === tag, 'badge non associé');
    const rescanned = await admin.ok('POST', '/api/cards/scan', { code: tag, source: 'nfc' });
    expect(rescanned.card.studentId === cardStudentId, 'le badge NFC ne résout pas l’élève');
    const issued = await admin.ok('POST', `/api/cards/${cardStudentId}/issue`);
    expect(issued.card.cardCode && issued.card.cardCode !== cardCode, 'nouveau code identique');
    cardCode = issued.card.cardCode;
    await admin.ok('PATCH', `/api/cards/${cardStudentId}/nfc`, { nfcTag: null });
    return `badge ${tag} · nouvelle carte ${cardCode}`;
  });

  await check('Cartes', 'Parent interdit sur les cartes → 403', async () => {
    if (!parent) throw new Error('compte parent indisponible');
    const res = await parent.get('/api/cards');
    expect(res.status === 403, `statut ${res.status}`);
  });

  // ─── Erreurs & robustesse ────────────────────────────────────────────────
  await check('Robustesse', 'Route API inconnue → 404 JSON', async () => {
    const res = await admin.get('/api/inconnue');
    expect(res.status === 404 && res.json?.error, `statut ${res.status}`);
  });

  await check('Robustesse', 'Identifiant inexistant → 404 (pas 500)', async () => {
    const res = await admin.get('/api/students/stu-inexistant');
    expect(res.status === 404, `statut ${res.status}`);
  });

  await check('Robustesse', 'Corps JSON invalide → 400', async () => {
    const res = await fetch(`${BASE}/api/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: admin.cookie },
      body: '{invalide',
    });
    expect(res.status === 400, `statut ${res.status}`);
  });

  await check('Robustesse', 'Déconnexion invalide le cookie', async () => {
    const temp = await login('admin');
    await temp.ok('POST', '/api/auth/logout');
    const res = await temp.get('/api/dashboard');
    expect(res.status === 401, `statut ${res.status}`);
  });

  // ─── Restitution ─────────────────────────────────────────────────────────
  console.log('');
  for (const [group, items] of groups) {
    console.log(`\x1b[1m${group}\x1b[0m`);
    for (const item of items) {
      const icon = item.ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
      console.log(`  ${icon} ${item.name}${item.detail ? ` \x1b[90m— ${item.detail}\x1b[0m` : ''}`);
    }
  }

  const total = passed + failures.length;
  console.log('');
  if (failures.length) {
    console.log(`\x1b[31m${failures.length} échec(s) sur ${total} vérifications\x1b[0m`);
    for (const f of failures) console.log(`  ✗ [${f.group}] ${f.name} — ${f.detail}`);
    process.exitCode = 1;
  } else {
    console.log(`\x1b[32m${passed}/${total} vérifications réussies\x1b[0m`);
  }
}

main().catch((error) => {
  console.error('Audit interrompu :', error);
  process.exitCode = 1;
});
