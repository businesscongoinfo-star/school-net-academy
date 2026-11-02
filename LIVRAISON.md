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

---

## 6. Intégration Supabase & e-mails (mise à jour du 2 novembre 2026)

**Supabase est branché en production** (projet `sskqhiyebnlvdntmmhjb`, région Europe de l'Ouest) :

- **Données durables** : un instantané compressé de la base est enregistré dans la table
  `app_state` à chaque écriture et restauré au démarrage de chaque instance. Les comptes,
  établissements et abonnements créés **survivent** donc aux redéploiements et aux
  redémarrages serverless (plus de perte au bout de quelques minutes).
- **E-mails de réinitialisation réels** : Supabase Auth envoie le lien (`/auth/v1/recover`)
  et le retour se fait sur `/reinitialiser`. Les comptes de l'application sont
  automatiquement miroir dans Supabase Auth (à la connexion, à la création, au changement
  de mot de passe).
- **Journal d'accès** : `access_events` (connexions, inscriptions, campagnes, changements
  de configuration).

**Compte super administrateur réel**

| Identifiant | Mot de passe |
| --- | --- |
| `businesscongo.inf@gmail.com` | celui que vous avez fourni |

Il est créé à chaque démarrage depuis les variables Vercel `SUPERADMIN_EMAIL` /
`SUPERADMIN_PASSWORD` (jamais présent dans le dépôt). Rôle : **propriétaire de la
plateforme** → accès à `/plateforme` (ses 7 onglets, dont **Intégrations**).

**Créer un établissement et son compte (mot de passe généré)**

`/plateforme` → **Établissements** → **Nouvel établissement** : nom, type (école /
université), pays et devise, responsable et e-mail. L'application génère un mot de passe
provisoire du type `Sna-XXXX-XXXX`, l'affiche avec un bouton de copie et l'envoie au
responsable. Le bouton **Ouvrir** entre ensuite dans l'espace du client (jeton à usage
unique de 15 minutes) pour terminer le paramétrage.

**Envoyer de vrais e-mails (newsletter, reçus, identifiants)**

Supabase ne peut envoyer que les e-mails d'authentification (quota faible). Pour les
campagnes et les notifications, deux possibilités **sans redéploiement** :

1. `/plateforme` → **Intégrations** → fournisseur **Resend** (clé API `re_…`, gratuit
   jusqu'à 3 000 e-mails/mois) → **Enregistrer** → **Envoyer un test**.
2. Ou fournisseur **SMTP** (Gmail avec mot de passe d'application, Brevo, Mailjet…) :
   serveur, port, utilisateur, mot de passe.

Tant qu'aucun expéditeur n'est configuré, chaque message (identifiants, reçus, newsletter,
réinitialisation) est **conservé en file d'attente** et visible dans l'onglet Intégrations —
rien n'est perdu, il suffit du bouton « Enregistrer » pour que la file s'écoule.

**Variables Vercel ajoutées**

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (secrète), `SUPABASE_PUBLISHABLE_KEY`,
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPERADMIN_EMAIL`,
`SUPERADMIN_PASSWORD` (secrète), `SUPERADMIN_NAME`, `APP_URL`, `MAIL_REPLY_TO`.
