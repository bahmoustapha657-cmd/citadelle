# Migrations SQL

## Le principe

Toute évolution de la base est un fichier **numéroté** de
`supabase/migrations/`, appliqué **une seule fois, dans l'ordre**. Plus de
script collé à la main dans l'éditeur SQL de Supabase.

- `20261008175200_baseline.sql` : schéma RÉEL de la production au
  2026-10-08 (dump du workflow « Schéma production »), + rôle PowerSync et
  Storage. Elle n'est jamais rejouée en production.
- Les anciens scripts sont archivés dans `supabase/historique/` : **ne jamais
  les rejouer** (`rls.sql` rejoué seul a rouvert une faille le 2026-09-25).

## Écrire une migration

```bash
npm run migration:nouvelle -- nom-court-de-la-modif
```

crée `supabase/migrations/<horodatage>_nom_court_de_la_modif.sql` avec un
modèle. Règles :

1. **Ne jamais modifier une migration déjà fusionnée** : en écrire une autre.
2. **Compatible avec le front encore en ligne** : le front change APRÈS la
   base. Ajouter une colonne / une policy avant de s'en servir ; ne retirer
   l'ancienne qu'une fois le nouveau front en ligne (migration suivante).
3. Préférer l'idempotent (`create or replace`, `if not exists`,
   `drop policy if exists` + `create policy`).
4. Données : toute migration qui modifie ou supprime des lignes en masse est
   d'abord vérifiée sur une école, puis validée explicitement.

## Ce que vérifie la CI

À chaque push et PR, le job **`migrations`** démarre une base Supabase vierge
(Postgres 17) dans le runner, y rejoue TOUTES les migrations dans l'ordre et
contrôle le résultat : nombre de migrations appliquées, **RLS active sur
toutes les tables publiques**, garde `comptes_guard` présente, et **garde des
encaissements** (une fiche élève qui a de l'argent au journal, sur sa fiche
ou dans une année archivée ne se supprime pas ; une école entière, si — essai
sur des données jetables, annulé à la fin). Une migration qui échoue ici ne
peut pas être fusionnée sans que ça se voie.

## Appliquer en production

Au déploiement (Actions → **CI** → Run workflow sur master), le job
**`migrations-production`** applique les migrations en attente à la
production (`supabase db push`), **puis** le front est publié. Garde-fous :

- refus net si la baseline n'est pas marquée « déjà appliquée » en
  production (sinon elle serait rejouée) ;
- retour arrière (« Re-run » d'un ancien déploiement) : aucune migration
  annulée, front seul ;
- un seul passage à la fois ; si une migration échoue, rien n'est déployé.

**Plus rien à coller dans l'éditeur SQL** : fusionner la PR, puis déployer.

### Opération unique : marquer la baseline

À faire UNE fois, après la fusion de la baseline et avant le premier
déploiement par la CI : Actions → **Schéma production** → Run workflow →
action **marquer-baseline** (branche master). Le job vérifie que la
production contient bien le schéma (50 tables, garde `comptes_guard`) et
que l'historique est vide, puis inscrit la baseline
(`supabase migration repair --status applied`). Il n'écrit que dans
`supabase_migrations.schema_migrations`, aucune table d'EduGest. Relancé, il
ne fait rien.

## Photographier la production

Actions → **Schéma production** → Run workflow : dump du schéma (structure
seule, lecture seule), relevé Storage/Realtime, version de Postgres. Sert à
recréer une baseline ou à comparer la production aux migrations.

Prérequis : secret `SUPABASE_DB_URL` dans l'environnement GitHub
**Production** = URI **Session pooler** (port 5432,
`postgres.<ref>@aws-0-eu-west-1.pooler.supabase.com`), mot de passe
encodé (`@`→`%40`, `#`→`%23`…). En cas d'échec de connexion, l'étape
« Diagnostic de l'adresse » dit ce qui cloche sans rien révéler.

⚠️ Ce mot de passe est aussi celui de PowerSync : le changer impose de le
changer dans PowerSync (Connections → Test connection → Deploy) aussitôt.
