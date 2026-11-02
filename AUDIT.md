# Rapport d'analyse & de finition — School Net Academy

**Date :** 2 novembre 2026 · **Dernier audit local :** plateforme multi-établissements (voir § 0 ter) · **Production :** <https://school-net-academy.vercel.app>

Ce document trace la recette complète de la plateforme : ce qui a été vérifié, ce qui a été
corrigé, ce qui a été ajouté, et ce qui reste volontairement hors périmètre.

---

## 0. Incident de production du 1er novembre 2026 (connexion impossible)

**Symptôme** : sur <https://school-net-academy.vercel.app/connexion>, la connexion échouait avec
« Une erreur est survenue. » — quelle que soit la saisie, y compris avec les comptes de démonstration.

**Cause racine** : la plateforme Vercel n'acheminait pas les chemins d'API imbriqués vers la
fonction serverless. Le projet déclarait `api/[...path].js` en plus de `api/index.js`, mais les
fichiers « catch-all » ne sont pas reconnus par un projet Vercel hors Next.js : `/api/auth/login`,
`/api/auth/me`, `/api/grades/results`… renvoyaient la page **404 HTML de Vercel**. Le front, qui
attend du JSON, affichait donc le message d'erreur générique. Aucune requête n'atteignait Express,
ce qui explique que le serveur local fonctionnait parfaitement (base, mots de passe, sessions OK).

**Correctif** (commits `effc67d`, `7dd23b5`, `87eb7d3`, `77901b0`) :

| Élément | Avant | Après |
| --- | --- | --- |
| Fonctions | `api/index.js` + `api/[...path].js` | `api/index.js` uniquement |
| Réécriture API | absente | `{ "source": "/api/(.+)", "destination": "/api?__p=$1" }` |
| Routage Express | dépendait de Vercel | `server/app.js` reconstitue `req.url` depuis `__p` (URL brute, cache `_parsedUrl` invalidé) |
| Réponse inconnue | 404 muet | 404 JSON détaillé (`receivedUrl`, `originalUrl`) |
| Diagnostic | — | `GET /api/health`, `GET /api/diagnostics` (journal des 40 derniers appels) |

⚠️ Piège rencontré : écrire `"^/api/(.+)$"` dans `source` produit un motif échappé littéralement
(`^\^/api…`) et ne correspond à rien. Il faut laisser Vercel ajouter les ancres : `/api/(.+)`.

**Vérification en production** (navigateur réel, via une page de test temporaire supprimée depuis) :

```
GET  /api/health ............. 200   {"ok":true}
GET  /api/auth/me  (anonyme) .. 401   {"error":"Session expirée…"}
POST /api/auth/login .......... 200   {user: direction@schoolnet.academy, role: admin}
GET  /api/auth/me  (connecté) . 200   (cookie sna_session conservé)
GET  /api/dashboard ........... 200
GET  /api/library/books ....... 401   JSON (et non plus la page 404 de Vercel)
```

Recette locale après correctif : `npm run typecheck` ✅, `npm run build` ✅, 19/19 pages rendues,
**87/87 vérifications d'API**. ⚠️ L'audit est un test « avec état » : il exige un serveur démarré
sur une base fraîchement semée (`node server/seed.js --reset`), sinon les vérifications dépendant
d'un élève créé plus tôt échouent en cascade.

---

## 0 ter. Plateforme multi-établissements, abonnements et super administration (2 novembre 2026)

### Ce qui a été construit

