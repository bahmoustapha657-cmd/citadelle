-- 20261110142943_messagerie_reactions.sql
-- Pourquoi : réagir à un message (👍 ❤️ 😂 😮 🙏 ✅) sans écrire de réponse.
-- Les réactions vivent sur le message lui-même ({ compte : émoji }) : elles
-- arrivent avec lui et se propagent par le temps réel déjà en place, sans
-- table ni abonnement de plus. Une réaction par personne et par message.
--
-- Règles (docs/migrations-sql.md) :
--  - appliquée UNE fois, dans l'ordre, par la CI au déploiement — jamais à
--    la main dans l'éditeur SQL ;
--  - compatible avec le front encore en ligne (ajouter avant de retirer) ;
--  - ne jamais modifier une migration déjà fusionnée : en écrire une autre.

alter table public.msg_messages
  add column if not exists reactions jsonb not null default '{}'::jsonb;

-- Un message naît sans réaction : personne n'en prête aux autres à l'envoi
-- (la policy d'insertion laisse le client remplir ses colonnes).
create or replace function public.msg_reactions_vides() returns trigger
    language plpgsql
    set search_path to 'public'
    as $$
begin
  new.reactions := '{}'::jsonb;
  return new;
end $$;

drop trigger if exists trg_msg_reactions_vides on public.msg_messages;
create trigger trg_msg_reactions_vides before insert on public.msg_messages
  for each row execute function public.msg_reactions_vides();

-- Pose, change ou retire MA réaction (p_emoji null, ou le même émoji une
-- seconde fois, la retire). Renvoie les réactions du message.
create or replace function public.msg_reagir(p_message uuid, p_emoji text) returns jsonb
    language plpgsql security definer
    set search_path to 'public'
    as $$
declare
  moi uuid := my_compte_id();
  msg msg_messages;
  v jsonb;
begin
  select * into msg from msg_messages where id = p_message;
  if msg.id is null or moi is null
     or msg.conversation_id not in (select msg_mes_conversations()) then
    raise exception 'Message introuvable.' using errcode = '42501';
  end if;
  if msg.supprime or msg.type not in ('texte', 'audio', 'fichier') then
    raise exception 'Réaction impossible sur ce message.' using errcode = '42501';
  end if;
  if p_emoji is not null and p_emoji not in ('👍', '❤️', '😂', '😮', '🙏', '✅') then
    raise exception 'Réaction inconnue.' using errcode = '22023';
  end if;
  -- Une seule écriture : deux réactions simultanées ne s'écrasent pas.
  update msg_messages
     set reactions = case
           when p_emoji is null or reactions ->> moi::text = p_emoji then reactions - moi::text
           else reactions || jsonb_build_object(moi::text, p_emoji) end
   where id = p_message
   returning reactions into v;
  return v;
end $$;

revoke all on function public.msg_reagir(uuid, text) from public, anon;
grant execute on function public.msg_reagir(uuid, text) to authenticated, service_role;
