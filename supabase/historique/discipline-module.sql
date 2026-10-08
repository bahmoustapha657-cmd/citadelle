-- ════════════════════════════════════════════════════════════════════════
--  EduGest — Permission fine « discipline »   [delta]
-- ════════════════════════════════════════════════════════════════════════
-- À exécuter APRÈS postes.sql (qui pose la policy absences_write d'origine).
-- Idempotent.
--
-- POURQUOI : les permissions sont par MODULE, et la Discipline est un onglet
-- de Primaire/Secondaire. Autoriser un surveillant à saisir une absence
-- revenait donc à lui donner l'écriture sur tout le module — notes, élèves,
-- classes comprises. Bien au-delà de son office.
--
-- `discipline` devient une permission à part entière. L'ancien droit reste
-- valable : un poste qui écrit la section écrit toujours la discipline, donc
-- AUCUN poste existant ne perd quoi que ce soit. C'est un élargissement des
-- façons d'obtenir le droit, pas un remplacement.
--
-- ⚠️ À REJOUER APRÈS TOUT PASSAGE DE postes.sql, qui rétablirait la policy
--    sans la clause `discipline`.

drop policy if exists absences_write on absences;
create policy absences_write on absences for all to authenticated
  using (ecole_id = auth_ecole_id()
         and (has_module_write(section_module(section))
              or has_module_write('discipline')
              or eleve_id in (select my_teacher_eleve_ids())))
  with check (ecole_id = auth_ecole_id()
         and (has_module_write(section_module(section))
              or has_module_write('discipline')
              or eleve_id in (select my_teacher_eleve_ids())));

-- Contrôle :
--   select policyname from pg_policies where tablename = 'absences';
