-- 20261110083855_appels_trace.sql
-- Pourquoi : un appel décroché mais muet (4 novembre 2026) n'a laissé aucun
-- indice : la base ne savait pas par où la voix était censée passer (direct,
-- relais TURN, relais de secours) ni si du son était arrivé. Chaque appareil
-- dépose désormais un petit compte rendu technique à la fin de l'appel.
--
-- Règles (docs/migrations-sql.md) :
--  - appliquée UNE fois, dans l'ordre, par la CI au déploiement — jamais à
--    la main dans l'éditeur SQL ;
--  - compatible avec le front encore en ligne (ajouter avant de retirer) ;
--  - ne jamais modifier une migration déjà fusionnée : en écrire une autre.

-- Table à part de msg_appels : pas de diffusion en temps réel, et le compte
-- rendu d'un appareil (navigateur, réseau) n'est pas montré à l'autre.
create table if not exists public.msg_appels_traces (
    appel_id uuid not null references public.msg_appels(id) on delete cascade,
    compte_id uuid not null references public.comptes(id) on delete cascade,
    cote text not null check (cote in ('appelant', 'appele')),
    trace jsonb not null,
    created_at timestamptz not null default now(),
    primary key (appel_id, compte_id)
);

-- Aucune policy : lecture réservée au diagnostic (SQL côté serveur), écriture
-- par la seule fonction ci-dessous.
alter table public.msg_appels_traces enable row level security;
revoke all on table public.msg_appels_traces from anon, authenticated;

create or replace function public.msg_appel_tracer(p_id uuid, p_trace jsonb) returns void
    language plpgsql security definer
    set search_path to 'public'
    as $$
declare
  moi uuid := my_compte_id();
  a msg_appels;
begin
  select * into a from msg_appels where id = p_id;
  if a.id is null or moi is null or moi not in (a.appelant_id, a.appele_id) then
    raise exception 'Appel introuvable.' using errcode = '42501';
  end if;
  -- Un compte rendu tardif ou démesuré n'est pas un diagnostic.
  if a.created_at < now() - interval '2 hours' then return; end if;
  if jsonb_typeof(p_trace) <> 'object' or length(p_trace::text) > 6000 then return; end if;
  insert into msg_appels_traces (appel_id, compte_id, cote, trace)
  values (p_id, moi, case when moi = a.appelant_id then 'appelant' else 'appele' end, p_trace)
  on conflict (appel_id, compte_id) do update set trace = excluded.trace, created_at = now();
end $$;

revoke all on function public.msg_appel_tracer(uuid, jsonb) from public, anon;
grant execute on function public.msg_appel_tracer(uuid, jsonb) to authenticated, service_role;
