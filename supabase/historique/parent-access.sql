-- ════════════════════════════════════════════════════════════════════════
--  EduGest — Accès PARENT au portail (delta)
-- ════════════════════════════════════════════════════════════════════════
-- À exécuter dans Supabase → SQL Editor APRÈS modules.sql. Idempotent.
-- Ouvre la visibilité de deux tables aux parents (le reste de modules.sql
-- demeure staff-only) :
--   • messages  : un parent lit/écrit UNIQUEMENT les messages liés à ses
--                 enfants  → colonne réelle eleve_id + RLS my_eleve_ids().
--   • annonces  : lisibles par tout utilisateur de l'école (parents inclus).

-- ── messages : colonne eleve_id (filtre parent fiable, pas de cast jsonb) ───
alter table messages add column if not exists eleve_id uuid
  references eleves(id) on delete cascade;
create index if not exists idx_messages_eleve on messages (eleve_id);

drop policy if exists messages_select on messages;
create policy messages_select on messages for select to authenticated
  using (ecole_id = auth_ecole_id()
         and (is_staff() or eleve_id in (select my_eleve_ids())));

drop policy if exists messages_write on messages;
create policy messages_write on messages for all to authenticated
  using (ecole_id = auth_ecole_id()
         and (is_staff() or eleve_id in (select my_eleve_ids())))
  with check (ecole_id = auth_ecole_id()
         and (is_staff() or eleve_id in (select my_eleve_ids())));

-- ── annonces : lecture ouverte à toute l'école (parents inclus) ────────────
drop policy if exists annonces_select on annonces;
create policy annonces_select on annonces for select to authenticated
  using (ecole_id = auth_ecole_id());
