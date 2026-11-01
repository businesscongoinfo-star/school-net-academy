/**
 * Application Express (API + interface compilée).
 * Exportée sans `listen()` pour pouvoir tourner en serverless (Vercel) ou en serveur Node.
 */
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { migrate, isEmpty } from './db.js';
import { seed, resetDatabase } from './seed.js';
import { requireAuth, verifyPassword, createSession, hashPassword } from './auth.js';
import { recentActivity } from './helpers.js';
import { get as dbGet } from './db.js';
import { requestLogger, recordRequest as requestLoggerReport, recent as recentRequests } from './diagnostics.js';

import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import studentRoutes from './routes/students.js';
import classRoutes from './routes/classes.js';
import teacherRoutes from './routes/teachers.js';
import admissionRoutes from './routes/admissions.js';
import paymentRoutes from './routes/payments.js';
import courseRoutes from './routes/courses.js';
import announcementRoutes from './routes/announcements.js';
import gradeRoutes from './routes/grades.js';
import metaRoutes from './routes/meta.js';
import { facultiesRouter, programsRouter, unitsRouter } from './routes/university.js';
import scheduleRoutes from './routes/schedules.js';
import libraryRoutes from './routes/library.js';
import attendanceRoutes from './routes/attendance.js';
import cardRoutes from './routes/cards.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, '..', 'web', 'dist');
const PORT = Number(process.env.PORT || 3000);

migrate();
if (isEmpty() || process.env.SEED === 'force') {
  if (process.env.SEED === 'force') resetDatabase();
  console.log('→ Initialisation des données de démonstration…');
  console.log('  ', seed());
}

const app = express();
app.disable('x-powered-by');

/**
 * Routage Vercel : la fonction serverless vit sur `/api` (un seul segment).
 * `vercel.json` réécrit `/api/<chemin>` en `/api?__p=<chemin>` ; on reconstitue
 * ici l'URL d'origine pour que les routeurs Express fonctionnent normalement,
 * quel que soit le nombre de segments (ex. /api/auth/login, /api/grades/results).
 */
app.use((req, res, next) => {
  const raw = String(req.url ?? '');
  const [, rawQuery = ''] = raw.split('?');
  if (rawQuery) {
    const params = new URLSearchParams(rawQuery);
    const encoded = params.get('__p');
    if (encoded) {
      params.delete('__p');
      const search = params.toString();
      req.url = `/api/${encoded.replace(/^\/+/, '')}${search ? `?${search}` : ''}`;
      // Express/parseurl met en cache l'URL analysée : on l'invalide pour que
      // le routage utilise bien le chemin reconstitué.
      req._parsedUrl = undefined;
    }
  }
  next();
});

app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

/* ----------------------------- API ----------------------------- */

app.use(requestLogger);

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'school-net-academy', time: new Date().toISOString() });
});

/**
 * Auto-test public : vérifie que le chemin d'authentification fonctionne sur
 * cette instance (base lisible, empreinte de mot de passe valide, jeton
 * signable et vérifiable). Ne renvoie aucune donnée personnelle.
 */
