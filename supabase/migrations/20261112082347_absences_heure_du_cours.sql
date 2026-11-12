-- 20261112082347_absences_heure_du_cours.sql
-- Pourquoi : au secondaire, plusieurs professeurs font l'appel dans la même
-- journée ; un élève peut être présent à un cours et absent à un autre. Une
-- absence ne portait que sa date : la première marquée valait pour toute la
-- journée et bloquait l'appel des cours suivants. Elle porte désormais
-- l'heure du cours (début, fin, « 08:00 »). Sans heure (primaire, direction,
-- anciennes absences) : toute la journée, comme avant.
--
-- Règles (docs/migrations-sql.md) :
--  - appliquée UNE fois, dans l'ordre, par la CI au déploiement — jamais à
--    la main dans l'éditeur SQL ;
--  - compatible avec le front encore en ligne (ajouter avant de retirer) ;
--  - ne jamais modifier une migration déjà fusionnée : en écrire une autre.

alter table public.absences
  add column if not exists heure_debut text,
  add column if not exists heure_fin text;

comment on column public.absences.heure_debut is
  'Début du cours manqué (HH:MM) ; NULL = toute la journée.';
comment on column public.absences.heure_fin is
  'Fin du cours manqué (HH:MM) ; NULL = toute la journée.';
