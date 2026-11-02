import { all, get, run, now, uid } from './db.js';
import { HttpError } from './helpers.js';
import { hashPassword, verifyPassword } from './auth.js';
import { sendMail, renderEmail } from './mailer.js';

/* ------------------------------- Offres ---------------------------------- */

export const PLANS = [
  {
    id: 'essentiel',
    name: 'Essentiel',
    priceFcfa: 15000,
    period: 'mois',
    tagline: 'Pour une petite école qui démarre',
    features: [
      'Élèves, classes, présences',
      'Paiements & reçus',
      'Cartes scolaires (QR + NFC)',
      '3 comptes utilisateurs',
    ],
    seats: 3,
    trialDays: 7,
  },
  {
    id: 'pro',
    name: 'Pro',
    priceFcfa: 45000,
    period: 'mois',
    tagline: "L'offre des établissements complets",
    features: [
      'Tout Essentiel',
      'Université : facultés, filières, UE, crédits',
      'Emploi du temps & bibliothèque',
      'Bulletins, SMS aux parents, notifications',
      '10 comptes utilisateurs',
    ],
    seats: 10,
    popular: true,
    trialDays: 7,
  },
  {
    id: 'universite',
    name: 'Université',
    priceFcfa: 120000,
    period: 'mois',
    tagline: 'Campus, LMD et grandes structures',
    features: [
      'Tout Pro',
      'Multi-campus & filières illimitées',
      'Pointage NFC sur plusieurs portails',
      'Support prioritaire & accompagnement',
      'Utilisateurs illimités',
    ],
    seats: 999,
    trialDays: 7,
  },
];

export const planById = (id) => PLANS.find((plan) => plan.id === id) ?? null;

/**
 * Taux indicatifs : 1 FCFA (XAF) = x devise locale.
 * Utilisés pour adapter automatiquement les prix au pays choisi à l'inscription.
 */
const FX = {
  XAF: 1, XOF: 1, XPF: 0.18, EUR: 0.001524, USD: 0.0017, GBP: 0.0013, CHF: 0.0015,
  CAD: 0.00233, AUD: 0.0026, NZD: 0.0028, JPY: 0.26, CNY: 0.0123, HKD: 0.0133,
  SGD: 0.0023, KRW: 2.4, TWD: 0.055, INR: 0.145, PKR: 0.48, BDT: 0.2, LKR: 0.51,
  NPR: 0.23, THB: 0.059, IDR: 27, MYR: 0.0076, PHP: 0.098, VND: 43, MNT: 5.9,
  KZT: 0.86, UZS: 21, KGS: 0.15, TJS: 0.019, TMT: 0.006, AZN: 0.0029, GEL: 0.0046,
  AMD: 0.66, RUB: 0.15, UAH: 0.071, BYN: 0.0055, MDL: 0.03, PLN: 0.0063, CZK: 0.039,
  HUF: 0.62, RON: 0.0078, BGN: 0.003, RSD: 0.19, MKD: 0.097, ALL: 0.16, BAM: 0.003,
  TRY: 0.07, ILS: 0.0063, AED: 0.00625, SAR: 0.00638, QAR: 0.0062, KWD: 0.00052,
  OMR: 0.00065, BHD: 0.00064, JOD: 0.0012, LBP: 0.15, IQD: 2.2, IRR: 71, AFN: 0.12,
  SYP: 0.022, YER: 0.42, PKR_ALT: 0,
  MAD: 0.0167, DZD: 0.23, TND: 0.0053, LYD: 0.0082, EGP: 0.084, SDG: 1, SSP: 8,
  ETB: 0.2, ERN: 0.026, DJF: 0.3, SOS: 0.97, KES: 0.22, UGX: 6.3, TZS: 4.5,
  RWF: 2.3, BIF: 4.9, CDF: 4.8, CDF_ALT: 0, XAF_ALT: 0,
  NGN: 2.6, GHS: 0.025, GMD: 0.12, GNF: 14.6, LRD: 0.33, SLE: 0.038, CVE: 0.17,
  STN: 0.038, MRU: 0.068, MGA: 7.7, MWK: 2.9, MZN: 0.11, ZMW: 0.045, ZWL: 0.58,
  BWP: 0.023, NAD: 0.031, LSL: 0.031, SZL: 0.031, ZAR: 0.031, AOA: 1.6, KMF: 0.75,
  MUR: 0.078, SCR: 0.024, MVR: 0.026,
  ARS: 2, BOB: 0.012, BRL: 0.0095, CLP: 1.6, COP: 6.9, CRC: 0.86, CUP: 0.041,
  DOP: 0.1, GTQ: 0.013, HNL: 0.042, HTG: 0.22, JMD: 0.27, MXN: 0.031, NIO: 0.063,
  PAB: 0.0017, PEN: 0.0063, PYG: 12.6, SRD: 0.062, TTD: 0.011, UYU: 0.07,
  VES: 0.1, XCD: 0.0046, BBD: 0.0034, BSD: 0.0017, BZD: 0.0034, GYD: 0.36,
  FJD: 0.0038, PGK: 0.0068, SBD: 0.014, VUV: 0.2, WST: 0.0046, TOP: 0.004,
};

