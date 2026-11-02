import { Router } from 'express';
import { z } from 'zod';
import { all, get, run, now, uid } from '../db.js';
import { parseBody, asyncHandler, badRequest, notFound, forbidden } from '../helpers.js';
import { hashPassword, createSession, sessionCookie } from '../auth.js';
import {
  PLANS, planById, tenantPublic, accessState, trialEndsAt, TRIAL_DAYS, requirePlatform,
  PLATFORM_ROLES, notify, subscriberAudience, ensurePlatformSeed,
  FX_RATES, SUPPORTED_CURRENCIES, convert, formatMoney,
} from '../platform.js';

const router = Router();

const slug = (value) => String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '').slice(0, 40);

function invoiceReference() {
  const year = new Date().getFullYear();
  const row = get('SELECT COUNT(*) AS c FROM subscriptions');
  return `SUB-${year}-${String((row?.c ?? 0) + 1).padStart(4, '0')}`;
}

function addDays(days) {
  return new Date(Date.now() + days * 86400000).toISOString();
}

/* ------------------------------- Catalogue ------------------------------- */

router.get('/catalog', (req, res) => {
  const currency = String(req.query.currency ?? 'XAF').toUpperCase();
  res.json({
    plans: PLANS.map((plan) => ({
      ...plan,
      price: plan.priceFcfa,
      currency: 'XAF',
      localPrice: convert(plan.priceFcfa, currency),
      localCurrency: currency,
    })),
    trialDays: TRIAL_DAYS,
    baseCurrency: 'XAF',
    rates: FX_RATES,
    currencies: SUPPORTED_CURRENCIES,
  });
});

/* --------------------------- Création d'établissement --------------------- */

const signupSchema = z.object({
  schoolName: z.string().min(3, "Nom de l'établissement requis.").max(120),
  kind: z.enum(['ecole', 'universite', 'mixte']).default('ecole'),
  country: z.string().min(2, 'Pays requis.').max(80),
  countryCode: z.string().min(2).max(3),
  currency: z.string().min(3).max(3),
  adminName: z.string().min(3, 'Votre nom est requis.').max(80),
  email: z.string().email('Adresse e-mail invalide.').max(160),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères.').max(120),
  phone: z.string().max(40).nullable().optional(),
  plan: z.string().max(20).optional(),
  newsletter: z.boolean().optional(),
});

router.post('/signup', asyncHandler(async (req, res) => {
  const data = parseBody(signupSchema, req.body);
  const email = data.email.toLowerCase().trim();
  if (get('SELECT id FROM users WHERE lower(email) = ?', email)) {
    throw badRequest('Un compte existe déjà avec cette adresse. Connectez-vous plutôt.');
  }

  const tenantId = uid('tnt');
  const ts = now();
  const plan = planById(data.plan ?? 'pro');
  run(
    `INSERT INTO tenants (id, name, kind, country, country_code, currency, email, phone, status, plan,
       trial_ends_at, seats, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'essai', ?, ?, ?, ?, ?, ?)`,
    tenantId, data.schoolName.trim(), data.kind, data.country, data.countryCode.toUpperCase(),
    data.currency.toUpperCase(), email, data.phone ?? null, plan?.id ?? 'pro',
    trialEndsAt(plan?.trialDays ?? TRIAL_DAYS), plan?.seats ?? 10,
    `Essai gratuit de ${TRIAL_DAYS} jours — ${data.country}`, ts, ts,
  );

  const userId = uid('usr');
  run(
    `INSERT INTO users (id, email, password_hash, name, role, phone, title, avatar_color, platform_role,
       tenant_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'admin', ?, ?, '#0f766e', NULL, ?, ?, ?)`,
    userId, email, hashPassword(data.password), data.adminName.trim(), data.phone ?? null,
    'Direction', tenantId, ts, ts,
  );
  run('UPDATE tenants SET owner_id = ? WHERE id = ?', userId, tenantId);

  if (data.newsletter) {
    const existing = get('SELECT id FROM newsletter_subscribers WHERE email = ?', email);
    if (!existing) {
      run(
        `INSERT INTO newsletter_subscribers (id, email, name, country_code, source, status, created_at)
         VALUES (?, ?, ?, ?, 'inscription', 'actif', ?)`,
        uid('nwl'), email, data.adminName.trim(), data.countryCode.toUpperCase(), ts,
      );
    }
  }

  notify({
    userId, tenantId, kind: 'bienvenue',
    title: `Bienvenue sur School Net Academy, ${data.schoolName.trim()} !`,
    body: `Votre essai gratuit de ${TRIAL_DAYS} jours a démarré. Vous serez invité à choisir une offre à la fin de l'essai.`,
    link: '/app',
  });

  const { token, expiresAt } = createSession(userId);
  res.setHeader('Set-Cookie', sessionCookie(token));
  const tenant = get('SELECT * FROM tenants WHERE id = ?', tenantId);
  res.status(201).json({
    user: {
      id: userId, email, name: data.adminName.trim(), role: 'admin',
      phone: data.phone ?? null, title: 'Direction', avatarColor: '#0f766e',
      platformRole: null, tenant: tenantPublic(tenant), access: accessState(tenant),
    },
    access: accessState(tenant),
    expiresAt,
    trialDays: TRIAL_DAYS,
  });
}));

