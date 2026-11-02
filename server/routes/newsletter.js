import { Router } from 'express';
import { z } from 'zod';
import { get, run, now, uid } from '../db.js';
import { parseBody, asyncHandler } from '../helpers.js';
import { sendMail, renderEmail } from '../mailer.js';
import { logEvent } from '../supabase.js';

const router = Router();

/** Inscription publique à la newsletter (page d'accueil, pied de page). */
router.post('/subscribe', asyncHandler(async (req, res) => {
  const data = parseBody(z.object({
    email: z.string().email('Adresse e-mail invalide.').max(160),
    name: z.string().max(80).nullable().optional(),
    countryCode: z.string().max(3).nullable().optional(),
    source: z.string().max(30).nullable().optional(),
  }), req.body);

  const email = data.email.toLowerCase().trim();
  const existing = get('SELECT * FROM newsletter_subscribers WHERE email = ?', email);
  if (existing) {
    if (existing.status === 'desinscrit') {
      run("UPDATE newsletter_subscribers SET status = 'actif' WHERE id = ?", existing.id);
    }
    res.json({ ok: true, already: true, message: 'Vous êtes déjà abonné : merci !' });
    return;
  }
  run(
    `INSERT INTO newsletter_subscribers (id, email, name, country_code, source, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'actif', ?)`,
    uid('nwl'), email, data.name ?? null,
    data.countryCode ? data.countryCode.toUpperCase() : null,
    data.source ?? 'site', now(),
  );
  // Confirmation réelle (si un fournisseur est configuré) — l'abonnement reste
  // enregistré dans tous les cas et apparaît dans la console d'administration.
  const origin = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  const unsubscribeUrl = `${origin.replace(/\/$/, '')}/desabonnement?email=${encodeURIComponent(email)}`;
  const delivery = await sendMail({
    to: email,
    kind: 'newsletter_confirmation',
    subject: 'Bienvenue dans la lettre School Net Academy',
    html: renderEmail({
      title: 'Votre abonnement est confirmé',
      preheader: 'Conseils de gestion scolaire, chaque mois.',
      intro: `Bonjour${data.name ? ` ${data.name}` : ''}, merci de votre intérêt pour School Net Academy.`,
      blocks: [
        { text: 'Chaque mois : des conseils concrets pour digitaliser la scolarité (inscriptions, paiements, présences, bulletins) et les nouveautés de la plateforme.' },
        { text: 'Vous pouvez vous désabonner à tout moment en un clic.' },
      ],
      cta: { label: 'Découvrir la plateforme', url: `${origin.replace(/\/$/, '')}/inscription` },
      footnote: `<a href="${unsubscribeUrl}" style="color:#0f766e">Se désabonner</a>`,
    }),
  }).catch(() => ({ status: 'echec' }));

  await logEvent('newsletter_subscribe', { email, source: data.source ?? 'site', delivery: delivery.status });

  res.status(201).json({
    ok: true,
    message: 'Inscription confirmée. À très vite dans votre boîte mail !',
    delivered: delivery.status === 'envoye',
  });
}));

router.post('/unsubscribe', asyncHandler(async (req, res) => {
  const data = parseBody(z.object({ email: z.string().email().max(160) }), req.body);
  const email = data.email.toLowerCase().trim();
  const existing = get('SELECT id FROM newsletter_subscribers WHERE email = ?', email);
  if (existing) run("UPDATE newsletter_subscribers SET status = 'desinscrit' WHERE id = ?", existing.id);
  res.json({ ok: true });
}));

export default router;