export const FX_RATES = Object.fromEntries(
  Object.entries(FX).filter(([code]) => !code.endsWith('_ALT')),
);

export const SUPPORTED_CURRENCIES = Object.keys(FX_RATES);

export function convert(amountFcfa, currency = 'XAF') {
  const rate = FX_RATES[String(currency).toUpperCase()] ?? 1;
  const value = amountFcfa * rate;
  if (rate >= 100) return Math.round(value / 100) * 100;
  if (rate >= 1) return Math.round(value);
  return Math.round(value * 100) / 100;
}

export const formatMoney = (amount, currency = 'XAF') => (
  `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(amount)} ${currency}`
);

/* ------------------------------- Établissements --------------------------- */

export const TRIAL_DAYS = 7;

export function trialEndsAt(days = TRIAL_DAYS) {
  return new Date(Date.now() + days * 86400000).toISOString();
}

export function tenantOf(user) {
  const id = user?.tenantId ?? user?.tenant_id;
  if (!id) return null;
  return get('SELECT * FROM tenants WHERE id = ?', id);
}

/**
 * État d'accès d'un établissement : essai en cours, actif, expiré, suspendu.
 * `blocked` déclenche le mur d'abonnement côté API (402).
 */
export function accessState(tenant) {
  if (!tenant) return { status: 'actif', blocked: false, daysLeft: null };
  if (tenant.status === 'suspendu') return { status: 'suspendu', blocked: true, daysLeft: 0 };
  if (tenant.status === 'essai') {
    const ends = tenant.trial_ends_at ? new Date(tenant.trial_ends_at).getTime() : 0;
    const daysLeft = Math.ceil((ends - Date.now()) / 86400000);
    if (ends < Date.now()) return { status: 'essai_expire', blocked: true, daysLeft: 0 };
    return { status: 'essai', blocked: false, daysLeft: Math.max(0, daysLeft) };
  }
  if (tenant.status === 'expire') return { status: 'expire', blocked: true, daysLeft: 0 };
  return { status: 'actif', blocked: false, daysLeft: null };
}

export function tenantPublic(tenant) {
  if (!tenant) return null;
  const access = accessState(tenant);
  return {
    id: tenant.id,
    name: tenant.name,
    kind: tenant.kind,
    country: tenant.country,
    countryCode: tenant.country_code,
    currency: tenant.currency,
    email: tenant.email,
    phone: tenant.phone,
    status: tenant.status,
    plan: tenant.plan,
    seats: tenant.seats,
    trialEndsAt: tenant.trial_ends_at,
    createdAt: tenant.created_at,
    access,
  };
}

/* --------------------------------- Équipe -------------------------------- */

