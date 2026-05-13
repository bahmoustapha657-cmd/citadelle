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

### 2.6 Archive multi-années (champ `annee`)

Depuis 2026-05-13, les documents annuels (notes, recettes, dépenses, salaires, bons, versements, livrets) portent un champ `annee` (ex. `"2025-2026"`). Le sélecteur "Année consultée" dans Comptabilité et École permet de lire l'historique d'une année passée.

**Décision de sécurité** : l'isolation Firestore est faite **uniquement par `schoolId`**, jamais par `annee`. Les rules ne contrôlent ni le contenu du champ `annee` à l'écriture, ni la valeur passée dans un `where("annee", "==", …)` à la lecture. Le filtrage est purement applicatif (côté `useFirestore`).

**Conséquence** : un utilisateur authentifié de l'école A peut lire **toutes** les années de l'école A. Les rules garantissent uniquement qu'il ne lit jamais l'école B. C'est l'UI qui décide quelle année afficher.

**Mode archive** : quand `anneeConsultee !== anneeCourante`, l'UI désactive création/édition (`canCreate=false`, `canEdit=false`). Ce n'est PAS une garantie de sécurité — un client malveillant peut toujours écrire dans une année passée via le SDK direct. Si cela devient un risque, prévoir un check rules sur la mutabilité (ex. interdire `update` des docs où `annee != anneeCourante`).

**Tests** : suite "15. Archive multi-années" dans `firestore-rules.emulator.js` vérifie que la lecture cross-année passe et que l'isolation par schoolId reste intacte.

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

### 🟢 F2. Fallback par nom d'élève dans les portails — **DURCI 2026-05-12**

**Description initiale** : Quand un document (note, absence, message) n'a pas de `eleveId`, le filtre fallback sur `eleveNom` (nom + prénom). En cas d'homonymie inter-classes, fuite possible.

**État après audit 2026-05-12** :
- **`parent-portal.js`** : aucun fallback eleveNom côté lecture. Les notes/absences/messages sont récupérés via `getDocsByFieldValues("eleveId", studentIds)` — un document sans `eleveId` est invisible au parent.
- **`teacher-portal.js`** : `noteBelongsToTeacherScope` ET le filtre incidents acceptent désormais le fallback `eleveNom` **uniquement si** `note.classe` (ou `inc.classe`) est dans `teacherClasses`. Un homonyme inter-classes est donc filtré.
- Tests dédiés : `tests/teacher-portal-scope.test.js` (4 cas F2 : fallback OK avec classe, refus si classe hors scope, refus si classe absente, path principal eleveId inchangé).

**Risque résiduel** : si un document legacy n'a ni `eleveId` ni `classe`, il est désormais invisible (refus). Si nécessaire, lancer un script de migration pour annoter ces documents (priorité basse — fail-closed est le bon défaut).

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

### ✅ F4. Énumération de logins via `login.js` — **CORRIGÉ**

**Fichier** : `api/_lib/handlers/login.js:86-97`

**Description initiale** : Si le compte n'existe pas, retournait 401 immédiatement. Si le compte existe mais le mdp est faux, retournait 401 après ~200ms de bcrypt. Permet à un attaquant de distinguer un login valide d'un login invalide via timing.

**Correctif appliqué** :
- `api/_lib/auth-tarpit.js` introduit un `applyPasswordTarpit(password)` qui exécute un `bcrypt.compare` contre un hash factice.
- Le tarpit est appelé dans `login.js` aux deux branches d'échec rapide : compte introuvable (l.87) et hash invalide (l.95).
- Le délai constant rend les deux branches indiscernables.

### ✅ F5. `pushSubs` : pas de vérification d'identité — **CORRIGÉ**

**Fichier** : `firestore.rules:60-69, 151-163`

**Description initiale** : `allow create, update, delete: if appartientEcole(schoolId);`. Tout utilisateur d'une école pouvait créer/modifier/supprimer n'importe quelle souscription push.

**Correctif appliqué** :
- Helper `pushSubPayloadValide(uid)` vérifie `request.auth.uid == uid` et la structure du payload.
- `create` : `appartientEcole(schoolId) && pushSubPayloadValide(docId)` — le `docId` doit être l'uid de l'auteur.
- `update` : ajoute `resource.data.uid == request.auth.uid` (ne peut mettre à jour que sa propre sub).
- `delete` : restreint au propriétaire de la sub.
- Couvert par les tests émulateur (suite 10 `/pushSubs`).

