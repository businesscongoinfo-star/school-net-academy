/**
 * Smoke test de rendu — monte chaque page avec les données réelles de l'API
 * via un rendu SSR et signale toute erreur d'exécution.
 */
import { createServer } from 'vite';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const BASE = process.env.BASE_URL || 'http://localhost:3000';

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: 'direction@schoolnet.academy', password: 'demo1234' }),
});
if (!login.ok) throw new Error('login failed ' + login.status);
const cookie = login.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
const me = await login.json();

const realFetch = async (path) => {
  const res = await fetch(path.startsWith('http') ? path : `${BASE}${path}`, { headers: { cookie } });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
};

const vite = await createServer({
  root: new URL('../web', import.meta.url).pathname,
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});

const { AuthProvider } = await vite.ssrLoadModule('/src/lib/auth.tsx');
const { ToastProvider } = await vite.ssrLoadModule('/src/components/toast.tsx');
const pages = {
  Landing: '/src/pages/Landing.tsx',
  Login: '/src/pages/Login.tsx',
  Dashboard: '/src/pages/Dashboard.tsx',
  Students: '/src/pages/Students.tsx',
  Classes: '/src/pages/Classes.tsx',
  Teachers: '/src/pages/Teachers.tsx',
  Admissions: '/src/pages/Admissions.tsx',
  Payments: '/src/pages/Payments.tsx',
  Courses: '/src/pages/Courses.tsx',
  Announcements: '/src/pages/Announcements.tsx',
  Results: '/src/pages/Results.tsx',
  Settings: '/src/pages/Settings.tsx',
  Faculties: '/src/pages/Faculties.tsx',
  Programs: '/src/pages/Programs.tsx',
  Units: '/src/pages/Units.tsx',
  Timetable: '/src/pages/Timetable.tsx',
  Library: '/src/pages/Library.tsx',
  Attendance: '/src/pages/Attendance.tsx',
  NotFound: '/src/pages/NotFound.tsx',
};

const meta = await realFetch('/api/meta');
const dashboard = await realFetch('/api/dashboard');
const students = await realFetch('/api/students');
const classes = await realFetch('/api/classes');
const teachers = await realFetch('/api/teachers');
const admissions = await realFetch('/api/admissions');
const payments = await realFetch('/api/payments');
const courses = await realFetch('/api/courses');
const announcements = await realFetch('/api/announcements');
const results = await realFetch('/api/grades/results?term=' + encodeURIComponent(meta.currentTerm));
const studentDetail = await realFetch('/api/students/' + students.items[0].id);
const faculties = await realFetch('/api/faculties');
const programs = await realFetch('/api/programs');
const units = await realFetch('/api/course-units');
const schedules = await realFetch('/api/schedules');
const books = await realFetch('/api/library/books');
const loans = await realFetch('/api/library/loans');
const attendance = await realFetch('/api/attendance?date=' + new Date().toISOString().slice(0, 10));
const attendanceToday = attendance;
const noFilters = { search: '', classFilter: '', statusFilter: '', typeFilter: '' };

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
const seed = [
  [['meta'], meta],
  [['dashboard'], dashboard],
  [['students', 'children'], students],
  [['students', noFilters], students],
  [['students', 'admin'], students],
  [['classes'], classes],
  [['class', classes.items[0].id], { class: classes.items[0], students: students.items.slice(0, 5) }],
  [['teachers', { search: '', statusFilter: '' }], teachers],
  [['admissions', { search: '' }], admissions],
  [['payments', { search: '', statusFilter: '', methodFilter: '', typeFilter: '' }], payments],
  [['courses', { search: '', statusFilter: '', levelFilter: '' }], courses],
  [['announcements', { search: '' }], announcements],
  [['results', { term: meta.currentTerm, classFilter: '' }], results],
  [['student', students.items[0].id], studentDetail],
  [['faculties'], faculties],
  [['faculty', faculties.items[0]?.id], { faculty: faculties.items[0], programs: programs.items }],
  [['programs', '', '', ''], programs],
  [['program', programs.items[0]?.id], { program: programs.items[0], units: units.items, students: students.items.slice(0, 5) }],
  [['units', '', '', ''], units],
  [['schedules', '', ''], schedules],
  [['books', '', '', ''], books],
  [['loans', '', ''], loans],
  [['attendance', new Date().toISOString().slice(0, 10), '', '', 'Journée'], attendanceToday],
  [['me'], { user: me.user }],
];
for (const [key, data] of seed) queryClient.setQueryData(key, data);

const user = me.user;
const routes = {
  Dashboard: '/app',
  Students: '/app/eleves',
  Classes: '/app/classes',
  Teachers: '/app/enseignants',
  Admissions: '/app/inscriptions',
  Payments: '/app/paiements',
  Courses: '/app/cours',
  Announcements: '/app/annonces',
  Results: '/app/resultats',
  Settings: '/app/parametres',
  Faculties: '/app/facultes',
  Programs: '/app/filieres',
  Units: '/app/unites',
  Timetable: '/app/emploi-du-temps',
  Library: '/app/bibliotheque',
  Attendance: '/app/presences',
  Login: '/connexion',
  Landing: '/',
  NotFound: '/nope',
};

let failures = 0;
for (const [name, path] of Object.entries(pages)) {
  try {
    const mod = await vite.ssrLoadModule(path);
    const Component = mod[name];
    if (!Component) throw new Error(`Composant ${name} introuvable dans ${path}`);
    const html = renderToString(
      React.createElement(QueryClientProvider, { client: queryClient },
        React.createElement(MemoryRouter, { initialEntries: [routes[name] ?? '/'] },
          React.createElement(AuthProvider, { initialUser: name === 'Login' || name === 'Landing' ? null : user },
            React.createElement(ToastProvider, null,
              React.createElement(Component, null))))),
    );
    const chars = html.length;
    const suspicious = /undefined|NaN/.test(html.replace(/<[^>]*>/g, ''));
    console.log(`${suspicious ? '⚠' : '✓'} ${name.padEnd(14)} ${String(chars).padStart(6)} car.${suspicious ? ' (texte suspect)' : ''}`);
    if (!chars) failures++;
  } catch (error) {
    failures++;
    console.error(`✗ ${name}: ${error.message}`);
    if (process.env.VERBOSE) console.error(error);
  }
}

await vite.close();
console.log(failures ? `\n${failures} page(s) en échec` : '\nToutes les pages se rendent correctement.');
process.exit(failures ? 1 : 0);