app.get('/api/diagnostics', (req, res) => {
  const checks = {};
  let ok = true;
  const run = (name, fn) => {
    try { checks[name] = fn(); } catch (error) {
      ok = false;
      checks[name] = `ERREUR: ${error?.message ?? error}`;
    }
  };

  run('db', () => dbGet('SELECT COUNT(*) AS c FROM users').c);
  run('adminDemoPassword', () => {
    const row = dbGet("SELECT password_hash FROM users WHERE role = 'admin' LIMIT 1");
    return row ? verifyPassword(process.env.DIAG_PASSWORD || 'demo1234', row.password_hash) : 'aucun compte direction';
  });
  run('teacherDemoPassword', () => {
    const row = dbGet("SELECT password_hash FROM users WHERE role = 'teacher' LIMIT 1");
    return row ? verifyPassword(process.env.DIAG_PASSWORD || 'demo1234', row.password_hash) : 'aucun compte enseignant';
  });
  run('hashRoundtrip', () => verifyPassword('mot-de-passe-test', hashPassword('mot-de-passe-test')));
  run('sessionToken', () => {
    const row = dbGet("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    const { token } = createSession(row.id);
    return typeof token === 'string' && token.includes('.') ? token.split('.')[1].length : 'jeton invalide';
  });

  if ([checks.db, checks.adminDemoPassword, checks.teacherDemoPassword, checks.hashRoundtrip, checks.sessionToken]
    .some((value) => typeof value === 'string' || value === false)) ok = false;

  res.status(ok ? 200 : 500).json({
    ok,
    routing: {
      url: req.url,
      originalUrl: req.originalUrl,
      query: req.query,
    },
    runtime: {
      node: process.version,
      platform: process.env.VERCEL ? 'vercel' : 'node',
      region: process.env.VERCEL_REGION ?? null,
      sessionMode: process.env.SESSION_MODE ?? 'stateful',
      dbFile: process.env.DB_FILE ?? '(defaut)',
      hasSecret: Boolean(process.env.SESSION_SECRET),
    },
    checks,
    requests: recentRequests.slice(0, 15),
  });
});

/**
 * Page de test auto-exécutée (HTML brut, hors SPA) : rejoue depuis un vrai
 * navigateur un POST technique puis un POST de connexion, et affiche
 * l'intégralité de la réponse (statut, en-têtes, corps). Sert à diagnostiquer
 * un incident réseau ou serverless en production.
 */
/** Le navigateur signale ici les réponses anormales (statut et message),
 *  ce qui permet de diagnostiquer un incident en production. */
app.get('/api/diagnostics/report', (req, res) => {
  const { path: apiPath, method, status, detail } = req.query;
  requestLoggerReport({
    kind: 'client-report',
    path: String(apiPath ?? '').slice(0, 120),
    method: String(method ?? '').slice(0, 10),
    status: Number(status) || 0,
    detail: String(detail ?? '').slice(0, 300),
  });
  res.json({ ok: true });
});

/** Écho technique : permet de vérifier depuis un navigateur que le POST et le
 *  corps JSON arrivent bien à la fonction serverless. */
app.post('/api/diagnostics/echo', (req, res) => {
  res.json({
    ok: true,
    method: req.method,
    contentType: req.headers['content-type'] ?? null,
    bodyParsed: Boolean(req.body && Object.keys(req.body).length),
    bodyKeys: Object.keys(req.body ?? {}),
    at: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);

app.use('/api/dashboard', requireAuth, dashboardRoutes);
app.use('/api/students', requireAuth, studentRoutes);
app.use('/api/classes', requireAuth, classRoutes);
app.use('/api/teachers', requireAuth, teacherRoutes);
app.use('/api/admissions', requireAuth, admissionRoutes);
app.use('/api/payments', requireAuth, paymentRoutes);
app.use('/api/courses', requireAuth, courseRoutes);
app.use('/api/announcements', requireAuth, announcementRoutes);
app.use('/api/grades', requireAuth, gradeRoutes);
app.use('/api/meta', requireAuth, metaRoutes);
app.use('/api/faculties', requireAuth, facultiesRouter);
app.use('/api/programs', requireAuth, programsRouter);
app.use('/api/course-units', requireAuth, unitsRouter);
app.use('/api/schedules', requireAuth, scheduleRoutes);
app.use('/api/library', requireAuth, libraryRoutes);
app.use('/api/attendance', requireAuth, attendanceRoutes);
app.use('/api/cards', requireAuth, cardRoutes);

app.get('/api/activity', requireAuth, (req, res) => {
  res.json({ items: recentActivity(12) });
});

app.use('/api', (req, res) => {
  res.status(404).json({
    error: 'Endpoint introuvable.',
    receivedUrl: req.url,
    originalUrl: req.originalUrl,
    expressPath: req.path,
  });
});

/* --------------------------- Frontend -------------------------- */

if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR, {
    setHeaders(res, filePath) {
      if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
      else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  }));

  app.get('*', (req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
} else {
  app.get('*', (req, res) => {
    res.status(503).type('html').send(
      `<main style="font-family:system-ui;padding:3rem;max-width:40rem;margin:auto">
         <h1>School Net Academy</h1>
         <p>L'interface n'est pas encore compilée. Lancez <code>npm run build</code> puis redémarrez le serveur.</p>
       </main>`,
    );
  });
}

/* ------------------------- Erreurs ----------------------------- */

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.locals.errorMessage = err.message;
  res.status(status).json({
    error: status >= 500 ? 'Une erreur interne est survenue. Réessayez.' : err.message,
    details: err.details?.map?.((d) => ({ path: d.path?.join('.'), message: d.message })),
  });
});

export { app, PORT };

export default app;
