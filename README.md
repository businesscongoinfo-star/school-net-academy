# School Net Academy

Plateforme complète (full-stack) de gestion **d'écoles et d'universités** au Congo :
inscriptions, élèves, étudiants, classes, facultés, filières LMD, unités d'enseignement,
emploi du temps, bibliothèque, présences, paiements, résultats, cours en ligne et annonces —
avec authentification, tableau de bord, CRUD complet et base de données persistante.

L'interface est en français et reprend l'identité du site public **School Net Academy**
(Brazzaville, République du Congo), désormais intégré à l'application.

---

## Démarrage rapide

```bash
npm install
npm run build     # compile l'interface (Vite)
npm start         # démarre l'API + l'interface sur http://localhost:3000
```

La base SQLite est créée et remplie automatiquement au premier lancement avec un
établissement de démonstration réaliste mêlant école et université : ≈238 inscrits
(dont 48 étudiants), 9 classes, 4 facultés, 8 filières, 210 UE, 760+ paiements,
emploi du temps, bibliothèque, présences, notes, admissions, cours et annonces —
chaque inscrit disposant déjà de sa carte scolaire (12 badges NFC de démonstration).

### Comptes de démonstration

Mot de passe commun : **`demo1234`**

| Profil | Identifiant | Accès |
| --- | --- | --- |
| Direction | `direction@schoolnet.academy` | Accès complet à tous les modules + abonnement |
| Enseignant | `prof.mbemba@schoolnet.academy` | Élèves, classes, résultats, cours, annonces |
| Parent | `parent.ondongo@schoolnet.academy` | Ses 2 enfants, paiements, résultats, annonces |
| Super admin | `superadmin@schoolnet.academy` | Espace `/plateforme` : établissements, équipe, abonnements, newsletter, SMS |
| Gestionnaire | `gestion@schoolnet.academy` | Plateforme complète sauf journal SMS filtré |
| Support / Financier / Marketeur / Closer | `support@` · `finance@` · `marketing@` · `closer@schoolnet.academy` | Accès restreints selon le rôle |

Sur l'écran de connexion, trois boutons permettent de se connecter en un clic avec
chacun de ces profils.

---

## Fonctionnalités

