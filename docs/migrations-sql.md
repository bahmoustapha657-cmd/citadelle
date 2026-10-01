# Migrations SQL (chantier en cours)

## Pourquoi

Jusqu'ici, chaque évolution de la base était un fichier `supabase/*.sql`
collé à la main dans l'éditeur SQL de Supabase, dans un ordre à connaître par
cœur (`rls.sql` → `teacher-security.sql` → … → `postes.sql` en dernier,
`ecole-hors-service.sql` après `rls.sql`…). Rejouer un ancien fichier a déjà
rouvert une faille en production (garde `comptes_guard`, 2026-09-25).

Cible : des migrations **numérotées** dans `supabase/migrations/`, appliquées
**une seule fois chacune, dans l'ordre**, par GitHub Actions — et vérifiées
sur une base vierge à chaque PR.

## Étape 1 — photographier la production (en cours)

Le point de départ (« baseline ») est le schéma RÉEL de la production, pas la
somme des anciens fichiers (qui a dérivé : réparations, re-runs, retouches
dans le tableau de bord).

1. Supabase → projet EduGest → bouton **Connect** → onglet **Session pooler**
   → copier l'URI (`postgresql://postgres.<ref>:[YOUR-PASSWORD]@aws-…pooler.supabase.com:5432/postgres`)
   et y mettre le mot de passe de la base. ⚠️ Pas la connexion directe
   (`db.<ref>.supabase.co`, IPv6 seulement : injoignable depuis GitHub) ni le
   port 6543 (mode transaction, incompatible avec `pg_dump`).
2. GitHub → Settings → Environments → **production** → Add secret :
   `SUPABASE_DB_URL` = cette URI.
3. GitHub → Actions → **Schéma production** → Run workflow.

Le workflow ne fait que LIRE (structure, aucune donnée). Il refuse de publier
son résultat s'il y repère quelque chose qui ressemble à un secret, et le
résultat est effacé au bout d'un jour.

## Étapes suivantes

2. Baseline = ce dump, relu, + Storage / Realtime ; marquée « déjà appliquée »
   en production (rien n'est rejoué).
3. `matieres-rattachement.sql` (en attente) devient la première vraie
   migration.
4. CI : à chaque PR, toutes les migrations sont appliquées sur un Postgres
   Supabase vierge ; au déploiement, les migrations en attente sont appliquées
   à la production AVANT la mise en ligne du front.
5. Les anciens `supabase/*.sql` sont archivés (lecture seule, ne jamais les
   rejouer).
