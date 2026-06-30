-- ════════════════════════════════════════════════════════════════════════
--  EduGest — Notifications push : abonnements   [delta]
-- ════════════════════════════════════════════════════════════════════════
-- À exécuter dans Supabase → SQL Editor (après rls.sql). Idempotent.
-- Stocke les abonnements push (un par utilisateur/école). L'ENVOI se fait dans
-- l'Edge Function `push` (service_role + clé VAPID privée), qui lit cette table.

create table if not exists push_subs (
  ecole_id     uuid not null references ecoles(id) on delete cascade,
  user_id      uuid not null,
  subscription jsonb not null,
  role         text,
  nom          text,
  updated_at   timestamptz default now(),
  primary key (ecole_id, user_id)
);
create index if not exists idx_push_subs_ecole on push_subs (ecole_id);

alter table push_subs enable row level security;
-- Chaque utilisateur gère SON propre abonnement.
drop policy if exists push_subs_self on push_subs;
create policy push_subs_self on push_subs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Superadmin : accès total (l'Edge Function d'envoi lit via service_role).
drop policy if exists push_subs_superadmin on push_subs;
create policy push_subs_superadmin on push_subs for all to authenticated
  using (is_superadmin()) with check (is_superadmin());
