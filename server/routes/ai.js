import { Router } from 'express';
import { z } from 'zod';
import { parseBody, asyncHandler } from '../helpers.js';
import { aiConfig, aiReady } from '../settings.js';
import { logEvent } from '../supabase.js';

const router = Router();

/**
 * Assistant « School Net IA ».
 * - Si OPENAI_API_KEY est configurée, la réponse vient du modèle.
 * - Sinon (ou en cas d'erreur réseau), une base de connaissances locale répond :
 *   l'assistant reste utile pour la démonstration, sans dépendance externe.
 */

const SYSTEM_PROMPT = `Tu es "School Net IA", l'assistant de la plateforme School Net Academy
(gestion d'écoles et d'universités au Congo et en Afrique). Tu réponds en français, de façon
concise (3 à 6 phrases maximum), avec un ton professionnel et chaleureux.
Tu connais : les élèves et étudiants, les classes, les facultés/filières LMD, les unités
d'enseignement et crédits, l'emploi du temps, la bibliothèque, les présences, les paiements
(FCFA, Mobile Money), les bulletins, les cartes scolaires à QR code / code-barres / badge NFC,
les abonnements (essai gratuit de 7 jours, offres Essentiel 15 000 FCFA/mois, Pro 45 000
FCFA/mois, Université 120 000 FCFA/mois), la newsletter et les SMS aux parents.
Si la question sort du domaine, ramène poliment vers la gestion scolaire.
Ne promets jamais d'action que tu ne peux pas exécuter : propose le bon écran ou le contact du support.`;

const KNOWLEDGE = [
  {
    keys: ['prix', 'tarif', 'abonnement', 'combien', 'offre', 'plan', 'payer', 'fcfa'],
    answer: "Trois offres : **Essentiel** 15 000 FCFA/mois (petite école), **Pro** 45 000 FCFA/mois "
      + "(école + université, SMS et notifications) et **Université** 120 000 FCFA/mois (campus, LMD illimité). "
      + "Chaque création d'établissement commence par **7 jours d'essai gratuit**. Le paiement se fait par "
      + "Mobile Money, carte bancaire, virement ou espèces depuis l'écran « Abonnement ».",
  },
  {
    keys: ['essai', 'gratuit', '7 jours', 'expire', 'bloque'],
    answer: "Votre établissement démarre avec **7 jours d'essai gratuit**. À la fin de l'essai, l'accès à "
      + "l'espace est bloqué et vous êtes redirigé vers la page d'abonnement : le déblocage est immédiat après "
      + "le paiement. La direction peut aussi demander une prolongation depuis l'espace plateforme.",
  },
  {
    keys: ['carte', 'qr', 'code-barres', 'nfc', 'badge', 'présence', 'presence', 'pointer'],
    answer: "Chaque élève reçoit automatiquement une **carte scolaire** avec QR code et code-barres Code 128 ; "
      + "un badge NFC peut y être associé depuis l'écran « Cartes scolaires ». Le scan signe la présence du jour, "
      + "avec détection des doublons. La carte s'imprime au format carte bancaire.",
  },
  {
    keys: ['sms', 'notification', 'parent', 'prévenir', 'prevenir'],
    answer: "Les parents reçoivent une **notification** et un **SMS** au numéro enregistré à chaque inscription "
      + "d'élève ou paiement encaissé. Les SMS partent par le fournisseur configuré (SMS_API_URL) ; sans "
      + "configuration, ils restent dans la boîte d'envoi de démonstration.",
  },
  {
    keys: ['mot de passe', 'oublié', 'oublie', 'connecter', 'connexion'],
    answer: "Utilisez « Mot de passe oublié ? » sur l'écran de connexion : un lien de réinitialisation valable "
      + "30 minutes est généré. Si le compte est celui de la direction, l'équipe plateforme peut aussi réinitialiser "
      + "l'accès depuis l'espace super administrateur.",
  },
  {
    keys: ['démo', 'demo', 'compte', 'tester'],
    answer: "Comptes de démonstration (mot de passe `demo1234`) : `direction@schoolnet.academy` (direction), "
      + "`prof.mbemba@schoolnet.academy` (enseignant), `parent.ondongo@schoolnet.academy` (parent) et "
      + "`superadmin@schoolnet.academy` (super administrateur).",
  },
  {
    keys: ['université', 'universite', 'faculté', 'faculte', 'filière', 'filiere', 'lmd', 'crédit', 'credit'],
    answer: "Le volet université gère les **facultés**, les **filières LMD** (L1 → M2), les **unités "
      + "d'enseignement** avec crédits, l'emploi du temps et les relevés de notes des étudiants.",
  },
  {
    keys: ['newsletter', 'campagne', 'email', 'e-mail', 'marketing'],
    answer: "Depuis l'espace super administrateur (rôle Marketing), vous composez des **campagnes newsletter**, "
      + "vous choisissez l'audience et vous suivez les abonnés. Le formulaire d'inscription est présent sur la "
      + "page d'accueil.",
  },
  {
    keys: ['sécurité', 'securite', 'données', 'donnees', 'sauvegarde'],
    answer: "Les mots de passe sont hachés avec scrypt, les sessions signées HttpOnly et chaque rôle est "
      + "cloisonné côté serveur. Sur Vercel, la base SQLite est éphémère : pour une production réelle, branchez "
      + "une base managée (Supabase, Neon ou Turso).",
  },
];