/* ------------------------------- Vue d'ensemble -------------------------- */

router.get('/overview', requirePlatform('manager', 'finance', 'support', 'marketing', 'closer'), asyncHandler(async (req, res) => {
  const tenants = all('SELECT * FROM tenants ORDER BY created_at DESC');
  const nowMs = Date.now();
  const actifs = tenants.filter((tenant) => accessState(tenant).status === 'actif');
  const essais = tenants.filter((tenant) => accessState(tenant).status === 'essai');
  const bloques = tenants.filter((tenant) => accessState(tenant).blocked);
  const revenue = get("SELECT COALESCE(SUM(COALESCE(amount_fcfa, amount)), 0) AS total FROM subscriptions WHERE status = 'paye'");
  const monthRevenue = get(
    `SELECT COALESCE(SUM(COALESCE(amount_fcfa, amount)), 0) AS total FROM subscriptions
      WHERE status = 'paye' AND created_at >= ?`,
    new Date(nowMs - 30 * 86400000).toISOString(),
  );
  const subscribers = get("SELECT COUNT(*) AS c FROM newsletter_subscribers WHERE status = 'actif'");
  const staff = all("SELECT id, name, email, platform_role AS platformRole FROM users WHERE platform_role IS NOT NULL");
  const recentInvoices = all(
    `SELECT s.id, s.reference, s.amount, s.currency, s.plan, s.method, s.status, s.created_at AS createdAt,
            t.name AS tenantName
       FROM subscriptions s JOIN tenants t ON t.id = s.tenant_id
      ORDER BY s.created_at DESC LIMIT 8`,
  );

  res.json({
    kpis: {
      tenants: tenants.length,
      actifs: actifs.length,
      essais: essais.length,
      bloques: bloques.length,
      mrr: Math.round(actifs.reduce((sum, tenant) => sum + (planById(tenant.plan)?.priceFcfa ?? 0), 0)),
      revenue: revenue?.total ?? 0,
      revenue30d: monthRevenue?.total ?? 0,
      subscribers: subscribers?.c ?? 0,
      staff: staff.length,
    },
    trials: essais
      .map((tenant) => ({ ...tenantPublic(tenant) }))
      .sort((a, b) => String(a.trialEndsAt ?? '').localeCompare(String(b.trialEndsAt ?? '')))
      .slice(0, 6),
    tenants: tenants.slice(0, 8).map(tenantPublic),
    invoices: recentInvoices,
    staff,
  });
}));

/* ------------------------------ Établissements --------------------------- */

router.get('/tenants', requirePlatform('manager', 'support', 'finance', 'closer'), asyncHandler(async (req, res) => {
  const { search = '', status = '' } = req.query;
  const filters = ['1 = 1'];
  const params = [];
  if (search) {
    filters.push('(name LIKE ? OR email LIKE ? OR country LIKE ?)');
    const q = `%${search}%`;
    params.push(q, q, q);
  }
  if (status) { filters.push('status = ?'); params.push(status); }
  const rows = all(`SELECT * FROM tenants WHERE ${filters.join(' AND ')} ORDER BY created_at DESC`, ...params);
  res.json({
    items: rows.map((tenant) => {
      const subscription = get(
        "SELECT * FROM subscriptions WHERE tenant_id = ? AND status = 'paye' ORDER BY created_at DESC LIMIT 1",
        tenant.id,
      );
      const usersCount = get('SELECT COUNT(*) AS c FROM users WHERE tenant_id = ?', tenant.id);
      return {
        ...tenantPublic(tenant),
        owner: get('SELECT name, email FROM users WHERE tenant_id = ? ORDER BY created_at LIMIT 1', tenant.id) ?? null,
        users: usersCount?.c ?? 0,
        lastSubscription: subscription
          ? { reference: subscription.reference, amount: subscription.amount, plan: subscription.plan, createdAt: subscription.created_at, periodEnd: subscription.period_end }
          : null,
      };
    }),
  });
}));