### Authentification & rôles
- Connexion par e-mail + mot de passe, session persistante en cookie `HttpOnly` (30 jours).
- Mots de passe hachés avec `scrypt` (sel aléatoire, comparaison à temps constant).
- Trois rôles contrôlés côté serveur : **direction**, **enseignant**, **parent**.
- Un parent ne voit strictement que les données de ses enfants (élèves, paiements, notes,
  fil d'activité, échéances).
- Gestion du profil et du mot de passe, déconnexion.
- **Mot de passe oublié** : lien à usage unique valable 30 minutes (`/mot-de-passe-oublie`).
- **Connexion sociale** Google / Facebook (OAuth 2.0) en complément de l'e-mail.

### Plateforme multi-établissements
- Inscription en libre-service (`/inscription`) : établissement, **pays parmi la liste complète du
  monde**, devise déduite automatiquement, offre choisie, compte de direction.
- **Essai gratuit de 7 jours** puis blocage de l'accès (HTTP 402) et redirection vers
  `/app/abonnement` : Mobile Money, carte bancaire, virement ou espèces.
- **Super administration** `/plateforme` avec rôles serveur : `owner`, `manager`, `support`,
  `finance`, `marketing`, `closer` — chacun ne voit que ses onglets.
- **Newsletter** : formulaire public, base d'abonnés, studio de campagnes et envoi.
- **Notifications** in-app + **SMS aux parents** à l'inscription d'un élève et à chaque paiement.
- **Assistant IA** « School Net IA » (`OPENAI_API_KEY`), avec repli local hors ligne.

### Tableau de bord
- KPI contextuels par rôle (effectifs, encaissements 30 jours, reste à recouvrer, moyenne).
- Courbe des encaissements sur 6 mois, répartition des moyens de paiement, effectifs par niveau.
- Activité récente, échéances à venir, dernières annonces, classes les plus remplies.
- Raccourcis « Nouvel élève » et « Encaisser » qui ouvrent directement le formulaire.

### Modules (CRUD complet)

| Module | Actions |
| --- | --- |
| **Élèves** | Créer, modifier, consulter (tiroir détaillé : identité, scolarité, paiements, résultats), supprimer, rechercher, filtrer par classe/statut, paginer |
| **Classes** | Créer, modifier, supprimer, consulter l'effectif, suivre le remplissage et les frais |
| **Enseignants** | Créer, modifier, supprimer, filtrer par statut, voir les affectations |
| **Inscriptions** | Créer un dossier, changer de statut (optimiste), accepter/refuser, **convertir en élève inscrit** (matricule + frais générés), modifier, supprimer |
| **Paiements** | Enregistrer, modifier, supprimer, marquer payé / repasser en attente (optimiste), filtrer par statut, moyen et type |
| **Résultats** | Saisir, modifier, supprimer des notes par matière et trimestre, moyennes pondérées, classement, taux de réussite |
| **Cours en ligne** | Créer, modifier, supprimer, publier/dépublier (optimiste) avec couverture colorée |
| **Annonces** | Rédiger, publier/dépublier (optimiste), cibler une audience, supprimer |
| **Facultés** | Créer, modifier, supprimer (protection si filières rattachées), consulter les filières et effectifs |
| **Filières** | Licence, Master, Doctorat, BTS, Certificat : durée, crédits, frais, statut, maquette et étudiants |
| **Unités d'enseignement** | Codes, semestres, crédits, volumes horaires, enseignant affecté, statut |
| **Emploi du temps** | Planning hebdomadaire par classe ou filière : jour, horaires, salle, enseignant, type de séance |
| **Bibliothèque** | Catalogue et exemplaires, prêt, retour (optimiste), retards, disponibilité recalculée |
| **Présences** | Pointage par classe/filière et par séance, marquage rapide optimiste, « tout présent », taux du jour, **pointage par carte** (QR / douchette / badge NFC) |
| **Cartes scolaires** | Une carte d'identité par élève et par étudiant : QR code, code-barres **Code 128**, badge **NFC**, aperçu, impression, réémission, association d'un badge, signature de présence en un clic |

### Cartes scolaires & pointage sans contact
- **Carte émise automatiquement** à la création d'un élève (code unique `SNA-26-XXXXXX`,
  année scolaire, validité, classe/filière, matricule, date de naissance, tuteur).
- **QR code** (URL de pointage, donc lisible par n'importe quel téléphone) et **code-barres
  Code 128** (douchettes USB / Bluetooth) imprimés sur la carte, rendus côté navigateur.
- **Badge NFC** : programmation d'un support (écriture d'URL NDEF) ou association d'un badge
  existant, via Web NFC (Chrome Android) ; repli automatique sur le QR / la douchette ailleurs.
- **Signature de présence** : scan → recherche par code carte, tag NFC, matricule ou URL,
  enregistrement du pointage du jour (présent / retard), détection du doublon (« déjà pointé »),
  notification et mise à jour immédiate des compteurs.
- Impression au format carte bancaire (85,6 × 54 mm) et page « Cartes scolaires » dédiée
  (statistiques, filtres, aperçu, actions).

### Expérience utilisateur
- Mise en page avec barre latérale (navigation adaptée au rôle) et barre supérieure collante.
- **Mises à jour optimistes** sur les changements de statut, publications et suppressions,
  avec retour arrière automatique et notification en cas d'échec.
- **États de chargement** : squelettes de tableaux et de cartes, boutons avec *spinner*.
- **États vides** dédiés (aucune donnée, aucun résultat de recherche, erreur réseau avec
  bouton « Réessayer »).
- Toasts de confirmation, dialogues de confirmation avant suppression,
  validation formulaire avec messages en français.
- Responsive : barre latérale coulissante, grilles adaptatives, tableaux défilables,
  tiroirs plein écran sur mobile.
