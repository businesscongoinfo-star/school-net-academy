/**
 * Vérifie l'API simulée de la démo statique (aucun navigateur requis) :
 * bundle le module avec esbuild, remplace `import.meta.env` et localStorage,
 * puis exécute les principales routes de l'application.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const SNAPSHOT = JSON.parse(fs.readFileSync('web/public/demo/snapshot.json', 'utf8'));
const OUT = '/tmp/demo-mock.mjs';

// Compilation TypeScript → JS (typescript est déjà une dépendance de dev).
fs.rmSync('/tmp/mockbuild', { recursive: true, force: true });
execFileSync('npx', [
  'tsc', 'web/src/demo/mock.ts',
  '--outDir', '/tmp/mockbuild',
  '--module', 'esnext', '--target', 'es2022', '--lib', 'es2022,dom,dom.iterable',
  '--moduleResolution', 'bundler', '--skipLibCheck',
], { stdio: 'inherit' });
fs.copyFileSync('/tmp/mockbuild/demo/mock.js', OUT);

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
};
globalThis.fetch = async () => ({ ok: true, json: async () => SNAPSHOT });

const { demoRequest } = await import(pathToFileURL(OUT).href);

let failures = 0;
const check = async (label, method, route, body, verify) => {
  try {
    const data = await demoRequest(method, route, body);
    const extra = verify ? verify(data) : '';
    console.log(`✓ ${label.padEnd(34)} ${String(extra).slice(0, 70)}`);
    return data;
  } catch (error) {
    failures += 1;
    console.log(`✗ ${label.padEnd(34)} ${error.status ?? ''} ${error.message}`);
    return null;
  }
};

const expectError = async (label, method, route, body, status) => {
  try {
    await demoRequest(method, route, body);
    failures += 1;
    console.log(`✗ ${label.padEnd(34)} aucune erreur renvoyée`);
  } catch (error) {
    const ok = status ? error.status === status : true;
    if (!ok) failures += 1;
    console.log(`${ok ? '✓' : '✗'} ${label.padEnd(34)} ${error.status} ${error.message}`);
  }
};

console.log('--- session ---');
await check('auth/me (admin auto)', 'GET', '/auth/me', null, (d) => d.user.email);
await check('auth/login teacher', 'POST', '/auth/login', { email: 'prof.mbemba@schoolnet.academy', password: 'demo1234' }, (d) => d.user.role);
await check('dashboard (teacher)', 'GET', '/dashboard', null, (d) => `${d.kpis.students} inscrits`);
await check('login parent', 'POST', '/auth/login', { email: 'parent.ondongo@schoolnet.academy', password: 'demo1234' }, (d) => d.user.role);
await check('students (parent)', 'GET', '/students', null, (d) => `${d.items.length} enfants`);
await expectError('login inconnu rejeté', 'POST', '/auth/login', { email: 'x@y.z', password: 'demo1234' }, 401);
await check('login admin', 'POST', '/auth/login', { email: 'direction@schoolnet.academy', password: 'demo1234' }, (d) => d.user.role);

console.log('--- lectures ---');
await check('meta', 'GET', '/meta', null, (d) => `${d.classes.length} classes, ${d.programs.length} filières`);
await check('dashboard', 'GET', '/dashboard', null, (d) => `${d.kpis.students} inscrits, ${d.university.courseUnits} UE`);
await check('students', 'GET', '/students', null, (d) => `${d.items.length} fiches`);
await check('students filtrés (type)', 'GET', '/students?type=etudiant', null, (d) => `${d.items.length} étudiants`);
await check('students recherche', 'GET', '/students?search=mabiala', null, (d) => `${d.items.length} résultat(s)`);
await check('student détail', 'GET', `/students/${SNAPSHOT.roles.admin.students.items[0].id}`, null, (d) => `${d.payments.length} paiements`);
await check('classes', 'GET', '/classes', null, (d) => `${d.items.length} classes`);
await check('classe détail', 'GET', `/classes/${SNAPSHOT.classes.items[0].id}`, null, (d) => `${d.students.length} élèves`);
await check('teachers', 'GET', '/teachers', null, (d) => `${d.items.length} enseignants`);
await check('admissions', 'GET', '/admissions', null, (d) => `${d.items.length} dossiers`);
await check('payments', 'GET', '/payments?status=retard', null, (d) => `${d.items.length} en retard`);
await check('results T1', 'GET', '/grades/results?term=Trimestre%201', null, (d) => `${(d.rows ?? d.items ?? []).length} lignes`);
await check('courses', 'GET', '/courses?status=publie', null, (d) => `${d.items.length} publiés`);
await check('announcements', 'GET', '/announcements', null, (d) => `${d.items.length} annonces`);
await check('faculties', 'GET', '/faculties', null, (d) => `${d.items.length} facultés`);
await check('faculté détail', 'GET', `/faculties/${SNAPSHOT.faculties.items[0].id}`, null, (d) => `${d.programs.length} filières`);
await check('programs', 'GET', '/programs?degree=Master', null, (d) => `${d.items.length} masters`);
await check('programme détail', 'GET', `/programs/${SNAPSHOT.programs.items[0].id}`, null, (d) => `${d.units.length} UE`);
await check('course-units', 'GET', '/course-units?semester=2', null, (d) => `${d.items.length} UE S2`);
await check('schedules', 'GET', '/schedules', null, (d) => `${d.items.length} séances`);
await check('books', 'GET', '/library/books?availability=disponible', null, (d) => `${d.items.length} disponibles`);
await check('loans', 'GET', '/library/loans?status=retard', null, (d) => `${d.items.length} retards`);
await check('attendance (jour)', 'GET', `/attendance?date=${SNAPSHOT.attendance[0]?.date ?? new Date().toISOString().slice(0, 10)}`, null, (d) => `${d.items.length} pointages`);

console.log('--- écritures ---');
const created = await check('créer une faculté', 'POST', '/faculties', { name: 'Faculté démo', code: 'DMO' }, (d) => d.faculty.id);
if (created) {
  await check('modifier la faculté', 'PATCH', `/faculties/${created.faculty.id}`, { building: 'Bâtiment Z' }, (d) => d.faculty.building);
  await check('supprimer la faculté', 'DELETE', `/faculties/${created.faculty.id}`, null, (d) => d.ok);
}
const book = await check('créer un ouvrage', 'POST', '/library/books', { title: 'Livre démo', copiesTotal: 2 }, (d) => `${d.book.copiesAvailable}/${d.book.copiesTotal}`);
if (book) {
  const student = SNAPSHOT.roles.admin.students.items[0];
  const loan = await check('prêter l’ouvrage', 'POST', '/library/loans', { bookId: book.book.id, studentId: student.id, dueAt: '2026-12-01' }, (d) => `${d.loan.status}`);
  if (loan) {
    await check('retour de l’ouvrage', 'PATCH', `/library/loans/${loan.loan.id}`, { status: 'rendu' }, (d) => `${d.loan.status}`);
  }
}
await check('pointage élève', 'POST', '/attendance/mark', {
  studentId: SNAPSHOT.roles.admin.students.items[0].id, date: '2026-11-02', session: 'Journée', status: 'present',
}, (d) => d.item.status);
await check('pointage en masse', 'POST', '/attendance/bulk', {
  date: '2026-11-02', session: 'Journée', status: 'absent', studentIds: SNAPSHOT.roles.admin.students.items.slice(0, 3).map((s) => s.id),
}, (d) => `${d.updated} mises à jour`);
await check('créer un élève', 'POST', '/students', { firstName: 'Aya', lastName: 'Démo', gender: 'F', studentType: 'eleve' }, (d) => d.student.matricule);
await expectError('route inconnue → 404', 'GET', '/inconnu', null, 404);

console.log(failures ? `\n${failures} échec(s)` : '\nAPI simulée opérationnelle.');
process.exit(failures ? 1 : 0);
