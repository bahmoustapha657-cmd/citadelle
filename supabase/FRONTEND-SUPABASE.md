# EduGest sur Supabase — état du branchement frontend

Reconstruction **parallèle** : le frontend React peut tourner sur **Firebase** (défaut, prod) ou **Supabase**, via un simple interrupteur. Rien n'est imposé en prod.

## Activer le mode Supabase (local)

Dans `.env.local`, puis redémarrer `npm run dev` :

```
VITE_BACKEND=supabase
VITE_SUPABASE_URL=https://pfzanslrcowkjjipuzpa.supabase.co
VITE_SUPABASE_ANON_KEY=<clé anon publique>
```

Défaut sans ces variables = `firebase` (prod intacte). Interrupteur : `src/backend.js`.

## Pré-requis base de données (SQL Editor, dans l'ordre)

1. `schema.sql` · 2. `rls.sql` · 3. `superadmin.sql` · 4. `comptabilite.sql` ·
5. `modules.sql` · 6. `parent-access.sql` · 7. `teacher-security.sql` ·
8. `superadmin-extend.sql` · 9. `transferts.sql` · 10. `push.sql` ·
11. `superadmin-messages.sql`

Puis peupler le périmètre d'écriture des enseignants (et le re-lancer quand les
affectations changent) :

```
node supabase/populate-teacher-classes.mjs
```

