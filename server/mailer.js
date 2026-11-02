/**
 * Service e-mail : envoi réel via Resend ou SMTP (Gmail, Brevo, Mailjet…),
 * journalisation dans `email_outbox` et gabarits aux couleurs de School Net Academy.
 *
 * Sans fournisseur configuré, les messages sont conservés en file (« en_attente »)
 * et visibles dans la console d'administration — rien n'est perdu, et l'envoi
 * peut être relancé après configuration.
 */
import { all, get, run, now, uid } from './db.js';
import { mailConfig, mailReady } from './settings.js';

const BRAND = {
  name: 'School Net Academy',
  color: '#0f766e',
  site: process.env.APP_URL || 'https://school-net-academy.vercel.app',
  contact: process.env.MAIL_REPLY_TO || 'businesscongo.inf@gmail.com',
};

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Gabarit HTML commun (compatible clients mail : tables + styles en ligne). */
export function renderEmail({ title, preheader = '', intro, blocks = [], cta, footnote }) {
  const blocksHtml = blocks.map((block) => {
    if (block.list) {
      return `<ul style="margin:0 0 18px;padding-left:20px;color:#334155;font-size:15px;line-height:1.7">${
        block.list.map((item) => `<li style="margin-bottom:6px">${item}</li>`).join('')}</ul>`;
    }
    return `<p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.7">${block.html ?? escapeHtml(block.text ?? '')}</p>`;
  }).join('');

  const ctaHtml = cta?.url
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 22px">
         <tr><td style="border-radius:10px;background:${BRAND.color}">
           <a href="${escapeHtml(cta.url)}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px">${escapeHtml(cta.label)}</a>
         </td></tr>
       </table>${cta.fallbackUrl ? `<p style="margin:0 0 18px;color:#64748b;font-size:12px;line-height:1.6;word-break:break-all">Lien direct : <a href="${escapeHtml(cta.fallbackUrl)}" style="color:${BRAND.color}">${escapeHtml(cta.fallbackUrl)}</a></p>` : ''}`
    : '';

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:28px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
        <tr><td style="background:${BRAND.color};padding:22px 28px">
          <span style="color:#ffffff;font-size:17px;font-weight:700;letter-spacing:-0.01em">School Net <span style="color:#99f6e4">Academy</span></span>
        </td></tr>
        <tr><td style="padding:28px">
          <h1 style="margin:0 0 14px;color:#0f172a;font-size:22px;line-height:1.3">${escapeHtml(title)}</h1>
          ${intro ? `<p style="margin:0 0 18px;color:#334155;font-size:15px;line-height:1.7">${intro}</p>` : ''}
          ${blocksHtml}
          ${ctaHtml}
          ${footnote ? `<p style="margin:0;padding-top:16px;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px;line-height:1.6">${footnote}</p>` : ''}
        </td></tr>
        <tr><td style="background:#f8fafc;padding:16px 28px;border-top:1px solid #e2e8f0">
          <p style="margin:0;color:#64748b;font-size:12px;line-height:1.6">
            ${BRAND.name} — gestion scolaire et universitaire.<br>
            Besoin d'aide ? Répondez à cet e-mail ou écrivez à
            <a href="mailto:${escapeHtml(BRAND.contact)}" style="color:${BRAND.color}">${escapeHtml(BRAND.contact)}</a>.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export function mailerStatus() {
  const config = mailConfig();
  const counts = get(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN status = 'envoye' THEN 1 ELSE 0 END) AS envoyes,
            SUM(CASE WHEN status = 'en_attente' THEN 1 ELSE 0 END) AS en_attente,
            SUM(CASE WHEN status = 'echec' THEN 1 ELSE 0 END) AS echecs
       FROM email_outbox`,
  ) ?? {};
  return {
    configured: mailReady(),
    provider: config.provider || null,
    from: config.from,
    replyTo: config.replyTo,
    counts: {
      total: counts.total ?? 0,
      sent: counts.envoyes ?? 0,
      pending: counts.en_attente ?? 0,
      failed: counts.echecs ?? 0,
    },
  };
}

async function sendWithResend(config, message) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: config.from,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
      reply_to: config.replyTo || undefined,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json())?.id ?? 'resend';
}

async function sendWithSmtp(config, message) {
  const { default: nodemailer } = await import('nodemailer');
  const transport = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
    connectionTimeout: 12_000,
  });
  const info = await transport.sendMail({
    from: config.from,
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
    replyTo: config.replyTo || undefined,
  });
  return info.messageId ?? 'smtp';
}

/**
 * Envoie un e-mail et journalise le résultat.
 * @returns {Promise<{status:'envoye'|'en_attente'|'echec', provider:string|null, error?:string}>}
 */
