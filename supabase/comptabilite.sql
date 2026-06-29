-- ════════════════════════════════════════════════════════════════════════
--  EduGest — Module COMPTABILITÉ (recettes, dépenses, versements, bons,
--  personnel)   [delta]
-- ════════════════════════════════════════════════════════════════════════
-- À exécuter UNE FOIS dans Supabase → SQL Editor, sur une base déjà créée via
-- schema.sql + rls.sql. Idempotent (create table if not exists + drop policy
-- if exists). Tables financières → réservées au personnel (is_staff()).
--
-- Modèle : peu de colonnes typées (annee/date/montant) pour le filtrage et les
-- sommes, + `extra` jsonb pour les champs libres pilotés par les formulaires
-- (libelle, description, categorie, periode, motif, observation, nom…). Mappées
-- côté front dans src/backend/collection-map.js.

-- ── Tables ─────────────────────────────────────────────────────────────────
-- Grand livre des recettes (entrées hors mensualités).
create table if not exists recettes (
  id          uuid primary key default gen_random_uuid(),
  ecole_id    uuid not null references ecoles(id) on delete cascade,
  annee       text,                                  -- "2025-2026"
  date        text,
  montant     numeric default 0,
  extra       jsonb default '{}'::jsonb,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Grand livre des dépenses.
create table if not exists depenses (
  id          uuid primary key default gen_random_uuid(),
  ecole_id    uuid not null references ecoles(id) on delete cascade,
  annee       text,
  date        text,
  montant     numeric default 0,
  extra       jsonb default '{}'::jsonb,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Versements / dons (Fondation).
create table if not exists versements (
  id          uuid primary key default gen_random_uuid(),
  ecole_id    uuid not null references ecoles(id) on delete cascade,
  annee       text,
  date        text,
  montant     numeric default 0,
  extra       jsonb default '{}'::jsonb,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Bons (avances/retenues sur salaire).
create table if not exists bons (
  id          uuid primary key default gen_random_uuid(),
  ecole_id    uuid not null references ecoles(id) on delete cascade,
  annee       text,
  date        text,
  montant     numeric default 0,
  extra       jsonb default '{}'::jsonb,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Personnel non enseignant (paie).
create table if not exists personnel (
  id          uuid primary key default gen_random_uuid(),
  ecole_id    uuid not null references ecoles(id) on delete cascade,
  nom         text,
  prenom      text,
  extra       jsonb default '{}'::jsonb,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Index de filtrage par école (+ année pour les grands livres).
create index if not exists idx_recettes_ecole   on recettes   (ecole_id, annee);
create index if not exists idx_depenses_ecole    on depenses    (ecole_id, annee);
create index if not exists idx_versements_ecole  on versements  (ecole_id, annee);
create index if not exists idx_bons_ecole        on bons        (ecole_id, annee);
create index if not exists idx_personnel_ecole   on personnel   (ecole_id);

-- ── updated_at automatique (réutilise le trigger set_updated_at de schema.sql) ─
do $$
declare t text;
begin
  for t in select unnest(array['recettes','depenses','versements','bons','personnel'])
  loop
    execute format('drop trigger if exists trg_%1$s_updated on %1$s;', t);
    execute format(
      'create trigger trg_%1$s_updated before update on %1$s
         for each row execute function set_updated_at();', t);
  end loop;
end $$;

-- ── RLS : lecture/écriture réservées au personnel de l'école ───────────────
do $$
declare t text;
begin
  for t in select unnest(array['recettes','depenses','versements','bons','personnel'])
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists %1$s_select on %1$s;', t);
    execute format(
      'create policy %1$s_select on %1$s for select to authenticated
         using (ecole_id = auth_ecole_id() and is_staff());', t);
    execute format('drop policy if exists %1$s_write on %1$s;', t);
    execute format(
      'create policy %1$s_write on %1$s for all to authenticated
         using (ecole_id = auth_ecole_id() and is_staff())
         with check (ecole_id = auth_ecole_id() and is_staff());', t);
  end loop;
end $$;