const tenantPatch = z.object({
  status: z.enum(['essai', 'actif', 'expire', 'suspendu']).optional(),
  plan: z.string().max(20).nullable().optional(),
  trialDays: z.number().int().min(2).max(60).optional(),
  seats: z.number().int().min(1).max(999).optional(),
  notes: z.string().max(400).nullable().optional(),
});

router.patch('/tenants/:id', requirePlatform('manager', 'finance'), asyncHandler(async (req, res) => {
  const tenant = get('SELECT * FROM tenants WHERE id = ?', req.params.id);
  if (!tenant) throw notFound('Établissement introuvable.');
  const data = parseBody(tenantPatch, req.body);
  const fields = [];
  const params = [];
  if (data.status) { fields.push('status = ?'); params.push(data.status); }
  if (data.plan !== undefined) { fields.push('plan = ?'); params.push(data.plan); }
  if (data.seats !== undefined) { fields.push('seats = ?'); params.push(data.seats); }
  if (data.notes !== undefined) { fields.push('notes = ?'); params.push(data.notes); }
  if (data.trialDays) {
    fields.push('status = ?', 'trial_ends_at = ?');
    params.push('essai', addDays(data.trialDays));
  }
  if (!fields.length) throw badRequest('Aucune modification fournie.');
  fields.push('updated_at = ?');
  params.push(now(), req.params.id);
  run(`UPDATE tenants SET ${fields.join(', ')} WHERE id = ?`, ...params);

  if (data.status === 'actif') {
    const owner = get('SELECT id FROM users WHERE tenant_id = ? ORDER BY created_at LIMIT 1', req.params.id);
    notify({
      userId: owner?.id, tenantId: req.params.id, kind: 'abonnement',
      title: 'Votre établissement est activé',
      body: "L'accès complet à la plateforme est ouvert. Bonne rentrée !",
      link: '/app',
    });
  }
  res.json({ tenant: tenantPublic(get('SELECT * FROM tenants WHERE id = ?', req.params.id)) });
}));

/* ------------------------------- Abonnements ----------------------------- */

function activateSubscription({ tenant, plan, method, phone }) {
  const periodStart = now();
  const periodEnd = addDays(plan.id === 'universite' ? 365 : 30);
  const id = uid('sub');
  const currency = tenant.currency || 'XAF';
  const localAmount = convert(plan.priceFcfa, currency);
  run(
    `INSERT INTO subscriptions (id, reference, tenant_id, plan, amount, amount_fcfa, currency, method,
       status, period_start, period_end, payer_phone, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'paye', ?, ?, ?, ?, ?)`,
    id, invoiceReference(), tenant.id, plan.id, localAmount, plan.priceFcfa, currency, method,
    periodStart, periodEnd, phone ?? null,
    `Abonnement ${plan.name} — ${tenant.name} (${plan.priceFcfa} FCFA)`, periodStart,
  );
  run("UPDATE tenants SET status = 'actif', plan = ?, seats = ?, updated_at = ? WHERE id = ?",
    plan.id, plan.seats, periodStart, tenant.id);
  return get('SELECT * FROM subscriptions WHERE id = ?', id);
}

const paySchema = z.object({
  plan: z.string().min(2, 'Offre requise.'),
  method: z.enum(['mobile_money', 'carte', 'virement', 'especes']),
  phone: z.string().max(40).nullable().optional(),
});

