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

## Prochaine Marche Recommandee

- ~~brancher une solution centralisee de logs/alertes~~ (fait: Sentry, 2026-05-12)
- ~~ajouter des tests Firestore rules avec emulateur~~ (fait: 2026-05-05)
- ajouter une verification manuelle post-deploiement
- mettre en place un canal de feedback utilisateur direct (email visible,
  groupe WhatsApp, formulaire) pour ramener du signal terrain
- documenter la procedure de bootstrap / rotation `SUPERADMIN_PASSWORD_HASH`
  (finding F7 du modele de securite)
- prevoir un acces partage ou un coffre recuperable (bus factor solo dev)

