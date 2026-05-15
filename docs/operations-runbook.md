# Runbook Exploitation Et Incident

Objectif: fournir une base simple pour exploiter `citadelle` sans improviser en cas d'incident.

## Garanties Actuelles

- CI GitHub:
  - `npm run lint`
  - `npm run test` (tsx --test, couvre .js et .ts)
  - `npm run typecheck` (tsc --noEmit, depuis 2026-05-12)
  - `npm run build`
- Tests anti-regression securite sur:
  - normalisation et validation des identifiants
  - autorisation de session
  - transferts inter-ecoles
  - verification de signature webhook
  - regles Firestore (emulateur, 14 suites / 82 tests, job CI parallele)
- Observabilite Sentry active sur tous les handlers API via `withObservability`
  (depuis 2026-05-12). Capture cote client via `initSentry()` + ErrorBoundary.

## Verification Quotidienne

- Verifier que la derniere CI est verte
- Verifier qu'aucune erreur serveur critique recente n'apparait dans les logs
- Verifier qu'au moins un parcours de connexion fonctionne
- Verifier que les exports critiques fonctionnent encore

## Signaux A Surveiller

- Echecs de connexion anormaux
- Reponses `401` ou `403` en hausse
- Erreurs `500` sur:
  - `api/login`
  - `api/transfert`
  - `api/account-manage`
  - `suivi des paiements Mobile Money`
- Duplications ou absence de paiements apres webhook
- Echec de build ou de tests dans la CI

## Incident Auth

Symptomes:
- utilisateurs deconnectes
- impossible de se connecter
- erreur "session invalide" ou "profil introuvable"

Actions:
1. verifier les variables d'environnement Firebase et Admin
2. verifier l'existence des profils `users/{uid}`
3. verifier `api/login` et `api/account-manage`
4. verifier les derniers changements merges
5. si besoin, rollback vers le dernier commit vert

## Incident Transfert

Symptomes:
- tokens refuses alors qu'ils semblent valides
- imports d'eleves en erreur
- transfert accepte vers mauvaise section

Actions:
1. verifier le document `transferts`
2. verifier `statut`, `dateExpiration`, `schoolIdSource`
3. verifier la cible (`targetSchoolId`)
4. rejouer le cas sur l'environnement de test
5. verifier les tests de `tests/transfert.test.js`

## Incident Paiement

Symptomes:
- paiement visible chez le canal Mobile Money mais absent dans l'ecole
- paiements en double
- plan non active apres paiement

Actions:
1. verifier la signature recue dans `suivi des paiements Mobile Money`
2. verifier `le canal Mobile Money_PRIVATE_KEY`
3. verifier le document `ecoles/{schoolId}/paiements/le canal Mobile Money_{transactionId}`
4. verifier que le webhook n'a pas ete rejoue avec un payload modifie
5. verifier l'activation du plan dans `ecoles/{schoolId}`

## Incident Securite

Symptomes:
- suspicion d'escalade de privileges
- acces a une autre ecole
- compte modifie de facon inattendue

Actions immediates:
1. geler les changements de production
2. identifier les comptes concernes
3. extraire les logs et l'historique de changement
4. invalider les sessions si necessaire
5. corriger puis redelivrer seulement avec CI verte

## Rollback

Condition:
- incident confirme et pas de correctif rapide fiable

Procedure:
1. identifier le dernier commit vert
2. deployer ce commit
3. verifier connexion + recette smoke minimale
4. documenter:
   - heure
   - cause
   - impact
   - commit retire
   - commit restaure

## Observabilite Sentry

Configuration:
- DSN configurees dans les env vars Vercel:
  - `VITE_SENTRY_DSN` (frontend, expose via `import.meta.env`)
  - `SENTRY_DSN` (backend, lue par `process.env`)
- Si l'une est absente, le code passe en mode no-op et `console.error`
  remplace la capture. Pas d'erreur fatale.

Verifier que la capture fonctionne (apres rotation DSN, migration projet,
ou doute):
- **Methode recommandee** (depuis 2026-05-14): SuperAdmin -> onglet
  "Alertes Sentry" -> bouton "Tester la capture". Declenche une exception
  serveur capturee par Sentry sans crasher l'endpoint. Pas besoin d'ajouter
  ou de supprimer un fichier.
- Methode legacy: ajouter `api/sentry-test.js` temporairement, hit l'URL,
  supprimer apres validation.

Panneau "Alertes Sentry" (SuperAdmin):
- Liste les 20 dernieres issues du projet (14 derniers jours) via l'API
  Sentry. Necessite cote serveur:
  - `SENTRY_AUTH_TOKEN` (scopes: `event:read`, `project:read`)
  - `SENTRY_ORG_SLUG`
  - `SENTRY_PROJECT_SLUG`
