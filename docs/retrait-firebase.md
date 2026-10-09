# Retrait de Firebase (octobre 2026)

Depuis la migration, la production tourne entièrement sur Supabase. Le code
gardait pourtant un double chemin Firebase/Supabase (interrupteur
`VITE_BACKEND`), une API Vercel (`api/`), des Cloud Functions (`functions/`)
et les règles Firestore. Tout cela est retiré.

## Pourquoi

- **Poids** : chaque ouverture de l'app téléchargeait `firebase-vendor`
  (502 Ko, 148 Ko compressés) sans s'en servir — sensible sur les réseaux
  lents. Il n'est plus dans le bundle.
- **Pièges** : plusieurs écrans visaient encore Firebase ou l'API Vercel en
  production, en silence. Ce fut le cas de l'année lue dans un vieux document
  Firestore, des photos envoyées vers Firebase Storage, de l'onglet « Alertes
  Sentry » (fonction Vercel disparue), des annonces du portail public et de
  l'attente d'activation d'un abonnement. Avec le code Firebase supprimé, ce
  type de régression n'est plus possible.
- **Sécurité** : 348 paquets npm en moins (firebase, firebase-admin,
  firebase-functions…), donc moins de surface et d'alertes de dépendances.

## Ce qui a été retiré

- `src/firebase*.js`, `src/firestore-safe.ts`, `src/apiClient.js`,
  l'interrupteur `isSupabase` (45 fichiers ramenés au seul chemin Supabase).
- `api/` (API Vercel) et ses tests, `functions/` (Cloud Functions).
- `firebase.json`, `.firebaserc`, `firestore.rules`,
  `firestore.indexes.json`, `storage.rules`, test des règles (émulateur).
- Scripts de migration Firestore → Supabase (`supabase/migrate*.mjs`,
  `etat-firebase.mjs`, `verrouiller-firebase.mjs`) et scripts racine
  (`create-superadmin.mjs`, `delete-school.mjs`, `migrate-*.mjs`,
  `seed-legal-profile.mjs`).
- Workflow « Sauvegarde Firestore » (données figées depuis la bascule).
- Domaines Firebase de la CSP (`connect-src`) et routes Firebase du service
  worker. Avant ce retrait, une vérification en base a montré qu'aucune
  photo ni aucun logo ne pointe encore vers Firebase Storage : 16 photos et
  5 logos sont sur Supabase, 0 sur Firebase.

## Ce qui change à l'écran

- **Super-admin** : l'onglet « Alertes Sentry » disparaît (il n'affichait
  plus qu'une erreur). Le tableau de bord Sentry reste accessible
  directement. Les boutons « Sync écoles publiques » et « Migrer année
  legacy » (déjà masqués) disparaissent aussi.
- **Comptes & Postes** : la carte « Configuration des rôles » (Firebase
  seulement, déjà invisible) est supprimée ; les postes flexibles restent.
- **Portail public d'une école** : annonces lues par la RPC
  `annonces_publiques` (avant : Firestore).
- **Demande d'abonnement** : l'activation par le super-admin est détectée
  sur la fiche école, suivie en temps réel.
- Le bandeau « EduGest a déménagé » (ancienne adresse Firebase) est retiré.
- Le service worker vide l'ancien cache `edugest-data-*`, qui gardait les
  réponses de l'API Vercel.

## Le projet Firebase `citadelle-school`

Il existe toujours, données gelées (lecture seule). Le supprimer est une
décision à part. Avant de le faire :

1. garder un dernier export Firestore (les exports quotidiens déjà faits
   sont dans le bucket Cloud Storage du projet) ;
2. supprimer ensuite le secret GitHub `GCP_SA_KEY`, devenu inutile.

## Retrouver l'ancien code

Dernier commit de master qui contient tout Firebase : `fb503d4`.

```bash
git show fb503d4:supabase/migrate.mjs
```

Une reprise de données depuis Firestore (par exemple la section des bons
migrés sans section) se fait en restaurant le script et en réinstallant
`firebase-admin` le temps de l'opération, hors de master.
