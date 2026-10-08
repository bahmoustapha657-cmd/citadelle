-- ════════════════════════════════════════════════════════════════════════
--  EduGest — Modules restants (communication, scolarité annexe, vie scolaire,
--  fondation, journal)   [delta]
-- ════════════════════════════════════════════════════════════════════════
-- À exécuter UNE FOIS dans Supabase → SQL Editor, après schema.sql + rls.sql.
-- Idempotent. Tables « document » uniformes : id + ecole_id + `extra` jsonb
-- (tous les champs libres, pilotés par les écrans). Lues via useFirestore par
-- des écrans STAFF uniquement (le portail parent passe par une API serveur,
-- hors de ce périmètre) → RLS réservée au personnel (is_staff()).
--
-- Tables : messages, annonces, documents, examens, livrets, honneurs,
--          membres, evenements, historique.

do $$
declare t text;
begin
  for t in select unnest(array[
    'messages','annonces','documents','examens','livrets','honneurs',
    'membres','evenements','historique'])
  loop
    -- Table uniforme.
    execute format(
      'create table if not exists %I (
         id          uuid primary key default gen_random_uuid(),
         ecole_id    uuid not null references ecoles(id) on delete cascade,
         extra       jsonb default ''{}''::jsonb,
         created_at  timestamptz default now(),
         updated_at  timestamptz default now()
       );', t);

    -- Index de filtrage par école.
    execute format('create index if not exists idx_%1$s_ecole on %1$s (ecole_id);', t);

    -- updated_at automatique (trigger défini dans schema.sql).
    execute format('drop trigger if exists trg_%1$s_updated on %1$s;', t);
    execute format(
      'create trigger trg_%1$s_updated before update on %1$s
         for each row execute function set_updated_at();', t);

    -- RLS : lecture + écriture réservées au personnel de l'école.
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