| Domaine | Détail | Vérifié par |
| --- | --- | --- |
| Inscription d'un établissement | `/inscription` : 4 étapes (établissement, pays + devise, offre, compte). Liste **complète des pays du monde** (`web/src/lib/countries.ts`), devise déduite du pays. | Smoke `Signup`, audit « Inscription établissement » |
| Essai gratuit | 7 jours, `trial_ends_at` sur `tenants`. À l'expiration, l'API répond **402 `ABONNEMENT_REQUIS`** et le front redirige vers `/app/abonnement`. | Audit « Établissement suspendu → 402 » |
| Abonnement | 3 offres (15 000 / 45 000 / 120 000 FCFA), montants **convertis dans la devise de l'établissement** (136 devises), paiement Mobile Money, carte, virement ou espèces. Factures `SUB-2026-NNNN`. | Audit « Paiement self-service », « Abonnement activé depuis la plateforme » |
| Super administration | `/plateforme` : vue d'ensemble, établissements, équipe, abonnements, studio newsletter, journal SMS — chaque onglet filtré par rôle. | Smoke `Platform`, audit RBAC |
| Équipe & rôles | `owner`, `manager`, `support`, `finance`, `marketing`, `closer`. `requirePlatform(...)` vérifie le rôle **côté serveur** ; le propriétaire contourne les restrictions. | Audit « Nouvel agent + droits limités » |
| Notifications parents | Inscription d'un élève et paiement → notification in-app + **SMS** au numéro du tuteur (`sms_outbox`, statut `simule` sans opérateur). | Audit « Paiement → notification + SMS » |
| Newsletter | Formulaire public (`/api/newsletter/subscribe`), studio de campagne, audiences (abonnés, tous, essais, clients), envoi. | Audit « Newsletter » |
| Mot de passe oublié | `/mot-de-passe-oublie` → jeton 30 minutes à usage unique → `/reinitialiser?token=…`. | Audit « Parcours oubli → réinitialisation » |
| Connexion sociale | Google / Facebook OAuth 2.0 (redirection + callback). Sans identifiants, l'API répond **501** avec l'aide de configuration, et la connexion e-mail reste disponible. | Audit « Connexion sociale non configurée → 501 » |
| Assistant IA | Widget « School Net IA » (`POST /api/ai/chat`). Utilise `OPENAI_API_KEY` si présente, sinon base de connaissances locale. | Audit « POST /api/ai/chat répond » |

### Configuration (variables d'environnement, jamais dans Git)

| Variable | Usage |
| --- | --- |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Assistant IA (défaut `gpt-4o-mini`) |
| `SMS_API_URL`, `SMS_API_KEY` | Envoi réel des SMS (sinon journalisation `simule`) |
| `SMTP_URL` / `RESEND_API_KEY` | Envoi des e-mails (réinitialisation, reçus) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Connexion Google |
| `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` | Connexion Facebook |
| `APP_URL` | URL publique pour les redirections OAuth |

### Limites connues

- Sur Vercel, la base SQLite vit dans `/tmp` : elle est **éphémère** et non partagée entre instances.
  Les données de démonstration sont régénérées à froid ; une base PostgreSQL managée est requise pour
  une exploitation réelle multi-utilisateurs.
- Aucune passerelle de paiement réelle n'est branchée : les encaissements sont enregistrés et
  facturés, mais le débit Mobile Money / carte reste simulé.

---

## 0 bis. Cartes scolaires & affichage du tableau de bord (novembre 2026)

**Affichage corrigé.** Sur le tableau de bord, la carte « Université & vie scolaire » et la
double carte « Séances / Vie scolaire » étaient **imbriquées dans la grille des 4 KPI**
(`grid-4`). Elles devenaient donc des colonnes de 250 px, ce qui écrasait les chiffres et
chevauchait les blocs. Elles sont désormais des sœurs de la grille : KPI sur 4 colonnes,
puis les blocs pleine largeur.

**Nouveau module — cartes d'identité scolaires :**

| Élément | Détail |
| --- | --- |
| Émission | Automatique à la création de l'élève (`card_code` unique `SNA-26-XXXXXX`), plus réémission à la demande |
| Visuel | Carte au format 85,6 × 54 mm : logo, photo (initiales), nom, classe/filière, matricule, date de naissance, validité |
| QR code | `qrcode.react`, valeur = URL de pointage (`/app/presences?scan=CODE`) donc lisible par n'importe quel téléphone |
| Code-barres | Code 128 (`jsbarcode`), compatible douchettes USB/Bluetooth |
| NFC | Web NFC : programmation d'un badge (NDEF URL) ou association d'un support existant ; lecture par identifiant de série |
| Pointage | `POST /api/cards/scan` (code, tag NFC, matricule ou URL) → présence du jour, détection du doublon, statut présent/retard |
| Impression | Feuille de style dédiée (`body.printing-card`) : seule la carte est imprimée |
| Sécurité | Réservé aux rôles direction/enseignant ; le parent reçoit 403 |