- Site public (accueil, fonctionnalités, modules, admissions, contact) + page de connexion
  avec panneau de marque et comptes de démonstration.
- **Export CSV** (séparateur `;`, UTF-8 BOM, compatible Excel) sur les élèves, les paiements,
  les enseignants, les résultats, les présences et la bibliothèque.
- **Bulletins imprimables** : fiche officielle par élève (matières, coefficients, points,
  moyenne, rang, mention, décision, signatures) prête à imprimer ou à enregistrer en PDF.
- **Titre d'onglet par page** et **écran de reprise** en cas d'erreur de rendu.
- **Emploi du temps protégé** : un créneau déjà pris (classe, filière, enseignant ou salle)
  est refusé avec un message explicite, à la création comme à la modification.
- **Historique protégé** : un élève qui a des paiements, notes ou présences ne peut pas être
  supprimé — l'interface invite à l'archiver (statut « Parti »).

---

## Stack technique

| Couche | Technologie |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, React Router, TanStack Query, Recharts, Lucide, `qrcode.react` (QR), `jsbarcode` (Code 128) |
| Styles | CSS design system maison (variables, composants, responsive), polices Inter & Sora auto-hébergées |
| Backend | Node.js 22, Express 4, validation Zod |
| Base de données | SQLite via `node:sqlite` (module natif, aucune dépendance binaire) |
| Sécurité | `scrypt`, sessions SQL, cookies `HttpOnly`/`SameSite=Lax`, RBAC, requêtes paramétrées |

Un seul processus sert l'API `/api/*` et l'interface compilée : aucun proxy, aucune
configuration CORS, des URL relatives partout.

---

## Scripts

| Commande | Description |
| --- | --- |
| `npm start` | Démarre le serveur (API + interface compilée) sur le port 3000 |
| `npm run build` | Compile l'interface React dans `web/dist` |
| `npm run dev` | Serveur API en mode *watch* (rechargement automatique) |
| `npm run dev:web` | Serveur Vite avec HMR (proxy `/api` vers `localhost:3000`) |
| `npm run seed` | Remplit la base si elle est vide |
| `npm run seed:reset` | Efface et régénère les données de démonstration |
| `npm run typecheck` | Vérification TypeScript de l'interface |
| `node scripts/smoke.mjs` | Test de rendu de toutes les pages avec les données réelles |
| `npm run audit` | Recette fonctionnelle de l'API : 122 vérifications (CRUD, droits, plateforme, intégrations, IA, erreurs) |
| `npm run check` | Enchaîne typecheck + build + rendu des pages + audit API |

### Développement avec rechargement à chaud

```bash
# terminal 1 — API
npm run dev

# terminal 2 — interface
npm run dev:web   # http://localhost:5173 (proxy /api vers :3000)
```

---

## Architecture

```
school-net-academy/
├── server/
│   ├── index.js            # application Express, routes, service des fichiers statiques
│   ├── db.js               # connexion SQLite, schéma, helpers de requêtes
│   ├── auth.js             # hachage, sessions, cookies, middlewares de rôle
│   ├── helpers.js          # erreurs HTTP, validation, portées parent, références
│   ├── seed.js             # données de démonstration déterministes
│   └── routes/             # auth, dashboard, students, classes, teachers,
│                           # admissions, payments, courses, announcements, grades, meta
├── web/
│   ├── index.html
│   ├── vite.config.ts
│   └── src/
│       ├── main.tsx, App.tsx
│       ├── styles.css      # design system complet
│       ├── lib/            # api, auth, types, formatage, libellés, query client
│       ├── components/     # ui, overlays, charts, layout, toast
│       └── pages/          # Landing, Login, Dashboard, Students, Classes, Teachers,
│                           # Admissions, Payments, Results, Courses, Announcements,
│                           # Faculties, Programs, Units, Timetable, Library, Attendance,
│                           # Settings, NotFound
├── scripts/smoke.mjs       # test de rendu SSR de toutes les pages
└── data/                   # base SQLite générée (ignorée par Git)
```

### Modèle de données