Et déployer les Edge Functions (aucun secret à poser : `SUPABASE_URL` /
`SUPABASE_SERVICE_ROLE_KEY` sont injectés d'office) :

```
supabase functions deploy account-manage    # création/reset de comptes (privilège admin)
supabase functions deploy inscription        # auto-enregistrement public d'une école
supabase functions deploy push               # envoi de notifications push
supabase secrets set VAPID_PUBLIC_KEY="..." VAPID_PRIVATE_KEY="..." VAPID_SUBJECT="mailto:contact@edugest.app"
supabase functions deploy ia                  # assistant IA (appréciations + superadmin)
supabase secrets set ANTHROPIC_API_KEY="sk-ant-..."
```

## Déploiement du frontend Supabase — Cloudflare Pages

Le build Supabase est hébergé sur **Cloudflare Pages** (projet `edugest`,
gratuit, usage commercial autorisé) : **https://edugest-gn.pages.dev**. Aucun
serveur applicatif : le backend est Supabase (RLS + Edge Functions).

```bash
npm run deploy:pages       # = vite build --mode supabase (lit .env.supabase)
                           #   + wrangler pages deploy dist
```

- Pré-requis une seule fois : `npx wrangler login` (compte Cloudflare).
- `.env.supabase` (commité — la clé anon est publique) fournit `VITE_BACKEND`,
  `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` au mode `supabase` de Vite.
- `public/_headers` porte les en-têtes de sécurité (équivalent Cloudflare des
  headers de `vercel.json`) avec une CSP qui autorise `*.supabase.co` —
  la CSP Vercel, elle, ne l'autorise PAS (Firebase only).
- Le déploiement est MANUEL (pas de build à chaque push) : relancer la
  commande après chaque évolution à publier.

## Architecture de la couche d'accès (`src/backend/`)

| Fichier | Rôle |
|---|---|
| `backend.js` | Interrupteur `VITE_BACKEND` + `emailFor` (domaine interne `@edugest.app`) |
| `supabaseClient.js` | Client Supabase (clé anon) |
| `auth-supabase.js` | Connexion (école/superadmin), session, déconnexion |
| `collection-map.js` | Firestore (collections par section) → tables Supabase unifiées ; transformateurs snake_case↔camelCase (2 sens) |
| `data-supabase.js` | Lecture/écriture générique des collections (CRUD) |
| `parent-portal-supabase.js` | Portail parent (RLS = ses enfants) |
| `teacher-portal-supabase.js` + `teacher-scope.js` | Portail enseignant (périmètre = ses classes) |
| `account-manage-supabase.js` | Création/reset (Edge Function) + mdp perso + role_settings |

## Couverture — ce qui tourne sur Supabase

Vérifié en live contre l'école **citadelle** :

- **Auth** : connexion, session, déconnexion (toutes rôles). ✅
- **Académique (lecture+écriture)** : élèves, notes, classes, enseignants, absences, matières, emplois, enseignements, appréciations, tarifs, salaires. ✅
- **Comptabilité** : recettes, dépenses, versements, bons, personnel. ✅
- **Vie scolaire / communication** : messages, annonces, documents, examens, livrets, honneurs, membres, événements, journal (historique). ✅
- **Portail parent** : enfants, notes, absences, annonces, messages (+ envoi). ✅
- **Portail enseignant** : périmètre scopé, saisie de notes, incidents. ✅
- **Comptes** : création (parent/enseignant/staff), reset mot de passe, changement perso, réglages de rôles. ✅ (logique vérifiée ; déployer l'Edge Function)
- **Superadmin** : connexion + gestion multi-écoles (liste + stats, plans, cycle de vie create/deactivate/reactivate/delete) via bypass RLS. ✅ (demandes de plan → `superadmin-extend.sql`)
- **Inscription** : auto-enregistrement public d'une école + compte direction (Edge Function `inscription`). ✅
- **Transferts** : transfert d'élève entre écoles par token (table `transferts` + RPC). ✅ (→ `transferts.sql`)
- **Push** : abonnement (table `push_subs`) + envoi (Edge Function `push` / VAPID). ⚠️ envoi réel non vérifié ici (nécessite un navigateur abonné).
- **Diffusion superadmin** : messages superadmin → écoles ciblées + accusés de lecture (tables `superadmin_messages` / `superadmin_message_lectures`). ✅ (→ `superadmin-messages.sql`)
- **Assistant IA** : génération d'appréciation de bulletin (primaire/secondaire) + assistant superadmin, via Edge Function `ia` (Anthropic `claude-opus-4-8`). Marche aussi en prod Firebase via `/api/ia`. ⚠️ génération réelle non vérifiée ici (clé Anthropic requise).
- **Photos / logos** : base64 en champ — aucun stockage externe à migrer. ✅

## Identifiants de test (citadelle)

| Rôle | code / login / mdp |
|---|---|
| Direction | `citadelle` / `directeur` / `Test1234!` |
| Enseignant | `citadelle` / `fatoumatabinta.diallo` / `Test1234!` |
| Parent | `citadelle` / `parent.haidara` / `Test1234!` |
| Superadmin | `superadmin` / `superadmin` / `Test1234!` |

> ⚠️ Ce sont de vrais comptes citadelle avec un mot de passe de test connu (posés pour la recette Supabase). À **réinitialiser** avant toute mise en production de la base Supabase.

## Mode hors ligne (PowerSync) — vague 1, périmètre académique

Contrepartie du cache local Firestore (`persistentLocalCache`) pour la branche
Supabase : `eleves`, `classes`, `matieres`, `enseignants`, `emplois`,
`enseignements`, `notes`, `absences`, `appreciations` sont mises en miroir
localement (SQLite via [PowerSync](https://www.powersync.com)) — lecture/
écriture instantanées hors ligne, remontée automatique vers Supabase (RLS
toujours seule autorité d'écriture) au retour réseau.

- **Code** : `src/backend/powersync/` (schema, connector, client, local-data) ;
  branchement transparent dans `src/backend/data-supabase.js` (mêmes
  signatures — aucun écran à modifier). Cycle de vie connecté à l'auth dans
  `src/hooks/use-auth-session.js` ; badge « N en attente de synchronisation »
  dans `AppHeader.jsx` (`src/hooks/use-powersync-status.js`).
- **Reste en ligne seule pour l'instant** (pas une régression, juste pas
  encore fait) : portail parent (`parent-portal-supabase.js` — appels directs,
  hors du point de levier générique), comptabilité, superadmin, transferts,
  Edge Functions (`account-manage`/`inscription`/`push`/`ia`).
- **⚠️ Étapes d'infra restant à faire manuellement (dashboard, hors de portée
  d'un agent de code) avant que le hors-ligne fonctionne réellement** :
  1. Exécuter `supabase/powersync-scope.sql` (après `teacher-security.sql`) :
     duplique `user_id` sur `enseignant_classes` — nécessaire car les
     Parameter Queries PowerSync ne supportent qu'UNE table (pas de JOIN).
  2. Créer un rôle Postgres dédié (`powersync_role`, `REPLICATION BYPASSRLS`,
     lecture sur tout le schéma) et une instance **PowerSync Cloud** connectée
     au projet Supabase (connexion **directe**, pas le pooler) — voir le
     guide officiel « PowerSync + Supabase ».
  3. Coller les **Sync Rules** de `supabase/powersync-sync-rules.yaml` dans le
     dashboard PowerSync (onglet Sync Streams), Validate puis Deploy.
  4. Renseigner `VITE_POWERSYNC_URL` dans `.env.supabase` (et `.env.local`
     pour tester en dev) avec l'URL de l'instance.
  5. `npm install` (ajoute `@powersync/web` + `@journeyapps/wa-sqlite`).
  Tant que `VITE_POWERSYNC_URL` est vide, le hors-ligne est simplement
  désactivé — le reste de l'app Supabase tourne normalement (comportement
  actuel inchangé, zéro risque de régression).
- **Vérification** : recette live (comme les autres tranches) — portail
  enseignant, couper le réseau (DevTools → Offline), saisir des notes, les
  voir instantanément, reconnecter, vérifier la remontée dans Supabase Studio.
- **Vagues suivantes** (non commencées) : portail parent, comptabilité, reste
  admin/superadmin (probablement en ligne seule en permanence — agrégation
  multi-écoles incompatible avec un miroir local par école).

## Limites assumées / reste à faire

- **Sécurité périmètre enseignant** : ✅ durci. `teacher-security.sql` impose en RLS que l'enseignant n'écrive notes/absences que pour les élèves de **ses classes** (table `enseignant_classes`, écrite par le staff uniquement, peuplée par `populate-teacher-classes.mjs`). Un trigger empêche aussi l'auto-élévation de privilège (modif de role/école/login sur sa propre ligne `comptes`). À relancer le peuplement quand les affectations changent.
- **Encore côté serveur** (Firebase/Vercel) sous Supabase : assistant IA superadmin (clé Anthropic), alertes Sentry (API externe). (Portés : school-lifecycle, superadmin-login, inscription, transferts, push, superadmin-messages ; `ecole-public-sync` inutile.)
- **Création de comptes** : pas de fusion de foyer parent, ni de génération auto de comptes à l'activation d'un rôle (création manuelle).
- **Hors-ligne** : vague 1 (périmètre académique) codée — voir section dédiée ci-dessus ; infra PowerSync à finaliser côté dashboard avant activation réelle.

## Vérification

Le réseau du preview ne permet pas le clic-à-clic React ici : tout est validé par **build** + **tests live de l'adaptateur** (requêtes réelles contre citadelle, round-trips net-zéro). Pour un test visuel, basculer `.env.local` et naviguer dans l'app.