- Affiche niveau, titre, occurrences, utilisateurs touches, derniere vue,
  lien direct vers l'issue dans le dashboard Sentry.
- Bouton "Ouvrir Sentry" pointe sur l'URL du projet.
- Tant que les env vars manquent, le panneau affiche un encart de
  configuration au lieu de la liste.

Alerte:
- Par defaut Sentry envoie un email a chaque nouvelle issue.
- Pour ajouter Slack / Telegram / Discord: Sentry dashboard ->
  Settings -> Integrations.
- Pour ajuster la verbosite: Project Settings -> Alerts.

## Sauvegarde Et Recuperation

Minimum recommande:
- export regulier Firestore
- sauvegarde des variables d'environnement
- conservation des commits deployes

En cas de recuperation:
1. restaurer les variables d'environnement
2. restaurer les donnees si necessaire
3. reconstruire l'application
4. rejouer la recette fonctionnelle courte

## Bootstrap Et Rotation Superadmin (F7)

L'endpoint `api/_lib/handlers/superadmin-login.js` accepte deux sources
de comptes super-admin :

1. Collection Firestore `superadmins` (mode normal).
2. Env var `SUPERADMIN_PASSWORD_HASH` (bootstrap / fallback), utilisee
   uniquement si la collection est vide. Login force a `superadmin`.

### Detenteur Et Stockage

- Variable stockee dans Vercel (Project Settings -> Environment Variables),
  scope `Production`. Aucun commit en clair dans le repo.
- Detenteur unique : developpeur principal. Bus factor : prevoir un coffre
  partage (ex. 1Password Family, Bitwarden organisation) pour ne pas
  perdre l'acces si le detenteur unique est indisponible.

### Generer Un Hash

Format attendu : bcrypt cost >= 10, prefixe `$2b$`.

```bash
node -e "import('bcryptjs').then(b=>b.default.hash(process.argv[1],12).then(console.log))" 'NouveauMotDePasseFort'
```

Verifier que la sortie demarre bien par `$2b$12$...`.

### Rotation Reguliere

Frequence recommandee : tous les 6 mois, ou immediatement apres :

- Depart d'un detenteur de l'env var
- Soupcon de fuite (laptop perdu, vault compromis)
- Changement d'equipe ayant acces Vercel
- Incident de securite

Procedure (1 a 5 min de coupure superadmin) :

1. Generer un nouveau hash avec la commande ci-dessus.
2. Vercel -> Settings -> Environment Variables -> `SUPERADMIN_PASSWORD_HASH`
   -> Edit, coller le nouveau hash, sauvegarder.
3. Vercel -> Deployments -> latest production -> Redeploy (pour propager
   immediatement la nouvelle valeur). Sans redeploiement, le changement
   n'est pris en compte qu'au prochain push.
4. Tester la connexion superadmin avec le nouveau mot de passe.
5. Mettre a jour le coffre partage.
6. Invalider d'eventuelles sessions superadmin en cours via
   Firebase Auth -> Users -> revoquer les refresh tokens du compte
   `superadmin@superadmin.edugest.app` si l'incident le justifie.

### Cible : Supprimer Le Fallback

Le fallback env var est un mecanisme de bootstrap. Des qu'un super-admin
existe dans la collection Firestore `superadmins`, l'env var n'est plus
lue (cf. `superadmin-login.js:62-69`). Procedure de migration :

1. Se connecter avec le mot de passe env var.
2. Creer un compte superadmin reel via le panneau SuperAdmin.
3. Verifier que le nouveau compte fonctionne (logout + login).
4. Supprimer la variable `SUPERADMIN_PASSWORD_HASH` dans Vercel et
   redeployer.
5. Confirmer que la connexion superadmin reste OK via le compte Firestore.

Apres cette migration, la rotation se fait directement dans l'UI
SuperAdmin (changer le mot de passe du compte), sans toucher aux env vars.

## Prochaine Marche Recommandee

- ~~brancher une solution centralisee de logs/alertes~~ (fait: Sentry, 2026-05-12)
- ~~ajouter des tests Firestore rules avec emulateur~~ (fait: 2026-05-05)
- ~~documenter la procedure de bootstrap / rotation `SUPERADMIN_PASSWORD_HASH`~~
  (fait: 2026-05-15, section "Bootstrap Et Rotation Superadmin (F7)" ci-dessus)
- ajouter une verification manuelle post-deploiement
- mettre en place un canal de feedback utilisateur direct (email visible,
  groupe WhatsApp, formulaire) pour ramener du signal terrain
- prevoir un acces partage ou un coffre recuperable (bus factor solo dev)

