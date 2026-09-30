-- ════════════════════════════════════════════════════════════════════════
--  EduGest — École désactivée / abonnement expiré : appliqués PAR LA BASE
-- ════════════════════════════════════════════════════════════════════════
-- À exécuter EN DERNIER (après rls.sql → teacher-security.sql → postes.sql
-- et les deltas). Idempotent. ⚠️ Tout re-run de rls.sql redéfinit
-- auth_ecole_id() / my_compte_id() : ré-exécuter CE fichier ensuite.
--
-- CONSTAT (audit 2026-09-30) : ces deux états n'existaient que dans l'UI.
--   • École désactivée (ecoles.actif = false) : un simple texte rouge sur
--     l'écran de connexion — la connexion passait, les sessions ouvertes
--     restaient ouvertes, la RLS ne regardait jamais `actif`.
--   • Abonnement expiré (après 3 j de grâce) : lecture seule dans le shell
--     du personnel UNIQUEMENT — la base acceptait toutes les écritures, et
--     les portails enseignant/parent n'étaient pas concernés.
--
-- RÈGLES
--   1. École HORS SERVICE (actif = false ou supprime = true) : plus AUCUN
--      accès, ni lecture ni écriture. auth_ecole_id() et my_compte_id()
--      rendent NULL pour ses comptes → toutes les policies qui en dépendent
--      (quasiment toutes, dont `comptes_select` : le compte lui-même devient
--      illisible, l'app déconnecte).
--   2. Abonnement EXPIRÉ (plan payant, plan_expiry + 3 j dépassé) : LECTURE
--      SEULE pour tout le monde (personnel, enseignants, parents). Un
--      déclencheur refuse toute écriture venant d'un compte de l'école.
--      Restent permis : la demande de renouvellement (demandes_plan), les
--      abonnements push, les accusés de lecture, la mise à jour de son
--      propre compte (première connexion / mot de passe).
--   • Le superadmin (compte sans école) et service_role (Edge Functions,
--     webhook de paiement, scripts) ne sont jamais concernés.
--   • Même échéance que l'app (computePlanInfo) et que les Edge Functions
--     premium : plan ≠ gratuit, plan_expiry (epoch ms) + 3 jours.

-- ── 1. Helpers d'identité : une école hors service n'existe plus ─────────────
create or replace function auth_ecole_id() returns uuid
  language sql stable security definer set search_path = public as $$
  select c.ecole_id from comptes c
  join ecoles e on e.id = c.ecole_id
  where c.user_id = auth.uid()
    and e.actif is not false and e.supprime is not true
  limit 1;
$$;

-- Le superadmin n'a pas d'école (ecole_id null) : il garde son identité.
create or replace function my_compte_id() returns uuid
  language sql stable security definer set search_path = public as $$
  select c.id from comptes c
  left join ecoles e on e.id = c.ecole_id
  where c.user_id = auth.uid()
    and (c.ecole_id is null or (e.actif is not false and e.supprime is not true))
  limit 1;
$$;

-- ── 2. Motif de blocage des écritures du compte courant ──────────────────────
-- 'hors_service' | 'expire' | null (écriture permise). Lu sur l'école DU
-- COMPTE (pas de la ligne écrite) : une école active qui reçoit un transfert
-- d'une école expirée n'est pas bloquée.
create or replace function ecole_blocage_ecriture() returns text
  language sql stable security definer set search_path = public as $$
  select case
    when e.actif is false or e.supprime is true then 'hors_service'
    when coalesce(e.plan, 'gratuit') <> 'gratuit' and e.plan_expiry is not null
         and (extract(epoch from now()) * 1000)::bigint > e.plan_expiry + 3 * 86400000
      then 'expire'
  end
  from comptes c join ecoles e on e.id = c.ecole_id
  where c.user_id = auth.uid()
  limit 1;
$$;
revoke execute on function ecole_blocage_ecriture() from public, anon;
grant execute on function ecole_blocage_ecriture() to authenticated;

-- ── 3. Déclencheur (par instruction : un seul contrôle même pour 1000 lignes) ─
create or replace function garde_ecriture_ecole() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  motif text;
begin
  -- service_role / SQL Editor (pas de JWT) : jamais bloqués.
  if coalesce(auth.role(), 'service_role') <> 'authenticated' then return null; end if;
  motif := ecole_blocage_ecriture();
  if motif = 'expire' then
    raise exception 'Abonnement expiré : l''établissement est en lecture seule. Renouvelez l''abonnement depuis le tableau de bord.'
      using errcode = 'P0001', hint = 'abonnement_expire';
  elsif motif = 'hors_service' then
    raise exception 'Établissement désactivé : aucune modification n''est possible.'
      using errcode = 'P0001', hint = 'ecole_hors_service';
  end if;
  return null;
end $$;
revoke execute on function garde_ecriture_ecole() from public, anon, authenticated;

-- Pose sur TOUTES les tables du schéma public, sauf les exceptions. Une table
-- créée plus tard n'est pas couverte : ré-exécuter ce fichier.
do $$
declare
  t text;
  -- Jamais bloquées : renouvellement, push, accusés de lecture, tables
  -- alimentées par service_role / déclencheurs.
  exclues text[] := array[
    'demandes_plan', 'push_subs', 'audit', 'notifications_envois',
    'codes_reinitialisation', 'superadmin_messages', 'superadmin_message_lectures',
    'messages_internes_lus', 'msg_annonces_lus'];
  -- UPDATE permis (propre compte : première connexion ; msg_membres : « lu
  -- jusqu'à »), INSERT/DELETE bloqués.
  maj_permise text[] := array['comptes', 'msg_membres'];
begin
  for t in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and not c.relispartition
  loop
    execute format('drop trigger if exists trg_garde_ecriture_ecole on %I', t);
    continue when t = any(exclues);
    execute format(
      'create trigger trg_garde_ecriture_ecole before %s on %I
         for each statement execute function garde_ecriture_ecole()',
      case when t = any(maj_permise) then 'insert or delete' else 'insert or update or delete' end, t);
  end loop;
end $$;

-- Contrôle :
--   select event_object_table, string_agg(event_manipulation, ',')
--   from information_schema.triggers where trigger_name = 'trg_garde_ecriture_ecole'
--   group by 1 order by 1;
