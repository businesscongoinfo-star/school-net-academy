# Rapport d'analyse & de finition — School Net Academy

**Date :** 1er novembre 2026 · **Commit audité :** `622d148` · **Production :** <https://school-net-academy.vercel.app>

Ce document trace la recette complète de la plateforme : ce qui a été vérifié, ce qui a été
corrigé, ce qui a été ajouté, et ce qui reste volontairement hors périmètre.

---

## 1. Méthode

| Étape | Outil | Résultat |
| --- | --- | --- |
| Typage de l'interface | `npm run typecheck` (TypeScript strict) | ✅ 0 erreur |
| Compilation production | `npm run build` (Vite) | ✅ 1,1 s |
| Rendu de toutes les pages | `node scripts/smoke.mjs` | ✅ 19/19 pages, avec contrôle du contenu attendu |
| Recette fonctionnelle de l'API | `npm run audit` | ✅ **87/87 vérifications** |
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
npm run check   # typecheck + build + rendu des 19 pages + 87 vérifications API
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
