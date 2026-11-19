-- 20261119185253_retours_terrain.sql
-- Pourquoi : la feuille de route (étape 1, « consolider ») prévoit un canal
-- de retours terrain. Une trentaine de fonctions en production attendent
-- « un retour terrain », mais rien ne remonte des écoles hormis un lien
-- WhatsApp : pas de trace, pas d'écran ni de version, pas de suivi. Chaque
-- compte peut désormais signaler un problème, proposer une idée, poser une
-- question ou dire ce qui marche ; EduGest (superadmin) lit, classe et répond.
--
-- Règles (docs/migrations-sql.md) :
--  - appliquée UNE fois, dans l'ordre, par la CI au déploiement — jamais à
--    la main dans l'éditeur SQL ;
--  - compatible avec le front encore en ligne (ajouter avant de retirer) ;
--  - ne jamais modifier une migration déjà fusionnée : en écrire une autre.

create table if not exists public.retours_terrain (
    id uuid primary key default gen_random_uuid(),
    ecole_id uuid not null references public.ecoles(id) on delete cascade,
    -- L'auteur peut disparaître (compte supprimé) : son retour reste, signé
    -- du nom et du rôle qu'il avait.
    compte_id uuid references public.comptes(id) on delete set null,
    auteur text not null default '',
    role text not null default '',
    genre text not null check (genre in ('probleme', 'idee', 'question', 'bravo')),
    message text not null check (char_length(btrim(message)) between 3 and 2000),
    -- Écran ouvert, version de l'app, langue, appareil : ce qu'il faut pour
    -- retrouver un problème sans rappeler l'école.
    contexte jsonb not null default '{}'::jsonb
        check (jsonb_typeof(contexte) = 'object' and length(contexte::text) <= 2000),
    statut text not null default 'nouveau' check (statut in ('nouveau', 'lu', 'traite')),
    reponse text check (reponse is null or char_length(reponse) <= 2000),
    repondu_le timestamptz,
    created_at timestamptz not null default now()
);

create index if not exists retours_terrain_statut_idx on public.retours_terrain (statut, created_at desc);
create index if not exists retours_terrain_compte_idx on public.retours_terrain (compte_id, created_at desc);

-- Lecture : l'auteur voit ses retours (et la réponse d'EduGest), EduGest voit
-- tout. Ni la direction ni les collègues ne lisent les retours des autres :
-- un comptable doit pouvoir signaler un souci sans que sa hiérarchie le lise.
-- Écriture : par les deux fonctions ci-dessous seulement (aucune policy
-- d'insertion ni de modification pour les comptes ordinaires).
alter table public.retours_terrain enable row level security;
revoke all on table public.retours_terrain from anon;

drop policy if exists retours_terrain_select on public.retours_terrain;
create policy retours_terrain_select on public.retours_terrain
  for select to authenticated
  using (compte_id = public.my_compte_id() or public.is_superadmin());

drop policy if exists retours_terrain_superadmin on public.retours_terrain;
create policy retours_terrain_superadmin on public.retours_terrain
  to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

-- Envoi d'un retour par le compte connecté, pour SON école. Le nom, le rôle
-- et l'école viennent de la base, jamais du navigateur. Au plus 20 retours
-- par compte et par 24 heures : un canal de retours, pas une messagerie.
create or replace function public.retour_envoyer(p_genre text, p_message text, p_contexte jsonb default '{}'::jsonb)
returns uuid
    language plpgsql security definer
    set search_path to 'public'
    as $$
declare
  c comptes;
  nouveau uuid;
begin
  select * into c from comptes where id = my_compte_id();
  if c.id is null or c.ecole_id is null or c.ecole_id is distinct from auth_ecole_id() then
    raise exception 'Compte introuvable.' using errcode = '42501';
  end if;
  if (select count(*) from retours_terrain
      where compte_id = c.id and created_at > now() - interval '24 hours') >= 20 then
    raise exception 'Trop de retours envoyés aujourd''hui : réessayez demain.' using errcode = 'P0001';
  end if;
  insert into retours_terrain (ecole_id, compte_id, auteur, role, genre, message, contexte)
  values (
    c.ecole_id, c.id,
    coalesce(nullif(btrim(c.nom), ''), c.login), coalesce(nullif(btrim(c.label), ''), c.role::text),
    p_genre, btrim(p_message),
    case when jsonb_typeof(p_contexte) = 'object' then p_contexte else '{}'::jsonb end
  )
  returning id into nouveau;
  return nouveau;
end $$;

revoke all on function public.retour_envoyer(text, text, jsonb) from public, anon;
grant execute on function public.retour_envoyer(text, text, jsonb) to authenticated, service_role;
