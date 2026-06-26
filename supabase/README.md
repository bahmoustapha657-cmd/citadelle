# EduGest sur Supabase — reconstruction parallèle

Piste **parallèle** : Firebase reste la production. On reconstruit ici, tranquillement, jusqu'à ce que la version Supabase soit complète et testée. Rien dans ce dossier n'affecte l'app Firebase.

## 1. Mettre la base debout (5 min)

1. Crée un projet sur [supabase.com](https://supabase.com) (région la plus proche : Europe ou US-East).
2. Studio → **SQL Editor** → exécute, dans l'ordre :
   - `schema.sql` (tables, index, triggers)
   - `rls.sql` (sécurité par ligne)
3. Récupère dans **Project Settings → API** :
   - `Project URL` et `anon public key` (pour le front),
   - `service_role key` (pour le back / scripts de migration — **jamais** côté client).

## 2. Authentification (choix retenu : Supabase Auth + emails synthétisés)

On reproduit le modèle actuel (pas d'email réel : code école + login + mot de passe). À la création d'un compte, on crée un utilisateur `auth.users` avec un **email synthétique** :

```
{login}.{codeEcole}@edugest.app      ex.  prof.diallo.lacitadelle@edugest.app
```

- **Connexion** (front) : `supabase.auth.signInWithPassword({ email, password })` où `email` est reconstruit depuis le code école + login saisis.
- **Création de compte** (back, service_role) : `auth.admin.createUser({ email, password })` puis insertion de la ligne `comptes` (role, ecole_id, périmètre) liée à `user_id`.
- Le **rôle et le périmètre** vivent dans `comptes` ; les politiques RLS lisent ce profil via `auth_ecole_id()` / `auth_role()`.

> Mapping direct depuis l'existant : c'est exactement ce que fait déjà `api/_lib/handlers/account-manage.js` avec Firebase Auth (`{login}.{schoolId}@edugest.app`).

## 3. Correspondance Firestore → Postgres

| Firestore (collections) | Postgres (table) | Note |
|---|---|---|
| `ecoles/{id}` + `ecoles_public` | `ecoles` + vue `ecoles_public` | — |
| `comptes` + `users` | `comptes` (+ `auth.users`) | profil lié à l'auth |
| `ensPrimaire/College/Lycee` | `enseignants` | **+ colonne `section`** |
| `elevesPrimaire/College/Lycee` | `eleves` | **+ `section`** |
| `classesPrimaire/...` | `classes` | **+ `section`** |
| `classes*_matieres` | `matieres` | **+ `section`** |
| `notesPrimaire/...` | `notes` | **+ `section`**, FK `eleve_id` |
| `eleves*_absences` | `absences` | FK `eleve_id` |
| `classes*_emplois` | `emplois` | — |
| `ens*_enseignements` | `enseignements` | — |
| `appreciations*` | `appreciations` | — |
| mensualités / reçus | `paiements` + `tarifs` | normalisé |
| `salaires` | `salaires` | `details` en JSONB |
| `historique` / `audit_securite` | `audit` | insert-only (inaltérable) |

**Gros gain** : plus de collections dupliquées par section → **une table + colonne `section`**. Les jointures SQL remplacent les multiples lectures Firestore (et tuent au passage le problème de quota : Postgres se paie au forfait, pas à la lecture).

## 4. Stratégie de migration (quand la version est prête)

1. **Schéma figé** (ce dossier) + RLS validés.
2. **Script d'export** Firestore → import Postgres (Node + Admin SDK + service_role). Ordre : `ecoles` → `comptes`/`auth.users` → `enseignants`/`classes`/`matieres` → `eleves` → `notes`/`absences`/`paiements`/`appreciations`.
3. **Couche d'accès** côté front : remplacer les appels Firestore par le client Supabase, **module par module** (idéalement derrière une petite abstraction pour basculer l'un après l'autre).
4. **Bascule** par école (ou globale) une fois tout testé.

## 5. Reste à porter (phases suivantes)

- **Filtrage fin enseignant → ses classes** : aujourd'hui assuré côté serveur (`/api/teacher-portal`). En Supabase, soit on l'ajoute en RLS (table de mapping `enseignant ↔ classes`), soit on garde une Edge Function. La RLS v1 isole déjà par **école** et **parent → ses enfants**.
- **Hors-ligne** : Firestore l'offrait nativement (brouillon/synchro qu'on a construits dessus). Sur Supabase : démarrer **online-only**, puis évaluer **PowerSync** ou **ElectricSQL** pour l'offline-first.
- **Stockage** (photos, logos) : Firebase Storage → **Supabase Storage** (buckets + politiques).
- **Fonctions serveur** : les handlers `api/_lib/handlers/*` → **Edge Functions** Supabase (ou on garde Vercel + `service_role`).
- **Temps réel** : `onSnapshot` → Supabase Realtime (à activer table par table selon le besoin).

## Fichiers

- `schema.sql` — tables, index, triggers `updated_at`.
- `rls.sql` — helpers + politiques de sécurité.
- (à venir) `migrate.mjs` — export Firestore → import Postgres.