`users` · `sessions` · `students` · `classes` · `teachers` · `admissions` ·
`payments` · `courses` · `announcements` · `grades` ·
`faculties` · `programs` · `course_units` · `schedules` · `books` · `loans` · `attendance`

Relations principales : un élève appartient à une classe ; une classe a un enseignant
titulaire ; paiements et notes sont rattachés aux élèves (suppression en cascade) ;
un compte parent est lié à ses élèves via `students.guardian_user_id`.

Volet universitaire : une **faculté** regroupe des **filières** (`programs`), chaque filière
contient des **unités d'enseignement** (`course_units`, crédits + semestre) ; un étudiant
(`students.student_type = 'etudiant'`) est rattaché à une filière et à un niveau
(`academic_level` L1→M2) ; `schedules` planifie les séances d'une classe **ou** d'une filière ;
`books`/`loans` gèrent la bibliothèque (disponibilité = exemplaires − prêts en cours) ;
`attendance` enregistre présences, absences, retards et justificatifs par date et séance.

### API REST

| Méthode | Route | Rôle |
| --- | --- | --- |
| `POST` | `/api/auth/login`, `/api/auth/logout` | public |
| `GET` | `/api/auth/me` | authentifié |
| `PATCH` / `POST` | `/api/auth/profile`, `/api/auth/password` | authentifié |
| `GET` | `/api/dashboard` | authentifié (données filtrées) |
| `GET` | `/api/meta` | authentifié (listes de référence) |
| `GET/POST` | `/api/students` | lecture : tous rôles (portée parent) · écriture : direction |
| `GET/PATCH/DELETE` | `/api/students/:id` | idem |
| `GET/POST` | `/api/classes` | direction (lecture élargie) |
| `GET/PATCH/DELETE` | `/api/classes/:id` | direction |
| `GET/POST` | `/api/teachers` | direction (lecture pour enseignants) |
| `PATCH/DELETE` | `/api/teachers/:id` | direction |
| `GET/POST` | `/api/admissions` | direction |
| `PATCH/DELETE` | `/api/admissions/:id` | direction |
| `POST` | `/api/admissions/:id/enroll` | direction |
| `GET/POST` | `/api/payments` | lecture : direction/parent · écriture : direction |
| `PATCH/DELETE` | `/api/payments/:id` | direction |
| `GET` | `/api/grades/results` | direction, enseignant, parent |
| `POST` | `/api/grades` | direction, enseignant |
| `PATCH/DELETE` | `/api/grades/:id` | direction, enseignant |
| `GET/POST` | `/api/courses` | lecture : tous · écriture : direction/enseignant |
| `PATCH/DELETE` | `/api/courses/:id` | direction/enseignant |
| `GET/POST` | `/api/announcements` | lecture : filtrée par audience · écriture : direction |
| `PATCH/DELETE` | `/api/announcements/:id` | direction |

Toutes les listes acceptent des filtres (`search`, `status`, `level`, `classId`, `term`…)
et renvoient `{ items, stats }`. Les erreurs sont renvoyées au format
`{ error, details? }` avec le code HTTP approprié.

---

## Démo publique (GitHub Pages / CDN GitHub)

Une version **100 % statique** de l'interface est publiée dans `docs/` : elle rejoue l'API du
serveur dans le navigateur à partir d'un instantané de données (`web/public/demo/snapshot.json`).
Idéal pour montrer le produit sans serveur, y compris sur un téléphone.

- URL GitHub Pages (après activation) : `https://businesscongoinfo-star.github.io/school-net-academy/`
- Activation : **Settings → Pages → Source : Deploy from a branch → Branch :
  `arena/ccb67a6c-school-net-academy` (ou `main` après fusion) → dossier `/docs` → Save**.
- Aperçu immédiat sans configuration : CDN GitHub, par exemple
  `https://raw.githack.com/businesscongoinfo-star/school-net-academy/arena/ccb67a6c-school-net-academy/docs/index.html`

