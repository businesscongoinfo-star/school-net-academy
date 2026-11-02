/**
 * API simulée pour la démo statique (GitHub Pages).
 *
 * Le serveur Express/SQLite n'est pas disponible sur un hébergement statique : ce module
 * rejoue les mêmes routes à partir d'un instantané de données (`public/demo/snapshot.json`)
 * et applique les écritures en mémoire (elles disparaissent au rechargement de la page).
 */
import type { User } from '../lib/types';

type Json = Record<string, any>;

const SESSION_KEY = 'sna-demo-session';
const ACCOUNTS: Record<string, User['role']> = {
  'direction@schoolnet.academy': 'admin',
  'prof.mbemba@schoolnet.academy': 'teacher',
  'parent.ondongo@schoolnet.academy': 'parent',
};

/* -------------------------- Données de la plateforme ---------------------- */

const DEMO_TENANT = {
  id: 'tnt_demo',
  name: 'School Net Academy',
  kind: 'mixte',
  country: 'Congo-Brazzaville',
  countryCode: 'CG',
  currency: 'XAF',
  email: 'direction@schoolnet.academy',
  phone: '+242 06 512 44 18',
  status: 'actif',
  plan: 'universite',
  seats: 999,
  trialEndsAt: null as string | null,
  createdAt: '2025-09-01T08:00:00.000Z',
};

const DEMO_ACCESS = { status: 'actif', blocked: false, daysLeft: null as number | null };

const DEMO_PLANS = [
  {
    id: 'essentiel', name: 'Essentiel', priceFcfa: 15000, price: 15000, currency: 'XAF', period: 'mois',
    tagline: 'Pour une petite école qui démarre', seats: 3, trialDays: 7,
    features: ['Élèves, classes, présences', 'Paiements & reçus', 'Cartes scolaires (QR + NFC)', '3 comptes utilisateurs'],
  },
  {
    id: 'pro', name: 'Pro', priceFcfa: 45000, price: 45000, currency: 'XAF', period: 'mois',
    tagline: "L'offre des établissements complets", seats: 10, trialDays: 7, popular: true,
    features: ['Tout Essentiel', 'Université : facultés, filières, UE, crédits', 'Emploi du temps & bibliothèque', 'Bulletins, SMS aux parents, notifications', '10 comptes utilisateurs'],
  },
  {
    id: 'universite', name: 'Université', priceFcfa: 120000, price: 120000, currency: 'XAF', period: 'mois',
    tagline: 'Campus, LMD et grandes structures', seats: 999, trialDays: 7,
    features: ['Tout Pro', 'Multi-campus & filières illimitées', 'Pointage NFC sur plusieurs portails', 'Support prioritaire & accompagnement', 'Utilisateurs illimités'],
  },
];

const DEMO_RATES: Record<string, number> = {
  XAF: 1, XOF: 1, EUR: 0.001524, USD: 0.0017, GBP: 0.0013, CDF: 4.8, NGN: 2.6,
  MAD: 0.0167, KES: 0.22, ZAR: 0.031, CAD: 0.00233, AED: 0.00625, CHF: 0.0015,
};

function demoConvert(amount: number, currency: string) {
  const rate = DEMO_RATES[currency] ?? 1;
  const value = amount * rate;
  if (rate >= 100) return Math.round(value / 100) * 100;
  if (rate >= 1) return Math.round(value);
  return Math.round(value * 100) / 100;
}

/** Complète l'utilisateur de démonstration avec établissement, accès et rôle plateforme. */
function enrich(user: User | null): User | null {
  if (!user) return null;
  return {
    ...user,
    tenant: DEMO_TENANT as unknown as User['tenant'],
    access: DEMO_ACCESS as User['access'],
    platformRole: user.role === 'admin' ? 'owner' : null,
  };
}

