-- ════════════════════════════════════════════════════════════════════════
--  EduGest — Temps réel : PARAMÈTRES D'ÉCOLE et POSTES   [delta]
-- ════════════════════════════════════════════════════════════════════════
-- À exécuter UNE FOIS dans Supabase → SQL Editor, après realtime.sql.
-- Idempotent.
--
-- POURQUOI : realtime.sql publie les données scolaires, mais refuse toute
-- table sans colonne `ecole_id` — ce qui écartait `ecoles`. Et `postes` avait
-- simplement été oubliée de la liste. Conséquences observées :
--   • un changement de paramètres (année scolaire, périodicité, jours
--     ouvrables, verrous, branding) n'atteignait les autres postes qu'au
--     rechargement de la page ;
--   • créer, modifier ou supprimer un poste — donc changer les DROITS de
--     quelqu'un — restait invisible de sa session en cours.
--
-- Deux cas, deux traitements.
--
-- MISE À JOUR (cf. storage.sql et migrer-logos.mjs) : `logo` ne contient plus
-- une image en base64 mais une URL de quelques dizaines d'octets. La colonne
-- est donc REVENUE dans la liste publiée — un changement de logo se propage
-- désormais comme le reste du branding.

-- ── POSTES : cas standard (elle a bien un ecole_id) ────────────────────────
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  -- REPLICA IDENTITY FULL : sans elle, un DELETE ne transporte que la clé
  -- primaire, le filtre serveur `ecole_id=eq.…` ne correspond pas, et la
  -- suppression d'un poste n'est jamais livrée.
  alter table public.postes replica identity full;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'postes'
  ) then
    alter publication supabase_realtime add table public.postes;
    raise notice 'realtime : postes publiée';
  end if;
end $$;

-- ── ECOLES : cas particulier, à deux titres ────────────────────────────────
-- 1) Pas de colonne `ecole_id` : la ligne EST l'école. Le client filtre donc
--    sur `id` (cf. COLONNE_ECOLE dans src/backend/realtime-supabase.js).
-- 2) On publie une LISTE DE COLONNES explicite (PostgreSQL 15+ ; ici 17)
--    plutôt que la table entière. Historiquement, c'était pour écarter `logo`,
--    qui portait l'image en base64 (~72 ko) et aurait transité à chaque
--    enregistrement de paramètres. Depuis le passage au stockage objet, `logo`
--    n'est plus qu'une URL et figure dans la liste.
--    ⚠️ Le jour où une colonne est ajoutée à `ecoles` et doit être vue du
--    client, il faut la rajouter ici.
-- REPLICA IDENTITY reste DEFAULT : on ne supprime pas d'école en cours de
-- session, et la clé primaire suffit au filtre `id=eq.…`.
do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ecoles'
  ) then
    alter publication supabase_realtime drop table public.ecoles;
  end if;

  alter publication supabase_realtime add table public.ecoles
    (id, code, nom, logo, couleur1, couleur2, pays, devise, plan, plan_expiry,
     modele_bulletin, role_settings, legal, extra, actif, supprime, updated_at);
  raise notice 'realtime : ecoles publiée';
end $$;

-- Contrôle :
--   select tablename from pg_publication_tables
--    where pubname='supabase_realtime' and tablename in ('ecoles','postes');
