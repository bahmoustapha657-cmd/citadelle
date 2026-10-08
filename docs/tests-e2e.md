# Tests de bout en bout (e2e)

Le **vrai front** (build de production) est piloté dans Chromium par
Playwright, contre un **Supabase local complet** démarré dans GitHub Actions
(toutes les migrations, auth, API, Edge Functions). Jamais contre la
production : `e2e/donnees.js` refuse toute autre base que `127.0.0.1` /
`localhost`.

## Ce qui est couvert

| Parcours | Vérifié à l'écran | Vérifié en base |
|---|---|---|
| Connexion direction / mauvais mot de passe | connecté, nom de l'école ; message d'erreur | — |
| **Encaissement** d'une mensualité (comptable) | montant proposé, confirmation (montant + élève), reçu, mois « payé » | 1 mois « Payé » sur la fiche, 1 ligne au journal `paiements` du bon montant, l'autre élève intact |
| **Saisie de notes** (grille du collège) | « n note(s) enregistrée(s) » | chaque note pour le bon élève et la bonne matière, section, période, année |
| **Bulletin** | moyenne générale pondérée par les coefficients (13,43 et 12,43) | — |

Pourquoi vérifier la base : plusieurs écritures de l'app annoncent le succès
avant la réponse du serveur (mode hors ligne), et une écriture refusée par la
RLS ne lève pas toujours d'erreur. Seule la base dit si c'est passé.

## Le jeu de données

Créé à chaque run, par les **mêmes chemins que la production** :
Edge Function `inscription` (école + direction), `account-manage` (compte
comptable), puis classe, matières, tarif et élèves écrits **par la
direction, sous RLS**, sous la forme exacte que produit l'app (`toRow`).

## Dans la CI

Job **`e2e`** à chaque push et PR. Il est **bloquant pour le déploiement** :
si un parcours casse, ni les migrations ni le front ne partent en
production. En cas d'échec, l'artefact `rapport-e2e` contient le rapport,
les captures d'écran et les traces Playwright (données de test uniquement).

## Ajouter un scénario

`e2e/tests/<parcours>.spec.js`. Règles :

- cibler par **ce que voit l'utilisateur** (libellés, rôles), pas par CSS ;
- vérifier **l'écran ET la base** pour toute écriture qui compte ;
- une boîte `confirm()` de l'app se traite explicitement
  (`page.once("dialog", …)`) : Playwright la refuse par défaut ;
- les scénarios partagent une école et s'enchaînent (1 seul worker) : pas
  de dépendance cachée entre fichiers, ou bien `test.describe.configure({ mode: "serial" })`.

## Pas encore couvert

- **Chemin hors ligne (PowerSync)** : la CI tourne en mode « en ligne »
  (`VITE_POWERSYNC_URL` vide). La production écrit via le miroir local
  PowerSync — prochaine étape : service PowerSync dans la CI.
- **Fin d'année** (clôture, promotion, passage des admis) : la clôture
  dépend de la date du jour, à piloter avec l'horloge de Playwright.

Lancement local (nécessite Docker + Supabase CLI) :

```bash
supabase start
npm run build:supabase   # avec VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY locales
npm run test:e2e         # avec E2E_ANON_KEY / E2E_SERVICE_ROLE_KEY de `supabase status`
```
