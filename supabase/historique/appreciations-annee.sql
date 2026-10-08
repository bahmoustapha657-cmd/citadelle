-- ════════════════════════════════════════════════════════════════════════
--  EduGest — Année scolaire sur les appréciations  [delta]
-- ════════════════════════════════════════════════════════════════════════
-- À exécuter UNE FOIS dans Supabase → SQL Editor. Idempotent.
--
-- POURQUOI (perte de données, pas simple mélange) : la table n'avait aucune
-- notion d'année, et son unicité portait sur (eleve_id, periode). À la
-- rentrée, écrire l'appréciation de T1 2026-2027 aurait ÉCRASÉ celle de
-- T1 2025-2026 — l'application fait un upsert sur cette clé. Les 346
-- appréciations déjà rédigées auraient disparu une par une.
--
-- On ajoute l'année, on reprend l'existant, puis on élargit l'unicité.

alter table appreciations add column if not exists annee text;

-- Reprise : les appréciations existantes appartiennent à l'année scolaire
-- en cours de leur école (ecoles.extra.anneeScolaire), avec repli sur
-- 2025-2026 pour une école qui n'aurait jamais fixé la sienne.
update appreciations a
   set annee = coalesce(
         (select e.extra->>'anneeScolaire' from ecoles e where e.id = a.ecole_id),
         '2025-2026')
 where a.annee is null;

-- L'unicité doit inclure l'année, sinon deux rentrées se disputent la même
-- ligne. On retire l'ancienne contrainte AVANT de poser la nouvelle.
alter table appreciations drop constraint if exists appreciations_eleve_id_periode_key;
alter table appreciations drop constraint if exists appreciations_eleve_id_periode_annee_key;
alter table appreciations add constraint appreciations_eleve_id_periode_annee_key
  unique (eleve_id, periode, annee);

create index if not exists idx_appreciations_ecole_annee on appreciations (ecole_id, annee);

-- Contrôle (doit renvoyer 0) :
--   select count(*) from appreciations where annee is null;