function localAnswer(question) {
  const text = String(question).toLowerCase();
  let best = null;
  let score = 0;
  KNOWLEDGE.forEach((entry) => {
    const hits = entry.keys.reduce((sum, key) => (text.includes(key) ? sum + 1 : sum), 0);
    if (hits > score) { score = hits; best = entry; }
  });
  if (best) return best.answer;
  return "Je peux vous aider sur les élèves et étudiants, les paiements, les cartes scolaires (QR/NFC), "
    + "les présences, les abonnements et la newsletter. Précisez votre question ou écrivez à "
    + "businesscongo.inf@gmail.com : l'équipe répond du lundi au vendredi, de 7h30 à 16h00.";
}

router.post('/chat', asyncHandler(async (req, res) => {
  const data = parseBody(z.object({
    messages: z.array(z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().min(1).max(2000),
    })).min(1, 'Message requis.').max(20),
  }), req.body);

  const question = [...data.messages].reverse().find((message) => message.role === 'user')?.content ?? '';
  const config = aiConfig();
  const apiKey = config.apiKey;

  if (!apiKey) {
    res.json({ reply: localAnswer(question), source: 'local' });
    return;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: config.model,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...data.messages.slice(-8).map((message) => ({ role: message.role, content: message.content.slice(0, 1200) })),
        ],
      }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      const reason = response.status === 401 ? 'clé API refusée'
        : response.status === 429 ? 'quota ou débit dépassé'
          : response.status === 404 ? 'modèle introuvable'
            : `erreur ${response.status}`;
      throw new Error(`${reason}${detail ? ` — ${detail.slice(0, 120)}` : ''}`);
    }
    const payload = await response.json();
    const reply = payload?.choices?.[0]?.message?.content?.trim();
    if (!reply) throw new Error('réponse vide');
    await logEvent('ai_chat', {
      model: config.model, origin: config.origin,
      tokens: payload?.usage?.total_tokens ?? null, characters: reply.length,
    });
    res.json({ reply, source: 'openai', model: config.model });
  } catch (error) {
    await logEvent('ai_chat_error', { model: config.model, error: String(error?.message ?? error).slice(0, 200) });
    res.json({
      reply: localAnswer(question),
      source: 'local',
      note: `Assistant IA indisponible (${String(error?.message ?? error).slice(0, 120)}).`,
    });
  }
}));

/** État de l'assistant (modèle configuré, sans jamais exposer la clé). */
router.get('/status', (req, res) => {
  const config = aiConfig();
  res.json({
    configured: aiReady(),
    model: config.model,
    origin: config.origin,
    hint: config.hint,
    lastCheck: config.lastCheck,
    fallback: 'Base de connaissances locale (français)',
  });
});

export default router;