Vérifications ajoutées à l'audit (8) : liste, détail, scan QR, scan URL de badge, carte inconnue,
signature manuelle, association NFC + réémission, contrôle d'accès parent → **114/114** (dont 20
vérifications dédiées à la plateforme : inscription, essai, blocage, RBAC, newsletter, IA).

---

## 1. Méthode

| Étape | Outil | Résultat |
| --- | --- | --- |
| Typage de l'interface | `npm run typecheck` (TypeScript strict) | ✅ 0 erreur |
| Compilation production | `npm run build` (Vite) | ✅ 1,1 s |
| Rendu de toutes les pages | `node scripts/smoke.mjs` | ✅ 25/25 pages, avec contrôle du contenu attendu |
| Recette fonctionnelle de l'API | `npm run audit` | ✅ **114/114 vérifications** |
| API simulée de la démo statique | `node scripts/test-demo-mock.mjs` | ✅ 35 routes |
| Déploiement serverless | Vercel (production) | ✅ `READY` / `PROMOTED` |

La recette API (`scripts/audit.mjs`) crée réellement des données, les modifie, les supprime et
nettoie derrière elle. Elle couvre les trois rôles (direction, enseignant, parent) et vérifie
les refus attendus (401, 403, 404, 409, 429, validation 400).

---

## 2. Couverture fonctionnelle vérifiée

- **Authentification** — connexion, mauvais mot de passe, `/me`, profil, changement de mot de
  passe, déconnexion (cookie invalidé), limitation à 8 tentatives / 5 min.
- **Tableau de bord** — indicateurs, séries de revenus, activité, échéances, prochains cours,
  présences du jour, annonces ; rendu distinct pour les trois rôles.
- **Élèves & étudiants** — liste filtrable (recherche, classe, statut, profil école/université),
  fiche détaillée (paiements, notes, moyennes), création, modification, suppression, portée
  parent (chaque parent ne voit que ses enfants).
- **Classes** — CRUD complet, effectif et taux de remplissage, blocage de suppression si la
  classe accueille encore des élèves.
- **Enseignants** — CRUD complet, blocage si l'enseignant est titulaire d'une classe.
- **Inscriptions** — dossier → décision → conversion en élève (matricule généré, frais
  d'inscription créés), contrôle des places disponibles, suppression.
- **Paiements** — enregistrement, modification de statut, suppression, totaux et répartition,
  portée parent.
- **Résultats** — saisie et modification des notes (0–20, coefficients), moyennes pondérées,
  classement, taux de réussite, **bulletin imprimable**.
- **Cours en ligne** — CRUD, publication/brouillon/archive, accès enseignant.
- **Annonces** — CRUD (direction), lecture selon l'audience et le rôle.
- **Université** — facultés, filières (Licence → Doctorat), unités d'enseignement (crédits,
  semestres, volumes horaires), cohérence de la maquette.
- **Emploi du temps** — séances par jour, salle, enseignant ; **détection des conflits**.
- **Bibliothèque** — catalogue, prêts, retours, stock d'exemplaires, retards.
- **Présences** — pointage individuel et en masse, historique.
- **Paramètres** — profil, sécurité, à propos.
- **Robustesse** — route API inconnue → 404 JSON, identifiant inexistant → 404 (jamais 500),
  JSON malformé → 400, écran de reprise en cas d'erreur de rendu.

---

## 3. Anomalies trouvées et corrigées

