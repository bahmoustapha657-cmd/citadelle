-- 20261110132026_messagerie_ecrit.sql
-- Pourquoi : « en train d'écrire… » dans une discussion. Le signal passe par un
-- canal Realtime privé `ecrit:<discussion>`, jamais par la base : rien n'est
-- enregistré. Sans règle, n'importe quel compte connecté pourrait l'écouter :
-- seuls les membres de la discussion y ont accès.
--
-- Règles (docs/migrations-sql.md) :
--  - appliquée UNE fois, dans l'ordre, par la CI au déploiement — jamais à
--    la main dans l'éditeur SQL ;
--  - compatible avec le front encore en ligne (ajouter avant de retirer) ;
--  - ne jamais modifier une migration déjà fusionnée : en écrire une autre.

-- Le CASE garde l'ordre d'évaluation : un autre sujet n'est jamais converti en
-- uuid, ce qui ferait échouer la règle au lieu de la refuser.
create or replace function public.msg_ecrit_autorise(p_sujet text) returns boolean
    language sql stable security definer
    set search_path to 'public'
    as $$
  select exists (
    select 1 from msg_membres m
     where m.conversation_id = case when p_sujet ~ '^ecrit:[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
                                    then substr(p_sujet, 7)::uuid end
       and m.compte_id = my_compte_id()
  );
$$;

revoke all on function public.msg_ecrit_autorise(text) from public, anon;
grant execute on function public.msg_ecrit_autorise(text) to authenticated, service_role;

-- realtime.messages appartient au service Realtime : absente des bases de CI,
-- qui le démarrent sans lui. La règle est vérifiée à l'entrée dans le canal.
do $$
begin
  if to_regclass('realtime.messages') is null then
    raise notice 'realtime.messages absente : règles de « en train d''écrire » non posées (base sans Realtime).';
    return;
  end if;
  drop policy if exists msg_ecrit_ecouter on realtime.messages;
  create policy msg_ecrit_ecouter on realtime.messages for select to authenticated
    using (extension = 'broadcast' and public.msg_ecrit_autorise(realtime.topic()));
  drop policy if exists msg_ecrit_signaler on realtime.messages;
  create policy msg_ecrit_signaler on realtime.messages for insert to authenticated
    with check (extension = 'broadcast' and public.msg_ecrit_autorise(realtime.topic()));
end $$;
