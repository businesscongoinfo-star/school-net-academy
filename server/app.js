/**
 * Application Express (API + interface compilée).
 * Exportée sans `listen()` pour pouvoir tourner en serverless (Vercel) ou en serveur Node.
 */
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { migrate, isEmpty, isDirty, onWrite } from './db.js';
import { restore, flush, scheduleSync, persistenceStatus, persistenceMode } from './persist.js';
import { supabaseStatus, syncAuthUser } from './supabase.js';
import { mailerStatus } from './mailer.js';
import { seed, resetDatabase } from './seed.js';
import { requireAuth, verifyPassword, createSession, hashPassword, userFromRequest } from './auth.js';
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
import platformRoutes, { ensurePlatformSeed } from './routes/platform.js';
import notificationRoutes from './routes/notifications.js';
import newsletterRoutes from './routes/newsletter.js';
import aiRoutes from './routes/ai.js';
import { tenantOf, accessState, ensureSuperAdmins, pruneDemoStaff } from './platform.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, '..', 'web', 'dist');
const PORT = Number(process.env.PORT || 3000);

/**
 * Démarrage asynchrone, exécuté une seule fois par instance :
 *   1. restauration de l'instantané Supabase (persistance réelle) ;
 *   2. migration du schéma SQLite local ;
 *   3. données de démonstration si la base est vide ;
 *   4. compte super administrateur réel (variables d'environnement) ;
 *   5. première sauvegarde.
 * `ready` est attendu avant de servir la moindre requête (voir api/index.js).
 */
let bootResult = null;

export const ready = (async () => {
  const restored = await restore();
  migrate();
  onWrite(() => scheduleSync());

  if (isEmpty() || process.env.SEED === 'force') {
    if (process.env.SEED === 'force') resetDatabase();
    console.log('→ Initialisation des données de démonstration…');
    seed();
  }
  ensurePlatformSeed();
  const prunedStaff = pruneDemoStaff();
  if (prunedStaff.length) console.log('[boot] comptes de démonstration retirés :', prunedStaff.join(', '));
  const admins = ensureSuperAdmins();
  const superAdmin = admins?.primary ?? null;
  if (admins) {
    // Miroir Supabase Auth pour chaque adresse : récupération de mot de passe incluse.
    for (const account of [admins.primary, ...admins.aliases]) {
      if (!account) continue;
      await syncAuthUser({
        email: account.email,
        password: process.env.SUPERADMIN_PASSWORD,
        name: process.env.SUPERADMIN_NAME || 'Super administrateur',
      }).catch(() => null);
    }
  }

  bootResult = {
    restored,
    superAdmin,
    superAdminAliases: admins?.aliases?.map((account) => account.email) ?? [],
    persistence: persistenceMode(),
    users: dbGet('SELECT COUNT(*) AS c FROM users')?.c ?? 0,
  };
  if (isDirty()) await flush();
  console.log('[boot]', JSON.stringify(bootResult));
  return bootResult;
})().catch((error) => {
  console.error('[boot] échec :', error);
  // On laisse l'application démarrer : mieux vaut un service dégradé qu'un 500 total.
  return { error: String(error?.message ?? error) };
});

export const bootInfo = () => bootResult;

/**
 * Mur d'abonnement : quand l'essai gratuit est terminé (ou le compte suspendu),
 * les routes métier répondent 402 et le front redirige vers l'espace d'abonnement.
 */
function tenantGate(req, res, next) {
  if (!req.user?.tenantId) return next();
  const access = accessState(tenantOf(req.user));
  if (access.blocked) {
    res.status(402).json({
      error: "Votre essai gratuit est terminé. Choisissez une offre pour retrouver l'accès.",
      code: 'ABONNEMENT_REQUIS',
      access,
    });
    return;
  }
  next();
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
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

/**
 * Persistance : après chaque requête qui a écrit en base, on pousse l'instantané
 * vers Supabase. `waitUntil` maintient la fonction serverless en vie le temps de
 * l'envoi, même une fois la réponse terminée.
 */
app.use((req, res, next) => {
  res.on('finish', () => {
    if (!isDirty()) return;
    try {
      const pending = flush();
      if (process.env.VERCEL) {
        import('@vercel/functions')
          .then(({ waitUntil }) => waitUntil(pending))
          .catch(() => pending);
      }
    } catch { /* ignoré : la prochaine requête réessaiera */ }
  });
  next();
});

/* ----------------------------- API ----------------------------- */

app.use(requestLogger);

app.get('/api/health', (req, res) => {
  const persistence = persistenceStatus();
  res.json({
    ok: true,
    service: 'school-net-academy',
    time: new Date().toISOString(),
    persistence: persistence.mode,
    snapshot: { version: persistence.version, lastSyncAt: persistence.lastSyncAt, error: persistence.lastError },
    supabase: supabaseStatus().configured,
    email: mailerStatus().configured ? mailerStatus().provider : 'non configuré',
    boot: bootInfo(),
  });
});

/** État des intégrations (Supabase, e-mail, persistance) — réservé à l'équipe. */
app.get('/api/integrations/status', requireAuth, (req, res) => {
  const isPlatformStaff = Boolean(req.user.platformRole);
  res.json({
    supabase: supabaseStatus(),
    mail: mailerStatus(),
    persistence: persistenceStatus(),
    sms: {
      configured: Boolean((process.env.SMS_API_URL || '').trim()),
    },
    runtime: {
      platform: process.env.VERCEL ? 'vercel' : 'node',
      region: process.env.VERCEL_REGION ?? null,
      url: process.env.APP_URL || null,
    },
    canManage: ['owner', 'manager'].includes(req.user.platformRole) || isPlatformStaff === false,
    boot: bootInfo(),
  });
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

app.use('/api/dashboard', requireAuth, tenantGate, dashboardRoutes);
app.use('/api/students', requireAuth, tenantGate, studentRoutes);
app.use('/api/classes', requireAuth, tenantGate, classRoutes);
app.use('/api/teachers', requireAuth, tenantGate, teacherRoutes);
app.use('/api/admissions', requireAuth, tenantGate, admissionRoutes);
app.use('/api/payments', requireAuth, tenantGate, paymentRoutes);
app.use('/api/courses', requireAuth, tenantGate, courseRoutes);
app.use('/api/announcements', requireAuth, tenantGate, announcementRoutes);
app.use('/api/grades', requireAuth, tenantGate, gradeRoutes);
app.use('/api/meta', requireAuth, tenantGate, metaRoutes);
app.use('/api/faculties', requireAuth, tenantGate, facultiesRouter);
app.use('/api/programs', requireAuth, tenantGate, programsRouter);
app.use('/api/course-units', requireAuth, tenantGate, unitsRouter);
app.use('/api/schedules', requireAuth, tenantGate, scheduleRoutes);
app.use('/api/library', requireAuth, tenantGate, libraryRoutes);
app.use('/api/attendance', requireAuth, tenantGate, attendanceRoutes);
app.use('/api/cards', requireAuth, tenantGate, cardRoutes);

/* ------------------- Plateforme, équipe, facturation ------------------- */
// Authentification facultative : la plateforme contient des routes publiques
// (catalogue, inscription d'un établissement) et des routes réservées à l'équipe.
app.use('/api/platform', (req, res, next) => {
  const user = userFromRequest(req);
  if (user) req.user = user;
  next();
}, platformRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/ai', aiRoutes);

app.get('/api/activity', requireAuth, tenantGate, (req, res) => {
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