Limites de la démo statique : les écritures (création, modification, suppression, pointage…)
sont **simulées en mémoire** — elles fonctionnent et s'affichent, mais sont perdues au
rechargement ; aucune donnée ne quitte le navigateur. La version serveur (Node + SQLite)
reste la référence, avec persistance réelle.

Régénérer la démo :

```bash
node server/seed.js --reset        # données de démonstration
npm start                          # serveur sur :3000
npm run snapshot                   # → web/public/demo/snapshot.json
npm run build:demo                 # → docs/ (build statique, routage par ancre)
node scripts/test-demo-mock.mjs    # vérifie l'API simulée (≈35 routes)
```

---

## Déploiement

L'application est un **serveur Node.js** (Express + SQLite) qui sert l'API et l'interface compilée
depuis un seul processus. Elle n'est donc **pas** un site statique : un hébergement qui ne sert que
des fichiers (`index.html`, CSS, JS) affichera une page vide ou non stylée.

### Render — en un clic (recommandé, gratuit)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/businesscongoinfo-star/school-net-academy)

1. Cliquez sur le bouton ci-dessus (ou *New → Blueprint* sur [render.com](https://render.com) et
   sélectionnez le dépôt `businesscongoinfo-star/school-net-academy`).
2. Render lit `render.yaml`, compile (`npm ci && npm run build`) et démarre (`npm start`).
3. Vous obtenez une URL publique du type `https://school-net-academy.onrender.com`.

Notes :

- La base SQLite est **créée et remplie automatiquement** au premier démarrage (≈230 inscrits,
  4 facultés, 8 filières, 210 UE, bibliothèque, présences…).
- Sur le **plan gratuit** le disque est éphémère : les données sont réinitialisées à chaque
  redéploiement ou redémarrage. Pour les conserver, décommentez le bloc `disk` dans `render.yaml`
  (plan payant) ou montez un volume persistant.
- Le plan gratuit met le service en veille après inactivité : le premier chargement peut prendre
  ~30 secondes.

### Railway / Fly.io / VPS — via Docker

Un `Dockerfile` de production est fourni (Node 22, build de la SPA, base dans `/data`) :

```bash
docker build -t school-net-academy .
docker run -p 3000:3000 -v $(pwd)/data:/data school-net-academy
```

Railway détecte le `Dockerfile` automatiquement (un `Procfile` `web: npm start` est aussi fourni
pour Scalingo/Heroku) ; sur Fly.io : `fly launch` puis `fly volumes create data --size 1` et montez
le volume sur `/data`.

### Serveur classique

```bash
npm ci
npm run build
DB_FILE=/var/lib/school-net/school-net.db PORT=3000 npm start
```

Variables d'environnement utiles : `PORT`, `DB_FILE` (chemin de la base), `SEED=force`
(régénère les données de démonstration au démarrage).

### Vercel — déployé en production

L'application tourne sur Vercel en **serverless** : <https://school-net-academy.vercel.app>

- `vercel.json` : `npm ci` → `npm run build` (Vite) → sortie `web/dist`, rewrite SPA vers
  `index.html` (les routes `/app/...` fonctionnent au rechargement).
- **Une seule fonction serverless** : `api/index.js`, montée sur `/api`. Vercel ne sait pas
  router `/api/auth/login` vers un `api/[...path].js` (les fichiers « catch-all » ne sont pas
  reconnus hors Next.js) : la réécriture `{ "source": "/api/(.+)", "destination": "/api?__p=$1" }`
  amène tous les chemins imbriqués à la fonction, et `server/app.js` reconstitue l'URL d'origine
  (`req.url`) avant les routeurs Express. Les paramètres de requête sont conservés.
  ⚠️ Ne pas remettre d'ancres (`^…$`) dans `source` : Vercel les échappe littéralement.
- Toute requête `/api/*` est donc traitée par l'application Express exportée depuis
  `server/app.js` (le même code que le serveur Node, sans `listen`).
- Diagnostic en production : `GET /api/health` (vivacité) et `GET /api/diagnostics` (base,
  empreinte des mots de passe démo, signature de session, journal des 40 derniers appels d'API).
- **Sessions sans état** : sur Vercel, `SESSION_MODE=stateless` signe le cookie avec
  `SESSION_SECRET` (HMAC-SHA256). Le jeton est donc valide sur toutes les instances, même si
  chacune recrée sa base SQLite.
- Variables d'environnement du projet : `SESSION_MODE=stateless`, `SESSION_SECRET` (secret),
  `DB_FILE=/tmp/school-net.db`.
- Redéploiement : `git push` sur la branche, ou depuis le tableau de bord Vercel.

**Limite connue** : le système de fichiers serverless est éphémère et propre à chaque instance.
La base SQLite est donc recréée (et remplie avec les données de démonstration) à chaque démarrage
à froid, et les écritures peuvent ne pas être conservées d'une instance à l'autre. Pour une
persistance réelle en production, brancher une base managée (Turso/libSQL, Neon/Postgres, Supabase)
via la même couche `server/db.js`, ou déployer sur un serveur Node avec volume (`render.yaml`,
`Dockerfile` fournis).

## Sécurité

- Mots de passe hachés avec `scrypt` + sel unique ; jamais renvoyés par l'API.
- Sessions stockées en base, révocables, cookie `HttpOnly`, `SameSite=Lax`.
- Limitation des tentatives de connexion (8 essais / 5 minutes par e-mail).
- Autorisations vérifiées **côté serveur** pour chaque écriture, pas uniquement dans l'UI.
- Portée parent appliquée dans toutes les requêtes (SQL), y compris le fil d'activité.
- Toutes les requêtes SQL sont paramétrées ; validation systématique des entrées via Zod.
- Les secrets ne sont pas exposés : la configuration se fait par variables
  d'environnement (`PORT`, `DATA_DIR`, `DB_FILE`).

---

## Données de démonstration

Le script `server/seed.js` génère un établissement cohérent et déterministe :

- 190 élèves répartis dans 9 classes (6ème à Terminale) avec tuteurs, adresses
  et coordonnées congolaises réalistes ;
- 12 enseignants, 9 classes avec titulaires et salles ;
- 760+ paiements sur 6 mois (Mobile Money, espèces, virement, chèque) avec échéances
  passées, en attente et à venir ;
- 18 demandes d'inscription à différents stades du parcours ;
- notes du trimestre en cours et du trimestre précédent, avec coefficients ;
- 10 cours en ligne (publiés, brouillons, archivé) et 7 annonces ;
- **4 facultés** (FST, FLSH, FDSP, FSEG), **8 filières** (Licence et Master) et **210 unités
  d'enseignement** — maquettes complètes : 30 UE / 180 crédits en Licence, 20 UE / 120 crédits en
  Master, avec semestres, volumes horaires et enseignants affectés ;
- **48 étudiants** répartis en L1→M2 avec matricules `UNI-…` ;
- **emploi du temps** : séances pour les 9 classes et les 8 filières (Cours, TD, TP) ;
- **bibliothèque** : 18 ouvrages, 20 prêts (en cours, rendus, en retard) ;
- **présences** : pointages sur les 10 derniers jours ouvrés, élèves et étudiants ;
- un compte parent rattaché à deux élèves.

Régénérer les données : `npm run seed:reset` (le serveur doit être redémarré ensuite).

---

## Notes techniques

- SQLite est fourni par le module natif `node:sqlite` (Node ≥ 22.5) : aucun build natif.
  Node affiche un avertissement `ExperimentalWarning`, sans impact sur le fonctionnement.
- En production, la base peut être déplacée ou remplacée : toutes les requêtes sont
  centralisées dans `server/db.js` et `server/routes/*`.
- Pour un hébergement multi-instances, remplacer la base fichier par PostgreSQL et le
  stockage de sessions par un magasin partagé (Redis). Le reste de l'application est
  inchangé.
- L'ancien `index.html` statique du dépôt a été remplacé par l'application React,
  qui reprend l'intégralité de ses contenus (accueil, chiffres, inscription, contact).