| # | Constat | Impact | Correction |
| --- | --- | --- | --- |
| 1 | Aucun contrôle des doubles réservations dans l'emploi du temps | Deux cours pouvaient être programmés pour la même classe, le même professeur ou la même salle au même moment | `ensureNoConflict()` : chevauchement horaire calculé en minutes, sur classe, filière, enseignant **et** salle, à la création comme à la modification ; réponse `409` avec un message nommant le conflit |
| 2 | Supprimer un élève effaçait **en cascade** ses paiements, notes, présences et emprunts | Perte silencieuse de l'historique financier et pédagogique | Suppression refusée (`409`) dès qu'un historique existe, avec la liste des éléments concernés et l'invitation à archiver la fiche (statut « Parti ») |
| 3 | Aucun filet de sécurité en cas d'erreur de rendu React | Page blanche pour l'utilisateur | `ErrorBoundary` global avec écran de reprise (retour au tableau de bord / rechargement) |
| 4 | Le titre de l'onglet restait identique sur toutes les pages | Onglets et favoris indiscernables | Titre contextuel par route (`Élèves · School Net Academy`, …) |
| 5 | Aucun export de données | Impossible de travailler hors ligne ou de transmettre une liste au secrétariat | Export CSV sur 6 modules (voir §4) |
| 6 | Pas de bulletin de notes | Un établissement ne pouvait pas remettre de document officiel | Bulletin imprimable / PDF par élève (voir §4) |

---

## 4. Fonctionnalités ajoutées

### Bulletins de notes imprimables — page *Résultats*
Bouton **Bulletin** sur chaque ligne : en-tête de l'établissement, année scolaire, trimestre,
identité de l'élève, tableau matières / notes / coefficients / points / appréciations, total,
moyenne générale, rang, mention, décision (Admis / Doit progresser), zones de signature.
Feuille de style `@media print` dédiée : barre latérale, barre supérieure, boutons et fond
sont masqués — l'impression (ou « Enregistrer en PDF ») ne contient que le bulletin.

### Exports CSV
Élèves, paiements, enseignants, résultats, présences, bibliothèque (catalogue et prêts).
Format compatible Excel / LibreOffice français : séparateur `;`, BOM UTF-8, montants bruts,
dates ISO, libellés traduits. Le nom de fichier est horodaté (`eleves-2026-11-01.csv`).

### Emploi du temps protégé
Toute création ou déplacement de séance qui chevauche une séance existante est refusé avec
un message explicite, par exemple :
> *Lundi de 09:45 à 11:45 : L'enseignant Hervé Bouanga a déjà « Droit des obligations ».
> Choisissez un autre créneau, une autre salle ou un autre intervenant.*

### Historique protégé
La suppression d'un élève est refusée dès que la fiche porte des paiements, notes, présences
ou emprunts, avec la liste des éléments et la recommandation d'archivage.

### Finitions d'interface
Titre d'onglet par page, écran de reprise global, colonne d'actions homogène dans les résultats,
reconstruction de la démo statique (`docs/`) avec les nouvelles fonctionnalités.

---

## 5. Qualité / non-régression

```bash
npm run check   # typecheck + build + rendu des 25 pages + 114 vérifications API
```

- `scripts/audit.mjs` — **nouveau** : recette fonctionnelle de bout en bout.
- `scripts/smoke.mjs` — enrichi : chaque page doit désormais contenir ses éléments
  fonctionnels clés (boutons d'action, exports, bulletin…), pas seulement « s'afficher ».

---

## 6. Limites connues (assumées)

1. **Hébergement Vercel serverless** — le disque est éphémère et propre à chaque instance :
   la base SQLite est recréée avec les données de démonstration à chaque démarrage à froid,
   et les écritures ne sont pas garanties d'une instance à l'autre. Pour des données
   durables : base managée (Turso/libSQL, Neon/Postgres, Supabase) ou déploiement Node avec
   volume (`render.yaml`, `Dockerfile` fournis).
2. **Pas de messagerie sortante** — les relances d'impayés et notifications sont affichées dans
   l'application ; l'envoi d'e-mails/SMS nécessiterait un fournisseur externe.
3. **Pas de paiement en ligne** — Mobile Money / carte sont enregistrés comme moyens de
   paiement, sans passerelle de règlement.
4. **Un seul établissement par instance** — le multi-tenant (plusieurs écoles dans un même
   déploiement) demanderait une couche de scoping supplémentaire.
5. **Démo statique (`docs/`)** — simulée dans le navigateur, les écritures sont réinitialisées
   au rechargement ; c'est un support de présentation, pas l'application complète.
