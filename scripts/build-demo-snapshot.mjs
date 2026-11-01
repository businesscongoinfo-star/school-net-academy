/**
 * Génère l'instantané de données utilisé par la démo statique (GitHub Pages).
 * Interroge l'API locale (serveur Node + SQLite) avec les trois comptes de démonstration
 * et écrit `web/public/demo/snapshot.json`.
 *
 *   node server/seed.js --reset && npm start    # serveur sur :3000
 *   BASE_URL=http://localhost:3000 node scripts/build-demo-snapshot.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const OUT = path.join(process.cwd(), 'web', 'public', 'demo', 'snapshot.json');

const ACCOUNTS = {
  admin: 'direction@schoolnet.academy',
  teacher: 'prof.mbemba@schoolnet.academy',
  parent: 'parent.ondongo@schoolnet.academy',
};

const cookies = {};

async function login(role) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: ACCOUNTS[role], password: 'demo1234' }),
  });
  if (!res.ok) throw new Error(`login ${role} impossible (${res.status})`);
  cookies[role] = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  return res.json();
}

async function call(role, endpoint, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}/api${endpoint}`, {
    method,
    headers: { 'content-type': 'application/json', cookie: cookies[role] },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${endpoint} → ${res.status} ${text.slice(0, 160)}`);
  return JSON.parse(text);
}

const users = {};
for (const role of Object.keys(ACCOUNTS)) {
  const data = await login(role);
  users[role] = data.user;
  console.log(`✓ connexion ${role} — ${data.user.name}`);
}

const meta = await call('admin', '/meta');
const snapshot = {
  generatedAt: new Date().toISOString(),
  users,
  meta,
  roles: {},
  studentDetails: {},
  classDetails: {},
  facultyDetails: {},
  programDetails: {},
  attendance: [],
};

/* ---------------------------- Vues par rôle ----------------------------- */
for (const role of Object.keys(ACCOUNTS)) {
  const dashboard = await call(role, '/dashboard');
  const students = await call(role, '/students');
  const payments = await call(role, '/payments');
  const announcements = await call(role, '/announcements');
  const results = {};
  for (const term of meta.terms) {
    results[term] = await call(role, `/grades/results?term=${encodeURIComponent(term)}`);
  }
  snapshot.roles[role] = { dashboard, students, payments, announcements, results };
  console.log(`✓ ${role} : ${students.items.length} inscrit(s), ${payments.items.length} paiement(s)`);
}

/* --------------------------- Données partagées --------------------------- */
snapshot.classes = await call('admin', '/classes');
snapshot.teachers = await call('admin', '/teachers');
snapshot.admissions = await call('admin', '/admissions');
snapshot.courses = await call('admin', '/courses');
snapshot.faculties = await call('admin', '/faculties');
snapshot.programs = await call('admin', '/programs');
snapshot.units = await call('admin', '/course-units');
snapshot.schedules = await call('admin', '/schedules');
snapshot.books = await call('admin', '/library/books');
snapshot.loans = await call('admin', '/library/loans');

for (const cls of snapshot.classes.items) {
  snapshot.classDetails[cls.id] = await call('admin', `/classes/${cls.id}`);
}
for (const faculty of snapshot.faculties.items) {
  snapshot.facultyDetails[faculty.id] = await call('admin', `/faculties/${faculty.id}`);
}
for (const program of snapshot.programs.items) {
  snapshot.programDetails[program.id] = await call('admin', `/programs/${program.id}`);
}

const studentIds = snapshot.roles.admin.students.items.map((student) => student.id);
for (const id of studentIds) {
  snapshot.studentDetails[id] = await call('admin', `/students/${id}`);
}
console.log(`✓ ${studentIds.length} fiches élèves/étudiants`);

/* ---------------------------- Présences (20 j) --------------------------- */
const seen = new Set();
for (let offset = 0; offset < 20; offset += 1) {
  const date = new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10);
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  if (day === 0 || day === 6) continue;
  const data = await call('admin', `/attendance?date=${date}`);
  data.items.forEach((record) => {
    if (seen.has(record.id)) return;
    seen.add(record.id);
    snapshot.attendance.push(record);
  });
}
console.log(`✓ ${snapshot.attendance.length} pointages de présence`);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(snapshot));
const size = fs.statSync(OUT).size;
console.log(`→ ${path.relative(process.cwd(), OUT)} (${(size / 1024 / 1024).toFixed(2)} Mo)`);
