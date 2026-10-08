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
| **Fin d'année** : clôture, simulation de promotion, annulation | bilan « n fiche(s) archivée(s) sur n » (jamais 0 sur 0), année active | année officielle et repère de clôture conservés ; mois payés archivés puis remis à zéro ; simulation sans écriture ; annulation qui rend l'argent ; journal de caisse intact |
| **Fiche supprimée** pendant un encaissement (autre poste) | avertissement « n'a pas été enregistrée », pas de « ✅ Versement » | aucune ligne de caisse |
| **Hors ligne** (variante PowerSync seulement) : réseau coupé pendant une saisie | note gardée à l'écran | rien en base pendant la coupure ; la note arrive au retour du réseau, une seule fois |

Pourquoi vérifier la base : plusieurs écritures de l'app annoncent le succès
avant la réponse du serveur (mode hors ligne), et une écriture refusée par la
RLS ne lève pas d'erreur (0 ligne). Seule la base dit si c'est passé. La fin
d'année l'a montré : sans ces contrôles, deux pertes de données passaient
inaperçues (fiche école écrasée, clôture sur un miroir local incomplet —
cf. docs/ecritures-sans-effet.md).

## Deux variantes : en ligne et hors ligne

Chaque parcours tourne deux fois (matrice du job `e2e`) :

- **en-ligne** : `VITE_POWERSYNC_URL` vide, écritures directes vers Supabase ;
- **hors-ligne** : comme en production, via le miroir PowerSync — service
  PowerSync **1.26.1** local, mêmes règles (`powersync-sync-rules.min.yaml`),
  réplication par `powersync_role`, jetons vérifiés par le JWKS du Supabase
  local (`e2e/powersync/powersync.yaml`).

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

- **Promotion appliquée** et **passage des admis** (seule la simulation est
  testée : appliquer déplacerait les élèves dont dépendent les autres
  scénarios).
- Portail enseignant, portail parent.

Lancement local (nécessite Docker + Supabase CLI) :

```bash
supabase start
npm run build:supabase   # avec VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY locales
npm run test:e2e         # avec E2E_ANON_KEY / E2E_SERVICE_ROLE_KEY de `supabase status`
```
