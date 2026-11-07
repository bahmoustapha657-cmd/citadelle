-- 20261030192500_push_subs_plusieurs_appareils.sql
-- Pourquoi : la clé (ecole_id, user_id) ne gardait qu'un seul appareil par
-- personne : ouvrir l'application sur l'ordinateur retirait le téléphone, qui
-- ne recevait plus rien, appels compris. Une ligne par appareil désormais :
-- l'adresse d'abonnement entre dans la clé.
--
-- Règles (docs/migrations-sql.md) :
--  - appliquée UNE fois, dans l'ordre, par la CI au déploiement — jamais à
--    la main dans l'éditeur SQL ;
--  - compatible avec le front encore en ligne (ajouter avant de retirer) ;
--  - ne jamais modifier une migration déjà fusionnée : en écrire une autre.

-- Colonne calculée : l'ancien front, qui n'envoie que `subscription`, continue
-- de fonctionner, son upsert visant désormais la nouvelle clé.
delete from public.push_subs where coalesce(subscription->>'endpoint', '') = '';

alter table public.push_subs
  add column endpoint text generated always as (subscription->>'endpoint') stored not null;

alter table public.push_subs drop constraint push_subs_pkey;
alter table public.push_subs add constraint push_subs_pkey primary key (ecole_id, user_id, endpoint);

notify pgrst, 'reload schema';
