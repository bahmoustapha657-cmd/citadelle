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
8. `superadmin-extend.sql`

Puis peupler le périmètre d'écriture des enseignants (et le re-lancer quand les
affectations changent) :

```
node supabase/populate-teacher-classes.mjs
```

Et déployer l'Edge Function de gestion de comptes :

```
supabase functions deploy account-manage
```
(aucun secret à poser : `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` sont injectés d'office.)

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
- **Photos / logos** : base64 en champ — aucun stockage externe à migrer. ✅

## Identifiants de test (citadelle)

| Rôle | code / login / mdp |
|---|---|
| Direction | `citadelle` / `directeur` / `Test1234!` |
| Enseignant | `citadelle` / `fatoumatabinta.diallo` / `Test1234!` |
| Parent | `citadelle` / `parent.haidara` / `Test1234!` |
| Superadmin | `superadmin` / `superadmin` / `Test1234!` |

> ⚠️ Ce sont de vrais comptes citadelle avec un mot de passe de test connu (posés pour la recette Supabase). À **réinitialiser** avant toute mise en production de la base Supabase.

## Limites assumées / reste à faire

- **Sécurité périmètre enseignant** : ✅ durci. `teacher-security.sql` impose en RLS que l'enseignant n'écrive notes/absences que pour les élèves de **ses classes** (table `enseignant_classes`, écrite par le staff uniquement, peuplée par `populate-teacher-classes.mjs`). Un trigger empêche aussi l'auto-élévation de privilège (modif de role/école/login sur sa propre ligne `comptes`). À relancer le peuplement quand les affectations changent.
- **Encore côté serveur** (Firebase/Vercel) sous Supabase : `inscription` (publique), `transferts`, `push`, assistant IA superadmin, alertes Sentry, `superadmin-messages`. (`ecole-public-sync` est inutile : la vue `ecoles_public` / RPC `etat_ecole` couvre le besoin public ; `school-lifecycle` et `superadmin-login` sont déjà portés.)
- **Création de comptes** : pas de fusion de foyer parent, ni de génération auto de comptes à l'activation d'un rôle (création manuelle).
- **Hors-ligne** : non porté (Firestore natif → évaluer PowerSync/ElectricSQL).

## Vérification

Le réseau du preview ne permet pas le clic-à-clic React ici : tout est validé par **build** + **tests live de l'adaptateur** (requêtes réelles contre citadelle, round-trips net-zéro). Pour un test visuel, basculer `.env.local` et naviguer dans l'app.
