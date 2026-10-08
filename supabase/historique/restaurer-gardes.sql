-- ════════════════════════════════════════════════════════════════════════
--  EduGest — Restauration des gardes écrasées par un rejeu   [delta]
-- ════════════════════════════════════════════════════════════════════════
-- À exécuter dans Supabase → SQL Editor, APRÈS postes.sql et
-- discipline-module.sql. Idempotent, sans danger à relancer.
--
-- CONSTAT (2026-09-25, sondes test-rls-postes.mjs sur l'École Démo) : un
-- compte surveillant — poste SANS admin_panel — a remplacé son propre poste
-- par celui de la direction, puis lu les messages privés adressés à la
-- direction. Le comptes_guard actif n'était donc plus celui de postes.sql.
--
-- CAUSE PROBABLE : un rejeu de teacher-security.sql APRÈS postes.sql. Il
-- reposait trois objets dans leur version d'AVANT les postes :
--   • comptes_guard : `if is_staff() then return new;` — tout le personnel
--     modifie sa propre ligne de comptes, rôle et poste compris : un
--     comptable ou un surveillant se fait « direction » avec sa session
--     ordinaire (par l'API ; l'interface ne le propose pas) ;
--   • notes_write / absences_write : `is_staff()` — tout le personnel écrit
--     n'importe quelle note ou absence, comptabilité comprise.
-- teacher-security.sql ne repose plus ces trois objets quand postes.sql est
-- passé : le rejeu ne peut plus rouvrir la faille.
--
-- REMÈDE : ce fichier remet la DERNIÈRE version de chacun, et rien d'autre.
-- (Rejouer postes.sql en entier imposerait de rejouer ensuite
-- prescolaire-2-permissions.sql et discipline-module.sql.)
-- Copies CONFORMES de leurs fichiers d'origine — tests/restaurer-gardes.test.js
-- échoue si elles divergent : toute évolution se fait d'abord à l'origine.

-- ── 1. comptes_guard (postes.sql § 6) ──────────────────────────────────────
create or replace function comptes_guard() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), 'service_role') = 'service_role' then return new; end if;
  if auth_role() in ('direction', 'superadmin') or has_module_write('admin_panel') then return new; end if;
  if old.user_id = auth.uid() then
    if new.role is distinct from old.role
       or new.ecole_id is distinct from old.ecole_id
       or new.user_id is distinct from old.user_id
       or new.login is distinct from old.login
       or new.section is distinct from old.section
       or new.sections is distinct from old.sections
       or new.matiere is distinct from old.matiere
       or new.nom is distinct from old.nom
       or new.enseignant_id is distinct from old.enseignant_id
       or new.enseignant_nom is distinct from old.enseignant_nom
       or new.poste_id is distinct from old.poste_id
       or new.extra is distinct from old.extra then
      raise exception 'Champs protégés (rôle/école/login/périmètre/poste) non modifiables.';
    end if;
  else
    if new.role is distinct from old.role
       or new.ecole_id is distinct from old.ecole_id
       or new.user_id is distinct from old.user_id
       or new.login is distinct from old.login
       or new.poste_id is distinct from old.poste_id then
      raise exception 'Champs protégés (rôle/école/login/poste) non modifiables.';
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists trg_comptes_guard on comptes;
create trigger trg_comptes_guard before update on comptes
  for each row execute function comptes_guard();

-- ── 2. notes_write (postes.sql § 10) ───────────────────────────────────────
drop policy if exists notes_write on notes;
create policy notes_write on notes for all to authenticated
  using (ecole_id = auth_ecole_id()
         and (has_module_write(section_module(section))
              or teacher_can_write_note(eleve_id, matiere, section)))
  with check (ecole_id = auth_ecole_id()
         and (has_module_write(section_module(section))
              or teacher_can_write_note(eleve_id, matiere, section)));

-- ── 3. absences_write (discipline-module.sql) ──────────────────────────────
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

-- Contrôle (la garde doit figer le poste, et jamais laisser passer is_staff) :
--   select pg_get_functiondef('public.comptes_guard()'::regprocedure);
--   select tgname, tgenabled from pg_trigger
--    where tgrelid = 'public.comptes'::regclass and not tgisinternal;
--   select tablename, policyname, qual from pg_policies
--    where policyname in ('notes_write', 'absences_write');
-- Sondes : node supabase/test-rls-postes.mjs