### ✅ F6. Parent legacy link → lecture de toute la collection élèves — **CORRIGÉ**

**Description initiale** : Si `profile.elevesAssocies` contient une entrée sans `eleveId`, `parent-portal.js` lisait `(await elevesRef.get()).docs.map(toItem)` puis filtrait côté serveur. Coût en lectures Firestore + dépendance totale à la justesse de `filterParentStudents` pour empêcher la fuite.

**Correctif appliqué** :
- `parent-portal.js:loadParentStudents` charge uniquement via `getDocsByIds(elevesRef, explicitIds)` — pas de `elevesRef.get()` global.
- `matchesStudentLink` (`portal-data.js:70-80`) exige désormais `link.eleveId` non-vide pour matcher — un lien legacy sans `eleveId` ne ramène rien plutôt que tout.
- Migration auto au login parent via `migrateParentAccountLinks` (`parent-links-migration.js`) : résout `eleveNom + eleveClasse` → `eleveId` lors de la première connexion et persiste le résultat sur le compte.
- Tests : `tests/parent-links-migration.test.js`, `tests/portal-data.test.js`.

### 🟢 F7. `superadmin-login` : fallback env var

**Fichier** : `api/_lib/handlers/superadmin-login.js:60-64`

**Description** : Si la collection `superadmins` est vide, fallback sur `SUPERADMIN_PASSWORD_HASH` env var. Acceptable comme bootstrap, mais à documenter (qui détient cette env var, comment elle est rotée).

**Sévérité** : Information.
**Mitigation** : runbook opérationnel + rotation périodique.

### ✅ F8. `displayName` Firebase Auth non sanitizé — **CORRIGÉ 2026-05-12**

**Description initiale** : `compte.nom` était passé tel quel à `authAdmin.createUser({ displayName })`. Pas de validation de longueur ou caractères.

**Correctif appliqué** :
- Helper `sanitizeDisplayName(value, fallback)` ajouté dans `api/_lib/security.js`.
- Supprime les caractères de contrôle (`\x00-\x1F`, `\x7F`), collapse les espaces, trim, cape à 128 caractères.
- Fallback explicite quand le nom devient vide après sanitisation.
- Appliqué dans `login.js` et `superadmin-login.js` avant `authAdmin.createUser({ displayName })`.
- Tests : `tests/sanitize-display-name.test.js` (6 cas).

---

## 6. Remédiations recommandées

### Priorité 1 — Cette semaine

- [x] **F1** : Refusé pour secondaire sans matière, primaire reste permissif (titulaire). Tests dans `tests/teacher-portal-scope.test.js`. ✅ 2026-04-30
- [x] **F3 (code)** : Chemins isolés par école dans `UploadFichiers`, `storage.rules` versionné, `firebase.json` configuré. ✅ 2026-04-30
- [ ] **F3 (déploiement)** : Activer Firebase Storage en console + `firebase deploy --only storage`. **Action utilisateur.**

### Priorité 2 — Ce mois-ci

- [x] **F2** : `teacher-portal.js` durci — fallback eleveNom n'accepte que si `note.classe ∈ teacherClasses`. `parent-portal.js` n'a pas de fallback eleveNom (lecture par `eleveId` strict). ✅ 2026-05-12
- [x] **F6** : Migration auto en place via `migrateParentAccountLinks`. `parent-portal.js` n'a plus de fallback "all students" — `matchesStudentLink` exige `link.eleveId`. ✅
- [x] **F5** : Durcir `pushSubs` rules pour valider `uid == auth.uid`. ✅ via `pushSubPayloadValide` (couvert par tests émulateur).

### Priorité 3 — Trimestre

- [x] **F4** : `applyPasswordTarpit` (bcrypt factice) appliqué aux deux branches d'échec rapide dans `login.js`. ✅ (commit antérieur, doc mise à jour 2026-05-11)
- [x] Tests d'intégration des Firestore rules via emulator (`@firebase/rules-unit-testing`). 14 suites / 82 tests dans `tests/firestore-rules.emulator.js`, lancés via `npm run test:rules`, intégrés au CI. ✅ 2026-05-05
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
✅ Archive multi-années : isolation par `schoolId` uniquement, jamais par `annee` (cf. § 2.6).

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