router.post('/tenants/:id/subscribe', requirePlatform('manager', 'finance', 'closer'), asyncHandler(async (req, res) => {
  const tenant = get('SELECT * FROM tenants WHERE id = ?', req.params.id);
  if (!tenant) throw notFound('Établissement introuvable.');
  const data = parseBody(paySchema, req.body);
  const plan = planById(data.plan);
  if (!plan) throw badRequest('Offre inconnue.');
  if (data.method === 'mobile_money' && !data.phone) throw badRequest('Numéro Mobile Money requis.');
  const invoice = activateSubscription({ tenant, plan, method: data.method, phone: data.phone });
  const owner = get('SELECT id FROM users WHERE tenant_id = ? ORDER BY created_at LIMIT 1', tenant.id);
  notify({
    userId: owner?.id, tenantId: tenant.id, kind: 'paiement',
    title: `Abonnement ${plan.name} activé`,
    body: `Paiement de ${formatMoney(invoice.amount, invoice.currency)} confirmé (${data.method}). Référence ${invoice.reference}.`,
    link: '/app/abonnement',
  });
  res.status(201).json({ subscription: invoice, tenant: tenantPublic(get('SELECT * FROM tenants WHERE id = ?', tenant.id)) });
}));

router.get('/subscriptions', requirePlatform('manager', 'finance'), asyncHandler(async (req, res) => {
  const rows = all(
    `SELECT s.*, t.name AS tenantName, t.country AS tenantCountry
       FROM subscriptions s JOIN tenants t ON t.id = s.tenant_id
      ORDER BY s.created_at DESC LIMIT 200`,
  );
  const totals = get("SELECT COUNT(*) AS c, COALESCE(SUM(COALESCE(amount_fcfa, amount)), 0) AS total FROM subscriptions WHERE status = 'paye'");
  res.json({
    items: rows.map((row) => ({
      id: row.id, reference: row.reference, tenantId: row.tenant_id, tenantName: row.tenantName,
      tenantCountry: row.tenantCountry, plan: row.plan, amount: row.amount,
      amountFcfa: row.amount_fcfa, currency: row.currency,
      method: row.method, status: row.status, periodStart: row.period_start, periodEnd: row.period_end,
      createdAt: row.created_at,
    })),
    stats: { count: totals?.c ?? 0, total: totals?.total ?? 0 },
  });
}));

/** Espace facturation de l'établissement connecté. */
router.get('/billing', asyncHandler(async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Non authentifié.' });
  const tenant = req.user.tenantId ? get('SELECT * FROM tenants WHERE id = ?', req.user.tenantId) : null;
  if (!tenant) {
    return res.json({
      tenant: null, access: { status: 'actif', blocked: false, daysLeft: null },
      plans: PLANS, invoices: [], currency: 'XAF', rates: FX_RATES, baseCurrency: 'XAF',
    });
  }
  const invoices = all(
    'SELECT * FROM subscriptions WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 12', tenant.id,
  );
  const currency = tenant.currency || 'XAF';
  res.json({
    tenant: tenantPublic(tenant),
    access: accessState(tenant),
    plans: PLANS.map((plan) => ({
      ...plan, price: plan.priceFcfa, currency: 'XAF',
      localPrice: convert(plan.priceFcfa, currency), localCurrency: currency,
    })),
    currency,
    baseCurrency: 'XAF',
    rates: FX_RATES,
    invoices: invoices.map((row) => ({
      id: row.id, reference: row.reference, plan: row.plan, amount: row.amount,
      amountFcfa: row.amount_fcfa, currency: row.currency,
      method: row.method, status: row.status, periodStart: row.period_start, periodEnd: row.period_end,
      createdAt: row.created_at,
    })),
  });
}));

/** Paiement de l'abonnement par l'établissement lui-même (Mobile Money / carte). */
router.post('/billing/pay', asyncHandler(async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Non authentifié.' });
  if (req.user.role !== 'admin') throw forbidden();
  const tenant = req.user.tenantId ? get('SELECT * FROM tenants WHERE id = ?', req.user.tenantId) : null;
  if (!tenant) throw badRequest('Aucun établissement associé à ce compte.');
  const data = parseBody(paySchema, req.body);
  const plan = planById(data.plan);
  if (!plan) throw badRequest('Offre inconnue.');
  if (data.method === 'mobile_money' && !data.phone) throw badRequest('Numéro Mobile Money requis.');
  const invoice = activateSubscription({ tenant, plan, method: data.method, phone: data.phone });
  notify({
    userId: req.user.id, tenantId: tenant.id, kind: 'paiement',
    title: `Paiement confirmé — ${plan.name}`,
    body: `Référence ${invoice.reference}. ${formatMoney(invoice.amount, invoice.currency)} — actif jusqu'au ${invoice.period_end.slice(0, 10)}.`,
    link: '/app/abonnement',
  });
  res.status(201).json({ subscription: invoice, tenant: tenantPublic(get('SELECT * FROM tenants WHERE id = ?', tenant.id)) });
}));

