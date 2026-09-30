-- ════════════════════════════════════════════════════════════════════════
--  EduGest — Présence des comptes (« en ligne », « absent », « vu il y a »)
-- ════════════════════════════════════════════════════════════════════════
-- À exécuter dans Supabase → SQL Editor APRÈS messagerie-v2.sql. Idempotent.
--
-- Chaque application ouverte (personnel, enseignants) signale sa présence
-- toutes les minutes : « actif » (à l'écran) ou « absent » (ouverte en
-- arrière-plan, encore joignable par appel). Sans signal depuis 150 s, le
-- compte est « hors ligne » et l'on affiche « vu il y a … ».
--
-- Choix : un signal toutes les minutes + une LECTURE périodique par
-- l'application, et PAS de diffusion temps réel : diffuser chaque signal à
-- toute l'école coûterait des millions de messages Realtime par mois.
-- L'état « hors ligne » et l'ancienneté sont calculés ici, à l'heure du
-- serveur (l'horloge des téléphones n'est pas fiable).

create table if not exists msg_presences (
  compte_id uuid primary key references comptes(id) on delete cascade,
  ecole_id  uuid not null references ecoles(id) on delete cascade,
  etat      text not null default 'actif' check (etat in ('actif', 'absent', 'hors_ligne')),
  vu_at     timestamptz not null default now()
);
create index if not exists idx_msg_presences_ecole on msg_presences (ecole_id);

-- Aucune policy : lecture et écriture par les deux fonctions ci-dessous.
alter table msg_presences enable row level security;

-- Signal du compte courant (personnel et enseignants uniquement).
create or replace function msg_presence(p_etat text) returns void
  language sql security definer set search_path = public as $$
  insert into msg_presences (compte_id, ecole_id, etat, vu_at)
  select c.id, c.ecole_id,
         case when p_etat in ('actif', 'absent', 'hors_ligne') then p_etat else 'actif' end,
         now()
  from comptes c
  where c.user_id = auth.uid() and c.ecole_id is not null
    and c.role::text not in ('parent', 'superadmin')
  on conflict (compte_id) do update
    set etat = excluded.etat, vu_at = excluded.vu_at, ecole_id = excluded.ecole_id;
$$;

-- Présence des comptes de l'école : état effectif + secondes depuis le
-- dernier signal.
create or replace function msg_presences()
returns table (compte_id uuid, etat text, depuis int)
  language sql stable security definer set search_path = public as $$
  select p.compte_id,
         case when p.vu_at > now() - interval '150 seconds' then p.etat else 'hors_ligne' end,
         greatest(0, extract(epoch from now() - p.vu_at))::int
  from msg_presences p
  where est_membre_messagerie() and p.ecole_id = auth_ecole_id();
$$;

revoke execute on function msg_presence(text) from public, anon;
revoke execute on function msg_presences() from public, anon;
grant execute on function msg_presence(text) to authenticated;
grant execute on function msg_presences() to authenticated;
