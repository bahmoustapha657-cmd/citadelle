-- ════════════════════════════════════════════════════════════════════════
--  EduGest — Abonnements push : un navigateur = un seul abonné  [delta]
-- ════════════════════════════════════════════════════════════════════════
-- À exécuter dans Supabase → SQL Editor, APRÈS push-subs-verrou.sql.
-- Idempotent. Ne supprime rien en masse : le nettoyage des doublons déjà
-- présents (étape 3) est commenté, à lancer après lecture du contrôle.
--
-- CONSTAT (2026-10-08) : un navigateur a UNE adresse d'abonnement push
-- (subscription->>'endpoint'), quel que soit le compte connecté. Sur un
-- appareil partagé (secrétariat, cybercafé, téléphone familial), chaque
-- compte qui s'y connectait ajoutait sa ligne avec la même adresse, et
-- aucune n'était retirée : le navigateur continuait de recevoir les
-- notifications des comptes précédents — paiements, absences, messages
-- d'une autre famille ou du personnel.
--
-- RÈGLES
--   1. Déclencheur push_subs_un_navigateur : quand une ligne est écrite,
--      les AUTRES lignes portant la même adresse sont supprimées — le
--      dernier compte connecté sur ce navigateur est le seul abonné.
--      (Un compte reste abonné sur ses autres appareils : adresses
--      différentes.) L'adresse est un secret du navigateur, illisible des
--      autres comptes (RLS) : personne ne peut viser la ligne d'autrui.
--   2. Côté application (auth-supabase.js, signOut) : à la déconnexion, la
--      ligne de CE navigateur est supprimée et le navigateur se désabonne.
--      Le déclencheur couvre les cas sans déconnexion (session expirée,
--      ancien client).

-- ── 1. Index sur l'adresse du navigateur ────────────────────────────────────
create index if not exists idx_push_subs_endpoint on push_subs ((subscription->>'endpoint'));

-- ── 2. Déclencheur : le dernier compte connecté garde seul l'adresse ─────────
create or replace function push_subs_un_navigateur() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.subscription->>'endpoint', '') = '' then return null; end if;
  delete from push_subs
   where subscription->>'endpoint' = new.subscription->>'endpoint'
     and (ecole_id, user_id) is distinct from (new.ecole_id, new.user_id);
  return null;
end $$;
-- Jamais appelable en direct (piège EXECUTE à PUBLIC).
revoke execute on function push_subs_un_navigateur() from public, anon, authenticated;

drop trigger if exists trg_push_subs_un_navigateur on push_subs;
create trigger trg_push_subs_un_navigateur after insert or update of subscription on push_subs
  for each row execute function push_subs_un_navigateur();

-- ── 3. Doublons déjà présents (contrôle, puis nettoyage sur confirmation) ────
-- Contrôle : adresses partagées par plusieurs lignes (la plus récente garde
-- l'adresse, les autres seraient supprimées). La colonne subscription n'est
-- pas affichée : seul un rang et l'école/compte de chaque ligne.
select dense_rank() over (order by ps.subscription->>'endpoint') as navigateur,
       e.code as ecole, c.login, ps.role, ps.updated_at,
       case when row_number() over (partition by ps.subscription->>'endpoint'
                                    order by ps.updated_at desc nulls last) = 1
            then 'garde' else 'supprimée' end as devenir
from push_subs ps
left join comptes c on c.user_id = ps.user_id
left join ecoles e on e.id = ps.ecole_id
where ps.subscription->>'endpoint' in (
  select subscription->>'endpoint' from push_subs
  group by 1 having count(*) > 1)
order by navigateur, ps.updated_at desc nulls last;

-- Nettoyage (le nombre de lignes supprimées = les « supprimée » ci-dessus) :
-- delete from push_subs ps
--  using (select ecole_id, user_id,
--                row_number() over (partition by subscription->>'endpoint'
--                                   order by updated_at desc nulls last) as rang
--           from push_subs
--          where coalesce(subscription->>'endpoint', '') <> '') d
--  where d.ecole_id = ps.ecole_id and d.user_id = ps.user_id and d.rang > 1;

-- Contrôle du déclencheur et des droits :
--   select tgname from pg_trigger where tgrelid = 'push_subs'::regclass and not tgisinternal;
--   select has_function_privilege('authenticated', 'push_subs_un_navigateur()', 'execute');  -- false