/* --------------------------------- Équipe -------------------------------- */

const staffSchema = z.object({
  name: z.string().min(2, 'Nom requis.').max(80),
  email: z.string().email('Adresse e-mail invalide.').max(160),
  platformRole: z.enum(['manager', 'support', 'finance', 'marketing', 'closer']),
  password: z.string().min(8, 'Mot de passe de 8 caractères minimum.').max(120).optional(),
  phone: z.string().max(40).nullable().optional(),
});

router.get('/staff', requirePlatform('manager', 'support'), asyncHandler(async (req, res) => {
  const rows = all(
    `SELECT id, name, email, phone, platform_role AS platformRole, title, created_at AS createdAt, last_login_at AS lastLoginAt
       FROM users WHERE platform_role IS NOT NULL ORDER BY created_at`,
  );
  res.json({
    items: rows.map((row) => ({ ...row, roleLabel: PLATFORM_ROLES[row.platformRole]?.label ?? row.platformRole, scope: PLATFORM_ROLES[row.platformRole]?.scope ?? '' })),
    roles: Object.entries(PLATFORM_ROLES).map(([id, meta]) => ({ id, ...meta })),
  });
}));

router.post('/staff', requirePlatform('manager'), asyncHandler(async (req, res) => {
  const data = parseBody(staffSchema, req.body);
  const email = data.email.toLowerCase().trim();
  if (get('SELECT id FROM users WHERE lower(email) = ?', email)) throw badRequest('Cette adresse est déjà utilisée.');
  const id = uid('usr');
  const ts = now();
  const password = data.password ?? `agent.${Math.random().toString(36).slice(2, 10)}`;
  run(
    `INSERT INTO users (id, email, password_hash, name, role, phone, title, avatar_color, platform_role,
       tenant_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'admin', ?, ?, ?, ?, NULL, ?, ?)`,
    id, email, hashPassword(password), data.name.trim(), data.phone ?? null,
    PLATFORM_ROLES[data.platformRole]?.label ?? 'Agent', '#0f766e', data.platformRole, ts, ts,
  );
  notify({
    userId: id, tenantId: null, kind: 'equipe',
    title: 'Bienvenue dans l’équipe School Net Academy',
    body: `Votre accès ${PLATFORM_ROLES[data.platformRole]?.label ?? ''} est actif. Pensez à changer votre mot de passe.`,
    link: '/plateforme',
  });
  res.status(201).json({
    member: { id, name: data.name.trim(), email, platformRole: data.platformRole, phone: data.phone ?? null },
    temporaryPassword: data.password ? null : password,
  });
}));

router.patch('/staff/:id', requirePlatform('manager'), asyncHandler(async (req, res) => {
  const member = get('SELECT * FROM users WHERE id = ? AND platform_role IS NOT NULL', req.params.id);
  if (!member) throw notFound('Membre introuvable.');
  const data = parseBody(z.object({
    name: z.string().min(2).max(80).optional(),
    platformRole: z.enum(['manager', 'support', 'finance', 'marketing', 'closer']).optional(),
    phone: z.string().max(40).nullable().optional(),
    password: z.string().min(8).max(120).optional(),
  }), req.body);
  const fields = [];
  const params = [];
  if (data.name) { fields.push('name = ?'); params.push(data.name); }
  if (data.platformRole) { fields.push('platform_role = ?', 'title = ?'); params.push(data.platformRole, PLATFORM_ROLES[data.platformRole].label); }
  if (data.phone !== undefined) { fields.push('phone = ?'); params.push(data.phone); }
  if (data.password) { fields.push('password_hash = ?'); params.push(hashPassword(data.password)); }
  if (!fields.length) throw badRequest('Aucune modification fournie.');
  fields.push('updated_at = ?');
  params.push(now(), req.params.id);
  run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, ...params);
  res.json({ ok: true });
}));

router.delete('/staff/:id', requirePlatform('manager'), asyncHandler(async (req, res) => {
  const member = get('SELECT * FROM users WHERE id = ? AND platform_role IS NOT NULL', req.params.id);
  if (!member) throw notFound('Membre introuvable.');
  if (member.platform_role === 'owner') throw badRequest('Le propriétaire ne peut pas être supprimé.');
  run('DELETE FROM users WHERE id = ?', req.params.id);
  res.json({ ok: true });
}));

