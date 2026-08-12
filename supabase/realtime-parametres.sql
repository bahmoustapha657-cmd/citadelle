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
-- 2) La colonne `logo` porte l'image en base64 (~72 ko pour La Citadelle).
--    La publier ferait transiter 72 ko à chaque enregistrement de paramètres,
--    pour une information dont le client n'a aucun besoin : il se contente de
--    RECHARGER l'école quand un événement arrive. On publie donc une LISTE DE
--    COLONNES explicite, logo exclu (PostgreSQL 15+ ; ici 17).
--    Le jour où une colonne est ajoutée à `ecoles` et qu'elle doit être vue du
--    client, il faut la rajouter ici — d'où le rappel en commentaire.
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
    (id, code, nom, couleur1, couleur2, pays, devise, plan, plan_expiry,
     modele_bulletin, role_settings, legal, extra, actif, supprime, updated_at);
  raise notice 'realtime : ecoles publiée (sans logo)';
end $$;

-- Contrôle :
--   select tablename from pg_publication_tables
--    where pubname='supabase_realtime' and tablename in ('ecoles','postes');
