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
toutes les tables publiques**, garde `comptes_guard` présente. Une migration
qui échoue ici ne peut pas être fusionnée sans que ça se voie.

## Appliquer en production (en attente de validation)

Prévu : au déploiement (Actions → CI → Run workflow), un job applique les
migrations en attente à la production **avant** le front, avec deux
garde-fous :

- refus net si la baseline n'est pas marquée « déjà appliquée » en
  production (sinon elle serait rejouée) ;
- retour arrière d'un ancien déploiement : aucune migration annulée, front
  seul.

Une fois en place, une étape unique : marquer la baseline comme appliquée
(`supabase migration repair 20261008175200 --status applied`), via le
workflow « Schéma production ».

**En attendant**, une nouvelle migration fusionnée s'applique encore à la
main : coller son contenu dans l'éditeur SQL de Supabase, AVANT de déployer
le front.

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
