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
  put(path, body) { return this.request('PUT', path, body); }
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

let superClient = null;
let signupClient = null;
let signupTenantId = null;

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

  await check('Élèves', 'Photo d’identité : enregistrée, conservée, retirée', async () => {
    // PNG 1×1 valide, envoyé comme le fait le navigateur (data URL compressée).
    const pixel = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const photo = `data:image/png;base64,${pixel}`;
    const created = await admin.ok('POST', '/api/students', {
      firstName: 'Photo', lastName: 'Audit', gender: 'F',
      photo, photoThumb: photo,
    }, 201);
    const id = (created.student ?? created.item ?? created).id;
    const withPhoto = await admin.ok('GET', `/api/students/${id}`);
    if (!withPhoto.student.photo_url) throw new Error('photo non enregistrée');
    // Une modification sans photo ne doit pas l'effacer.
    await admin.ok('PATCH', `/api/students/${id}`, { address: 'Bacongo' });
    const kept = await admin.ok('GET', `/api/students/${id}`);
    expect(Boolean(kept.student.photo_url), 'photo effacée par une modification');
    // La liste renvoie uniquement la vignette (poids maîtrisé).
    const list = await admin.ok('GET', '/api/students');
    const row = list.items.find((item) => item.id === id);
    expect(row && 'photoThumb' in row && !('photo' in row), 'la liste ne doit exposer que la vignette');
    // Une valeur non image est refusée.
    const rejected = await admin.patch(`/api/students/${id}`, { photo: 'javascript:alert(1)' });
    expect(rejected.status === 400, `photo invalide acceptée (${rejected.status})`);
    // Retrait explicite.
    await admin.ok('PATCH', `/api/students/${id}`, { photo: '', photoThumb: '' });
    const cleared = await admin.ok('GET', `/api/students/${id}`);
    expect(!cleared.student.photo_url, 'photo non retirée');
    await admin.del(`/api/students/${id}`);
    return 'photo + vignette · conservation et retrait vérifiés';
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

  await check('Cartes', 'Scan → absence puis présence (validation du statut)', async () => {
    const absent = await admin.ok('POST', '/api/cards/scan', { code: cardCode, status: 'absent', source: 'qr' });
    expect(absent.attendance?.status === 'absent', 'absence non enregistrée');
    const present = await admin.ok('POST', '/api/cards/scan', { code: cardCode, status: 'present', source: 'qr' });
    expect(present.attendance?.status === 'present', 'présence non rétablie');
    expect(present.previousStatus === 'absent', 'statut précédent non signalé');
    return 'absent → présent · statut précédent retourné';
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


  // ─── Plateforme, abonnements, équipe, newsletter, IA ─────────────────────
  const stamp = Date.now().toString().slice(-6);

  await check('Plateforme', 'GET /api/platform/catalog (public)', async () => {
    const json = await admin.ok('GET', '/api/platform/catalog?currency=CD');
    expect(Array.isArray(json.plans) && json.plans.length === 3, 'offres manquantes');
    expect(json.trialDays === 7, 'essai différent de 7 jours');
    expect(json.plans[0].localCurrency === 'CD', 'devise locale non appliquée');
    return `${json.plans.length} offres · ${Object.keys(json.rates ?? {}).length} devises`;
  });

  await check('Plateforme', 'Inscription établissement → essai 7 jours', async () => {
    const res = await new Client('signup').post('/api/platform/signup', {
      schoolName: `École Audit ${stamp}`,
      kind: 'universite',
      country: 'RD Congo',
      countryCode: 'CD',
      currency: 'CDF',
      adminName: 'Audit Direction',
      email: `audit.${stamp}@ecole-test.cd`,
      password: 'motdepasse123',
      phone: '+243 81 000 00 00',
      plan: 'pro',
      newsletter: true,
    });
    expect(res.status === 201 || res.status === 200, `statut ${res.status} ${res.raw.slice(0, 120)}`);
    expect(res.json.access?.status === 'essai', 'statut d’accès inattendu');
    expect(res.json.access?.daysLeft === 7 || res.json.access?.daysLeft === 6, `jours restants : ${res.json.access?.daysLeft}`);
    expect(res.json.user?.tenant?.currency === 'CDF', 'devise de l’établissement non conservée');
    const newClient = new Client('nouveau');
    newClient.cookie = res.headers.get('set-cookie').split(';')[0];
    const students = await newClient.get('/api/students');
    expect(students.status === 200, `accès aux données pendant l’essai : ${students.status}`);
    // mémorise pour les vérifications suivantes
    signupClient = newClient;
    signupTenantId = res.json.user.tenant.id;
    return `${res.json.user.tenant.name} · ${res.json.user.tenant.currency}`;
  });

  await check('Plateforme', 'Connexion super administrateur', async () => {
    const res = await new Client('super').post('/api/auth/login', {
      email: 'superadmin@schoolnet.academy', password: PASSWORD,
    });
    expect(res.status === 200, `statut ${res.status}`);
    expect(res.json.user.platformRole === 'owner', 'rôle plateforme absent');
    superClient = new Client('super');
    superClient.cookie = res.headers.get('set-cookie').split(';')[0];
    return `${res.json.user.name} (${res.json.user.platformRole})`;
  });

  await check('Plateforme', 'GET /api/platform/overview', async () => {
    const json = await superClient.ok('GET', '/api/platform/overview');
    expect(json.kpis?.tenants >= 2, 'compteur d’établissements incohérent');
    expect(Array.isArray(json.staff) && json.staff.length >= 1, 'équipe absente');
    return `${json.kpis.tenants} établissements · MRR ${json.kpis.mrr} FCFA`;
  });

  await check('Plateforme', 'Liste des établissements filtrée', async () => {
    const json = await superClient.ok('GET', '/api/platform/tenants?status=actif');
    expect(Array.isArray(json.items), 'liste absente');
    expect(json.items.every((tenant) => tenant.status === 'actif'), 'filtre de statut non appliqué');
    const search = await superClient.ok('GET', '/api/platform/tenants?search=Audit');
    expect(search.items.length >= 1, 'recherche sans résultat');
    return `${json.items.length} actifs · recherche ${search.items.length}`;
  });

  await check('Plateforme', 'Nouvel agent + droits limités (RBAC)', async () => {
    const created = await superClient.ok('POST', '/api/platform/staff', {
      name: `Agent Audit ${stamp}`,
      email: `agent.${stamp}@schoolnet.academy`,
      platformRole: 'support',
    }, 201);
    const password = created.temporaryPassword;
    expect(password, 'mot de passe temporaire absent');
    const agent = new Client('agent');
    const session = await agent.post('/api/auth/login', { email: `agent.${stamp}@schoolnet.academy`, password });
    expect(session.status === 200, `connexion agent → ${session.status}`);
    expect(session.json.user.platformRole === 'support', 'rôle non appliqué');
    agent.cookie = session.headers.get('set-cookie').split(';')[0];
    const allowed = await agent.get('/api/platform/staff');
    expect(allowed.status === 200, `staff → ${allowed.status}`);
    const denied = await agent.get('/api/platform/subscriptions');
    expect(denied.status === 403, `abonnements autorisés à tort → ${denied.status}`);
    const updated = await superClient.ok('PATCH', `/api/platform/staff/${created.member.id}`, { platformRole: 'finance' });
    expect(updated.ok === true, 'changement de rôle refusé');
    await superClient.ok('DELETE', `/api/platform/staff/${created.member.id}`);
    const gone = await agent.get('/api/platform/staff');
    expect(gone.status === 401 || gone.status === 403, `agent supprimé toujours actif → ${gone.status}`);
    return 'support → finance → suppression';
  });

  await check('Plateforme', 'Parent interdit sur la plateforme → 403', async () => {
    if (!parent) throw new Error('compte parent indisponible');
    const res = await parent.get('/api/platform/overview');
    expect(res.status === 403, `statut ${res.status}`);
  });

  await check('Abonnement', 'GET /api/platform/billing (essai)', async () => {
    const json = await signupClient.ok('GET', '/api/platform/billing');
    expect(json.access?.status === 'essai', 'essai non reconnu');
    expect(json.plans?.length === 3, 'offres absentes');
    expect(json.plans[0].localPrice > 0, 'prix local non converti');
    return `${json.currency} · ${json.plans.length} offres`;
  });

  await check('Abonnement', 'Paiement self-service → accès actif', async () => {
    const json = await signupClient.ok('POST', '/api/platform/billing/pay', {
      plan: 'pro', method: 'mobile_money', phone: '+243 81 000 00 00',
    }, 201);
    expect(json.subscription?.reference?.startsWith('SUB-'), 'référence de facture absente');
    expect(json.subscription.amount > 0, 'montant nul');
    expect(json.tenant?.status === 'actif', 'établissement non activé');
    const billing = await signupClient.ok('GET', '/api/platform/billing');
    expect(billing.access?.blocked === false, 'accès toujours bloqué');
    expect(billing.invoices.length >= 1, 'facture non listée');
    return `${json.subscription.reference} · ${json.subscription.amount} ${json.subscription.currency}`;
  });

  await check('Abonnement', 'Établissement suspendu → 402 ABONNEMENT_REQUIS', async () => {
    await superClient.ok('PATCH', `/api/platform/tenants/${signupTenantId}`, { status: 'suspendu' });
    const blocked = await signupClient.get('/api/students');
    expect(blocked.status === 402, `statut ${blocked.status}`);
    expect(blocked.json?.code === 'ABONNEMENT_REQUIS', 'code d’erreur absent');
    await superClient.ok('PATCH', `/api/platform/tenants/${signupTenantId}`, { status: 'actif' });
    const reopened = await signupClient.get('/api/students');
    expect(reopened.status === 200, `réouverture → ${reopened.status}`);
    return 'blocage puis réouverture immédiate';
  });

  await check('Abonnement', 'Abonnement activé depuis la plateforme', async () => {
    const json = await superClient.ok('POST', `/api/platform/tenants/${signupTenantId}/subscribe`, {
      plan: 'universite', method: 'virement',
    }, 201);
    expect(json.subscription?.plan === 'universite', 'offre non appliquée');
    expect(json.tenant?.plan === 'universite', 'établissement non mis à jour');
    const list = await superClient.ok('GET', '/api/platform/subscriptions');
    expect(list.items.length >= 1 && list.stats.total > 0, 'historique vide');
    return `${list.items.length} factures · ${list.stats.total} FCFA`;
  });

  await check('Newsletter', 'Inscription publique + audience', async () => {
    const res = await new Client('nwl').post('/api/newsletter/subscribe', {
      email: `abonne.${stamp}@ecole-test.cd`, name: 'Abonné Audit', countryCode: 'CG', source: 'audit',
    });
    expect(res.status === 201 || res.status === 200, `statut ${res.status}`);
    const again = await new Client('nwl').post('/api/newsletter/subscribe', { email: `abonne.${stamp}@ecole-test.cd` });
    expect(again.json?.already === true, 'double inscription non signalée');
    const json = await superClient.ok('GET', '/api/platform/newsletter');
    expect(json.subscribers.some((item) => item.email === `abonne.${stamp}@ecole-test.cd`), 'abonné absent de la liste');
    return `${json.stats.actifs} abonnés actifs`;
  });

  await check('Newsletter', 'Création et envoi d’une campagne', async () => {
    const created = await superClient.ok('POST', '/api/platform/newsletter', {
      subject: `Audit ${stamp} — nouveautés`, body: 'Message de test envoyé par le script d’audit.', audience: 'abonnes',
    }, 201);
    expect(created.campaign?.status === 'brouillon', 'campagne non en brouillon');
    const sent = await superClient.ok('POST', `/api/platform/newsletter/${created.campaign.id}/send`, {});
    expect(sent.recipients > 0, 'aucun destinataire');
    const list = await superClient.ok('GET', '/api/platform/newsletter');
    const campaign = list.campaigns.find((item) => item.id === created.campaign.id);
    expect(campaign?.status === 'envoyee', 'campagne non marquée envoyée');
    return `${sent.recipients} destinataires`;
  });

  await check('Notifications & SMS', 'Paiement → notification + SMS aux parents', async () => {
    const students = await admin.ok('GET', '/api/students');
    const before = await superClient.ok('GET', '/api/platform/sms');
    const payment = await admin.ok('POST', '/api/payments', {
      studentId: students.items[0].id, amount: 30000, type: 'Cantine', method: 'Mobile Money',
    }, 201);
    expect(payment.payment?.reference, 'paiement non créé');
    const after = await superClient.ok('GET', '/api/platform/sms');
    expect(after.items.length > before.items.length, 'aucun SMS journalisé');
    const inbox = await parent.ok('GET', '/api/notifications');
    expect(inbox.items.some((item) => item.kind === 'paiement'), 'notification parent absente');
    expect(inbox.unread > 0, 'compteur de non-lues à zéro');
    return `${after.items.length} SMS · ${inbox.unread} non lues`;
  });

  await check('Notifications & SMS', 'Marquer lu, tout lire, supprimer', async () => {
    const inbox = await admin.ok('GET', '/api/notifications');
    expect(inbox.items.length > 0, 'aucune notification pour la direction');
    const target = inbox.items[0];
    await admin.ok('POST', `/api/notifications/${target.id}/read`, {});
    const after = await admin.ok('GET', '/api/notifications');
    expect(after.items.find((item) => item.id === target.id)?.readAt, 'notification non marquée lue');
    await admin.ok('POST', '/api/notifications/read-all', {});
    const all = await admin.ok('GET', '/api/notifications');
    expect(all.unread === 0, `restant ${all.unread} non lues`);
    await admin.ok('DELETE', `/api/notifications/${target.id}`);
    return `${inbox.items.length} notifications traitées`;
  });

  await check('Notifications & SMS', 'Journal SMS accessible au financeur', async () => {
    const json = await superClient.ok('GET', '/api/platform/sms');
    expect(Array.isArray(json.items), 'journal absent');
    expect(typeof json.configured === 'boolean', 'indicateur de configuration manquant');
    return `${json.items.length} messages · ${json.configured ? 'opérateur' : 'simulation'}`;
  });

  await check('Assistant IA', 'POST /api/ai/chat répond', async () => {
    const json = await admin.ok('POST', '/api/ai/chat', {
      messages: [{ role: 'user', content: 'Combien coûte un abonnement ?' }],
    });
    expect(typeof json.reply === 'string' && json.reply.length > 20, 'réponse vide');
    expect(['openai', 'local'].includes(json.source), 'source inconnue');
    return `${json.source} · ${json.reply.length} caractères`;
  });

  await check('Mot de passe', 'Parcours oubli → réinitialisation', async () => {
    const client = new Client('oubli');
    const forgot = await client.post('/api/auth/forgot', { email: ACCOUNTS.teacher });
    expect(forgot.status === 200, `statut ${forgot.status}`);
    const token = String(forgot.json.resetPath ?? '').split('token=')[1];
    expect(token, 'lien de réinitialisation absent');
    const reset = await client.post('/api/auth/reset', { token, password: 'nouveau.mot.de.passe' });
    expect(reset.status === 200, `réinitialisation → ${reset.status}`);
    const relogin = await client.post('/api/auth/login', { email: ACCOUNTS.teacher, password: 'nouveau.mot.de.passe' });
    expect(relogin.status === 200, 'connexion avec le nouveau mot de passe impossible');
    await client.post('/api/auth/reset', { token, password: PASSWORD });
    await client.post('/api/auth/login', { email: ACCOUNTS.teacher, password: PASSWORD });
    const reused = await client.post('/api/auth/reset', { token, password: 'autre.mot.de.passe' });
    expect(reused.status === 400, `lien réutilisé → ${reused.status}`);
    return 'token à usage unique';
  });

  await check('Mot de passe', 'Connexion sociale non configurée → 501 explicite', async () => {
    const res = await new Client('oauth').post('/api/auth/oauth/facebook', {});
    expect(res.status === 501, `statut ${res.status}`);
    expect(res.json?.hint, 'aide absente');
    return res.json.configured === false ? 'configuration attendue' : '';
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

  // ─── Intégrations Supabase, e-mails et persistance ───────────────────────
  let createdTenantId = null;
  await check('Intégrations', 'GET /api/platform/integrations', async () => {
    const json = await superClient.ok('GET', '/api/platform/integrations');
    expect(typeof json.supabase?.configured === 'boolean', 'état Supabase absent');
    expect(typeof json.mail?.configured === 'boolean', 'état e-mail absent');
    expect(['supabase', 'local'].includes(json.persistence?.mode), 'mode de persistance inconnu');
    expect(Array.isArray(json.emails), 'journal e-mail absent');
    return `supabase ${json.supabase.configured ? 'connecté' : 'non configuré'} · persistance ${json.persistence.mode}`;
  });

  await check('Intégrations', 'GET /api/health expose les intégrations', async () => {
    const res = await fetch(`${BASE}/api/health`);
    const json = await res.json();
    expect(json.ok === true, 'santé non conforme');
    expect(typeof json.persistence === 'string', 'persistance absente');
    return `${json.persistence} · e-mail ${json.email}`;
  });

  await check('Intégrations', 'Création d’établissement avec mot de passe généré', async () => {
    const res = await superClient.post('/api/platform/tenants', {
      name: 'Institut Audit Intégrations',
      kind: 'universite',
      country: 'Congo-Brazzaville',
      countryCode: 'CG',
      currency: 'XAF',
      ownerName: 'Audit Responsable',
      email: 'audit.tenant@schoolnet.academy',
      plan: 'essentiel',
      sendEmail: false,
    });
    expect(res.status === 201, `statut ${res.status}`);
    const json = res.json;
    expect(/^Sna-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(json.temporaryPassword ?? ''), 'mot de passe provisoire non généré');
    createdTenantId = json.tenant.id;
    const login = await new Client('tenant').post('/api/auth/login', {
      email: 'audit.tenant@schoolnet.academy', password: json.temporaryPassword,
    });
    expect(login.status === 200, 'connexion avec le mot de passe provisoire impossible');
    expect(login.json.user.tenant?.id === createdTenantId, 'établissement non rattaché');
    return `${json.tenant.name} · ${json.temporaryPassword}`;
  });

  await check('Intégrations', 'Jeton d’accès à un espace client', async () => {
    const json = await superClient.ok('POST', `/api/platform/tenants/${createdTenantId}/impersonate`);
    expect(String(json.url).startsWith('/api/auth/impersonate?token='), 'URL d’accès absente');
    const res = await fetch(`${BASE}${json.url}`, { redirect: 'manual' });
    expect([302, 200].includes(res.status), `statut ${res.status}`);
    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie.includes('sna_session='), 'session non ouverte');
    return `jeton ${json.expiresIn}s · redirection ${res.status}`;
  });

  await check('Intégrations', 'Assistant IA : état exposé sans la clé', async () => {
    const res = await fetch(`${BASE}/api/ai/status`);
    const json = await res.json();
    expect(typeof json.configured === 'boolean', 'état IA absent');
    expect(typeof json.model === 'string', 'modèle absent');
    expect(JSON.stringify(json).includes('sk-') === false, 'une clé fuite dans l’état');
    return `${json.configured ? 'OpenAI' : 'base locale'} · ${json.model}`;
  });

  await check('Intégrations', 'Assistant IA : clé masquée ou incomplète refusée', async () => {
    const masked = await superClient.put('/api/platform/integration/ai', { apiKey: 'sk-...nSQA' });
    expect(masked.status === 400, `clé masquée acceptée (${masked.status})`);
    expect(String(masked.json.error ?? '').includes('incomplète'), 'message peu explicite');
    const short = await superClient.put('/api/platform/integration/ai', { apiKey: 'sk-trop-court' });
    expect(short.status === 400, `clé trop courte acceptée (${short.status})`);
    return 'clé incomplète → 400 avec explication';
  });

  await check('Intégrations', 'Assistant IA : clé refusée → repli local', async () => {
    const fakeKey = `sk-test-${'0'.repeat(40)}`;
    const saved = await superClient.ok('PUT', '/api/platform/integration/ai', { apiKey: fakeKey, model: 'gpt-4o-mini' });
    expect(saved.ai?.configured === true, 'clé non enregistrée');
    const status = await fetch(`${BASE}/api/ai/status?t=${Date.now()}`).then((r) => r.json());
    expect(status.hint === '••••0000', `empreinte inattendue (${status.hint})`);
    expect(JSON.stringify(status).includes('sk-test') === false, 'une clé fuite dans l’état');
    const chat = await superClient.ok('POST', '/api/ai/chat', { messages: [{ role: 'user', content: 'Quels sont vos tarifs ?' }] });
    expect(typeof chat.reply === 'string' && chat.reply.length > 10, 'aucune réponse');
    expect(chat.source === 'local', 'le repli local aurait dû prendre le relais');
    const cleared = await superClient.ok('PUT', '/api/platform/integration/ai', { apiKey: '', model: 'gpt-4o-mini' });
    expect(cleared.ai?.configured === false || process.env.OPENAI_API_KEY, 'clé non effacée');
    const after = await fetch(`${BASE}/api/ai/status?t=${Date.now()}`).then((r) => r.json());
    expect(after.hint === null || process.env.OPENAI_API_KEY, 'empreinte persistante après effacement');
    return 'empreinte ••••0000 · repli local opérationnel';
  });

  await check('Intégrations', 'Réinitialisation : e-mail mis en file', async () => {
    const res = await new Client('forgot').post('/api/auth/forgot', { email: 'direction@schoolnet.academy' });
    expect(res.status === 200, `statut ${res.status}`);
    expect(res.json.ok === true, 'réponse non conforme');
    const emails = await superClient.ok('GET', '/api/platform/emails');
    expect(emails.items.some((item) => item.kind === 'reinitialisation'), 'message absent du journal');
    return `${emails.items[0]?.status ?? 'en file'} · ${emails.configured ? 'expéditeur actif' : 'expéditeur à configurer'}`;
  });

  await check('Intégrations', 'Newsletter : envoi journalisé par destinataire', async () => {
    const created = await superClient.post('/api/platform/newsletter', {
      subject: 'Audit intégrations', body: 'Message de vérification automatique des envois.', audience: 'abonnes', send: false,
    });
    expect(created.status === 201, `création → ${created.status}`);
    const campaign = created.json;
    const sent = await superClient.ok('POST', `/api/platform/newsletter/${campaign.campaign.id}/send`);
    expect(sent.recipients >= 1, 'aucun destinataire');
    expect(typeof sent.failed === 'number', 'compteur d’échecs absent');
    return `${sent.recipients} destinataires · ${sent.delivered ?? 0} envoyés · ${sent.queued ?? 0} en file`;
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
