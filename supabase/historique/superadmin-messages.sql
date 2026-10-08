-- ════════════════════════════════════════════════════════════════════════
--  EduGest — Messages de diffusion SuperAdmin   [delta]
-- ════════════════════════════════════════════════════════════════════════
-- À exécuter dans Supabase → SQL Editor (après superadmin.sql). Idempotent.
-- Le superadmin diffuse des messages ciblant des écoles et/ou des rôles ; chaque
-- école ne voit que ceux qui la concernent (RLS), et son accusé de lecture est
-- enregistré pour les stats côté superadmin.

create table if not exists superadmin_messages (
  id            uuid primary key default gen_random_uuid(),
  titre         text,
  corps         text,
  niveau        text,
  cible_schools text[] default '{}',                  -- codes d'écoles (vide = toutes)
  cible_roles   text[] default '{}',                  -- rôles (vide = tous)
  auteur        text,
  created_at    timestamptz default now()
);

create table if not exists superadmin_message_lectures (
  message_id uuid not null references superadmin_messages(id) on delete cascade,
  user_id    uuid not null,
  ecole_code text,
  role       text,
  login      text,
  read_at    timestamptz default now(),
  primary key (message_id, user_id)
);

-- ── RLS messages ───────────────────────────────────────────────────────────
alter table superadmin_messages enable row level security;
drop policy if exists sam_superadmin on superadmin_messages;
create policy sam_superadmin on superadmin_messages for all to authenticated
  using (is_superadmin()) with check (is_superadmin());
-- Une école lit les messages qui la ciblent (école ET rôle, vide = tous).
drop policy if exists sam_school_select on superadmin_messages;
create policy sam_school_select on superadmin_messages for select to authenticated
  using (
    (cardinality(coalesce(cible_schools, '{}')) = 0
      OR (select code from ecoles where id = auth_ecole_id()) = any(cible_schools))
    and (cardinality(coalesce(cible_roles, '{}')) = 0
      OR auth_role()::text = any(cible_roles))
  );

-- ── RLS accusés de lecture ─────────────────────────────────────────────────
alter table superadmin_message_lectures enable row level security;
drop policy if exists saml_superadmin on superadmin_message_lectures;
create policy saml_superadmin on superadmin_message_lectures for all to authenticated
  using (is_superadmin()) with check (is_superadmin());
-- Chaque utilisateur enregistre/voit SA lecture.
drop policy if exists saml_self on superadmin_message_lectures;
create policy saml_self on superadmin_message_lectures for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
