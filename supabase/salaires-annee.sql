-- ════════════════════════════════════════════════════════════════════════
--  EduGest — Année scolaire sur les salaires  [delta]
-- ════════════════════════════════════════════════════════════════════════
-- À exécuter UNE FOIS dans Supabase → SQL Editor. Idempotent.
--
-- POURQUOI : le front écrit et filtre un champ `annee` sur les fiches de
-- paie, mais la table `salaires` n'avait pas cette colonne — l'année partait
-- dans le jsonb `details`, invisible du filtre. Résultat : en mode archive,
-- les salaires de TOUTES les années s'affichaient mélangés, alors que les
-- recettes, dépenses et versements étaient bien filtrés.
--
-- La colonne est ajoutée PUIS remplie depuis details->>'annee' : les fiches
-- déjà saisies (254 sur La Citadelle, toutes en 2025-2026) restent visibles
-- dans leur année.

alter table salaires add column if not exists annee text;

-- Reprise des fiches existantes : l'année vivait dans le jsonb.
update salaires
   set annee = details->>'annee'
 where annee is null
   and details ? 'annee';

create index if not exists idx_salaires_ecole_annee on salaires (ecole_id, annee);

-- Contrôle (doit renvoyer 0 ligne sans année parmi celles qui en avaient une) :
--   select count(*) from salaires where annee is null and details ? 'annee';
