# School Net Academy — livraison du 2 novembre 2026

**Application en production :** <https://school-net-academy.vercel.app>
**Dépôt :** branche `arena/ccb67a6c-school-net-academy` · commit `a01d7d0`
**Recette locale :** `npm run check` → typecheck ✅ · build ✅ · démo statique ✅ · **25/25 pages** rendues · **114/114 vérifications API**

---

## 1. Les 9 demandes, point par point

| # | Demande | Où le voir | État |
| --- | --- | --- | --- |
| 1 | **Espace super administrateur** avec équipe et rôles (support, financier, gestionnaire, marketeur, closer…) | `/plateforme` — onglets filtrés par rôle, création/modification/suppression d'agents, mot de passe temporaire | ✅ |
| 2 | **Comptes école ET université**, essai gratuit 7 jours, blocage puis espace d'achat (mobile money / carte / autre) | `/inscription` puis `/app/abonnement` (402 `ABONNEMENT_REQUIS` → redirection automatique) | ✅ |
| 3 | **Connexion e-mail ou Facebook/autres** | `/connexion` : boutons Google & Facebook + mot de passe | ✅ (OAuth prêt, à activer avec les identifiants) |
| 4 | **Pays du monde entier + devise automatique** | Étape 2 de `/inscription` : 206 pays, devise déduite, prix convertis (136 devises) | ✅ |
| 5 | **Lancement de campagnes newsletter** + accueil enrichi avec formulaire | `/plateforme` → Newsletter ; accueil : nouvelles sections animées + formulaires | ✅ |
| 6 | **Mot de passe oublié** | `/mot-de-passe-oublie` → jeton 30 min à usage unique → `/reinitialiser?token=…` | ✅ |
| 7 | **Inscription / paiement → notification + SMS aux parents** | Notification dans la cloche + ligne dans `sms_outbox` (statut `simule` sans opérateur) | ✅ |
| 8 | **Support IA branché sur l'API OpenAI** | Widget « School Net IA » en bas à droite, `POST /api/ai/chat` | ✅ code prêt — **clé à ajouter dans Vercel** |
| 9 | **Déployé sur Vercel** | Production rédéployée et vérifiée (`/api/health`, `/api/platform/catalog`) | ✅ |

---

## 2. Comptes de démonstration (mot de passe : `demo1234`)

| Profil | Identifiant | Ce que ça montre |
| --- | --- | --- |
| Direction | `direction@schoolnet.academy` | Établissement complet + accès à l'abonnement |
| Enseignant | `prof.mbemba@schoolnet.academy` | Accès pédagogique restreint |
| Parent | `parent.ondongo@schoolnet.academy` | Ses 2 enfants, paiements, notifications |
| Super administrateur | `superadmin@schoolnet.academy` | `/plateforme` complet (owner) |
| Gestionnaire | `gestion@schoolnet.academy` | Plateforme complète |
| Support | `support@schoolnet.academy` | Établissements, équipe (lecture), SMS |
| Financier | `finance@schoolnet.academy` | Établissements, abonnements, SMS |
| Marketeur | `marketing@schoolnet.academy` | Vue d'ensemble + newsletter |
| Closer | `closer@schoolnet.academy` | Vue d'ensemble + établissements |
| **Essai terminé** | `essai@schoolnet.academy` | **Mur d'abonnement** : tout est bloqué sauf `/app/abonnement` |

---

## 3. Parcours de vérification conseillé (5 minutes)

1. **Accueil** → `https://school-net-academy.vercel.app` : sections « cartes scolaires / SMS », rôles,
   tarifs, newsletter, widget IA.
2. **Inscription** → `/inscription` : choisir « RD Congo » → la devise passe en **CDF** et les prix
   se convertissent. Créer l'établissement → essai de 7 jours, accès immédiat au tableau de bord.
3. **Abonnement** → `/app/abonnement` : comparer les offres, payer par Mobile Money → facture
   `SUB-2026-…` et accès prolongé.
4. **Blocage** → se déconnecter, se connecter avec `essai@schoolnet.academy` : redirection vers
   `/app/abonnement` avec le bandeau « Votre accès est suspendu ».
5. **Super admin** → `superadmin@schoolnet.academy` → `/plateforme` : équipe, établissements,
   abonnements, studio newsletter, journal SMS. Se reconnecter en `marketing@` pour constater la
   restriction des onglets.
6. **Parents** → se connecter en `parent.ondongo@`, cliquer la cloche : notification « Paiement reçu ».

---

## 4. Ce qu'il reste à faire côté configuration (une seule chose)

L'assistant IA fonctionne déjà avec sa **base de connaissances locale**. Pour qu'il réponde via
**OpenAI**, ajouter la clé dans Vercel :

> Vercel → projet `school-net-academy` → **Settings › Environment Variables** →
> `OPENAI_API_KEY` = votre clé `sk-…` (Production + Preview) → **Redeploy**.

Variables optionnelles, même principe : `SMS_API_URL` + `SMS_API_KEY` (SMS réels),
`SMTP_URL` ou `RESEND_API_KEY` (e-mails), `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`,
`FACEBOOK_APP_ID`/`FACEBOOK_APP_SECRET`, `APP_URL` (redirections OAuth).

---

## 5. Limites connues à garder en tête

- Sur Vercel, la base SQLite vit dans `/tmp` : elle est **éphémère** et propre à chaque instance.
  Les données de démonstration se régénèrent automatiquement ; pour une exploitation réelle, une
  base managée (PostgreSQL/Supabase) est nécessaire.
- Aucune passerelle de paiement n'est branchée : les encaissements sont enregistrés et facturés,
  le débit Mobile Money/carte est simulé.
- Sans opérateur SMS configuré, les messages sont journalisés (statut `simule`) plutôt qu'envoyés.
- La connexion Google/Facebook nécessite les identifiants OAuth du fournisseur.
