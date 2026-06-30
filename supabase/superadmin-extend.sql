-- ════════════════════════════════════════════════════════════════════════
--  EduGest — Superadmin : table demandes_plan + extension du bypass RLS
-- ════════════════════════════════════════════════════════════════════════
-- À exécuter dans Supabase → SQL Editor (après les autres deltas). Idempotent.
-- 1) Table des demandes de plan (une école demande un abonnement, le superadmin
--    valide/rejette). 2) Étend la politique permissive superadmin à TOUTES les
--    tables ajoutées après superadmin.sql (compta, modules, enseignant_classes,
--    demandes_plan) — sinon le superadmin n'y a pas accès transversal.

-- ── Table demandes_plan ────────────────────────────────────────────────────
create table if not exists demandes_plan (
  id           uuid primary key default gen_random_uuid(),
  ecole_id     uuid not null references ecoles(id) on delete cascade,
  plan_demande text,
  statut       text default 'en_attente',            -- en_attente / validee / rejetee
  extra        jsonb default '{}'::jsonb,
  created_at   timestamptz default now()
);
create index if not exists idx_demandes_ecole on demandes_plan (ecole_id);

alter table demandes_plan enable row level security;
-- Une école (staff) crée et voit SES demandes ; le superadmin voit tout (bypass).
drop policy if exists demandes_plan_school on demandes_plan;
create policy demandes_plan_school on demandes_plan for all to authenticated
  using (ecole_id = auth_ecole_id() and is_staff())
  with check (ecole_id = auth_ecole_id() and is_staff());

-- ── Bypass superadmin sur les tables ajoutées après superadmin.sql ─────────
do $$
declare t text;
begin
  for t in select unnest(array[
    'recettes','depenses','versements','bons','personnel',
    'messages','annonces','documents','examens','livrets','honneurs',
    'membres','evenements','historique','enseignant_classes','demandes_plan'])
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists %1$s_superadmin on %1$s;', t);
    execute format(
      'create policy %1$s_superadmin on %1$s for all to authenticated
         using (is_superadmin()) with check (is_superadmin());', t);
  end loop;
end $$;