/* -------------------------------- Newsletter ----------------------------- */

router.get('/newsletter', requirePlatform('manager', 'marketing'), asyncHandler(async (req, res) => {
  const campaigns = all('SELECT * FROM newsletter_campaigns ORDER BY created_at DESC LIMIT 50');
  const subscribers = all('SELECT * FROM newsletter_subscribers ORDER BY created_at DESC LIMIT 200');
  const stats = get(`SELECT COUNT(*) AS total,
      SUM(CASE WHEN status = 'actif' THEN 1 ELSE 0 END) AS actifs,
      SUM(CASE WHEN status = 'desinscrit' THEN 1 ELSE 0 END) AS desinscrits
    FROM newsletter_subscribers`);
  const countries = all(
    `SELECT country_code AS countryCode, COUNT(*) AS c FROM newsletter_subscribers
      WHERE country_code IS NOT NULL GROUP BY country_code ORDER BY c DESC LIMIT 8`,
  );
  res.json({
    campaigns: campaigns.map((row) => ({
      id: row.id, subject: row.subject, body: row.body, audience: row.audience, status: row.status,
      recipients: row.recipients, sentAt: row.sent_at, createdAt: row.created_at,
    })),
    subscribers: subscribers.map((row) => ({
      id: row.id, email: row.email, name: row.name, countryCode: row.country_code,
      source: row.source, status: row.status, createdAt: row.created_at,
    })),
    stats: { total: stats?.total ?? 0, actifs: stats?.actifs ?? 0, desinscrits: stats?.desinscrits ?? 0 },
    countries,
  });
}));

router.post('/newsletter', requirePlatform('manager', 'marketing'), asyncHandler(async (req, res) => {
  const data = parseBody(z.object({
    subject: z.string().min(3, 'Objet requis.').max(140),
    body: z.string().min(10, 'Message trop court.').max(6000),
    audience: z.enum(['abonnes', 'tous', 'essais', 'clients']).default('abonnes'),
    send: z.boolean().optional(),
  }), req.body);

  const id = uid('nwc');
  const ts = now();
  const recipients = data.send ? subscriberAudience(data.audience).length : 0;
  run(
    `INSERT INTO newsletter_campaigns (id, subject, body, audience, status, recipients, sent_at, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, data.subject, data.body, data.audience, data.send ? 'envoyee' : 'brouillon',
    recipients, data.send ? ts : null, req.user.id, ts,
  );
  res.status(201).json({
    campaign: { id, subject: data.subject, body: data.body, audience: data.audience, status: data.send ? 'envoyee' : 'brouillon', recipients, sentAt: data.send ? ts : null, createdAt: ts },
  });
}));

router.post('/newsletter/:id/send', requirePlatform('manager', 'marketing'), asyncHandler(async (req, res) => {
  const campaign = get('SELECT * FROM newsletter_campaigns WHERE id = ?', req.params.id);
  if (!campaign) throw notFound('Campagne introuvable.');
  const recipients = subscriberAudience(campaign.audience).length;
  run("UPDATE newsletter_campaigns SET status = 'envoyee', recipients = ?, sent_at = ? WHERE id = ?",
    recipients, now(), campaign.id);
  res.json({ ok: true, recipients });
}));

/* ----------------------------------- SMS --------------------------------- */

router.get('/sms', requirePlatform('manager', 'support', 'finance'), asyncHandler(async (req, res) => {
  const rows = all('SELECT * FROM sms_outbox ORDER BY created_at DESC LIMIT 100');
  const stats = get(`SELECT COUNT(*) AS total,
      SUM(CASE WHEN status = 'envoye' THEN 1 ELSE 0 END) AS envoyes,
      SUM(CASE WHEN status = 'simule' THEN 1 ELSE 0 END) AS simules
    FROM sms_outbox`);
  res.json({
    items: rows.map((row) => ({
      id: row.id, to: row.to_number, body: row.body, status: row.status,
      provider: row.provider, error: row.error, createdAt: row.created_at, sentAt: row.sent_at,
    })),
    stats: { total: stats?.total ?? 0, envoyes: stats?.envoyes ?? 0, simules: stats?.simules ?? 0 },
    configured: Boolean(process.env.SMS_API_URL && process.env.SMS_API_KEY),
  });
}));

export { ensurePlatformSeed };
export default router;
