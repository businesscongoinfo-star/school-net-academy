import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { migrate, isEmpty } from './db.js';
import { seed, resetDatabase } from './seed.js';
import { requireAuth, userFromRequest } from './auth.js';
import { recentActivity } from './helpers.js';

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
app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

/* ----------------------------- API ----------------------------- */

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'school-net-academy', time: new Date().toISOString() });
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

app.get('/api/activity', requireAuth, (req, res) => {
  res.json({ items: recentActivity(12) });
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Endpoint introuvable.' });
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
  res.status(status).json({
    error: status >= 500 ? 'Une erreur interne est survenue. Réessayez.' : err.message,
    details: err.details?.map?.((d) => ({ path: d.path?.join('.'), message: d.message })),
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✔ School Net Academy — http://localhost:${PORT}`);
  console.log(`  Données : ${process.env.DB_FILE || 'data/school-net.db'}`);
});

void userFromRequest;
