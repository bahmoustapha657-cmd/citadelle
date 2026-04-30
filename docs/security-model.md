# Modèle de sécurité EduGest

> Date d'audit : 2026-04-30
> Périmètre : `firestore.rules`, `api/_lib/handlers/*.js`, `api/_lib/security.js`
> Référence complémentaire : [security-architecture.md](./security-architecture.md)

## Sommaire

1. [Modèle de menace](#1-modèle-de-menace)
2. [Mécanismes de défense en place](#2-mécanismes-de-défense-en-place)
3. [Matrice rôle × ressource × action](#3-matrice-rôle--ressource--action)
4. [Endpoints API — résumé des contrôles](#4-endpoints-api--résumé-des-contrôles)
5. [Findings de l'audit](#5-findings-de-laudit)
6. [Remédiations recommandées](#6-remédiations-recommandées)
7. [Points vérifiés OK](#7-points-vérifiés-ok)

---

## 1. Modèle de menace

### Acteurs

| Acteur | Capacité initiale | Motivation typique |
|---|---|---|
| Visiteur anonyme | Aucune session | Lire les pages publiques, créer une école (rate-limité) |
| Parent | Token Firebase, schoolId fixe | Consulter les notes/absences de SES enfants, envoyer un message |
| Enseignant | Token Firebase, schoolId fixe | Consulter et noter SES classes/matières |
| Comptable | Token Firebase, schoolId fixe | Gérer recettes/dépenses/salaires de SON école |
| Primaire / College | Token Firebase, schoolId fixe | Gérer la pédagogie de SA section |
| Admin | Token Firebase, schoolId fixe | Gestion des accès (mdp parents/enseignants), lecture seule du reste |
| Direction | Token Firebase, schoolId fixe | Pouvoir total sur SON école |
| Superadmin | Token Firebase superadmin | Pouvoir total multi-écoles |

### Menaces principales

1. **Élévation de privilèges intra-école** — un rôle inférieur (admin, comptable) accède aux capacités d'un rôle supérieur. *Exemple : admin réinitialise le mdp comptable et se connecte avec.* **Adressé le 2026-04-30 (commits e06545d, 04e288a).**
2. **Fuite inter-écoles** — un utilisateur de l'école A lit/écrit des données de l'école B.
3. **Fuite intra-école** — un parent voit les notes d'un enfant qui n'est pas le sien ; un enseignant voit les notes d'une matière qui n'est pas la sienne.
4. **Manipulation de données financières** — un acteur modifie un montant de paie, mensualité, ou paiement.
5. **Brute force / énumération** — attaque par essais répétés sur les login.
6. **Bypass de l'UI** — un utilisateur authentifié contourne l'UI via la console Firebase ou un client SDK direct pour exécuter des opérations refusées par l'interface.

---

## 2. Mécanismes de défense en place

### 2.1 Authentification

- **Firebase Auth** comme source unique de vérité d'identité.
- `verifyIdToken()` côté API à chaque requête (`requireSession` dans `api/_lib/security.js:249`).
- **Hashes bcrypt** (rounds = 10) pour les mdp dans `comptes`. Le mdp clair n'est jamais stocké.
- **Custom claims** `{role, schoolId}` posés à chaque login. Synchronisés sur le profil `users/{uid}`.

### 2.2 Autorisation

- **Source de vérité serveur** : `users/{uid}` (write `false` côté client). Le rôle est toujours écrit par l'API via Admin SDK.
- **Profil utilisateur** comparé au token : `validateSessionProfile` vérifie `role ∈ rolesAttendus` ET `schoolId == schoolIdRequis`.
- **Firestore Rules durcies** : `comptes/*` en `write: false` côté client (uniquement via API Admin SDK qui contourne les rules).
- **Séparation lecture/écriture** : `backOfficeRoles()` (lecture) vs `backOfficeWriteRoles()` (écriture, sans admin) ; idem `pedagogieRoles()` vs `pedagogieWriteRoles()`.

### 2.3 Rate limiting

| Endpoint | Limite | Fenêtre | Clé |
|---|---|---|---|
| `login` | 10 | 15 min | `ip + schoolId + login` |
| `inscription` | 5 | 24 h | `ip` |
| `superadmin-login` | 5 | 1 h | `ip + login` |

Implémentation : transaction Firestore atomique sur `_rateLimits/{scope}_{hash}_{bucket}` (`api/_lib/security.js:166`).

### 2.4 CORS

- `ALLOWED_ORIGIN` env var en production.
- Same-origin auto-autorisé via `inferRequestOrigin`.
- Refus 403 si origine non listée hors same-origin.

### 2.5 Audit log

- Collection `/ecoles/{id}/audit_securite` (depuis 2026-04-30).
- `reset_password` et `sync_role_settings` y écrivent automatiquement.
- Lecture réservée à `direction` et `superadmin` (l'admin ne peut pas effacer ses traces).
- Écriture côté client : `false` (seul l'API y écrit via Admin SDK).

---

## 3. Matrice rôle × ressource × action

> Légende : ✅ autorisé · 👁 lecture seule · ❌ refusé · 🔒 via API serveur uniquement

### 3.1 Collections sous `/ecoles/{schoolId}/`

| Collection | parent | enseignant | comptable | primaire | college | admin | direction |
|---|---|---|---|---|---|---|---|
| `comptes` | ❌ | ❌ | ❌ | ❌ | ❌ | 👁 | 👁 |
| `audit_securite` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | 👁 |
| `recettes/depenses/salaires/bons` | ❌ | ❌ | ✅ | ✅ | ✅ | 👁 | ✅ |
| `elevesPrimaire/Lycee/College` | ❌ | ❌ | ✅ | ✅ | ✅ | 👁 | ✅ |
| `classesPrimaire/Lycee/College` | ❌ | ❌ | ✅ | ✅ | ✅ | 👁 | ✅ |
| `ensPrimaire/Lycee/College` | ❌ | ❌ | ✅ | ✅ | ✅ | 👁 | ✅ |
| `notesPrimaire` | ❌ | 🔒 | ❌ | ✅ | ❌ | 👁 | ✅ |
| `notesCollege/Lycee` | ❌ | 🔒 | ❌ | ❌ | ✅ | 👁 | ✅ |
| `*_absences` | ❌ | 🔒 | ❌ | (selon section) | (selon section) | 👁 | ✅ |
| `*_emplois`, `*_matieres`, `*_enseignements` | ❌ | ❌ | ✅ | ✅ | ✅ | 👁 | ✅ |
| `messages` | 🔒 (création) | ❌ | ✅ | ✅ | ✅ | 👁 | ✅ |
| `historique` | ❌ | ❌ | ✅ | ✅ | ✅ | 👁 | ✅ |
| `annonces`, `honneurs` | 👁 (public) | 👁 (public) | 👁 | ✅ | ✅ | 👁 | ✅ |
| `paiements` | ❌ | ❌ | 👁 | ❌ | ❌ | 👁 | 👁 |
| `pushSubs` | ✅ (sa souscription) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `demandes_plan` | ❌ | ❌ | ✅ | ❌ | ❌ | 👁 | ✅ |

Note : 🔒 sur `notes*` pour enseignant = via `teacher-portal` API, jamais en direct.

### 3.2 Collections racine

| Ressource | Lecture | Écriture |
|---|---|---|
| `/ecoles/{schoolId}` | tout user de l'école + superadmin | direction + superadmin (sauf champs plan : superadmin only) |
| `/ecoles_public/{schoolId}` | public | aucun (sync via API) |
| `/users/{uid}` | l'utilisateur lui-même | aucun (sync via API) |
| `/superadmins` | aucun | aucun |
| `/config/{docId}` | public | superadmin |
| `/transferts` | aucun | aucun |

---

## 4. Endpoints API — résumé des contrôles

| Endpoint | Auth | Rate-limited | Validation rôle |
|---|---|---|---|
| `POST /api/login` | ❌ (génère le token) | ✅ 10/15min | bcrypt + statut Actif + rôle whitelisté |
| `POST /api/superadmin-login` | ❌ | ✅ 5/h | bcrypt + collection `superadmins` ou env var |
| `POST /api/inscription` | ❌ | ✅ 5/24h | aucun rôle (création école) |
| `POST /api/school-lifecycle` | ✅ | ❌ | `direction` (ou `superadmin` pour reactivate) + confirmation textuelle |
| `POST /api/account-manage` (create) | ✅ | ❌ | `direction` ou `admin` (mais admin limité aux rôles enseignant/parent par `canManageTargetRole`) |
| `POST /api/account-manage` (sync_role_settings) | ✅ | ❌ | `direction` uniquement (depuis 2026-04-30) |
| `POST /api/account-manage` (reset_password) | ✅ | ❌ | `direction` ou `admin` (avec restriction par `canManageTargetRole`) |
| `POST /api/account-manage` (self_password_sync) | ✅ | ❌ | tout user authentifié — change SON propre mdp |
| `GET/POST /api/parent-portal` | ✅ | ❌ | `parent` |
| `GET/POST /api/teacher-portal` | ✅ | ❌ | `enseignant` |
| `POST /api/ecole-public-sync` | ✅ | ❌ | `direction`, `admin` (sync), `superadmin` (backfill) |

---

## 5. Findings de l'audit

### ✅ F1. Enseignant sans matière → accès toutes notes de ses classes — **CORRIGÉ 2026-04-30**

**Fichier** : `api/_lib/handlers/teacher-portal.js`

**Description** : La fonction `noteBelongsToTeacherScope` filtrait par matière uniquement si `profile.matiere` est non-vide. Si l'enseignant n'avait pas de matière définie, le filtre était sauté → il voyait et pouvait modifier les notes de toutes les matières de tous les élèves de ses classes.

**Correctif appliqué** :
- `noteBelongsToTeacherScope` prend désormais la `section` en paramètre.
- **Primaire** : pas de filtre matière obligatoire (un titulaire enseigne toutes les matières de sa classe).
- **Secondaire** (college/lycee) : matière du profil **obligatoire** ; absence → refus systématique.
- L'endpoint `save_note`/`delete_note` rejette en 403 dès le départ si l'enseignant secondaire n'a pas de matière.
- Tests unitaires : `tests/teacher-portal-scope.test.js` (11 cas).

### 🔴 F2. Fallback par nom d'élève dans les portails

**Fichier** : `api/_lib/handlers/teacher-portal.js:34-37` et `parent-portal.js:60-66`

**Description** : Quand un document (note, absence, message) n'a pas de `eleveId`, le filtre fallback sur `eleveNom` (nom + prénom). En cas d'homonymie inter-classes (cas réaliste), un enseignant ou un parent peut accéder aux données d'un élève qui n'est pas dans son périmètre.

**Sévérité** : Modérée à élevée.
**Probabilité** : Faible à moyenne (dépend de la base d'élèves).

### 🟡 F3. Storage non isolé par école — **Code corrigé 2026-04-30, déploiement en attente**

**Diagnostic 2026-04-30** :
- Firebase Storage **n'est pas activé** sur le projet `citadelle-school` (vérifié : `firebase deploy --only storage` retourne "Storage has not been set up").
- Conséquence actuelle : tous les uploads (`uploadFichier`, `uploadPhotoEleve`) **échouent** en production. Les logos/bannières sont stockés en base64 dans Firestore (cf. `ParametresEcole.jsx`) — pas dans Storage.
- Mais le code Storage existe et est appelé, donc dès que Storage sera activé, le risque devient actif.

**Findings dans le code** : les chemins n'étaient pas tous isolés par schoolId.
- ✅ `ecoles/{schoolId}/photos/...` — isolé
- ❌ `enseignants/{cleEns}/...` — partagé entre toutes les écoles
- ❌ `membres/...` — partagé
- ❌ `documents/...` — partagé

**Correctif appliqué (code)** :
- `UploadFichiers` (ui.jsx) préfixe désormais tous les uploads par `ecoles/{schoolId}/{dossier}/...`.
- `storage.rules` créé et versionné : isolation stricte par école, taille max 5 MB, content-type validé, écriture refusée à l'admin et à l'enseignant (lecture seule), suppression réservée à direction + superadmin.
- `firebase.json` configuré pour pointer sur `storage.rules`.

**Action manuelle requise** :
1. Activer Firebase Storage en console : https://console.firebase.google.com/project/citadelle-school/storage → "Get Started".
2. Choisir la région (recommandation : `eur3` ou la plus proche des utilisateurs).
3. Déployer les règles : `firebase deploy --only storage`.

**Sévérité actuelle** : Faible (pas de fichiers à exposer).
**Sévérité si Storage activé sans nos rules** : Élevée.

### 🟡 F4. Énumération de logins via `login.js`

**Fichier** : `api/_lib/handlers/login.js:84-86`

**Description** : Si le compte n'existe pas, retourne 401 immédiatement. Si le compte existe mais le mdp est faux, retourne 401 après ~200ms de bcrypt. Permet à un attaquant de distinguer un login valide d'un login invalide via timing.

**Sévérité** : Faible (le rate limit limite l'exploitation).
**Mitigation possible** : exécuter un bcrypt factice quand le compte n'existe pas (tarpit constant-time).

### 🟡 F5. `pushSubs` : pas de vérification d'identité

**Fichier** : `firestore.rules:175`

**Description** : `allow create, update, delete: if appartientEcole(schoolId);`. Tout utilisateur d'une école peut créer/modifier/supprimer n'importe quelle souscription push, y compris celles d'un autre user. Risque : spoofing de subscription, suppression des subs d'un autre, spam push.

**Sévérité** : Faible à modérée.
**Mitigation** : vérifier que `request.resource.data.uid == request.auth.uid` (ou équivalent).

### 🟡 F6. Parent legacy link → lecture de toute la collection élèves

**Fichier** : `api/_lib/handlers/parent-portal.js:39-49`

**Description** : Si `profile.elevesAssocies` contient une entrée sans `eleveId`, lit `(await elevesRef.get()).docs.map(toItem)` puis filtre côté serveur. Coût en lectures Firestore + dépendance totale à la justesse de `filterParentStudents` pour empêcher la fuite.

**Sévérité** : Modérée (perf + risque latent).
**Mitigation** : migration de tous les liens legacy vers `eleveId` explicite, puis suppression de ce code path.

### 🟢 F7. `superadmin-login` : fallback env var

**Fichier** : `api/_lib/handlers/superadmin-login.js:60-64`

**Description** : Si la collection `superadmins` est vide, fallback sur `SUPERADMIN_PASSWORD_HASH` env var. Acceptable comme bootstrap, mais à documenter (qui détient cette env var, comment elle est rotée).

**Sévérité** : Information.
**Mitigation** : runbook opérationnel + rotation périodique.

### 🟢 F8. `displayName` Firebase Auth non sanitizé

**Description** : `compte.nom` est passé tel quel à `authAdmin.createUser({ displayName })`. Pas de validation de longueur ou caractères. Pas de risque de sécurité direct identifié, mais peut causer des comportements inattendus côté Auth.

**Sévérité** : Information.

---

## 6. Remédiations recommandées

### Priorité 1 — Cette semaine

- [x] **F1** : Refusé pour secondaire sans matière, primaire reste permissif (titulaire). Tests dans `tests/teacher-portal-scope.test.js`. ✅ 2026-04-30
- [x] **F3 (code)** : Chemins isolés par école dans `UploadFichiers`, `storage.rules` versionné, `firebase.json` configuré. ✅ 2026-04-30
- [ ] **F3 (déploiement)** : Activer Firebase Storage en console + `firebase deploy --only storage`. **Action utilisateur.**

### Priorité 2 — Ce mois-ci

- [ ] **F2** : Programme de migration : pour chaque collection (notes, absences, messages), s'assurer que tous les documents ont `eleveId`. Une fois la migration faite, retirer le fallback `eleveNom` dans `teacher-portal.js` et `parent-portal.js`. Test d'intégration avec deux élèves homonymes.
- [ ] **F6** : Migrer les comptes parents legacy vers `eleveIds` explicites. Suppression du fallback "all students".
- [ ] **F5** : Durcir `pushSubs` rules pour valider `uid == auth.uid`.

### Priorité 3 — Trimestre

- [ ] **F4** : Ajouter un bcrypt factice constant-time dans `login.js` quand le compte n'existe pas.
- [ ] Tests d'intégration des Firestore rules via emulator (`@firebase/rules-unit-testing`). Couvrir : isolation inter-écoles, admin write refusé, comptes immuables côté client, audit_securite invisible aux non-direction.
- [ ] **F7** : Documenter la procédure de bootstrap superadmin dans `operations-runbook.md` + rotation régulière.

### En continu

- [ ] À chaque nouvelle collection : se demander "qui peut lire/écrire et pourquoi ?" avant de l'ajouter au catch-all.
- [ ] À chaque nouveau handler API : `requireSession` + validation explicite du rôle + journaliser dans `audit_securite` si action sensible.
- [ ] Revue trimestrielle de cette matrice pour détecter les dérives.

---

## 7. Points vérifiés OK

✅ Tokens Firebase signés et vérifiés (`verifyIdToken`).
✅ Multi-tenant : `schoolId` validé dans `requireSession` et dans les rules (`appartientEcole`).
✅ Custom claims `{role, schoolId}` synchronisés à chaque login.
✅ bcrypt (rounds 10) sur tous les hashes mdp.
✅ Rate limiting sur les endpoints d'authentification.
✅ CORS configuré avec whitelist + same-origin.
✅ `comptes/*` immuable côté client depuis 2026-04-30.
✅ `users/{uid}` write `false` côté client.
✅ `audit_securite` invisible à l'admin (séparation auteur/auditeur).
✅ Reset de mdp pour les rôles système réservé à direction (depuis 2026-04-30).
✅ Configuration des rôles réservée à direction (depuis 2026-04-30).
✅ Catch-all des collections : whitelist stricte (refus implicite hors liste).

---

## Annexes

### A. Fichiers clés à connaître

| Fichier | Rôle |
|---|---|
| `firestore.rules` | Autorisations Firestore côté client |
| `api/_lib/security.js` | `requireSession`, rate limit, CORS, validations |
| `api/_lib/handlers/account-manage.js` | Création / sync rôles / reset mdp / canManageTargetRole |
| `api/_lib/handlers/login.js` | Auth standard + sync Auth/Firestore |
| `api/_lib/handlers/parent-portal.js` | Vue restreinte parent |
| `api/_lib/handlers/teacher-portal.js` | Vue restreinte enseignant + édition notes |
| `shared/role-config.js` | Définition canonique des rôles et capacités |

### B. Commandes utiles

```bash
# Déployer les rules après modification
firebase deploy --only firestore:rules

# Tester localement (à mettre en place)
firebase emulators:start --only firestore

# Lister les écoles
firebase firestore:get /ecoles
```