export async function sendMail({ to, subject, html, text = '', kind = 'transactionnel' }) {
  const email = String(to || '').toLowerCase().trim();
  if (!email || !email.includes('@')) return { status: 'echec', provider: null, error: 'Adresse e-mail invalide.' };

  const config = mailConfig();
  const id = uid('mail');
  const ts = now();
  const ready = mailReady();

  run(
    `INSERT INTO email_outbox (id, to_email, subject, kind, status, provider, error, created_at, sent_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, ?, NULL)`,
    id, email, subject, kind, ready ? 'en_attente' : 'en_attente', config.provider || null, ts,
  );

  if (!ready) {
    run("UPDATE email_outbox SET error = ? WHERE id = ?", 'Aucun fournisseur e-mail configuré.', id);
    return { status: 'en_attente', provider: null, error: 'Aucun fournisseur e-mail configuré.' };
  }

  try {
    const provider = config.provider === 'resend'
      ? await sendWithResend(config, { to: email, subject, html, text: text || stripHtml(html) })
      : await sendWithSmtp(config, { to: email, subject, html, text: text || stripHtml(html) });
    run("UPDATE email_outbox SET status = 'envoye', provider = ?, sent_at = ? WHERE id = ?", provider, now(), id);
    return { status: 'envoye', provider };
  } catch (error) {
    const message = String(error?.message ?? error).slice(0, 400);
    run("UPDATE email_outbox SET status = 'echec', error = ? WHERE id = ?", message, id);
    return { status: 'echec', provider: config.provider, error: message };
  }
}

function stripHtml(html = '') {
  return String(html).replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function recentEmails(limit = 50) {
  return all('SELECT * FROM email_outbox ORDER BY created_at DESC LIMIT ?', limit).map((row) => ({
    id: row.id, to: row.to_email, subject: row.subject, kind: row.kind, status: row.status,
    provider: row.provider, error: row.error, createdAt: row.created_at, sentAt: row.sent_at,
  }));
}

/* ------------------------------ Gabarits métier --------------------------- */

const absolute = (path = '/') => `${BRAND.site.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;

export function welcomeEmail({ name, tenantName, email, temporaryPassword, loginUrl = '/connexion' }) {
  const blocks = [
    { text: `Bonjour ${name},` },
    { text: `Votre espace <strong>${escapeHtml(tenantName)}</strong> est prêt sur School Net Academy.` },
  ];
  if (email) blocks.push({ text: `Identifiant : <strong>${escapeHtml(email)}</strong>` });
  if (temporaryPassword) blocks.push({ text: `Mot de passe provisoire : <strong>${escapeHtml(temporaryPassword)}</strong>` });
  blocks.push({ text: 'Pensez à modifier ce mot de passe dès votre première connexion.' });
  return {
    subject: `Votre accès School Net Academy — ${tenantName}`,
    html: renderEmail({
      title: 'Bienvenue sur School Net Academy',
      preheader: `Votre espace ${tenantName} est actif.`,
      intro: null,
      blocks,
      cta: { label: 'Accéder à mon espace', url: absolute(loginUrl) },
      footnote: 'Vous recevez cet e-mail parce qu’un compte a été créé pour vous.',
    }),
  };
}

export function resetEmail({ name, link, minutes = 30 }) {
  return {
    subject: 'Réinitialisation de votre mot de passe — School Net Academy',
    html: renderEmail({
      title: 'Réinitialiser votre mot de passe',
      preheader: 'Lien valable 30 minutes, à usage unique.',
      intro: `Bonjour ${escapeHtml(name || '')}, nous avons reçu une demande de réinitialisation du mot de passe associé à votre compte.`,
      blocks: [{ text: `Ce lien est valable <strong>${minutes} minutes</strong> et ne peut être utilisé qu’une seule fois.` }],
      cta: { label: 'Choisir un nouveau mot de passe', url: link, fallbackUrl: link },
      footnote: 'Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail : votre mot de passe reste inchangé.',
    }),
  };
}

export function passwordChangedEmail({ name }) {
  return {
    subject: 'Votre mot de passe a été modifié — School Net Academy',
    html: renderEmail({
      title: 'Mot de passe modifié',
      intro: `Bonjour ${escapeHtml(name || '')}, le mot de passe de votre compte vient d’être modifié.`,
      blocks: [{ text: 'Si vous n’êtes pas à l’origine de ce changement, réinitialisez immédiatement votre mot de passe et contactez notre équipe.' }],
      cta: { label: 'Sécuriser mon compte', url: absolute('/mot-de-passe-oublie') },
    }),
  };
}

export function paymentReceiptEmail({ guardianName, studentName, amount, reference, tenantName }) {
  return {
    subject: `Paiement reçu — ${tenantName}`,
    html: renderEmail({
      title: 'Paiement enregistré',
      intro: `Bonjour ${escapeHtml(guardianName || '')}, nous confirmons la réception d’un paiement pour <strong>${escapeHtml(studentName)}</strong>.`,
      blocks: [
        { text: `Montant : <strong>${escapeHtml(amount)}</strong>` },
        { text: `Référence : ${escapeHtml(reference || '—')}` },
        { text: 'Le reçu est disponible à tout moment dans votre espace parent.' },
      ],
      cta: { label: 'Voir mes paiements', url: absolute('/connexion') },
    }),
  };
}

export function newsletterEmail({ subject, body, unsubscribeUrl }) {
  const paragraphs = String(body || '')
    .split(/\n{2,}/)
    .map((block) => `<p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.75">${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('');
  return {
    subject,
    html: renderEmail({
      title: subject,
      preheader: String(body || '').slice(0, 120),
      intro: null,
      blocks: [{ html: paragraphs }],
      cta: { label: 'Découvrir School Net Academy', url: absolute('/') },
      footnote: unsubscribeUrl
        ? `Vous recevez cette lettre car vous êtes abonné. <a href="${escapeHtml(unsubscribeUrl)}" style="color:${BRAND.color}">Se désinscrire</a>.`
        : null,
    }),
  };
}

export const emailBrand = BRAND;