export const PLATFORM_ROLES = {
  owner: { label: 'Propriétaire', scope: 'Tout, y compris la facturation et l’équipe' },
  manager: { label: 'Gestionnaire', scope: 'Établissements, abonnements, équipe, campagnes' },
  support: { label: 'Support', scope: 'Assistance aux établissements, lecture des comptes' },
  finance: { label: 'Finance', scope: 'Abonnements, paiements, factures, relances' },
  marketing: { label: 'Marketing', scope: 'Newsletter, campagnes, abonnés, contenus' },
  closer: { label: 'Closer', scope: 'Prospects, essais en cours, conversions' },
};

export const isPlatformStaff = (user) => Boolean(user?.platform_role);

export function requirePlatform(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Non authentifié.' });
    const role = req.user.platformRole ?? req.user.platform_role;
    if (!role) return res.status(403).json({ error: "Espace réservé à l'équipe School Net Academy." });
    if (role === 'owner') return next();
    if (roles.length && !roles.includes(role)) {
      return res.status(403).json({
        error: `Votre rôle (${PLATFORM_ROLES[role]?.label ?? role}) n'a pas accès à cette ressource.`,
      });
    }
    next();
  };
}

/* ------------------------------ Notifications ---------------------------- */

export function notify({ userId, tenantId = null, kind, title, body = null, link = null }) {
  if (!userId) return null;
  const id = uid('ntf');
  run(
    `INSERT INTO notifications (id, user_id, tenant_id, kind, title, body, link, read_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
    id, userId, tenantId, kind, title, body, link, now(),
  );
  return id;
}

/**
 * SMS : envoi réel si un fournisseur est configuré (SMS_API_URL/SMS_API_KEY),
 * sinon le message est journalisé dans la boîte d'envoi avec le statut « simule ».
 */
export async function sendSms({ tenantId = null, to, body }) {
  if (!to) return null;
  const id = uid('sms');
  const createdAt = now();
  const url = process.env.SMS_API_URL;
  const key = process.env.SMS_API_KEY;
  const from = process.env.SMS_SENDER || 'SchoolNet';

  if (!url || !key) {
    run(
      `INSERT INTO sms_outbox (id, tenant_id, to_number, body, status, provider, error, created_at, sent_at)
       VALUES (?, ?, ?, ?, 'simule', 'journal', NULL, ?, NULL)`,
      id, tenantId, to, body, createdAt,
    );
    return { id, status: 'simule' };
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ to, from, message: body }),
    });
    const ok = response.ok;
    run(
      `INSERT INTO sms_outbox (id, tenant_id, to_number, body, status, provider, error, created_at, sent_at)
       VALUES (?, ?, ?, ?, ?, 'api', ?, ?, ?)`,
      id, tenantId, to, body, ok ? 'envoye' : 'echec', ok ? null : `HTTP ${response.status}`,
      createdAt, ok ? now() : null,
    );
    return { id, status: ok ? 'envoye' : 'echec' };
  } catch (error) {
    run(
      `INSERT INTO sms_outbox (id, tenant_id, to_number, body, status, provider, error, created_at, sent_at)
       VALUES (?, ?, ?, ?, 'echec', 'api', ?, ?, NULL)`,
      id, tenantId, to, body, String(error?.message ?? error).slice(0, 180), createdAt,
    );
    return { id, status: 'echec' };
  }
}

/** Prévient les tuteurs d'un élève : notification in-app + SMS. */
export async function notifyGuardian(studentId, { kind, title, body, sms, link = '/app/mes-enfants' }) {
  const student = get(
    `SELECT s.id, s.first_name AS firstName, s.last_name AS lastName, s.guardian_phone AS guardianPhone,
            s.guardian_email AS guardianEmail, s.guardian_name AS guardianName,
            s.guardian_user_id AS guardianUserId, s.tenant_id AS tenantId,
            t.name AS tenantName, t.currency AS currency
       FROM students s LEFT JOIN tenants t ON t.id = s.tenant_id WHERE s.id = ?`,
    studentId,
  );
  if (!student) return;
  let guardianUserId = student.guardianUserId;
  if (!guardianUserId) {
    const parent = get("SELECT id FROM users WHERE role = 'parent' ORDER BY created_at LIMIT 1");
    guardianUserId = parent?.id ?? null;
  }
  if (guardianUserId) {
    notify({ userId: guardianUserId, tenantId: student.tenantId ?? null, kind, title, body, link });
  }
  if (student.guardianPhone && sms) {
    await sendSms({ tenantId: student.tenantId ?? null, to: student.guardianPhone, body: sms });
  }
  // E-mail réel au tuteur (dès qu'un fournisseur est configuré).
  if (student.guardianEmail) {
    await sendMail({
      to: student.guardianEmail,
      kind,
      subject: title,
      html: renderEmail({
        title,
        preheader: body ?? title,
        intro: `Bonjour ${student.guardianName || 'cher parent'},`,
        blocks: [
          { text: body ?? title },
          { text: `Élève : <strong>${student.firstName} ${student.lastName}</strong>` },
          student.tenantName ? { text: `Établissement : ${student.tenantName}` } : { text: '' },
        ].filter((block) => block.text),
        cta: { label: 'Ouvrir mon espace parent', url: `${(process.env.APP_URL || 'https://school-net-academy.vercel.app').replace(/\/$/, '')}/connexion` },
        footnote: 'Vous recevez cet e-mail en tant que tuteur enregistré auprès de l’établissement.',
      }),
    }).catch(() => null);
  }
  return student;
}

/**
 * Retire les comptes d'équipe de démonstration d'une base de production
 * (les données créées par le propriétaire ne sont jamais touchées).
 */
export function pruneDemoStaff() {
  if (!process.env.VERCEL || process.env.SEED_DEMO_STAFF === '1') return [];
  const emails = [
    'superadmin@schoolnet.academy', 'gestion@schoolnet.academy', 'support@schoolnet.academy',
    'finance@schoolnet.academy', 'marketing@schoolnet.academy', 'closer@schoolnet.academy',
  ];
  const removed = [];
  for (const email of emails) {
    const row = get('SELECT id FROM users WHERE lower(email) = ? AND platform_role IS NOT NULL', email);
    if (!row) continue;
    run('DELETE FROM notifications WHERE user_id = ?', row.id);
    run('DELETE FROM impersonation_tokens WHERE user_id = ?', row.id);
    run('DELETE FROM users WHERE id = ?', row.id);
    removed.push(email);
  }
  return removed;
}

/** Compte super administrateur réel, créé/à jour depuis les variables d'environnement. */
export function ensureSuperAdmin() {
  const email = String(process.env.SUPERADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.SUPERADMIN_PASSWORD || '';
  const name = process.env.SUPERADMIN_NAME || 'Super administrateur';
  if (!email || !password) return null;

  const ts = now();
  const existing = get('SELECT * FROM users WHERE lower(email) = ?', email);
  if (existing) {
    if (existing.platform_role !== 'owner') {
      run("UPDATE users SET platform_role = 'owner', title = ?, updated_at = ? WHERE id = ?",
        name, ts, existing.id);
    }
    if (!verifyPassword(password, existing.password_hash)) {
      run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', hashPassword(password), ts, existing.id);
      return { id: existing.id, created: false, passwordReset: true, email };
    }
    return { id: existing.id, created: false, passwordReset: false, email };
  }

  const id = process.env.SUPERADMIN_ID || 'usr_superadmin';
  run(
    `INSERT INTO users (id, email, password_hash, name, role, phone, title, avatar_color, platform_role,
       tenant_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'admin', ?, ?, '#0f766e', 'owner', NULL, ?, ?)`,
    id, email, hashPassword(password), name, process.env.SUPERADMIN_PHONE || null,
    name, ts, ts,
  );
  return { id, created: true, passwordReset: false, email };
}

/** Liste des abonnés « actifs » pour une campagne. */
export function subscriberAudience(audience = 'abonnes') {
  if (audience === 'tous') return all("SELECT * FROM newsletter_subscribers WHERE status <> 'desinscrit'");
  if (audience === 'essais' || audience === 'clients') {
    const status = audience === 'essais' ? 'essai' : 'actif';
    return all(
      'SELECT email, name FROM tenants WHERE status = ? AND email IS NOT NULL ORDER BY created_at DESC',
      status,
    );
  }
  return all("SELECT * FROM newsletter_subscribers WHERE status = 'actif'");
}

export function ensurePlatformSeed() {
  const ts = now();
  const existing = get('SELECT id FROM tenants LIMIT 1');
  if (!existing) {
    run(
      `INSERT INTO tenants (id, name, kind, country, country_code, currency, email, phone, status, plan,
        trial_ends_at, seats, notes, created_at, updated_at)
       VALUES (?, ?, 'mixte', ?, 'CG', 'XAF', ?, ?, 'actif', 'universite', NULL, 999, ?, ?, ?)`,
      'tnt_demo', 'School Net Academy', 'Congo-Brazzaville',
      'direction@schoolnet.academy', '+242 06 512 44 18',
      'Établissement de démonstration (abonnement Université actif)', ts, ts,
    );
  }
  const demo = get('SELECT id FROM tenants WHERE id = ?', 'tnt_demo');
  if (demo) {
    run("UPDATE users SET tenant_id = 'tnt_demo' WHERE tenant_id IS NULL AND platform_role IS NULL");
  }
  // Un établissement en fin d'essai (4 jours restants) pour l'espace plateforme
  if (!get('SELECT id FROM tenants WHERE id = ?', 'tnt_essai')) {
    const end = new Date(Date.now() + 4 * 86400000).toISOString();
    run(
      `INSERT INTO tenants (id, name, kind, country, country_code, currency, email, phone, status, plan,
        trial_ends_at, seats, notes, created_at, updated_at)
       VALUES ('tnt_essai', ?, 'ecole', ?, 'CI', 'XOF', ?, ?, 'essai', NULL, ?, 10, ?, ?, ?)`,
      'Groupe Scolaire Les Palmiers', "Côte d'Ivoire", 'contact@lespalmiers.ci',
      '+225 07 00 00 00', end, 'Essai gratuit de 7 jours (démonstration)', ts, ts,
    );
  }

  // Un établissement dont l'essai est terminé : permet de tester le mur d'abonnement
  // (connexion : essai@schoolnet.academy / demo1234).
  if (!get('SELECT id FROM tenants WHERE id = ?', 'tnt_expire')) {
    const ended = new Date(Date.now() - 86400000).toISOString();
    run(
      `INSERT INTO tenants (id, name, kind, country, country_code, currency, email, phone, status, plan,
        trial_ends_at, seats, notes, created_at, updated_at)
       VALUES ('tnt_expire', ?, 'universite', ?, 'CD', 'CDF', ?, ?, 'essai', NULL, ?, 10, ?, ?, ?)`,
      'Institut Supérieur Les Cèdres', 'RD Congo', 'contact@lescedres.cd',
      '+243 81 555 00 11', ended, 'Essai terminé (démonstration du blocage)', ts, ts,
    );
  }
  if (!get('SELECT id FROM users WHERE lower(email) = ?', 'essai@schoolnet.academy')) {
    const userId = 'usr_demo_essai';
    run(
      `INSERT INTO users (id, email, password_hash, name, role, phone, title, avatar_color,
         platform_role, tenant_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'admin', ?, ?, '#b45309', NULL, 'tnt_expire', ?, ?)`,
      userId, 'essai@schoolnet.academy', hashPassword('demo1234'), 'Patrick Loemba',
      '+243 81 555 00 11', 'Direction', ts, ts,
    );
    run("UPDATE tenants SET owner_id = ? WHERE id = 'tnt_expire'", userId);
  }
}
