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
-- Chaque utilisateur gère SON propre abonnement, dans SON école, avec SON
-- rôle (version durcie de push-subs-verrou.sql, reprise ici pour qu'un rejeu
-- de ce fichier ne rouvre pas la faille ; le déclencheur qui recalcule rôle
-- et poste vit dans push-subs-verrou.sql, à exécuter après postes.sql).
drop policy if exists push_subs_self on push_subs;
create policy push_subs_self on push_subs for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid()
              and ecole_id = auth_ecole_id()
              and role = auth_role()::text);
-- Superadmin : accès total (l'Edge Function d'envoi lit via service_role).
drop policy if exists push_subs_superadmin on push_subs;
create policy push_subs_superadmin on push_subs for all to authenticated
  using (is_superadmin()) with check (is_superadmin());