function platformStore(data: Json): Json {
  if (!data.platform) {
    data.platform = {
      tenants: [
        { ...DEMO_TENANT, owner: { name: 'Chancelle Mabiala', email: 'direction@schoolnet.academy' }, users: 4 },
        {
          id: 'tnt_essai', name: 'Groupe Scolaire Les Palmiers', kind: 'ecole', country: "Côte d'Ivoire",
          countryCode: 'CI', currency: 'XOF', email: 'contact@lespalmiers.ci', phone: '+225 07 00 00 00',
          status: 'essai', plan: null, seats: 10, trialEndsAt: new Date(Date.now() + 4 * 86400000).toISOString(),
          createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
          owner: { name: 'Ibrahim Koné', email: 'contact@lespalmiers.ci' }, users: 2,
        },
        {
          id: 'tnt_uni', name: 'Université Marien Ngouabi', kind: 'universite', country: 'Congo-Brazzaville',
          countryCode: 'CG', currency: 'XAF', email: 'scolarite@umng.cg', phone: '+242 06 100 20 30',
          status: 'actif', plan: 'universite', seats: 999, trialEndsAt: null,
          createdAt: new Date(Date.now() - 120 * 86400000).toISOString(),
          owner: { name: 'Pr. Alphonse Massamba', email: 'scolarite@umng.cg' }, users: 12,
        },
      ],
      staff: [
        { id: 'usr_super', name: 'Chancelle Mabiala', email: 'direction@schoolnet.academy', platformRole: 'owner', title: 'Propriétaire', createdAt: DEMO_TENANT.createdAt, lastLoginAt: new Date().toISOString() },
        { id: 'usr_manager', name: 'Serge Ikouma', email: 'gestion@schoolnet.academy', platformRole: 'manager', title: 'Gestionnaire', createdAt: DEMO_TENANT.createdAt, lastLoginAt: new Date(Date.now() - 3600000).toISOString() },
        { id: 'usr_support', name: 'Léa Mouyabi', email: 'support@schoolnet.academy', platformRole: 'support', title: 'Support', createdAt: DEMO_TENANT.createdAt, lastLoginAt: new Date(Date.now() - 7200000).toISOString() },
        { id: 'usr_finance', name: 'Boris Nkodia', email: 'finance@schoolnet.academy', platformRole: 'finance', title: 'Finance & facturation', createdAt: DEMO_TENANT.createdAt, lastLoginAt: null },
        { id: 'usr_marketing', name: 'Grace Loubota', email: 'marketing@schoolnet.academy', platformRole: 'marketing', title: 'Marketing & newsletter', createdAt: DEMO_TENANT.createdAt, lastLoginAt: null },
        { id: 'usr_closer', name: 'Yan Mabiala', email: 'closer@schoolnet.academy', platformRole: 'closer', title: 'Closer — conversions', createdAt: DEMO_TENANT.createdAt, lastLoginAt: null },
      ],
      invoices: [
        { id: 'sub_demo1', reference: 'SUB-2026-0001', tenantId: 'tnt_uni', tenantName: 'Université Marien Ngouabi', tenantCountry: 'Congo-Brazzaville', plan: 'universite', amount: 120000, amountFcfa: 120000, currency: 'XAF', method: 'mobile_money', status: 'paye', periodStart: new Date(Date.now() - 30 * 86400000).toISOString(), periodEnd: new Date(Date.now() + 335 * 86400000).toISOString(), createdAt: new Date(Date.now() - 30 * 86400000).toISOString() },
        { id: 'sub_demo2', reference: 'SUB-2026-0002', tenantId: 'tnt_demo', tenantName: 'School Net Academy', tenantCountry: 'Congo-Brazzaville', plan: 'universite', amount: 120000, amountFcfa: 120000, currency: 'XAF', method: 'virement', status: 'paye', periodStart: new Date(Date.now() - 15 * 86400000).toISOString(), periodEnd: new Date(Date.now() + 350 * 86400000).toISOString(), createdAt: new Date(Date.now() - 15 * 86400000).toISOString() },
      ],
      subscribers: [
        'Aline Mbemba', 'Rodrigue Ondongo', 'Clarisse Mavoungou', 'David Nzaba', 'Esther Bakala',
        'Franck Makosso', 'Gisèle Tchibinda', 'Hervé Massamba', 'Ines Nkounkou', 'Joël Kiminou',
      ].map((name, index) => ({
        id: `nwl_${index}`, email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@example.cg`, name,
        countryCode: ['CG', 'CD', 'CI', 'SN', 'CM'][index % 5], source: index % 3 === 0 ? 'accueil' : 'pied de page',
        status: index === 9 ? 'desinscrit' : 'actif', createdAt: new Date(Date.now() - index * 86400000).toISOString(),
      })),
      campaigns: [
        { id: 'nwc_1', subject: 'Rentrée : les nouvelles fonctions de School Net Academy', body: 'Bonjour, cette rentrée apporte les cartes scolaires NFC…', audience: 'abonnes', status: 'envoyee', recipients: 9, sentAt: new Date(Date.now() - 12 * 86400000).toISOString(), createdAt: new Date(Date.now() - 13 * 86400000).toISOString() },
        { id: 'nwc_2', subject: 'Offre Pro : —20 % pour les universités', body: 'Bonjour, les établissements supérieurs bénéficient de 20 %…', audience: 'abonnes', status: 'brouillon', recipients: 0, sentAt: null, createdAt: new Date(Date.now() - 2 * 86400000).toISOString() },
      ],
      sms: [
        { id: 'sms_1', to: '+242 06 580 82 65', body: 'School Net Academy : paiement de 45000 FCFA recu (Scolarite). Merci !', status: 'simule', provider: 'journal', error: null, createdAt: new Date(Date.now() - 86400000).toISOString(), sentAt: null },
        { id: 'sms_2', to: '+242 06 512 44 18', body: 'School Net Academy : nouvelle inscription enregistree en 6eme A.', status: 'simule', provider: 'journal', error: null, createdAt: new Date(Date.now() - 2 * 86400000).toISOString(), sentAt: null },
      ],
      notifications: [
        { id: 'ntf_1', kind: 'systeme', title: 'Bienvenue sur votre espace', body: "Votre abonnement Université est actif jusqu'à la fin de l'année scolaire.", link: '/app/abonnement', readAt: null, createdAt: new Date(Date.now() - 3600000).toISOString() },
        { id: 'ntf_2', kind: 'paiement', title: 'Paiement reçu : 45 000 FCFA', body: 'Scolarité — Mobile Money. Reçu PAY-2026-0042.', link: '/app/paiements', readAt: null, createdAt: new Date(Date.now() - 7200000).toISOString() },
        { id: 'ntf_3', kind: 'inscription', title: 'Carte scolaire disponible', body: "La carte d'identité scolaire de votre enfant est prête (QR + NFC).", link: '/app/mes-enfants', readAt: new Date().toISOString(), createdAt: new Date(Date.now() - 86400000).toISOString() },
      ],
      counters: { invoice: 3 },
    };
  }
  return data.platform as Json;
}

let snapshotPromise: Promise<Json> | null = null;

async function loadSnapshot(): Promise<Json> {
  if (!snapshotPromise) {
    // Chemin relatif au document : fonctionne aussi bien à la racine que sous /school-net-academy/.
    const base = typeof document !== 'undefined' ? document.baseURI : 'http://localhost/';
    snapshotPromise = fetch(new URL('demo/snapshot.json', base)).then((res) => {
      if (!res.ok) throw new Error("Instantané de démonstration introuvable.");
      return res.json();
    });
  }
  return snapshotPromise;
}

let state: Json | null = null;

async function ready(): Promise<Json> {
  if (!state) {
    state = structuredClone(await loadSnapshot());
  }
  return state as Json;
}

function role(): User['role'] | null {
  const value = localStorage.getItem(SESSION_KEY);
  if (value === null) {
    localStorage.setItem(SESSION_KEY, 'admin');
    return 'admin';
  }
  if (value === 'out') return null;
  return value as User['role'];
}

function currentUser(data: Json): User | null {
  const active = role();
  return active ? (data.users[active] as User) : null;
}

function fail(status: number, message: string): never {
  const error = new Error(message) as Error & { status: number };
  error.status = status;
  throw error;
}

const wait = (ms: number) => new Promise((resolve) => { setTimeout(resolve, ms); });
const uid = (prefix: string) => `${prefix}_demo${Math.random().toString(36).slice(2, 8)}`;
const today = () => new Date().toISOString().slice(0, 10);

/* ------------------------------- utilitaires ------------------------------ */

function filterBy(items: Json[], query: URLSearchParams, rules: Record<string, (item: Json, value: string) => boolean>) {
  let result = items;
  for (const [key, predicate] of Object.entries(rules)) {
    const value = query.get(key);
    if (!value) continue;
    result = result.filter((item) => predicate(item, value));
  }
  return result;
}

const contains = (value: unknown, needle: string) => String(value ?? '').toLowerCase().includes(needle.toLowerCase());
const anyContains = (item: Json, needle: string, fields: string[]) => fields.some((field) => contains(item[field], needle));

export function demoUserLabel(): string {
  return role() ?? 'out';
}

/* -------------------------------- requêtes -------------------------------- */

export async function demoRequest<T>(method: string, rawPath: string, body?: unknown): Promise<T> {
  const data = await ready();
  await wait(60 + Math.random() * 90);

  const [path, search = ''] = rawPath.split('?');
  const query = new URLSearchParams(search);
  const segments = path.split('/').filter(Boolean);
  const [root, id, extra] = segments;
  const rest = segments.slice(3);

  /* ------------------------------- session ------------------------------- */

  if (root === 'auth') {
    if (id === 'me' && method === 'GET') {
      const user = currentUser(data);
      if (!user) fail(401, 'Session expirée.');
      return { user: enrich(user) } as T;
    }
    if (id === 'login' && method === 'POST') {
      const payload = (body ?? {}) as { email?: string; password?: string };
      const email = String(payload.email ?? '').trim().toLowerCase();
      const target = ACCOUNTS[email];
      if (!target) fail(401, 'Compte de démonstration inconnu. Utilisez un des trois comptes proposés.');
      if (String(payload.password ?? '').length < 4) fail(401, 'Mot de passe trop court (démo : demo1234).');
      localStorage.setItem(SESSION_KEY, target);
      return { user: enrich(data.users[target] as User) } as T;
    }
    if (id === 'logout' && method === 'POST') {
      localStorage.setItem(SESSION_KEY, 'out');
      return { ok: true } as T;
    }
    if (id === 'profile' && (method === 'PATCH' || method === 'POST')) {
      const user = currentUser(data);
      if (!user) fail(401, 'Session expirée.');
      const payload = (body ?? {}) as Json;
      Object.assign(user, {
        name: payload.name ?? user.name,
        email: payload.email ?? user.email,
        phone: payload.phone ?? (user as Json).phone,
      });
      return { user } as T;
    }
    if (id === 'password') return { ok: true } as T;
    if (id === 'forgot' && method === 'POST') {
      const payload = (body ?? {}) as { email?: string };
      const known = Object.keys(ACCOUNTS).includes(String(payload.email ?? '').toLowerCase());
      return {
        ok: true,
        message: known
          ? 'Un lien de réinitialisation vient d’être généré pour cette adresse.'
          : "Si un compte existe pour cette adresse, un lien vient d'être généré.",
        resetPath: '/reinitialiser?token=demo-reinitialisation',
        delivered: false,
      } as T;
    }
    if (id === 'reset' && method === 'POST') {
      return { ok: true, message: 'Mot de passe mis à jour. Vous pouvez vous connecter.' } as T;
    }
    if (id === 'oauth') {
      fail(501, "La connexion sociale n'est pas activée dans la démo statique.");
    }
    fail(404, 'Route inconnue.');
  }

  /* ------------------------------ plateforme ----------------------------- */

  if (root === 'platform') {
    const store = platformStore(data);
    const currency = String(query.get('currency') ?? DEMO_TENANT.currency).toUpperCase();
    const withLocal = (plan: Json) => ({
      ...plan, localPrice: demoConvert(plan.priceFcfa, currency), localCurrency: currency,
    });

    if (id === 'catalog' && method === 'GET') {
      return {
        plans: DEMO_PLANS.map(withLocal), trialDays: 7, baseCurrency: 'XAF',
        rates: DEMO_RATES, currencies: Object.keys(DEMO_RATES),
      } as T;
    }

    if (id === 'signup' && method === 'POST') {
      const payload = (body ?? {}) as Json;
      localStorage.setItem(SESSION_KEY, 'admin');
      const user = data.users.admin as User;
      Object.assign(user, { name: payload.adminName ?? user.name, email: payload.email ?? user.email });
      const tenant = {
        ...DEMO_TENANT, name: payload.schoolName ?? 'Mon établissement', kind: payload.kind ?? 'ecole',
        country: payload.country ?? DEMO_TENANT.country, countryCode: payload.countryCode ?? 'CG',
        currency: payload.currency ?? 'XAF', email: payload.email ?? DEMO_TENANT.email,
        status: 'essai', plan: payload.plan ?? 'pro', seats: 10,
        trialEndsAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      };
      store.tenants.unshift(tenant);
      return { user: { ...enrich(user), tenant, access: { status: 'essai', blocked: false, daysLeft: 7 } } } as T;
    }

    if (id === 'overview' && method === 'GET') {
      const tenants = store.tenants as Json[];
      return {
        kpis: {
          tenants: tenants.length,
          actifs: tenants.filter((t) => t.status === 'actif').length,
          essais: tenants.filter((t) => t.status === 'essai').length,
          bloques: tenants.filter((t) => t.status === 'suspendu' || t.status === 'expire').length,
          mrr: tenants.filter((t) => t.status === 'actif')
            .reduce((sum, t) => sum + ((DEMO_PLANS.find((p) => p.id === t.plan)?.priceFcfa) ?? 0), 0),
          revenue: (store.invoices as Json[]).reduce((sum, i) => sum + (i.amountFcfa ?? i.amount), 0),
          revenue30d: (store.invoices as Json[]).reduce((sum, i) => sum + (i.amountFcfa ?? i.amount), 0),
          subscribers: (store.subscribers as Json[]).filter((s) => s.status === 'actif').length,
          staff: (store.staff as Json[]).length,
        },
        trials: (store.tenants as Json[]).filter((t) => t.status === 'essai'),
        tenants: tenants.slice(0, 8),
        invoices: store.invoices,
        staff: store.staff,
      } as T;
    }

    if (id === 'tenants') {
      const items = (store.tenants as Json[]).filter((tenant) => (
        (!query.get('status') || tenant.status === query.get('status'))
        && (!query.get('search') || anyContains(tenant, String(query.get('search')), ['name', 'email', 'country']))
      ));
      return { items } as T;
    }

    if (id === 'subscriptions' && method === 'GET') {
      const items = store.invoices as Json[];
      return { items, stats: { count: items.length, total: items.reduce((sum, i) => sum + (i.amountFcfa ?? i.amount), 0) } } as T;
    }

    if (id === 'billing') {
      const tenant = DEMO_TENANT as Json;
      const currency = String(tenant.currency ?? 'XAF');
      if (method === 'GET') {
        return {
          tenant, access: DEMO_ACCESS, currency, baseCurrency: 'XAF', rates: DEMO_RATES,
          plans: DEMO_PLANS.map(withLocal), invoices: store.invoices,
        } as T;
      }
      if (method === 'POST' && extra === 'pay') {
        const payload = (body ?? {}) as Json;
        const plan = DEMO_PLANS.find((p) => p.id === payload.plan) ?? DEMO_PLANS[1];
        const reference = `SUB-DEMO-${String((store.counters as Json).invoice++).padStart(4, '0')}`;
        const invoice = {
          id: uid('sub'), reference, tenantId: tenant.id, tenantName: tenant.name, plan: plan.id,
          amount: demoConvert(plan.priceFcfa, currency), amountFcfa: plan.priceFcfa, currency,
          method: payload.method ?? 'mobile_money', status: 'paye',
          periodStart: new Date().toISOString(),
          periodEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
          createdAt: new Date().toISOString(),
        };
        (store.invoices as Json[]).unshift(invoice);
        (store.notifications as Json[]).unshift({
          id: uid('ntf'), kind: 'paiement', title: `Paiement confirmé — ${plan.name}`,
          body: `Référence ${reference}. Votre établissement est actif jusqu'au ${invoice.periodEnd.slice(0, 10)}.`,
          link: '/app/abonnement', readAt: null, createdAt: new Date().toISOString(),
        });
        return { subscription: invoice, tenant: { ...tenant, status: 'actif', plan: plan.id } } as T;
      }
    }

    if (id === 'staff') {
      if (method === 'GET') return { items: store.staff } as T;
      if (method === 'POST') {
        const payload = (body ?? {}) as Json;
        const member = {
          id: uid('usr'), name: payload.name, email: payload.email, platformRole: payload.platformRole,
          phone: payload.phone ?? null, title: payload.platformRole, role: 'admin', createdAt: new Date().toISOString(),
          lastLoginAt: null,
        };
        (store.staff as Json[]).push(member);
        return { member, temporaryPassword: 'agent.demo2026' } as T;
      }
      const target = (store.staff as Json[]).find((item) => item.id === id);
      if (!target) fail(404, 'Membre introuvable.');
      if (method === 'PATCH') { Object.assign(target, body); return { ok: true } as T; }
      if (method === 'DELETE') {
        const list = store.staff as Json[];
        list.splice(list.indexOf(target), 1);
        return { ok: true } as T;
      }
    }

    if (id === 'newsletter') {
      if (method === 'GET') {
        const subscribers = store.subscribers as Json[];
        return {
          campaigns: store.campaigns,
          subscribers,
          stats: {
            total: subscribers.length,
            actifs: subscribers.filter((s) => s.status === 'actif').length,
            desinscrits: subscribers.filter((s) => s.status !== 'actif').length,
          },
          countries: [],
        } as T;
      }
      if (method === 'POST' && !extra) {
        const payload = (body ?? {}) as Json;
        const recipients = (store.subscribers as Json[]).filter((s) => s.status === 'actif').length;
        const campaign = {
          id: uid('nwc'), subject: payload.subject, body: payload.body, audience: payload.audience ?? 'abonnes',
          status: payload.send ? 'envoyee' : 'brouillon', recipients: payload.send ? recipients : 0,
          sentAt: payload.send ? new Date().toISOString() : null, createdAt: new Date().toISOString(),
        };
        (store.campaigns as Json[]).unshift(campaign);
        return { campaign } as T;
      }
      if (method === 'POST' && (extra === 'send' || rest[0] === 'send')) {
        const campaignId = rest[0] === 'send' ? extra : id;
        const campaign = (store.campaigns as Json[]).find((item) => item.id === campaignId);
        if (!campaign) fail(404, 'Campagne introuvable.');
        const recipients = (store.subscribers as Json[]).filter((s) => s.status === 'actif').length;
        Object.assign(campaign, { status: 'envoyee', recipients, sentAt: new Date().toISOString() });
        return { ok: true, recipients } as T;
      }
    }

    if (id === 'sms' && method === 'GET') {
      const items = store.sms as Json[];
      return {
        items,
        stats: { total: items.length, envoyes: items.filter((i) => i.status === 'envoye').length, simules: items.filter((i) => i.status === 'simule').length },
        configured: false,
      } as T;
    }

    fail(404, 'Route plateforme inconnue.');
  }

  /* ------------------------------ notifications -------------------------- */

  if (root === 'notifications') {
    const store = platformStore(data);
    const items = store.notifications as Json[];
    if (method === 'GET') {
      return { items, unread: items.filter((item) => !item.readAt).length } as T;
    }
    if (method === 'POST' && id === 'read-all') {
      items.forEach((item) => { item.readAt = item.readAt ?? new Date().toISOString(); });
      return { ok: true } as T;
    }
    const target = items.find((item) => item.id === id);
    if (!target) fail(404, 'Notification introuvable.');
    if (method === 'POST' && extra === 'read') {
      target.readAt = target.readAt ?? new Date().toISOString();
      return { ok: true } as T;
    }
    if (method === 'DELETE') {
      items.splice(items.indexOf(target), 1);
      return { ok: true } as T;
    }
  }

  /* -------------------------------- newsletter --------------------------- */

  if (root === 'newsletter' && method === 'POST') {
    const store = platformStore(data);
    const payload = (body ?? {}) as Json;
    if (id === 'subscribe') {
      const email = String(payload.email ?? '').toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail(400, 'Adresse e-mail invalide.');
      const existing = (store.subscribers as Json[]).find((item) => item.email === email);
      if (existing) {
        existing.status = 'actif';
        return { ok: true, already: true, message: 'Vous êtes déjà abonné : merci !' } as T;
      }
      (store.subscribers as Json[]).unshift({
        id: uid('nwl'), email, name: payload.name ?? null, countryCode: payload.countryCode ?? 'CG',
        source: payload.source ?? 'site', status: 'actif', createdAt: new Date().toISOString(),
      });
      return { ok: true, message: 'Inscription confirmée. À très vite dans votre boîte mail !' } as T;
    }
    if (id === 'unsubscribe') return { ok: true } as T;
  }

  /* ---------------------------------- IA --------------------------------- */

  if (root === 'ai' && method === 'POST') {
    const payload = (body ?? {}) as { messages?: { role: string; content: string }[] };
    const question = String(payload.messages?.filter((m) => m.role === 'user').at(-1)?.content ?? '').toLowerCase();
    const reply = question.includes('prix') || question.includes('abonnement') || question.includes('tarif')
      ? "Trois offres : **Essentiel** 15 000 FCFA/mois, **Pro** 45 000 FCFA/mois et **Université** 120 000 FCFA/mois. Chaque établissement commence par **7 jours d'essai gratuit**, puis règle par Mobile Money, carte, virement ou espèces depuis l'écran « Abonnement »."
      : question.includes('carte') || question.includes('nfc') || question.includes('qr')
        ? "Chaque élève reçoit automatiquement une **carte scolaire** avec QR code, code-barres et badge NFC. Le surveillant scanne la carte (ou approche le badge) pour **signer la présence** en un clic, depuis l'écran « Cartes scolaires »."
        : question.includes('sms') || question.includes('parent')
          ? "Lors d'une inscription ou d'un paiement, le tuteur reçoit une **notification dans l'application** et un **SMS** au numéro enregistré. Vous pouvez suivre les envois dans la super administration, onglet « Journal SMS »."
          : question.includes('newsletter') || question.includes('campagne')
            ? "Depuis la super administration, onglet **Newsletter**, rédigez votre message, choisissez l'audience puis envoyez. Les inscrits du site alimentent automatiquement la liste."
            : "Je suis **School Net IA**, l'assistant de la plateforme. Posez-moi une question sur les élèves, les paiements, les cartes scolaires, les abonnements, la newsletter ou les SMS aux parents.";
    return { reply, source: 'local' } as T;
  }

  const user = currentUser(data);
  if (!user) fail(401, 'Session expirée.');
  const activeRole = role() as User['role'];
  const views = data.roles[activeRole];

  /* ------------------------------ lectures ------------------------------- */

  if (method === 'GET') {
    switch (root) {
      case 'meta':
        return data.meta as T;

      case 'dashboard':
        return views.dashboard as T;

      case 'students': {
        if (!id) {
          const items = filterBy(views.students.items, query, {
            search: (item, value) => anyContains(item, value, ['firstName', 'lastName', 'matricule', 'guardianName', 'programName']),
            classId: (item, value) => item.classId === value,
            status: (item, value) => item.status === value,
            type: (item, value) => (item.studentType ?? 'eleve') === value,
            programId: (item, value) => item.programId === value,
          });
          return { ...views.students, items } as T;
        }
        const detail = data.studentDetails[id];
        if (detail) return detail as T;
        const student = views.students.items.find((item: Json) => item.id === id);
        if (!student) fail(404, 'Élève introuvable.');
        return {
          student: { ...student, annualFee: (student.tuitionFee ?? 0) + 25000, outstanding: 0 },
          payments: views.payments.items.filter((item: Json) => item.studentId === id),
          grades: [],
          averages: [],
        } as T;
      }

      case 'classes': {
        if (!id) return data.classes as T;
        const detail = data.classDetails[id];
        if (!detail) fail(404, 'Classe introuvable.');
        return detail as T;
      }

      case 'teachers':
        return {
          ...data.teachers,
          items: filterBy(data.teachers.items, query, {
            search: (item, value) => anyContains(item, value, ['name', 'firstName', 'lastName', 'subject', 'phone', 'email']),
            status: (item, value) => item.status === value,
          }),
        } as T;

      case 'admissions':
        return {
          ...data.admissions,
          items: filterBy(data.admissions.items, query, {
            search: (item, value) => anyContains(item, value, ['name', 'firstName', 'lastName', 'phone', 'email', 'level']),
            status: (item, value) => item.status === value,
          }),
        } as T;

      case 'payments':
        return {
          ...views.payments,
          items: filterBy(views.payments.items, query, {
            search: (item, value) => anyContains(item, value, ['reference', 'studentName', 'firstName', 'lastName', 'matricule']),
            status: (item, value) => item.status === value,
            method: (item, value) => item.method === value,
            type: (item, value) => item.type === value,
          }),
        } as T;

      case 'grades': {
        if (id === 'results') {
          const term = query.get('term') || data.meta.currentTerm;
          return (views.results[term] ?? views.results[data.meta.currentTerm]) as T;
        }
        fail(404, 'Route inconnue.');
      }

      case 'courses':
        return {
          ...data.courses,
          items: filterBy(data.courses.items, query, {
            search: (item, value) => anyContains(item, value, ['title', 'teacherName', 'level', 'subject']),
            status: (item, value) => item.status === value,
            level: (item, value) => item.level === value,
          }),
        } as T;

      case 'announcements':
        return {
          ...views.announcements,
          items: filterBy(views.announcements.items, query, {
            search: (item, value) => anyContains(item, value, ['title', 'body', 'author']),
          }),
        } as T;

      case 'faculties': {
        if (!id) return data.faculties as T;
        const detail = data.facultyDetails[id];
        if (!detail) fail(404, 'Faculté introuvable.');
        return detail as T;
      }

      case 'programs': {
        if (!id) {
          return {
            ...data.programs,
            items: filterBy(data.programs.items, query, {
              search: (item, value) => anyContains(item, value, ['name', 'code', 'facultyName']),
              degree: (item, value) => item.degree === value,
              facultyId: (item, value) => item.facultyId === value,
            }),
          } as T;
        }
        const detail = data.programDetails[id];
        if (!detail) fail(404, 'Filière introuvable.');
        return detail as T;
      }

      case 'course-units':
        return {
          ...data.units,
          items: filterBy(data.units.items, query, {
            search: (item, value) => anyContains(item, value, ['title', 'code', 'programName', 'teacherName']),
            programId: (item, value) => item.programId === value,
            semester: (item, value) => String(item.semester) === value,
          }),
        } as T;

      case 'schedules': {
        const items = filterBy(data.schedules.items, query, {
          classId: (item, value) => item.classId === value,
          programId: (item, value) => item.programId === value,
          day: (item, value) => item.day === value,
        }).sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)));
        return { ...data.schedules, items } as T;
      }

      case 'library': {
        if (id === 'books') {
          return {
            ...data.books,
            items: filterBy(data.books.items, query, {
              search: (item, value) => anyContains(item, value, ['title', 'author', 'isbn']),
              category: (item, value) => item.category === value,
              availability: (item, value) => (value === 'disponible' ? item.copiesAvailable > 0 : item.copiesAvailable === 0),
            }),
          } as T;
        }
        if (id === 'loans') {
          const date = today();
          const items = filterBy(data.loans.items, query, {
            search: (item, value) => anyContains(item, value, ['bookTitle', 'studentName', 'matricule']),
            status: (item, value) => item.status === value,
          }).map((item: Json) => ({ ...item, late: item.status !== 'rendu' && item.dueAt < date }));
          return { ...data.loans, items } as T;
        }
        fail(404, 'Route inconnue.');
      }

      case 'attendance': {
        const date = query.get('date') || today();
        const classId = query.get('classId');
        const programId = query.get('programId');
        const session = query.get('session');
        const items = data.attendance
          .filter((item: Json) => item.date === date)
          .filter((item: Json) => !classId || item.classId === classId)
          .filter((item: Json) => !programId || item.programId === programId)
          .filter((item: Json) => !session || item.session === session)
          .sort((a: Json, b: Json) => String(a.lastName).localeCompare(String(b.lastName)));
        const count = (status: string) => items.filter((item: Json) => item.status === status).length;
        return {
          date,
          items,
          stats: {
            total: items.length,
            present: count('present'),
            absent: count('absent'),
            retard: count('retard'),
            excuse: count('excuse'),
            tauxPresence: items.length ? Math.round(((count('present') + count('retard')) / items.length) * 100) : null,
          },
        } as T;
      }

      default:
        fail(404, 'Route inconnue.');
    }
  }

  /* ------------------------------ écritures ------------------------------ */

  /* --------------------------- cartes scolaires --------------------------- */
  if (root === 'cards') {
    const list = views.students.items as Json[];
    const codeOf = (student: Json) => {
      let hash = 0;
      for (const character of String(student.id)) hash = (hash * 31 + character.charCodeAt(0)) % 60466176;
      return `SNA-26-${hash.toString(36).toUpperCase().padStart(6, '2').slice(-6)}`;
    };
    const year = new Date().getFullYear();
    const toCard = (student: Json) => {
      const cardCode = codeOf(student);
      return {
        studentId: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        matricule: student.matricule,
        gender: student.gender,
        birthDate: student.birthDate ?? null,
        status: student.status,
        studentType: student.studentType ?? 'eleve',
        academicLevel: student.academicLevel ?? null,
        cardCode,
        nfcTag: null,
        issuedAt: new Date().toISOString(),
        guardianName: student.guardianName ?? null,
        guardianPhone: student.guardianPhone ?? null,
        classId: student.classId ?? null,
        className: student.className ?? null,
        level: student.level ?? null,
        programId: student.programId ?? null,
        programName: student.programName ?? null,
        age: null,
        schoolName: 'School Net Academy',
        schoolShort: 'SNA',
        city: 'Brazzaville',
        schoolYear: `${year}-${year + 1}`,
        validUntil: `${year + 1}-07-31`,
        scanPath: `/app/presences?scan=${cardCode}`,
      };
    };

    if (method === 'GET' && !id) {
      const items = list.map(toCard);
      return {
        items, date: new Date().toISOString().slice(0, 10),
        stats: { total: items.length, issued: items.length, missing: 0, nfc: 0, scansToday: 0 },
      } as T;
    }
    if (method === 'GET' && id) {
      const student = list.find((item) => item.id === id);
      if (!student) fail(404, 'Élève introuvable.');
      return { card: toCard(student), history: [] } as T;
    }
    if (method === 'POST' && id === 'scan') {
      const payload = (body ?? {}) as Json;
      const raw = String(payload.code ?? '').trim();
      const code = raw.includes('scan=') ? raw.split('scan=')[1].split('&')[0] : raw;
      const student = list.find((item) => codeOf(item) === code || item.matricule === code);
      if (!student) fail(404, `Aucune carte ne correspond à « ${code.slice(0, 40)} ».`);
      return {
        card: toCard(student),
        attendance: {
          id: uid('att'), date: new Date().toISOString().slice(0, 10), session: 'Journée',
          status: payload.status === 'retard' ? 'retard' : 'present', note: 'Pointage démo (carte)',
          createdAt: new Date().toISOString(),
        },
        alreadyMarked: false,
        previousStatus: null,
      } as T;
    }
    if (method === 'POST' && extra === 'sign') {
      const student = list.find((item) => item.id === id);
      if (!student) fail(404, 'Élève introuvable.');
      return {
        card: toCard(student),
        attendance: {
          id: uid('att'), date: new Date().toISOString().slice(0, 10), session: 'Journée',
          status: 'present', note: 'Pointage démo (carte)', createdAt: new Date().toISOString(),
        },
        alreadyMarked: false,
        previousStatus: null,
      } as T;
    }
    if (method === 'POST' && extra === 'issue') {
      const student = list.find((item) => item.id === id);
      if (!student) fail(404, 'Élève introuvable.');
      return { card: toCard(student) } as T;
    }
    fail(404, 'Route inconnue.');
  }

  const collections: Record<string, { key: string; items: Json[] }> = {
    students: { key: 'student', items: views.students.items },
    classes: { key: 'class', items: data.classes.items },
    teachers: { key: 'teacher', items: data.teachers.items },
    admissions: { key: 'admission', items: data.admissions.items },
    payments: { key: 'payment', items: views.payments.items },
    courses: { key: 'course', items: data.courses.items },
    announcements: { key: 'announcement', items: views.announcements.items },
    faculties: { key: 'faculty', items: data.faculties.items },
    programs: { key: 'program', items: data.programs.items },
    'course-units': { key: 'unit', items: data.units.items },
    schedules: { key: 'schedule', items: data.schedules.items },
  };

  /* Prêts et ouvrages : routes imbriquées sous /library */
  if (root === 'library') {
    const books = data.books.items as Json[];
    const loans = data.loans.items as Json[];

    if (id === 'books') {
      if (method === 'POST') {
        const book = { id: uid('bok'), activeLoans: 0, copiesAvailable: Number((body as Json)?.copiesTotal ?? 1), ...(body as Json) };
        books.unshift(book);
        return { book } as T;
      }
      if (method === 'PATCH' && extra) {
        const book = books.find((item) => item.id === extra);
        if (!book) fail(404, 'Ouvrage introuvable.');
        const payload = (body ?? {}) as Json;
        const onLoan = book.copiesTotal - book.copiesAvailable;
        Object.assign(book, payload);
        if (payload.copiesTotal !== undefined) book.copiesAvailable = Number(payload.copiesTotal) - onLoan;
        return { book } as T;
      }
      if (method === 'DELETE' && extra) {
        const index = books.findIndex((item) => item.id === extra);
        if (index >= 0) books.splice(index, 1);
        return { ok: true } as T;
      }
    }

    if (id === 'loans') {
      if (method === 'POST') {
        const payload = (body ?? {}) as Json;
        const book = books.find((item) => item.id === payload.bookId);
        if (!book) fail(400, 'Ouvrage introuvable.');
        if (book.copiesAvailable < 1) fail(409, 'Aucun exemplaire disponible.');
        const student = (data.meta.students as Json[]).find((item) => item.id === payload.studentId);
        const loan = {
          id: uid('lon'),
          bookId: book.id,
          bookTitle: book.title,
          bookAuthor: book.author,
          studentId: payload.studentId,
          studentName: student?.name ?? 'Emprunteur',
          firstName: student?.name?.split(' ')[0] ?? '',
          lastName: student?.name?.split(' ').slice(1).join(' ') ?? '',
          matricule: student?.matricule ?? '—',
          className: student?.className ?? null,
          programName: student?.programName ?? null,
          loanedAt: new Date().toISOString(),
          dueAt: payload.dueAt,
          returnedAt: null,
          status: 'en_cours',
          late: false,
        };
        loans.unshift(loan);
        book.copiesAvailable -= 1;
        book.activeLoans += 1;
        return { loan } as T;
      }
      if (method === 'PATCH' && extra) {
        const loan = loans.find((item) => item.id === extra);
        if (!loan) fail(404, 'Emprunt introuvable.');
        const book = books.find((item) => item.id === loan.bookId);
        const status = (body as Json)?.status;
        if (status === 'rendu') {
          if (loan.status !== 'rendu' && book) {
            book.copiesAvailable = Math.min(book.copiesTotal, book.copiesAvailable + 1);
            book.activeLoans = Math.max(0, book.activeLoans - 1);
          }
          loan.status = 'rendu';
          loan.returnedAt = new Date().toISOString();
        } else if (status) {
          if (loan.status === 'rendu' && book) {
            book.copiesAvailable = Math.max(0, book.copiesAvailable - 1);
            book.activeLoans += 1;
          }
          loan.status = status;
          loan.returnedAt = null;
        }
        return { loan } as T;
      }
      if (method === 'DELETE' && extra) {
        const index = loans.findIndex((item) => item.id === extra);
        if (index >= 0) {
          const [loan] = loans.splice(index, 1);
          const book = books.find((item) => item.id === loan.bookId);
          if (book && loan.status !== 'rendu') {
            book.copiesAvailable = Math.min(book.copiesTotal, book.copiesAvailable + 1);
            book.activeLoans = Math.max(0, book.activeLoans - 1);
          }
        }
        return { ok: true } as T;
      }
    }
    fail(404, 'Route inconnue.');
  }

  /* ------------------------------ présences ------------------------------ */

  if (root === 'attendance') {
    if (method === 'POST' && id === 'mark') {
      const payload = (body ?? {}) as Json;
      const record = upsertAttendance(data, payload.studentId, payload.date, payload.session || 'Journée', payload.status, payload.note ?? null);
      return { item: record } as T;
    }
    if (method === 'POST' && id === 'bulk') {
      const payload = (body ?? {}) as Json;
      (payload.studentIds as string[]).forEach((studentId) => {
        upsertAttendance(data, studentId, payload.date, payload.session || 'Journée', payload.status, null);
      });
      return { ok: true, updated: (payload.studentIds as string[]).length } as T;
    }
    if (method === 'PATCH' && id) {
      const record = data.attendance.find((item: Json) => item.id === id);
      if (!record) fail(404, 'Pointage introuvable.');
      Object.assign(record, body);
      return { item: record } as T;
    }
    if (method === 'DELETE' && id) {
      const index = data.attendance.findIndex((item: Json) => item.id === id);
      if (index >= 0) data.attendance.splice(index, 1);
      return { ok: true } as T;
    }
    fail(404, 'Route inconnue.');
  }

  /* ------------------------- inscription → élève ------------------------- */

  if (root === 'admissions' && method === 'POST' && extra === 'enroll') {
    const admission = data.admissions.items.find((item: Json) => item.id === id);
    if (!admission) fail(404, 'Dossier introuvable.');
    const student = {
      id: uid('stu'),
      matricule: `SNA-DEMO-${Math.floor(Math.random() * 900 + 100)}`,
      firstName: admission.firstName,
      lastName: admission.lastName,
      gender: admission.gender ?? 'F',
      birthDate: admission.birthDate ?? null,
      classId: admission.classId ?? null,
      className: admission.className ?? null,
      level: admission.level ?? null,
      guardianName: admission.guardianName ?? admission.name ?? '—',
      guardianPhone: admission.phone ?? '—',
      guardianEmail: admission.email ?? '',
      address: admission.address ?? '',
      status: 'actif',
      enrolledAt: today(),
      studentType: 'eleve',
      programId: null,
      programName: null,
      academicLevel: null,
      paidTotal: 0,
      tuitionFee: admission.tuitionFee ?? 0,
    };
    views.students.items.unshift(student);
    data.roles.teacher?.students.items.unshift({ ...student });
    admission.status = 'inscrite';
    return { student } as T;
  }

  /* --------------------------- CRUD génériques --------------------------- */

  const resource = collections[root as string];
  if (!resource) fail(404, 'Route inconnue.');
  const { key, items } = resource;

  if (method === 'POST') {
    const payload = { ...(body as Json) };
    const created: Json = {
      id: uid(root.slice(0, 3)),
      createdAt: new Date().toISOString(),
      studentCount: 0,
      ...payload,
    };
    if (root === 'students') {
      created.paidTotal = 0;
      created.status = created.status ?? 'actif';
      created.studentType = created.studentType ?? 'eleve';
      created.matricule = created.matricule ?? `SNA-DEMO-${Math.floor(Math.random() * 900 + 100)}`;
    }
    if (root === 'classes') created.studentCount = 0;
    if (root === 'payments') created.reference = created.reference ?? `PAY-DEMO-${Math.floor(Math.random() * 9000 + 1000)}`;
    items.unshift(created);
    return { [key]: created } as T;
  }

  if (method === 'PATCH' && id) {
    const target = items.find((item) => item.id === id);
    if (!target) fail(404, 'Élément introuvable.');
    Object.assign(target, body);
    return { [key]: target } as T;
  }

  if (method === 'DELETE' && id) {
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) fail(404, 'Élément introuvable.');
    items.splice(index, 1);
    return { ok: true } as T;
  }

  fail(405, 'Méthode non autorisée.');
}

/* ------------------------- pointage : création/maj ------------------------ */

function upsertAttendance(data: Json, studentId: string, date: string, session: string, status: string, note: string | null) {
  const student = (data.meta.students as Json[]).find((item) => item.id === studentId);
  const existing = data.attendance.find((item: Json) => (
    item.studentId === studentId && item.date === date && (item.session ?? 'Journée') === session
  ));
  if (existing) {
    existing.status = status;
    existing.note = note ?? existing.note ?? null;
    return existing;
  }
  const record = {
    id: uid('att'),
    studentId,
    studentName: student?.name ?? 'Élève',
    firstName: student?.name?.split(' ')[0] ?? '',
    lastName: student?.name?.split(' ').slice(1).join(' ') ?? '',
    matricule: student?.matricule ?? '—',
    classId: student?.classId ?? null,
    className: student?.className ?? null,
    programId: student?.programId ?? null,
    programName: student?.programName ?? null,
    date,
    session,
    status,
    note,
  };
  data.attendance.push(record);
  return record;
}
