-- ════════════════════════════════════════════════════════════════════════
--  EduGest — BASELINE : schéma de la production au 2026-10-08
-- ════════════════════════════════════════════════════════════════════════
-- Photographie du schéma RÉEL de la production (workflow « Schéma
-- production », run 37820086642, Postgres 17.6), pas la somme des anciens
-- fichiers supabase/historique/*.sql — qui avaient dérivé (réparations,
-- re-runs, retouches dans le tableau de bord).
--
-- ⚠️ JAMAIS rejouée en production : elle y est marquée « déjà appliquée »
-- (supabase migration repair). Elle ne sert qu'à reconstruire une base
-- identique ailleurs (CI : base vierge à chaque PR).
--
-- Ne PAS modifier ce fichier : toute évolution = une NOUVELLE migration
-- (npm run migration:nouvelle -- <nom>). Cf. docs/migrations-sql.md.
--
-- Contenu : 1) rôle powersync_role (hors dump : les rôles sont au niveau du
-- cluster) ; 2) dump CLI (`supabase db dump`, schéma public) ; 3) Storage
-- (buckets + policies de storage.objects, exclus du dump), repris des
-- scripts d'origine et vérifiés identiques à la production.

-- ── 1. Rôle de réplication PowerSync ────────────────────────────────────────
-- En production il existe déjà (avec mot de passe, posé à la main). Ailleurs,
-- on crée un rôle sans connexion pour que les GRANT ci-dessous passent.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'powersync_role') then
    create role powersync_role nologin;
  end if;
end $$;

-- ── 2. Dump du schéma de production ─────────────────────────────────────────



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "api";


ALTER SCHEMA "api" OWNER TO "postgres";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."role_compte" AS ENUM (
    'superadmin',
    'direction',
    'admin',
    'comptable',
    'surveillant',
    'primaire',
    'college',
    'staff',
    'enseignant',
    'parent'
);


ALTER TYPE "public"."role_compte" OWNER TO "postgres";


CREATE TYPE "public"."section_scolaire" AS ENUM (
    'primaire',
    'college',
    'lycee',
    'prescolaire'
);


ALTER TYPE "public"."section_scolaire" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."annonces_publiques"("p_code" "text") RETURNS TABLE("id" "uuid", "extra" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select a.id, a.extra
  from annonces a
  join ecoles e on e.id = a.ecole_id
  where e.code = lower(btrim(p_code))
    and e.actif is not false
    and e.supprime is not true
    -- Le drapeau vit dans le jsonb (table « document »). On accepte le booléen
    -- JSON comme la chaîne "true" : les écrans ont écrit les deux au fil du temps.
    and coalesce(a.extra->>'publique', 'false') in ('true', 't')
  order by (a.extra->>'date') desc nulls last
  limit 20;
$$;


ALTER FUNCTION "public"."annonces_publiques"("p_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auth_ecole_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select c.ecole_id from comptes c
  join ecoles e on e.id = c.ecole_id
  where c.user_id = auth.uid()
    and e.actif is not false and e.supprime is not true
  limit 1;
$$;


ALTER FUNCTION "public"."auth_ecole_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auth_role"() RETURNS "public"."role_compte"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select role from comptes where user_id = auth.uid() limit 1;
$$;


ALTER FUNCTION "public"."auth_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_grade"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(is_staff() or auth_role() = 'enseignant', false);
$$;


ALTER FUNCTION "public"."can_grade"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."comptes_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if coalesce(auth.role(), 'service_role') = 'service_role' then return new; end if;
  if auth_role() in ('direction', 'superadmin') or has_module_write('admin_panel') then return new; end if;
  if old.user_id = auth.uid() then
    if new.role is distinct from old.role
       or new.ecole_id is distinct from old.ecole_id
       or new.user_id is distinct from old.user_id
       or new.login is distinct from old.login
       or new.section is distinct from old.section
       or new.sections is distinct from old.sections
       or new.matiere is distinct from old.matiere
       or new.nom is distinct from old.nom
       or new.enseignant_id is distinct from old.enseignant_id
       or new.enseignant_nom is distinct from old.enseignant_nom
       or new.poste_id is distinct from old.poste_id
       or new.extra is distinct from old.extra then
      raise exception 'Champs protégés (rôle/école/login/périmètre/poste) non modifiables.';
    end if;
  else
    if new.role is distinct from old.role
       or new.ecole_id is distinct from old.ecole_id
       or new.user_id is distinct from old.user_id
       or new.login is distinct from old.login
       or new.poste_id is distinct from old.poste_id then
      raise exception 'Champs protégés (rôle/école/login/poste) non modifiables.';
    end if;
  end if;
  return new;
end; $$;


ALTER FUNCTION "public"."comptes_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ecole_blocage_ecriture"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."ecole_blocage_ecriture"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ecoles_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  -- service_role : Edge Functions (inscription, school-lifecycle, plans) et
  -- scripts d'administration. Ils opèrent hors session utilisateur.
  if coalesce(auth.role(), 'service_role') = 'service_role' then return new; end if;

  -- Le superadmin est le propriétaire légitime de ces colonnes.
  if is_superadmin() then return new; end if;

  if new.plan is distinct from old.plan
     or new.plan_expiry is distinct from old.plan_expiry then
    raise exception 'Le plan d''abonnement est géré par EduGest et ne peut pas être modifié depuis l''école.';
  end if;

  -- Activation : DISSYMÉTRIQUE, et c'est voulu.
  -- Se désactiver ou se retirer soi-même est un droit de l'établissement
  -- (Paramètres → Zone dangereuse, réservée à la direction). REVENIR en
  -- service après une désactivation par EduGest ne l'est pas : sans cette
  -- règle, une école suspendue se rallumait toute seule.
  if new.actif is distinct from old.actif and new.actif = true then
    raise exception 'La réactivation d''une école est réservée à EduGest.';
  end if;
  if new.supprime is distinct from old.supprime and new.supprime = false then
    raise exception 'La restauration d''une école est réservée à EduGest.';
  end if;

  -- Le code est l'identifiant immuable de l'école : il sert de secret au
  -- chiffrement des QR des documents imprimés (src/reports/qr-crypto.js).
  -- Le changer rendrait illisibles tous les bulletins et reçus déjà émis.
  if new.code is distinct from old.code then
    raise exception 'Le code de l''école est immuable.';
  end if;

  return new;
end $$;


ALTER FUNCTION "public"."ecoles_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."est_membre_messagerie"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce((
    select c.ecole_id is not null and c.role::text <> 'superadmin'
    from comptes c where c.user_id = auth.uid() limit 1), false);
$$;


ALTER FUNCTION "public"."est_membre_messagerie"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."etat_ecole"("p_code" "text") RETURNS TABLE("id" "uuid", "code" "text", "nom" "text", "logo" "text", "couleur1" "text", "couleur2" "text", "actif" boolean, "supprime" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select id, code, nom, logo, couleur1, couleur2, actif, supprime
  from ecoles where code = lower(p_code);
$$;


ALTER FUNCTION "public"."etat_ecole"("p_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."garde_ecriture_ecole"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."garde_ecriture_ecole"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_module_read"("p_module" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(my_permissions() ->> p_module, '') in ('lecture', 'ecriture');
$$;


ALTER FUNCTION "public"."has_module_read"("p_module" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_module_write"("p_module" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(my_permissions() ->> p_module, '') = 'ecriture';
$$;


ALTER FUNCTION "public"."has_module_write"("p_module" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_staff"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(auth_role()::text in
    ('superadmin','direction','admin','comptable','surveillant','primaire','college','staff'), false);
$$;


ALTER FUNCTION "public"."is_staff"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_superadmin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(auth_role() = 'superadmin', false);
$$;


ALTER FUNCTION "public"."is_superadmin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."login_pour_email"("p_code" "text", "p_email" "text") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select c.login
  from comptes c
  join ecoles e on e.id = c.ecole_id
  where e.code = lower(btrim(p_code))
    and lower(c.email) = lower(btrim(p_email))
  limit 1;
$$;


ALTER FUNCTION "public"."login_pour_email"("p_code" "text", "p_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."maj_reglages_compta"("p_champs" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_cle   text;
  v_patch jsonb := '{}'::jsonb;
begin
  -- Même autorité que les tables de compta (postes.sql § 9).
  if not has_module_write('compta') then
    raise exception 'Droits insuffisants : réservé à la comptabilité.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_champs) is distinct from 'object' or p_champs = '{}'::jsonb then
    raise exception 'Aucun réglage à enregistrer.';
  end if;

  for v_cle in select jsonb_object_keys(p_champs) loop
    case v_cle
      when 'blocageParentImpaye' then
        if jsonb_typeof(p_champs -> v_cle) <> 'boolean' then
          raise exception 'blocageParentImpaye : vrai ou faux attendu.';
        end if;
        v_patch := v_patch || jsonb_build_object(v_cle, p_champs -> v_cle);
      -- Mêmes bornes que l'écran (liste, ou « Autre… » limité à 5
      -- caractères) et même forme que normaliserMonnaie (parametres-api.js).
      when 'monnaie' then
        if jsonb_typeof(p_champs -> v_cle) <> 'string'
           or char_length(btrim(p_champs ->> v_cle)) not between 1 and 5 then
          raise exception 'Monnaie invalide (1 à 5 caractères).';
        end if;
        v_patch := v_patch || jsonb_build_object(v_cle, upper(btrim(p_champs ->> v_cle)));
      else
        raise exception 'Réglage « % » non modifiable depuis la comptabilité.', v_cle
          using errcode = '42501';
    end case;
  end loop;

  -- L'école de l'APPELANT, jamais un paramètre : aucune autre école visable.
  update ecoles set extra = coalesce(extra, '{}'::jsonb) || v_patch
   where id = auth_ecole_id();
  if not found then
    raise exception 'École introuvable.';
  end if;
  return v_patch;
end $$;


ALTER FUNCTION "public"."maj_reglages_compta"("p_champs" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mes_noms_paie"() RETURNS "text"[]
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(array_agg(distinct n) filter (where n <> ''), '{}')
  from comptes c
  left join enseignants e on e.id = c.enseignant_id and e.ecole_id = c.ecole_id
  cross join lateral unnest(array[
    nom_paie_normalise(c.enseignant_nom),
    nom_paie_normalise(c.nom),
    nom_paie_normalise(concat_ws(' ', e.prenom, e.nom))
  ]) as noms(n)
  where c.user_id = auth.uid() and c.role = 'enseignant';
$$;


ALTER FUNCTION "public"."mes_noms_paie"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_ajouter_membres"("p_conv" "uuid", "p_membres" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  ec uuid := auth_ecole_id();
  noms text;
begin
  if not exists (select 1 from msg_conversations where id = p_conv and type = 'groupe')
     or not msg_suis_admin(p_conv) then
    raise exception 'Seul un administrateur du groupe peut ajouter des membres.' using errcode = '42501';
  end if;
  if exists (select 1 from unnest(coalesce(p_membres, '{}')) x where not msg_compte_joignable(x)) then
    raise exception 'Un des membres est introuvable.' using errcode = '42501';
  end if;
  perform msg_exiger_contactables(p_membres);
  with ajoutes as (
    insert into msg_membres (conversation_id, compte_id, ecole_id)
    select p_conv, x, ec from unnest(p_membres) x
    on conflict do nothing
    returning compte_id)
  select string_agg(msg_nom_compte(compte_id), ', ') into noms from ajoutes;
  if noms is not null then
    perform msg_systeme(p_conv, msg_nom_compte(my_compte_id()) || ' a ajouté ' || noms);
  end if;
end $$;


ALTER FUNCTION "public"."msg_ajouter_membres"("p_conv" "uuid", "p_membres" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_annonce_destinataires"("p_annonce" "uuid") RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select c.id
  from msg_annonces a
  join comptes c on c.ecole_id = a.ecole_id
  left join postes p on p.id = c.poste_id
  where a.id = p_annonce
    and c.role::text <> 'superadmin'
    and coalesce(c.statut, 'Actif') = 'Actif'
    and c.id is distinct from a.de_compte_id
    and (case when c.role::text = 'parent' then
           c.id = any(coalesce(a.a_comptes, '{}'))
           or msg_parent_vise(c.id, a.a_parents, a.a_parents_sections, a.a_parents_classes)
         else
           a.a_tous
           or (a.a_personnel and c.role::text <> 'enseignant')
           or (a.a_enseignants and c.role::text = 'enseignant')
           or coalesce(p.cle, c.role::text) = any(coalesce(a.a_postes, '{}'))
           or c.id = any(coalesce(a.a_comptes, '{}')) end)
    and (a.hors_pyramide or a.de_compte_id is null
         or c.id in (select msg_contactables(a.de_compte_id)));
$$;


ALTER FUNCTION "public"."msg_annonce_destinataires"("p_annonce" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_annonce_epingler"("p_id" "uuid", "p_epinglee" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not msg_annonce_gerable(p_id) then
    raise exception 'Réservé à l''expéditeur et à la direction.' using errcode = '42501';
  end if;
  update msg_annonces set epinglee = coalesce(p_epinglee, false) where id = p_id;
end $$;


ALTER FUNCTION "public"."msg_annonce_epingler"("p_id" "uuid", "p_epinglee" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_annonce_gerable"("p_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (select 1 from msg_annonces a
                 where a.id = p_id and a.ecole_id = auth_ecole_id()
                   and (a.de_compte_id = my_compte_id()
                        or auth_role()::text in ('direction', 'admin')));
$$;


ALTER FUNCTION "public"."msg_annonce_gerable"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_annonce_joindre"("p_id" "uuid", "p_pieces" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  prefixe text;
begin
  if not exists (select 1 from msg_annonces
                 where id = p_id and ecole_id = auth_ecole_id() and de_compte_id = my_compte_id()) then
    raise exception 'Seul l''auteur joint des pièces à son annonce.' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_pieces, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_pieces, '[]'::jsonb)) > 5 then
    raise exception '5 pièces jointes au plus.';
  end if;
  prefixe := auth_ecole_id()::text || '/annonces/' || p_id::text || '/';
  if exists (select 1 from jsonb_array_elements(coalesce(p_pieces, '[]'::jsonb)) e
             where coalesce(e->>'path', '') not like prefixe || '%'
                or coalesce(char_length(e->>'nom'), 0) not between 1 and 200) then
    raise exception 'Pièce jointe invalide.';
  end if;
  update msg_annonces set pieces_jointes = coalesce(p_pieces, '[]'::jsonb) where id = p_id;
end $$;


ALTER FUNCTION "public"."msg_annonce_joindre"("p_id" "uuid", "p_pieces" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_annonce_lire"("p_id" "uuid", "p_confirmer" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  moi uuid := my_compte_id();
begin
  if moi is null or moi not in (select msg_annonce_destinataires(p_id)) then return; end if;
  insert into msg_annonces_lus (annonce_id, compte_id, confirme_at)
  values (p_id, moi, case when p_confirmer then now() end)
  on conflict (annonce_id, compte_id) do update
    set confirme_at = coalesce(msg_annonces_lus.confirme_at, excluded.confirme_at);
end $$;


ALTER FUNCTION "public"."msg_annonce_lire"("p_id" "uuid", "p_confirmer" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_annonce_lisible"("p_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (select 1 from msg_annonces a
                 where a.id = p_id and a.ecole_id = auth_ecole_id()
                   and (a.de_compte_id = my_compte_id()
                        or my_compte_id() in (select msg_annonce_destinataires(a.id))));
$$;


ALTER FUNCTION "public"."msg_annonce_lisible"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_annonce_objet_auteur"("p_segment" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (select 1 from msg_annonces a
                 where a.id = msg_uuid_ou_null(p_segment)
                   and a.ecole_id = auth_ecole_id()
                   and a.de_compte_id = my_compte_id());
$$;


ALTER FUNCTION "public"."msg_annonce_objet_auteur"("p_segment" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_annonce_objet_gerable"("p_segment" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(msg_annonce_gerable(msg_uuid_ou_null(p_segment)), false);
$$;


ALTER FUNCTION "public"."msg_annonce_objet_gerable"("p_segment" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_annonce_objet_lisible"("p_segment" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(msg_annonce_lisible(msg_uuid_ou_null(p_segment)), false);
$$;


ALTER FUNCTION "public"."msg_annonce_objet_lisible"("p_segment" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_annonce_suivi"("p_id" "uuid") RETURNS TABLE("compte_id" "uuid", "user_id" "uuid", "nom" "text", "poste" "text", "lu_at" timestamp with time zone, "confirme_at" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not msg_annonce_gerable(p_id) then
    raise exception 'Suivi réservé à l''expéditeur et à la direction.' using errcode = '42501';
  end if;
  return query
  select c.id, c.user_id, msg_nom_compte(c.id), msg_poste_compte(c.id), l.lu_at, l.confirme_at
  from msg_annonce_destinataires(p_id) d(cid)
  join comptes c on c.id = d.cid
  left join msg_annonces_lus l on l.annonce_id = p_id and l.compte_id = c.id
  order by l.lu_at nulls first, 3;
end $$;


ALTER FUNCTION "public"."msg_annonce_suivi"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_annonces_stats"() RETURNS TABLE("annonce_id" "uuid", "total" integer, "lus" integer, "confirmes" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select a.id,
         (select count(*)::int from msg_annonce_destinataires(a.id)),
         (select count(*)::int from msg_annonces_lus l
           where l.annonce_id = a.id and l.compte_id in (select msg_annonce_destinataires(a.id))),
         (select count(*)::int from msg_annonces_lus l
           where l.annonce_id = a.id and l.confirme_at is not null
             and l.compte_id in (select msg_annonce_destinataires(a.id)))
  from msg_annonces a
  where a.ecole_id = auth_ecole_id()
    and (a.de_compte_id = my_compte_id() or auth_role()::text in ('direction', 'admin'))
    and a.created_at > now() - interval '180 days';
$$;


ALTER FUNCTION "public"."msg_annonces_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_annuaire"() RETURNS TABLE("id" "uuid", "user_id" "uuid", "login" "text", "nom" "text", "poste" "text", "role" "text", "poste_cle" "text", "contactable" boolean, "enfants" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with joignables as (select msg_contactables(my_compte_id()) as id),
       visibles as (select msg_visibles() as id)
  select c.id, c.user_id, c.login, msg_nom_compte(c.id), msg_poste_compte(c.id),
         c.role::text, coalesce(p.cle, c.role::text),
         c.id in (select id from joignables),
         case when c.role::text = 'parent' then
           (select coalesce(jsonb_agg(jsonb_build_object('section', x.section, 'classe', x.classe, 'nom', x.nom)
                                      order by x.section, x.classe, x.nom), '[]'::jsonb)
            from msg_enfants(c.id) x) end
  from comptes c
  left join postes p on p.id = c.poste_id
  where est_membre_messagerie()
    and c.ecole_id = auth_ecole_id()
    and c.id in (select id from visibles)
    and coalesce(c.statut, 'Actif') = 'Actif'
    and coalesce(p.actif, true)
  order by 4;
$$;


ALTER FUNCTION "public"."msg_annuaire"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_appel_lancer"("p_conv" "uuid", "p_offre" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  moi uuid := my_compte_id();
  autre uuid;
  appel uuid;
begin
  if not exists (select 1 from msg_conversations where id = p_conv and type = 'direct')
     or not exists (select 1 from msg_membres where conversation_id = p_conv and compte_id = moi) then
    raise exception 'Appel impossible depuis cette discussion.' using errcode = '42501';
  end if;
  select compte_id into autre from msg_membres where conversation_id = p_conv and compte_id <> moi limit 1;
  if autre is null or not msg_compte_joignable(autre) then
    raise exception 'Correspondant injoignable.';
  end if;
  if not msg_peut_contacter(moi, autre) then
    raise exception 'Vous ne pouvez pas appeler directement cette personne (hiérarchie de l''établissement).'
      using errcode = '42501';
  end if;
  update msg_appels set statut = 'annule', fin_at = now()
   where appelant_id = moi and statut = 'sonne';
  insert into msg_appels (ecole_id, conversation_id, appelant_id, appele_id, offre)
  values (auth_ecole_id(), p_conv, moi, autre, p_offre)
  returning id into appel;
  return appel;
end $$;


ALTER FUNCTION "public"."msg_appel_lancer"("p_conv" "uuid", "p_offre" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_appel_repondre"("p_id" "uuid", "p_reponse" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  update msg_appels set statut = 'en_cours', reponse = p_reponse, repondu_at = now()
   where id = p_id and appele_id = my_compte_id() and statut = 'sonne';
  if not found then raise exception 'Cet appel n''est plus disponible.'; end if;
end $$;


ALTER FUNCTION "public"."msg_appel_repondre"("p_id" "uuid", "p_reponse" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_appel_terminer"("p_id" "uuid", "p_statut" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  moi uuid := my_compte_id();
  a msg_appels;
  v_final text;
  trace text;
begin
  select * into a from msg_appels where id = p_id;
  if a.id is null or moi not in (a.appelant_id, a.appele_id) then
    raise exception 'Appel introuvable.' using errcode = '42501';
  end if;
  if a.statut not in ('sonne', 'en_cours') then return; end if;
  v_final := case
    when a.statut = 'en_cours' then case when p_statut = 'echec' then 'echec' else 'termine' end
    when moi = a.appele_id then case when p_statut = 'occupe' then 'occupe' else 'refuse' end
    else case when p_statut = 'manque' then 'manque' when p_statut = 'echec' then 'echec' else 'annule' end
  end;
  update msg_appels set statut = v_final, fin_at = now()
   where id = p_id and statut in ('sonne', 'en_cours');
  if not found then return; end if;
  trace := case
    when v_final in ('termine', 'echec') and a.repondu_at is not null
      then v_final || ':' || greatest(0, extract(epoch from now() - a.repondu_at)::int)
    when v_final = 'annule' then 'manque'
    else v_final end;
  insert into msg_messages (conversation_id, ecole_id, de_compte_id, type, corps)
  values (a.conversation_id, a.ecole_id, a.appelant_id, 'appel', trace);
  -- Seul un appel MANQUÉ reste « non lu » chez l'appelé.
  if trace <> 'manque' then
    update msg_membres set dernier_lu_at = greatest(dernier_lu_at, now())
     where conversation_id = a.conversation_id and compte_id = a.appele_id;
  end if;
end $$;


ALTER FUNCTION "public"."msg_appel_terminer"("p_id" "uuid", "p_statut" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_apres_message"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  update msg_conversations
     set dernier_message_at = new.created_at,
         dernier_apercu = left(case new.type
           when 'audio' then '🎤 Message vocal'
           when 'fichier' then '📎 ' || coalesce(nullif(trim(new.corps), ''), new.fichier_nom, 'Document')
           when 'appel' then case split_part(coalesce(new.corps, ''), ':', 1)
                               when 'termine' then '📞 Appel'
                               when 'reunion' then '📞 Appel de groupe'
                               when 'refuse'  then '📞 Appel refusé'
                               when 'occupe'  then '📞 Appel non abouti'
                               when 'echec'   then '📞 Appel interrompu'
                               else '📞 Appel manqué' end
           else coalesce(new.corps, '') end, 140)
   where id = new.conversation_id;
  if new.de_compte_id is not null and new.type in ('texte', 'audio', 'fichier') then
    update msg_membres set dernier_lu_at = greatest(dernier_lu_at, new.created_at)
     where conversation_id = new.conversation_id and compte_id = new.de_compte_id;
  end if;
  return null;
end $$;


ALTER FUNCTION "public"."msg_apres_message"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_avant_annonce"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.de_compte_id is not null then
    select msg_nom_compte(c.id),
           case when c.role::text = 'enseignant' then 'Enseignant'
                else coalesce(p.label, c.label, c.role::text) end
      into new.de_nom, new.de_poste
      from comptes c left join postes p on p.id = c.poste_id
     where c.id = new.de_compte_id;
  end if;
  new.de_nom := coalesce(new.de_nom, '');
  return new;
end $$;


ALTER FUNCTION "public"."msg_avant_annonce"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_boite"() RETURNS TABLE("id" "uuid", "type" "text", "titre" "text", "cree_par" "uuid", "created_at" timestamp with time zone, "dernier_message_at" timestamp with time zone, "dernier_apercu" "text", "archive" boolean, "epingle" boolean, "sourdine" boolean, "admin" boolean, "dernier_lu_at" timestamp with time zone, "non_lus" integer, "membres" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select c.id, c.type, c.titre, c.cree_par, c.created_at, c.dernier_message_at, c.dernier_apercu,
         m.archive, m.epingle, m.sourdine, m.admin, m.dernier_lu_at,
         (select count(*)::int from msg_messages x
           where x.conversation_id = c.id and x.created_at > m.dernier_lu_at
             and x.de_compte_id is distinct from m.compte_id and not x.supprime
             and x.type <> 'systeme'),
         (select coalesce(jsonb_agg(jsonb_build_object(
                   'id', mm.compte_id, 'admin', mm.admin, 'lu', mm.dernier_lu_at,
                   'sourdine', mm.sourdine) order by mm.rejoint_at), '[]'::jsonb)
            from msg_membres mm where mm.conversation_id = c.id)
  from msg_membres m
  join msg_conversations c on c.id = m.conversation_id
  where m.compte_id = my_compte_id()
  order by c.dernier_message_at desc;
$$;


ALTER FUNCTION "public"."msg_boite"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_branches_de"("p_sections" "text"[]) RETURNS "text"[]
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select coalesce(array(
    select distinct case when s in ('college', 'lycee') then 'secondaire' else 'primaire' end
    from unnest(coalesce(p_sections, '{}')) s where s is not null), '{}');
$$;


ALTER FUNCTION "public"."msg_branches_de"("p_sections" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_branches_dirigees"("p_ecole" "uuid") RETURNS "text"[]
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(array_agg(distinct b), '{}')
  from msg_profils_ecole(p_ecole, null) r, unnest(r.branches) b
  where r.niveau = 'responsable';
$$;


ALTER FUNCTION "public"."msg_branches_dirigees"("p_ecole" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_branches_eff"("p" "text"[]) RETURNS "text"[]
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select case when coalesce(cardinality(p), 0) = 0 then array['secondaire', 'primaire'] else p end;
$$;


ALTER FUNCTION "public"."msg_branches_eff"("p" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_compte_joignable"("p_compte" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from comptes c
    left join postes p on p.id = c.poste_id
    where c.id = p_compte
      and c.ecole_id = auth_ecole_id()
      and c.role::text <> 'superadmin'
      and coalesce(c.statut, 'Actif') = 'Actif'
      and coalesce(p.actif, true));
$$;


ALTER FUNCTION "public"."msg_compte_joignable"("p_compte" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_contactables"("p_de" "uuid") RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with profils as (
    select * from msg_profils_ecole((select ecole_id from comptes where id = p_de), null)
  ),
  moi as (select * from profils where compte_id = p_de),
  dirigees as (
    select coalesce(array_agg(distinct b), '{}') d
    from profils r, unnest(r.branches) b where r.niveau = 'responsable'
  )
  select autre.compte_id
  from profils autre, moi, dirigees
  where autre.compte_id <> moi.compte_id
    and msg_regle(moi.niveau, moi.branches, moi.cle, autre.niveau, autre.branches, autre.cle, dirigees.d);
$$;


ALTER FUNCTION "public"."msg_contactables"("p_de" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_creer_groupe"("p_titre" "text", "p_membres" "uuid"[]) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  moi uuid := my_compte_id();
  ec  uuid := auth_ecole_id();
  v_titre text := left(trim(coalesce(p_titre, '')), 80);
  autres uuid[];
  conv uuid;
begin
  if not est_membre_messagerie() then
    raise exception 'Messagerie non autorisée.' using errcode = '42501';
  end if;
  if v_titre = '' then raise exception 'Donnez un nom au groupe.'; end if;
  select coalesce(array_agg(distinct x), '{}') into autres
    from unnest(coalesce(p_membres, '{}')) x where x is distinct from moi;
  if cardinality(autres) = 0 then raise exception 'Ajoutez au moins un membre.'; end if;
  if exists (select 1 from unnest(autres) x where not msg_compte_joignable(x)) then
    raise exception 'Un des membres est introuvable.' using errcode = '42501';
  end if;
  perform msg_exiger_contactables(autres);
  insert into msg_conversations (ecole_id, type, titre, cree_par)
  values (ec, 'groupe', v_titre, moi) returning id into conv;
  insert into msg_membres (conversation_id, compte_id, ecole_id, admin) values (conv, moi, ec, true);
  insert into msg_membres (conversation_id, compte_id, ecole_id)
  select conv, x, ec from unnest(autres) x;
  perform msg_systeme(conv, msg_nom_compte(moi) || ' a créé le groupe « ' || v_titre || ' »');
  return conv;
end $$;


ALTER FUNCTION "public"."msg_creer_groupe"("p_titre" "text", "p_membres" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_definir_admin"("p_conv" "uuid", "p_compte" "uuid", "p_admin" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not msg_suis_admin(p_conv) then
    raise exception 'Réservé aux administrateurs du groupe.' using errcode = '42501';
  end if;
  update msg_membres set admin = coalesce(p_admin, false)
   where conversation_id = p_conv and compte_id = p_compte;
end $$;


ALTER FUNCTION "public"."msg_definir_admin"("p_conv" "uuid", "p_compte" "uuid", "p_admin" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_enfants"("p_parent" "uuid") RETURNS TABLE("eleve_id" "uuid", "section" "text", "classe" "text", "nom" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select e.id, e.section::text, coalesce(e.classe, ''),
         trim(coalesce(e.prenom, '') || ' ' || coalesce(e.nom, ''))
  from parent_eleves pe
  join eleves e on e.id = pe.eleve_id
  where pe.compte_id = p_parent
    and coalesce(e.statut, '') not in ('Transféré', 'Exclu', 'Abandonné', 'Décédé', 'Diplômé');
$$;


ALTER FUNCTION "public"."msg_enfants"("p_parent" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_exiger_contactables"("p_comptes" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  hors text;
begin
  if auth_role()::text = 'parent'
     or exists (select 1 from comptes c
                where c.id = any(coalesce(p_comptes, '{}')) and c.role::text = 'parent') then
    raise exception 'Les parents échangent en discussion directe uniquement, pas en groupe.'
      using errcode = '42501';
  end if;
  select string_agg(msg_nom_compte(x), ', ') into hors
  from unnest(coalesce(p_comptes, '{}')) x
  where x is distinct from my_compte_id() and not msg_peut_contacter(my_compte_id(), x);
  if hors is not null then
    raise exception 'Hors de votre périmètre (hiérarchie de l''établissement) : %', hors using errcode = '42501';
  end if;
end $$;


ALTER FUNCTION "public"."msg_exiger_contactables"("p_comptes" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_marquer_lu"("p_conv" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  update msg_membres set dernier_lu_at = now()
   where conversation_id = p_conv and compte_id = my_compte_id();
$$;


ALTER FUNCTION "public"."msg_marquer_lu"("p_conv" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_mes_conversations"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select conversation_id from msg_membres where compte_id = my_compte_id();
$$;


ALTER FUNCTION "public"."msg_mes_conversations"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_modifier_message"("p_id" "uuid", "p_corps" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  texte text := trim(coalesce(p_corps, ''));
  msg msg_messages;
begin
  if texte = '' then raise exception 'Le message est vide.'; end if;
  select * into msg from msg_messages where id = p_id;
  if msg.id is null or msg.de_compte_id is distinct from my_compte_id()
     or msg.type <> 'texte' or msg.supprime then
    raise exception 'Modification impossible.' using errcode = '42501';
  end if;
  if msg.created_at < now() - interval '24 hours' then
    raise exception 'Un message ne se modifie que dans les 24 heures.';
  end if;
  update msg_messages set corps = left(texte, 4000), modifie_at = now() where id = p_id;
  update msg_conversations set dernier_apercu = left(texte, 140)
   where id = msg.conversation_id and dernier_message_at = msg.created_at;
end $$;


ALTER FUNCTION "public"."msg_modifier_message"("p_id" "uuid", "p_corps" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_nom_compte"("p_compte" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(nullif(trim(c.extra->>'nomSignature'), ''),
                  nullif(trim(c.enseignant_nom), ''),
                  nullif(trim(c.nom), ''), c.login)
  from comptes c where c.id = p_compte;
$$;


ALTER FUNCTION "public"."msg_nom_compte"("p_compte" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_ouvrir_directe"("p_compte" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  moi uuid := my_compte_id();
  ec  uuid := auth_ecole_id();
  cle text;
  conv uuid;
begin
  if not est_membre_messagerie() then
    raise exception 'Messagerie non autorisée.' using errcode = '42501';
  end if;
  if p_compte is null or p_compte = moi then raise exception 'Destinataire invalide.'; end if;
  if not msg_compte_joignable(p_compte) then
    raise exception 'Destinataire introuvable.' using errcode = '42501';
  end if;
  cle := least(moi::text, p_compte::text) || ':' || greatest(moi::text, p_compte::text);
  -- Discussion déjà ouverte (par exemple par le supérieur) : on la retrouve.
  select c.id into conv from msg_conversations c where c.ecole_id = ec and c.cle_directe = cle;
  if conv is null then
    if not msg_peut_contacter(moi, p_compte) then
      raise exception 'Vous ne pouvez pas contacter directement cette personne (hiérarchie de l''établissement).'
        using errcode = '42501';
    end if;
    insert into msg_conversations (ecole_id, type, cle_directe, cree_par)
    values (ec, 'direct', cle, moi)
    on conflict (ecole_id, cle_directe) do nothing
    returning id into conv;
    if conv is null then
      select c.id into conv from msg_conversations c where c.ecole_id = ec and c.cle_directe = cle;
    end if;
  end if;
  insert into msg_membres (conversation_id, compte_id, ecole_id)
  values (conv, moi, ec), (conv, p_compte, ec)
  on conflict do nothing;
  return conv;
end $$;


ALTER FUNCTION "public"."msg_ouvrir_directe"("p_compte" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_parent_vise"("p_parent" "uuid", "p_tous" boolean, "p_sections" "text"[], "p_classes" "text"[]) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from msg_enfants(p_parent) e
    where coalesce(p_tous, false)
       or e.section = any(coalesce(p_sections, '{}'))
       or (e.section || '|' || e.classe) = any(coalesce(p_classes, '{}')));
$$;


ALTER FUNCTION "public"."msg_parent_vise"("p_parent" "uuid", "p_tous" boolean, "p_sections" "text"[], "p_classes" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_peut_contacter"("p_de" "uuid", "p_vers" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce((
    select msg_regle(de.niveau, de.branches, de.cle, vers.niveau, vers.branches, vers.cle,
                     case when de.niveau = 'enseignant' and vers.niveau = 'sommet'
                          then msg_branches_dirigees(c.ecole_id) end)
    from comptes c
    cross join lateral msg_profils_ecole(c.ecole_id, p_de) de
    cross join lateral msg_profils_ecole(c.ecole_id, p_vers) vers
    where c.id = p_de and p_de is distinct from p_vers), false);
$$;


ALTER FUNCTION "public"."msg_peut_contacter"("p_de" "uuid", "p_vers" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_poste_compte"("p_compte" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select case
    when c.role::text = 'enseignant'
      then 'Enseignant' || coalesce(' · ' || nullif(trim(c.matiere), ''), '')
    when c.role::text = 'parent'
      then 'Parent' || coalesce(' · ' || (
        select string_agg(x.nom || case when x.classe <> '' then ' (' || x.classe || ')' else '' end,
                          ', ' order by x.classe, x.nom)
        from msg_enfants(c.id) x), '')
    else coalesce(p.label, c.label, c.role::text) end
  from comptes c
  left join postes p on p.id = c.poste_id
  where c.id = p_compte;
$$;


ALTER FUNCTION "public"."msg_poste_compte"("p_compte" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_preferences"("p_conv" "uuid", "p_archive" boolean, "p_epingle" boolean, "p_sourdine" boolean) RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  update msg_membres
     set archive  = coalesce(p_archive, archive),
         epingle  = coalesce(p_epingle, epingle),
         sourdine = coalesce(p_sourdine, sourdine)
   where conversation_id = p_conv and compte_id = my_compte_id();
$$;


ALTER FUNCTION "public"."msg_preferences"("p_conv" "uuid", "p_archive" boolean, "p_epingle" boolean, "p_sourdine" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_presence"("p_etat" "text") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  insert into msg_presences (compte_id, ecole_id, etat, vu_at)
  select c.id, c.ecole_id,
         case when p_etat in ('actif', 'absent', 'hors_ligne') then p_etat else 'actif' end,
         now()
  from comptes c
  where c.user_id = auth.uid() and c.ecole_id is not null
    and c.role::text <> 'superadmin'
  on conflict (compte_id) do update
    set etat = excluded.etat, vu_at = excluded.vu_at, ecole_id = excluded.ecole_id;
$$;


ALTER FUNCTION "public"."msg_presence"("p_etat" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_presences"() RETURNS TABLE("compte_id" "uuid", "etat" "text", "depuis" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select p.compte_id,
         case when p.vu_at > now() - interval '150 seconds' then p.etat else 'hors_ligne' end,
         greatest(0, extract(epoch from now() - p.vu_at))::int
  from msg_presences p
  where est_membre_messagerie() and p.ecole_id = auth_ecole_id()
    and p.compte_id in (select msg_visibles());
$$;


ALTER FUNCTION "public"."msg_presences"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_profils"("p_ecole" "uuid") RETURNS TABLE("compte_id" "uuid", "niveau" "text", "branches" "text"[])
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select compte_id, niveau, branches from msg_profils_ecole(p_ecole, null);
$$;


ALTER FUNCTION "public"."msg_profils"("p_ecole" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_profils_ecole"("p_ecole" "uuid", "p_compte" "uuid") RETURNS TABLE("compte_id" "uuid", "niveau" "text", "branches" "text"[], "cle" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select c.id,
         case when c.role::text in ('direction', 'admin') then 'sommet'
              when c.role::text = 'enseignant' then 'enseignant'
              when c.role::text = 'parent' then 'parent'
              else 'responsable' end,
         case when c.role::text = 'enseignant' then
                msg_branches_de(array(select s::text from unnest(coalesce(c.sections, '{}')
                  || case when c.section is null then '{}'::section_scolaire[] else array[c.section] end) s))
              when c.role::text = 'parent' then
                msg_branches_de(array(select x.section from msg_enfants(c.id) x))
              when c.role::text in ('direction', 'admin') then '{}'::text[]
              when coalesce(p.cle, c.role::text) = 'college' then array['secondaire']
              when coalesce(p.cle, c.role::text) = 'primaire' then array['primaire']
              else '{}'::text[] end,
         coalesce(p.cle, c.role::text)
  from comptes c
  left join postes p on p.id = c.poste_id
  where c.ecole_id = p_ecole
    and (p_compte is null or c.id = p_compte)
    and c.role::text <> 'superadmin'
    and coalesce(c.statut, 'Actif') = 'Actif'
    and coalesce(p.actif, true);
$$;


ALTER FUNCTION "public"."msg_profils_ecole"("p_ecole" "uuid", "p_compte" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_regle"("de_niv" "text", "de_br" "text"[], "de_cle" "text", "vers_niv" "text", "vers_br" "text"[], "vers_cle" "text", "dirigees" "text"[]) RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select coalesce(case de_niv
    -- Sommet : tout le monde, parents compris.
    when 'sommet' then true
    when 'responsable' then case vers_niv
      when 'sommet' then true
      when 'responsable' then true
      -- Chef de section → les enseignants de sa branche.
      when 'enseignant' then cardinality(de_br) > 0 and de_br && msg_branches_eff(vers_br)
      -- Comptable → tous les parents ; chef de section → ceux de sa branche.
      when 'parent' then de_cle = 'comptable'
                         or (cardinality(de_br) > 0 and de_br && msg_branches_eff(vers_br))
      else false end
    when 'enseignant' then case vers_niv
      -- Son chef de section…
      when 'responsable' then cardinality(vers_br) > 0 and vers_br && msg_branches_eff(de_br)
      -- … les enseignants de sa branche…
      when 'enseignant' then msg_branches_eff(de_br) && msg_branches_eff(vers_br)
      -- … et le sommet si une de ses branches n'a pas de chef.
      when 'sommet' then not (msg_branches_eff(de_br) <@ coalesce(dirigees, '{}'))
      else false end
    when 'parent' then case vers_niv
      when 'sommet' then true
      when 'responsable' then vers_cle = 'comptable'
                              or (cardinality(vers_br) > 0 and vers_br && msg_branches_eff(de_br))
      else false end
    else false end, false);
$$;


ALTER FUNCTION "public"."msg_regle"("de_niv" "text", "de_br" "text"[], "de_cle" "text", "vers_niv" "text", "vers_br" "text"[], "vers_cle" "text", "dirigees" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_renommer_groupe"("p_conv" "uuid", "p_titre" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_titre text := left(trim(coalesce(p_titre, '')), 80);
begin
  if v_titre = '' then raise exception 'Le nom du groupe est vide.'; end if;
  if not exists (select 1 from msg_conversations where id = p_conv and type = 'groupe')
     or not msg_suis_admin(p_conv) then
    raise exception 'Réservé aux administrateurs du groupe.' using errcode = '42501';
  end if;
  update msg_conversations set titre = v_titre where id = p_conv;
  perform msg_systeme(p_conv, msg_nom_compte(my_compte_id()) || ' a renommé le groupe en « ' || v_titre || ' »');
end $$;


ALTER FUNCTION "public"."msg_renommer_groupe"("p_conv" "uuid", "p_titre" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_reprendre_message_interne"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into msg_annonces (id, ecole_id, de_compte_id, de_nom, de_poste, titre, corps,
                            priorite, a_personnel, a_postes, a_comptes, created_at, hors_pyramide)
  values (new.id, new.ecole_id, new.de_compte_id, new.de_nom, new.de_poste, new.sujet, new.corps,
          case when new.sujet like '🔑%' then 'importante' else 'normale' end,
          new.a_tous, new.a_postes,
          case when new.a_compte_id is null then null else array[new.a_compte_id] end,
          coalesce(new.created_at, now()), true)
  on conflict (id) do nothing;
  return null;
end $$;


ALTER FUNCTION "public"."msg_reprendre_message_interne"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_retirer_membre"("p_conv" "uuid", "p_compte" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  moi uuid := my_compte_id();
  nom_cible text := msg_nom_compte(p_compte);
begin
  if not exists (select 1 from msg_conversations where id = p_conv and type = 'groupe') then
    raise exception 'On ne quitte pas une discussion directe.';
  end if;
  if p_compte is distinct from moi and not msg_suis_admin(p_conv) then
    raise exception 'Seul un administrateur du groupe peut retirer un membre.' using errcode = '42501';
  end if;
  if not exists (select 1 from msg_membres where conversation_id = p_conv and compte_id = p_compte) then
    raise exception 'Ce compte ne fait pas partie du groupe.';
  end if;
  -- Message système AVANT le retrait : le partant le voit encore passer.
  perform msg_systeme(p_conv, case when p_compte = moi
    then nom_cible || ' a quitté le groupe'
    else msg_nom_compte(moi) || ' a retiré ' || nom_cible end);
  delete from msg_membres where conversation_id = p_conv and compte_id = p_compte;
  if not exists (select 1 from msg_membres where conversation_id = p_conv) then
    delete from msg_conversations where id = p_conv;
  elsif not exists (select 1 from msg_membres where conversation_id = p_conv and admin) then
    -- Plus d'administrateur : le plus ancien membre le devient.
    update msg_membres set admin = true
     where conversation_id = p_conv
       and compte_id = (select compte_id from msg_membres where conversation_id = p_conv
                        order by rejoint_at limit 1);
  end if;
end $$;


ALTER FUNCTION "public"."msg_retirer_membre"("p_conv" "uuid", "p_compte" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_reunion_clore"("p_reunion" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  r msg_reunions;
  nb int;
begin
  update msg_reunions set statut = 'termine', fin_at = now()
   where id = p_reunion and statut = 'en_cours'
   returning * into r;
  if r.id is null then return; end if;
  update msg_reunion_participants set quitte_at = coalesce(quitte_at, now()) where reunion_id = p_reunion;
  select count(*) into nb from msg_reunion_participants where reunion_id = p_reunion;
  insert into msg_messages (conversation_id, ecole_id, de_compte_id, type, corps)
  values (r.conversation_id, r.ecole_id, r.lance_par, 'appel',
          'reunion:' || greatest(0, extract(epoch from now() - r.created_at)::int) || ':' || nb);
  -- Trace informative : ne compte pas comme non lue.
  update msg_membres m set dernier_lu_at = greatest(m.dernier_lu_at, now())
   where m.conversation_id = r.conversation_id
     and m.compte_id in (select compte_id from msg_reunion_participants where reunion_id = p_reunion);
end $$;


ALTER FUNCTION "public"."msg_reunion_clore"("p_reunion" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_reunion_demarrer"("p_conv" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  moi uuid := my_compte_id();
  existante uuid;
  nouvelle uuid;
begin
  if not est_membre_messagerie()
     or not exists (select 1 from msg_membres where conversation_id = p_conv and compte_id = moi) then
    raise exception 'Appel impossible depuis cette discussion.' using errcode = '42501';
  end if;
  select id into existante from msg_reunions where conversation_id = p_conv and statut = 'en_cours';
  if existante is not null then
    if exists (select 1 from msg_reunion_presents(existante)) then return existante; end if;
    perform msg_reunion_clore(existante);  -- restes d'un appel abandonné
  end if;
  if not msg_suis_admin(p_conv)
     and exists (select 1 from msg_membres m
                 where m.conversation_id = p_conv and m.compte_id <> moi
                   and not msg_peut_contacter(moi, m.compte_id)) then
    raise exception 'Seul un administrateur du groupe (ou un responsable de tous ses membres) peut lancer l''appel.'
      using errcode = '42501';
  end if;
  begin
    insert into msg_reunions (ecole_id, conversation_id, lance_par)
    values (auth_ecole_id(), p_conv, moi) returning id into nouvelle;
  exception when unique_violation then
    select id into nouvelle from msg_reunions where conversation_id = p_conv and statut = 'en_cours';
    return nouvelle;
  end;
  perform msg_systeme(p_conv, msg_nom_compte(moi) || ' a lancé un appel de groupe');
  return nouvelle;
end $$;


ALTER FUNCTION "public"."msg_reunion_demarrer"("p_conv" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_reunion_etat"("p_reunion" "uuid", "p_micro" boolean, "p_camera" boolean) RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  update msg_reunion_participants
     set micro = coalesce(p_micro, micro), camera = coalesce(p_camera, camera), vu_at = now()
   where reunion_id = p_reunion and compte_id = my_compte_id() and quitte_at is null;
$$;


ALTER FUNCTION "public"."msg_reunion_etat"("p_reunion" "uuid", "p_micro" boolean, "p_camera" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_reunion_presents"("p_reunion" "uuid") RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select compte_id from msg_reunion_participants
  where reunion_id = p_reunion and quitte_at is null and vu_at > now() - interval '60 seconds';
$$;


ALTER FUNCTION "public"."msg_reunion_presents"("p_reunion" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_reunion_quitter"("p_reunion" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  update msg_reunion_participants set quitte_at = now()
   where reunion_id = p_reunion and compte_id = my_compte_id() and quitte_at is null;
  if not exists (select 1 from msg_reunion_presents(p_reunion)) then
    perform msg_reunion_clore(p_reunion);
  end if;
end $$;


ALTER FUNCTION "public"."msg_reunion_quitter"("p_reunion" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_reunions_actives"() RETURNS TABLE("id" "uuid", "conversation_id" "uuid", "lance_par" "uuid", "created_at" timestamp with time zone, "presents" "uuid"[])
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select r.id, r.conversation_id, r.lance_par, r.created_at,
         array(select msg_reunion_presents(r.id))
  from msg_reunions r
  where r.statut = 'en_cours'
    and r.conversation_id in (select msg_mes_conversations())
    and exists (select 1 from msg_reunion_presents(r.id));
$$;


ALTER FUNCTION "public"."msg_reunions_actives"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_suis_admin"("p_conv" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (select 1 from msg_membres
                 where conversation_id = p_conv and compte_id = my_compte_id() and admin);
$$;


ALTER FUNCTION "public"."msg_suis_admin"("p_conv" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_suis_parent_vise"("p_tous" boolean, "p_sections" "text"[], "p_classes" "text"[]) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select auth_role()::text = 'parent'
     and msg_parent_vise(my_compte_id(), p_tous, p_sections, p_classes);
$$;


ALTER FUNCTION "public"."msg_suis_parent_vise"("p_tous" boolean, "p_sections" "text"[], "p_classes" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_supprimer_message"("p_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  msg msg_messages;
begin
  select * into msg from msg_messages where id = p_id;
  if msg.id is null or msg.de_compte_id is distinct from my_compte_id()
     or msg.type not in ('texte', 'audio', 'fichier') then
    raise exception 'Suppression impossible.' using errcode = '42501';
  end if;
  update msg_messages
     set supprime = true, corps = null, audio_path = null,
         fichier_path = null, fichier_nom = null, fichier_type = null, fichier_taille = null
   where id = p_id;
  update msg_conversations set dernier_apercu = '🚫 Message supprimé'
   where id = msg.conversation_id and dernier_message_at = msg.created_at;
  return coalesce(msg.audio_path, msg.fichier_path);
end $$;


ALTER FUNCTION "public"."msg_supprimer_message"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_systeme"("p_conv" "uuid", "p_texte" "text") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  insert into msg_messages (conversation_id, ecole_id, de_compte_id, type, corps)
  select c.id, c.ecole_id, my_compte_id(), 'systeme', left(p_texte, 4000)
  from msg_conversations c where c.id = p_conv;
$$;


ALTER FUNCTION "public"."msg_systeme"("p_conv" "uuid", "p_texte" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_uuid_ou_null"("p" "text") RETURNS "uuid"
    LANGUAGE "sql" IMMUTABLE
    AS $_$
  select case when p ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then p::uuid end;
$_$;


ALTER FUNCTION "public"."msg_uuid_ou_null"("p" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."msg_visibles"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with moi as (
    select id, ecole_id, role::text as role from comptes where user_id = auth.uid() limit 1
  ),
  joignables as (select msg_contactables((select id from moi)) as id),
  correspondants as (
    select m2.compte_id as id
    from msg_membres m1
    join msg_membres m2 on m2.conversation_id = m1.conversation_id
    where m1.compte_id = (select id from moi)
  )
  select c.id
  from comptes c, moi
  where c.ecole_id = moi.ecole_id
    and c.role::text <> 'superadmin'
    and ((moi.role <> 'parent' and c.role::text <> 'parent')
         or c.id = moi.id
         or c.id in (select id from joignables)
         or c.id in (select id from correspondants));
$$;


ALTER FUNCTION "public"."msg_visibles"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."my_compte_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select c.id from comptes c
  left join ecoles e on e.id = c.ecole_id
  where c.user_id = auth.uid()
    and (c.ecole_id is null or (e.actif is not false and e.supprime is not true))
  limit 1;
$$;


ALTER FUNCTION "public"."my_compte_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."my_eleve_ids"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select eleve_id from parent_eleves where compte_id = my_compte_id();
$$;


ALTER FUNCTION "public"."my_eleve_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."my_permissions"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select case
    when c.role in ('direction','superadmin') then
      '{"accueil":"ecriture","historique":"ecriture","admin_panel":"ecriture",
        "parametres":"ecriture","compta":"ecriture","primaire":"ecriture",
        "secondaire":"ecriture","calendrier":"ecriture","examens":"ecriture",
        "messages":"ecriture","fondation":"ecriture"}'::jsonb
    when c.role in ('parent', 'enseignant') then '{}'::jsonb
    when c.poste_id is not null then
      case when p.actif then coalesce(p.permissions, '{}'::jsonb) else '{}'::jsonb end
    when c.role = 'admin' then
      '{"accueil":"lecture","historique":"lecture","admin_panel":"ecriture",
        "parametres":"ecriture","compta":"lecture","primaire":"ecriture",
        "secondaire":"ecriture","calendrier":"ecriture","examens":"ecriture",
        "messages":"ecriture"}'::jsonb
    when c.role = 'comptable' then '{"compta":"ecriture"}'::jsonb
    when c.role = 'surveillant' then
      '{"primaire":"ecriture","secondaire":"ecriture","calendrier":"ecriture"}'::jsonb
    when c.role = 'primaire' then
      '{"primaire":"ecriture","calendrier":"ecriture","examens":"ecriture"}'::jsonb
    when c.role = 'college' then
      '{"secondaire":"ecriture","calendrier":"ecriture","examens":"ecriture"}'::jsonb
    else '{}'::jsonb
  end
  from comptes c
  left join postes p on p.id = c.poste_id
  where c.user_id = auth.uid()
  limit 1;
$$;


ALTER FUNCTION "public"."my_permissions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."my_poste_cle"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(p.cle, c.role::text)
  from comptes c
  left join postes p on p.id = c.poste_id
  where c.user_id = auth.uid()
  limit 1;
$$;


ALTER FUNCTION "public"."my_poste_cle"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."my_teacher_eleve_ids"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select e.id
  from eleves e
  join comptes c on c.user_id = auth.uid()
  join enseignant_classes ec on ec.compte_id = c.id
  where e.ecole_id = auth_ecole_id()
    and e.section = ec.section
    and e.classe = ec.classe;
$$;


ALTER FUNCTION "public"."my_teacher_eleve_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."nom_paie_normalise"("p_nom" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $_$
  select btrim(regexp_replace(
    lower(translate(
      regexp_replace(coalesce(p_nom, ''), '\s*\([^)]*\)\s*$', ''),
      'ÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝàáâãäåçèéêëìíîïñòóôõöùúûüýÿ'
        || 'ĀāĂăĄąĆćĈĉĊċČčĎďĒēĔĕĖėĘęĚěĜĝĞğĠġĢģĤĥĨĩĪīĬĭĮįİĴĵĶķĹĺĻļĽľŃńŅņŇňŌōŎŏŐőŔŕŖŗŘřŚśŜŝŞşŠšŢţŤťŨũŪūŬŭŮůŰűŲųŴŵŶŷŸŹźŻżŽž',
      'aaaaaaceeeeiiiinooooouuuuyaaaaaaceeeeiiiinooooouuuuyy'
        || 'aaaaaaccccccccddeeeeeeeeeegggggggghhiiiiiiiiijjkkllllllnnnnnnoooooorrrrrrssssssssttttuuuuuuuuuuuuwwyyyzzzzzz')),
    '\s+', ' ', 'g'));
$_$;


ALTER FUNCTION "public"."nom_paie_normalise"("p_nom" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."postes_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if tg_op = 'DELETE' then
    if old.cle = 'direction' then
      raise exception 'Le poste direction ne peut pas être supprimé.';
    end if;
    return old;
  end if;
  if old.cle = 'direction' and (new.actif = false or new.cle <> 'direction') then
    raise exception 'Le poste direction ne peut pas être désactivé.';
  end if;
  return new;
end; $$;


ALTER FUNCTION "public"."postes_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."powersync_perms_compute"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  p jsonb := null;
begin
  -- Permissions du poste (si rattaché et actif) ; poste inactif = aucun accès.
  if new.poste_id is not null then
    select case when actif then permissions else '{}'::jsonb end
      into p from postes where id = new.poste_id;
  end if;

  if new.role in ('direction', 'superadmin') then
    -- Super-poste : toujours tout (garde-fou anti-verrouillage, cf. postes.sql).
    new.perm_compta      := true;
    new.perm_calendrier  := true;
    new.perm_examens     := true;
    new.perm_messages    := true;
    new.perm_fondation   := true;
    new.perm_historique  := true;
    new.perm_admin_panel := true;
  elsif p is not null then
    -- Compte à poste : lecture = 'lecture' ou 'ecriture' dans la carte.
    new.perm_compta      := coalesce(p->>'compta'      in ('lecture','ecriture'), false);
    new.perm_calendrier  := coalesce(p->>'calendrier'  in ('lecture','ecriture'), false);
    new.perm_examens     := coalesce(p->>'examens'     in ('lecture','ecriture'), false);
    new.perm_messages    := coalesce(p->>'messages'    in ('lecture','ecriture'), false);
    new.perm_fondation   := coalesce(p->>'fondation'   in ('lecture','ecriture'), false);
    new.perm_historique  := coalesce(p->>'historique'  in ('lecture','ecriture'), false);
    new.perm_admin_panel := coalesce(p->>'admin_panel' in ('lecture','ecriture'), false);
  else
    -- Repli legacy (poste_id null) : capacités de lecture historiques du rôle
    -- enum — MÊME mapping que legacyPermissionsForRole (postes-config.js).
    new.perm_compta      := new.role in ('admin', 'comptable');
    new.perm_calendrier  := new.role in ('admin', 'surveillant', 'primaire', 'college');
    new.perm_examens     := new.role in ('admin', 'primaire', 'college');
    new.perm_messages    := new.role in ('admin');
    new.perm_fondation   := false;
    new.perm_historique  := new.role in ('admin');
    new.perm_admin_panel := new.role in ('admin');
  end if;
  return new;
end; $$;


ALTER FUNCTION "public"."powersync_perms_compute"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."powersync_perms_propagate"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  -- Touch no-op : déclenche trg_powersync_perms sur chaque compte du poste.
  update comptes set poste_id = poste_id where poste_id = new.id;
  return new;
end; $$;


ALTER FUNCTION "public"."powersync_perms_propagate"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."push_subs_identite"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_role  text;
  v_ecole uuid;
  v_cle   text;
begin
  select c.role::text, c.ecole_id,
         case when c.role::text in ('parent', 'enseignant') then c.role::text
              else coalesce(p.cle, c.role::text) end
    into v_role, v_ecole, v_cle
    from comptes c
    left join postes p on p.id = c.poste_id
   where c.user_id = new.user_id;

  if v_role is null then
    raise exception 'Abonnement push refusé : aucun compte pour cet utilisateur.'
      using errcode = '42501';
  end if;
  if v_role <> 'superadmin' and new.ecole_id is distinct from v_ecole then
    raise exception 'Abonnement push refusé : école différente de celle du compte.'
      using errcode = '42501';
  end if;

  new.role := v_role;
  new.poste_cle := v_cle;
  return new;
end $$;


ALTER FUNCTION "public"."push_subs_identite"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."push_subs_un_navigateur"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if coalesce(new.subscription->>'endpoint', '') = '' then return null; end if;
  delete from push_subs
   where subscription->>'endpoint' = new.subscription->>'endpoint'
     and (ecole_id, user_id) is distinct from (new.ecole_id, new.user_id);
  return null;
end $$;


ALTER FUNCTION "public"."push_subs_un_navigateur"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."section_module"("p_section" "public"."section_scolaire") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select case
    when p_section in ('primaire', 'prescolaire') then 'primaire'
    else 'secondaire'
  end;
$$;


ALTER FUNCTION "public"."section_module"("p_section" "public"."section_scolaire") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin new.updated_at = now(); return new; end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."teacher_can_write_note"("p_eleve" "uuid", "p_matiere" "text", "p_section" "public"."section_scolaire") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from comptes c
    join enseignant_classes ec on ec.compte_id = c.id
    join eleves e on e.ecole_id = ec.ecole_id
                 and e.section = ec.section and e.classe = ec.classe
    where c.user_id = auth.uid()
      and e.id = p_eleve
      and e.section = p_section
      and (ec.section::text in ('primaire', 'prescolaire')
           or (coalesce(btrim(c.matiere), '') <> ''
               and (lower(btrim(p_matiere)) = lower(btrim(c.matiere))
                    or exists (
                      select 1 from matieres m
                      where m.ecole_id = e.ecole_id
                        and m.section = e.section
                        and lower(btrim(m.nom)) = lower(btrim(p_matiere))
                        and lower(btrim(coalesce(m.extra->>'rattachement', '')))
                            = lower(btrim(c.matiere))))))
  );
$$;


ALTER FUNCTION "public"."teacher_can_write_note"("p_eleve" "uuid", "p_matiere" "text", "p_section" "public"."section_scolaire") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."transfert_accepter"("p_token" "uuid", "p_classe" "text" DEFAULT NULL::"text", "p_matricule" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  t transferts%rowtype;
  snap jsonb;
  new_id uuid;
begin
  if not is_staff() then
    return jsonb_build_object('error', 'Droits insuffisants.');
  end if;
  select * into t from transferts where token = p_token and statut = 'en_attente' for update;
  if not found then
    return jsonb_build_object('error', 'Token introuvable ou déjà utilisé.');
  end if;
  if t.created_at <= now() - interval '30 days' then
    return jsonb_build_object('error', 'Token expiré (validité 30 jours) : demandez-en un nouveau à l''école d''origine.');
  end if;
  if t.ecole_source_id = auth_ecole_id() then
    return jsonb_build_object('error', 'Ce transfert vient de votre propre école.');
  end if;
  snap := t.eleve_snapshot;
  if coalesce(snap->>'section', '') = '' then
    return jsonb_build_object('error', 'Dossier de transfert incomplet (section manquante).');
  end if;

  -- L'identité seule, dans ses colonnes. Scolarité, paiements, dispenses,
  -- départ et historique restent à l'école d'origine : l'élève arrive neuf,
  -- inscrit comme tout élève venu d'ailleurs (réinscription + établissement
  -- d'origine), daté de ce jour.
  insert into eleves (
    ecole_id, section, nom, prenom, sexe, matricule, ien, classe,
    date_naissance, lieu_naissance, filiation, tuteur, contact_tuteur, domicile, photo,
    statut, extra
  )
  values (
    auth_ecole_id(),
    (snap->>'section')::section_scolaire,
    snap->>'nom', snap->>'prenom',
    case when snap->>'sexe' in ('M', 'F') then snap->>'sexe' end,
    coalesce(nullif(trim(p_matricule), ''), snap->>'matricule'),
    snap->>'ien',
    coalesce(nullif(trim(p_classe), ''), snap->>'classe'),
    snap->>'dateNaissance', snap->>'lieuNaissance', snap->>'filiation',
    snap->>'tuteur', snap->>'contactTuteur', snap->>'domicile', snap->>'photo',
    'Actif',
    jsonb_strip_nulls(jsonb_build_object(
      'typeInscription', 'Réinscription',
      'etablissementOrigine', snap->>'schoolNom',
      'dateArrivee', to_char(current_date, 'YYYY-MM-DD')
    ))
  )
  returning id into new_id;

  update transferts set statut = 'accepte', accepted_eleve_id = new_id where id = t.id;
  return jsonb_build_object('ok', true, 'eleveId', new_id);
end; $$;


ALTER FUNCTION "public"."transfert_accepter"("p_token" "uuid", "p_classe" "text", "p_matricule" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."transfert_verifier"("p_token" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select jsonb_build_object(
           'eleveSnapshot', eleve_snapshot,
           'ecoleDestination', ecole_destination,
           'statut', statut,
           'expireLe', created_at + interval '30 days')
  from transferts
  where token = p_token and statut = 'en_attente'
    and created_at > now() - interval '30 days';
$$;


ALTER FUNCTION "public"."transfert_verifier"("p_token" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verifier_code_reinitialisation"("p_compte_id" "uuid", "p_empreinte" "text", "p_essais_max" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  c codes_reinitialisation%rowtype;
begin
  select * into c from codes_reinitialisation
   where compte_id = p_compte_id and utilise_le is null
   order by created_at desc
   limit 1
   for update;
  if not found or c.expire_le <= now() then
    return jsonb_build_object('statut', 'expire');
  end if;
  if c.essais >= p_essais_max then
    return jsonb_build_object('statut', 'epuise', 'codeId', c.id);
  end if;
  if c.empreinte is distinct from p_empreinte then
    update codes_reinitialisation set essais = essais + 1 where id = c.id;
    return jsonb_build_object(
      'statut', case when c.essais + 1 >= p_essais_max then 'epuise' else 'faux' end,
      'codeId', c.id,
      'essaisRestants', greatest(p_essais_max - c.essais - 1, 0));
  end if;
  return jsonb_build_object('statut', 'ok', 'codeId', c.id, 'essaisRestants', p_essais_max - c.essais);
end $$;


ALTER FUNCTION "public"."verifier_code_reinitialisation"("p_compte_id" "uuid", "p_empreinte" "text", "p_essais_max" integer) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."absences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ecole_id" "uuid" NOT NULL,
    "section" "public"."section_scolaire" NOT NULL,
    "eleve_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "date" "text",
    "justifie" "text" DEFAULT 'Non'::"text",
    "motif" "text",
    "matiere" "text",
    "signale_par_id" "uuid",
    "signale_par_nom" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."absences" REPLICA IDENTITY FULL;


ALTER TABLE "public"."absences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."annonces" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ecole_id" "uuid" NOT NULL,
    "extra" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."annonces" REPLICA IDENTITY FULL;


ALTER TABLE "public"."annonces" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."appreciations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ecole_id" "uuid" NOT NULL,
    "section" "public"."section_scolaire" NOT NULL,
    "eleve_id" "uuid" NOT NULL,
    "periode" "text" NOT NULL,
    "texte" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "annee" "text"
);

ALTER TABLE ONLY "public"."appreciations" REPLICA IDENTITY FULL;


ALTER TABLE "public"."appreciations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ecole_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "auteur" "jsonb" DEFAULT '{}'::"jsonb",
    "cible" "jsonb" DEFAULT '{}'::"jsonb",
    "details" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."audit" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ecole_id" "uuid" NOT NULL,
    "annee" "text",
    "date" "text",
    "montant" numeric DEFAULT 0,
    "extra" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."bons" REPLICA IDENTITY FULL;


ALTER TABLE "public"."bons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."classes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ecole_id" "uuid" NOT NULL,
    "section" "public"."section_scolaire" NOT NULL,
    "nom" "text" NOT NULL,
    "effectif" integer DEFAULT 0,
    "enseignant" "text",
    "enseignant_id" "uuid",
    "salle" "text",
    "extra" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."classes" REPLICA IDENTITY FULL;


ALTER TABLE "public"."classes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."codes_reinitialisation" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ecole_id" "uuid" NOT NULL,
    "compte_id" "uuid" NOT NULL,
    "empreinte" "text" NOT NULL,
    "canal" "text",
    "essais" integer DEFAULT 0 NOT NULL,
    "expire_le" timestamp with time zone NOT NULL,
    "utilise_le" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."codes_reinitialisation" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comptes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "ecole_id" "uuid",
    "login" "text" NOT NULL,
    "role" "public"."role_compte" NOT NULL,
    "nom" "text",
    "label" "text",
    "section" "public"."section_scolaire",
    "sections" "public"."section_scolaire"[] DEFAULT '{}'::"public"."section_scolaire"[],
    "enseignant_id" "uuid",
    "enseignant_nom" "text",
    "matiere" "text",
    "statut" "text" DEFAULT 'Actif'::"text",
    "premiere_co" boolean DEFAULT true,
    "extra" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "poste_id" "uuid",
    "email" "text",
    "perm_compta" boolean DEFAULT false NOT NULL,
    "perm_calendrier" boolean DEFAULT false NOT NULL,
    "perm_examens" boolean DEFAULT false NOT NULL,
    "perm_messages" boolean DEFAULT false NOT NULL,
    "perm_fondation" boolean DEFAULT false NOT NULL,
    "perm_historique" boolean DEFAULT false NOT NULL,
    "perm_admin_panel" boolean DEFAULT false NOT NULL,
    "perm_prescolaire" boolean DEFAULT false NOT NULL,
    "telephone" "text"
);

ALTER TABLE ONLY "public"."comptes" REPLICA IDENTITY FULL;


ALTER TABLE "public"."comptes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."demandes_plan" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ecole_id" "uuid" NOT NULL,
    "plan_demande" "text",
    "statut" "text" DEFAULT 'en_attente'::"text",
    "extra" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."demandes_plan" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."depenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ecole_id" "uuid" NOT NULL,
    "annee" "text",
    "date" "text",
    "montant" numeric DEFAULT 0,
    "extra" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."depenses" REPLICA IDENTITY FULL;


ALTER TABLE "public"."depenses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ecole_id" "uuid" NOT NULL,
    "extra" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."documents" REPLICA IDENTITY FULL;


ALTER TABLE "public"."documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ecoles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "nom" "text" NOT NULL,
    "logo" "text",
    "couleur1" "text",
    "couleur2" "text",
    "pays" "text" DEFAULT 'République de Guinée'::"text",
    "devise" "text",
    "plan" "text" DEFAULT 'gratuit'::"text",
    "plan_expiry" bigint,
    "modele_bulletin" "text" DEFAULT 'classique'::"text",
    "role_settings" "jsonb" DEFAULT '{}'::"jsonb",
    "legal" "jsonb" DEFAULT '{}'::"jsonb",
    "extra" "jsonb" DEFAULT '{}'::"jsonb",
    "actif" boolean DEFAULT true,
    "supprime" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ecoles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."ecoles_public" AS
 SELECT "id",
    "code",
    "nom",
    "logo",
    "couleur1",
    "couleur2",
    "actif",
    "supprime"
   FROM "public"."ecoles";


ALTER VIEW "public"."ecoles_public" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."eleves" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ecole_id" "uuid" NOT NULL,
    "section" "public"."section_scolaire" NOT NULL,
    "nom" "text",
    "prenom" "text",
    "sexe" "text",
    "matricule" "text",
    "ien" "text",
    "classe" "text",
    "date_naissance" "text",
    "lieu_naissance" "text",
    "filiation" "text",
    "tuteur" "text",
    "contact_tuteur" "text",
    "domicile" "text",
    "photo" "text",
    "statut" "text" DEFAULT 'Actif'::"text",
    "extra" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "eleves_sexe_check" CHECK ((("sexe" = ANY (ARRAY['M'::"text", 'F'::"text"])) OR ("sexe" IS NULL)))
);

ALTER TABLE ONLY "public"."eleves" REPLICA IDENTITY FULL;


ALTER TABLE "public"."eleves" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."emplois" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ecole_id" "uuid" NOT NULL,
    "section" "public"."section_scolaire" NOT NULL,
    "classe" "text",
    "jour" "text",
    "heure_debut" "text",
    "heure_fin" "text",
    "matiere" "text",
    "enseignant" "text",
    "salle" "text",
    "extra" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."emplois" REPLICA IDENTITY FULL;


ALTER TABLE "public"."emplois" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."enseignant_classes" (
    "compte_id" "uuid" NOT NULL,
    "ecole_id" "uuid" NOT NULL,
    "section" "public"."section_scolaire" NOT NULL,
    "classe" "text" NOT NULL,
    "user_id" "uuid"
);


ALTER TABLE "public"."enseignant_classes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."enseignants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ecole_id" "uuid" NOT NULL,
    "section" "public"."section_scolaire" NOT NULL,
    "nom" "text",
    "prenom" "text",
    "matiere" "text",
    "classe_title" "text",
    "contact" "text",
    "statut" "text" DEFAULT 'Actif'::"text",
    "extra" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."enseignants" REPLICA IDENTITY FULL;


ALTER TABLE "public"."enseignants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."enseignements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ecole_id" "uuid" NOT NULL,
    "section" "public"."section_scolaire" NOT NULL,
    "classe" "text",
    "matiere" "text",
    "enseignant_nom" "text",
    "date" bigint,
    "contenu" "text",
    "extra" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."enseignements" REPLICA IDENTITY FULL;


ALTER TABLE "public"."enseignements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."evenements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ecole_id" "uuid" NOT NULL,
    "extra" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."evenements" REPLICA IDENTITY FULL;


ALTER TABLE "public"."evenements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."examens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ecole_id" "uuid" NOT NULL,
    "extra" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."examens" REPLICA IDENTITY FULL;


ALTER TABLE "public"."examens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."historique" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ecole_id" "uuid" NOT NULL,
    "extra" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."historique" REPLICA IDENTITY FULL;


ALTER TABLE "public"."historique" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."honneurs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ecole_id" "uuid" NOT NULL,
    "extra" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."honneurs" REPLICA IDENTITY FULL;


ALTER TABLE "public"."honneurs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."livrets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ecole_id" "uuid" NOT NULL,
    "extra" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."livrets" REPLICA IDENTITY FULL;


ALTER TABLE "public"."livrets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."matieres" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ecole_id" "uuid" NOT NULL,
    "section" "public"."section_scolaire" NOT NULL,
    "nom" "text" NOT NULL,
    "coefficient" numeric DEFAULT 1,
    "classes" "text"[] DEFAULT '{}'::"text"[],
    "extra" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."matieres" REPLICA IDENTITY FULL;


ALTER TABLE "public"."matieres" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."membres" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ecole_id" "uuid" NOT NULL,
    "extra" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."membres" REPLICA IDENTITY FULL;


ALTER TABLE "public"."membres" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ecole_id" "uuid" NOT NULL,
    "extra" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "eleve_id" "uuid"
);

ALTER TABLE ONLY "public"."messages" REPLICA IDENTITY FULL;


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages_internes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ecole_id" "uuid" NOT NULL,
    "de_compte_id" "uuid" NOT NULL,
    "de_nom" "text" NOT NULL,
    "de_poste" "text",
    "a_compte_id" "uuid",
    "a_postes" "text"[],
    "a_tous" boolean DEFAULT false NOT NULL,
    "sujet" "text",
    "corps" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."messages_internes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages_internes_lus" (
    "message_id" "uuid" NOT NULL,
    "compte_id" "uuid" NOT NULL,
    "lu_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."messages_internes_lus" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."msg_annonces" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ecole_id" "uuid" NOT NULL,
    "de_compte_id" "uuid",
    "de_nom" "text" DEFAULT ''::"text" NOT NULL,
    "de_poste" "text",
    "titre" "text",
    "corps" "text" NOT NULL,
    "priorite" "text" DEFAULT 'normale'::"text" NOT NULL,
    "accuse_requis" boolean DEFAULT false NOT NULL,
    "epinglee" boolean DEFAULT false NOT NULL,
    "a_tous" boolean DEFAULT false NOT NULL,
    "a_personnel" boolean DEFAULT false NOT NULL,
    "a_enseignants" boolean DEFAULT false NOT NULL,
    "a_postes" "text"[],
    "a_comptes" "uuid"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "pieces_jointes" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "hors_pyramide" boolean DEFAULT false NOT NULL,
    "a_parents" boolean DEFAULT false NOT NULL,
    "a_parents_sections" "text"[],
    "a_parents_classes" "text"[],
    CONSTRAINT "msg_annonces_corps_check" CHECK (("char_length"("corps") <= 8000)),
    CONSTRAINT "msg_annonces_priorite_check" CHECK (("priorite" = ANY (ARRAY['normale'::"text", 'importante'::"text", 'urgente'::"text"]))),
    CONSTRAINT "msg_annonces_titre_check" CHECK (("char_length"("titre") <= 160))
);

ALTER TABLE ONLY "public"."msg_annonces" REPLICA IDENTITY FULL;


ALTER TABLE "public"."msg_annonces" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."msg_annonces_lus" (
    "annonce_id" "uuid" NOT NULL,
    "compte_id" "uuid" NOT NULL,
    "lu_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "confirme_at" timestamp with time zone
);


ALTER TABLE "public"."msg_annonces_lus" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."msg_appels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ecole_id" "uuid" NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "appelant_id" "uuid" NOT NULL,
    "appele_id" "uuid" NOT NULL,
    "statut" "text" DEFAULT 'sonne'::"text" NOT NULL,
    "offre" "jsonb",
    "reponse" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "repondu_at" timestamp with time zone,
    "fin_at" timestamp with time zone,
    CONSTRAINT "msg_appels_statut_check" CHECK (("statut" = ANY (ARRAY['sonne'::"text", 'en_cours'::"text", 'refuse'::"text", 'occupe'::"text", 'manque'::"text", 'annule'::"text", 'termine'::"text", 'echec'::"text"])))
);

ALTER TABLE ONLY "public"."msg_appels" REPLICA IDENTITY FULL;


ALTER TABLE "public"."msg_appels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."msg_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ecole_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "titre" "text",
    "cle_directe" "text",
    "cree_par" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "dernier_message_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "dernier_apercu" "text",
    CONSTRAINT "msg_conversations_titre_check" CHECK (("char_length"("titre") <= 80)),
    CONSTRAINT "msg_conversations_type_check" CHECK (("type" = ANY (ARRAY['direct'::"text", 'groupe'::"text"])))
);


ALTER TABLE "public"."msg_conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."msg_membres" (
    "conversation_id" "uuid" NOT NULL,
    "compte_id" "uuid" NOT NULL,
    "ecole_id" "uuid" NOT NULL,
    "admin" boolean DEFAULT false NOT NULL,
    "dernier_lu_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "archive" boolean DEFAULT false NOT NULL,
    "epingle" boolean DEFAULT false NOT NULL,
    "sourdine" boolean DEFAULT false NOT NULL,
    "rejoint_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."msg_membres" REPLICA IDENTITY FULL;


ALTER TABLE "public"."msg_membres" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."msg_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "ecole_id" "uuid" NOT NULL,
    "de_compte_id" "uuid",
    "type" "text" DEFAULT 'texte'::"text" NOT NULL,
    "corps" "text",
    "audio_path" "text",
    "audio_duree" integer,
    "reponse_a" "uuid",
    "modifie_at" timestamp with time zone,
    "supprime" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "fichier_path" "text",
    "fichier_nom" "text",
    "fichier_type" "text",
    "fichier_taille" integer,
    CONSTRAINT "msg_messages_audio_duree_check" CHECK ((("audio_duree" >= 0) AND ("audio_duree" <= 600))),
    CONSTRAINT "msg_messages_corps_check" CHECK (("char_length"("corps") <= 4000)),
    CONSTRAINT "msg_messages_fichier_check" CHECK (((COALESCE("char_length"("fichier_nom"), 0) <= 200) AND ((COALESCE("fichier_taille", 0) >= 0) AND (COALESCE("fichier_taille", 0) <= 10485760)))),
    CONSTRAINT "msg_messages_type_check" CHECK (("type" = ANY (ARRAY['texte'::"text", 'audio'::"text", 'fichier'::"text", 'systeme'::"text", 'appel'::"text"])))
);

ALTER TABLE ONLY "public"."msg_messages" REPLICA IDENTITY FULL;


ALTER TABLE "public"."msg_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."msg_presences" (
    "compte_id" "uuid" NOT NULL,
    "ecole_id" "uuid" NOT NULL,
    "etat" "text" DEFAULT 'actif'::"text" NOT NULL,
    "vu_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "msg_presences_etat_check" CHECK (("etat" = ANY (ARRAY['actif'::"text", 'absent'::"text", 'hors_ligne'::"text"])))
);


ALTER TABLE "public"."msg_presences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."msg_reunion_participants" (
    "reunion_id" "uuid" NOT NULL,
    "compte_id" "uuid" NOT NULL,
    "ecole_id" "uuid" NOT NULL,
    "session_id" "text",
    "pistes" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "micro" boolean DEFAULT true NOT NULL,
    "camera" boolean DEFAULT false NOT NULL,
    "rejoint_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "vu_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "quitte_at" timestamp with time zone
);

ALTER TABLE ONLY "public"."msg_reunion_participants" REPLICA IDENTITY FULL;


ALTER TABLE "public"."msg_reunion_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."msg_reunions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ecole_id" "uuid" NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "lance_par" "uuid",
    "statut" "text" DEFAULT 'en_cours'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "fin_at" timestamp with time zone,
    CONSTRAINT "msg_reunions_statut_check" CHECK (("statut" = ANY (ARRAY['en_cours'::"text", 'termine'::"text"])))
);

ALTER TABLE ONLY "public"."msg_reunions" REPLICA IDENTITY FULL;


ALTER TABLE "public"."msg_reunions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ecole_id" "uuid" NOT NULL,
    "section" "public"."section_scolaire" NOT NULL,
    "eleve_id" "uuid" NOT NULL,
    "matiere" "text" NOT NULL,
    "type" "text" NOT NULL,
    "periode" "text" NOT NULL,
    "note" numeric NOT NULL,
    "annee" "text" NOT NULL,
    "enseignant_id" "uuid",
    "enseignant_nom" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."notes" REPLICA IDENTITY FULL;


ALTER TABLE "public"."notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications_envois" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ecole_id" "uuid" NOT NULL,
    "eleve_id" "uuid",
    "type" "text" NOT NULL,
    "canal" "text",
    "destinataire" "text",
    "statut" "text" DEFAULT 'envoye'::"text" NOT NULL,
    "erreur" "text",
    "cout" numeric,
    "dedup_key" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notifications_envois" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."paiements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ecole_id" "uuid" NOT NULL,
    "eleve_id" "uuid" NOT NULL,
    "mois" "text",
    "statut" "text" DEFAULT 'encaisse'::"text",
    "montant" numeric DEFAULT 0,
    "date_paiement" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "annee" "text",
    "type" "text",
    "libelle" "text",
    "eleve_nom" "text",
    "classe" "text",
    "auteur" "text",
    "extra" "jsonb" DEFAULT '{}'::"jsonb"
);

ALTER TABLE ONLY "public"."paiements" REPLICA IDENTITY FULL;


ALTER TABLE "public"."paiements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."parent_eleves" (
    "compte_id" "uuid" NOT NULL,
    "eleve_id" "uuid" NOT NULL,
    "lien" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "parent_eleves_lien_check" CHECK ((("lien" IS NULL) OR ("lien" = ANY (ARRAY['pere'::"text", 'mere'::"text", 'tuteur'::"text", 'autre'::"text"]))))
);


ALTER TABLE "public"."parent_eleves" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."personnel" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ecole_id" "uuid" NOT NULL,
    "nom" "text",
    "prenom" "text",
    "extra" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."personnel" REPLICA IDENTITY FULL;


ALTER TABLE "public"."personnel" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."postes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ecole_id" "uuid" NOT NULL,
    "cle" "text" NOT NULL,
    "label" "text" NOT NULL,
    "systeme" boolean DEFAULT false NOT NULL,
    "actif" boolean DEFAULT true NOT NULL,
    "permissions" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "responsable" "text"
);

ALTER TABLE ONLY "public"."postes" REPLICA IDENTITY FULL;


ALTER TABLE "public"."postes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_subs" (
    "ecole_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "subscription" "jsonb" NOT NULL,
    "role" "text",
    "nom" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "poste_cle" "text"
);


ALTER TABLE "public"."push_subs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recettes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ecole_id" "uuid" NOT NULL,
    "annee" "text",
    "date" "text",
    "montant" numeric DEFAULT 0,
    "extra" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."recettes" REPLICA IDENTITY FULL;


ALTER TABLE "public"."recettes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."salaires" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ecole_id" "uuid" NOT NULL,
    "nom" "text",
    "section" "text",
    "mois" "text",
    "montant_net" numeric DEFAULT 0,
    "details" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "annee" "text"
);

ALTER TABLE ONLY "public"."salaires" REPLICA IDENTITY FULL;


ALTER TABLE "public"."salaires" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."superadmin_message_lectures" (
    "message_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "ecole_code" "text",
    "role" "text",
    "login" "text",
    "read_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."superadmin_message_lectures" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."superadmin_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "titre" "text",
    "corps" "text",
    "niveau" "text",
    "cible_schools" "text"[] DEFAULT '{}'::"text"[],
    "cible_roles" "text"[] DEFAULT '{}'::"text"[],
    "auteur" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."superadmin_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tarifs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ecole_id" "uuid" NOT NULL,
    "section" "public"."section_scolaire",
    "classe" "text" NOT NULL,
    "montant" numeric DEFAULT 0,
    "extra" "jsonb" DEFAULT '{}'::"jsonb"
);

ALTER TABLE ONLY "public"."tarifs" REPLICA IDENTITY FULL;


ALTER TABLE "public"."tarifs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transferts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "token" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ecole_source_id" "uuid" NOT NULL,
    "ecole_destination" "text",
    "eleve_snapshot" "jsonb" NOT NULL,
    "statut" "text" DEFAULT 'en_attente'::"text",
    "accepted_eleve_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."transferts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."versements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ecole_id" "uuid" NOT NULL,
    "annee" "text",
    "date" "text",
    "montant" numeric DEFAULT 0,
    "extra" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."versements" REPLICA IDENTITY FULL;


ALTER TABLE "public"."versements" OWNER TO "postgres";


ALTER TABLE ONLY "public"."absences"
    ADD CONSTRAINT "absences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."annonces"
    ADD CONSTRAINT "annonces_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."appreciations"
    ADD CONSTRAINT "appreciations_eleve_id_periode_annee_key" UNIQUE ("eleve_id", "periode", "annee");



ALTER TABLE ONLY "public"."appreciations"
    ADD CONSTRAINT "appreciations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit"
    ADD CONSTRAINT "audit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bons"
    ADD CONSTRAINT "bons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_ecole_id_section_nom_key" UNIQUE ("ecole_id", "section", "nom");



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."codes_reinitialisation"
    ADD CONSTRAINT "codes_reinitialisation_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comptes"
    ADD CONSTRAINT "comptes_ecole_id_login_key" UNIQUE ("ecole_id", "login");



ALTER TABLE ONLY "public"."comptes"
    ADD CONSTRAINT "comptes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comptes"
    ADD CONSTRAINT "comptes_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."demandes_plan"
    ADD CONSTRAINT "demandes_plan_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."depenses"
    ADD CONSTRAINT "depenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ecoles"
    ADD CONSTRAINT "ecoles_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."ecoles"
    ADD CONSTRAINT "ecoles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."eleves"
    ADD CONSTRAINT "eleves_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."emplois"
    ADD CONSTRAINT "emplois_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."enseignant_classes"
    ADD CONSTRAINT "enseignant_classes_pkey" PRIMARY KEY ("compte_id", "section", "classe");



ALTER TABLE ONLY "public"."enseignants"
    ADD CONSTRAINT "enseignants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."enseignements"
    ADD CONSTRAINT "enseignements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."evenements"
    ADD CONSTRAINT "evenements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."examens"
    ADD CONSTRAINT "examens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."historique"
    ADD CONSTRAINT "historique_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."honneurs"
    ADD CONSTRAINT "honneurs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."livrets"
    ADD CONSTRAINT "livrets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."matieres"
    ADD CONSTRAINT "matieres_ecole_id_section_nom_key" UNIQUE ("ecole_id", "section", "nom");



ALTER TABLE ONLY "public"."matieres"
    ADD CONSTRAINT "matieres_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."membres"
    ADD CONSTRAINT "membres_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages_internes_lus"
    ADD CONSTRAINT "messages_internes_lus_pkey" PRIMARY KEY ("message_id", "compte_id");



ALTER TABLE ONLY "public"."messages_internes"
    ADD CONSTRAINT "messages_internes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."msg_annonces_lus"
    ADD CONSTRAINT "msg_annonces_lus_pkey" PRIMARY KEY ("annonce_id", "compte_id");



ALTER TABLE ONLY "public"."msg_annonces"
    ADD CONSTRAINT "msg_annonces_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."msg_appels"
    ADD CONSTRAINT "msg_appels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."msg_conversations"
    ADD CONSTRAINT "msg_conversations_ecole_id_cle_directe_key" UNIQUE ("ecole_id", "cle_directe");



ALTER TABLE ONLY "public"."msg_conversations"
    ADD CONSTRAINT "msg_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."msg_membres"
    ADD CONSTRAINT "msg_membres_pkey" PRIMARY KEY ("conversation_id", "compte_id");



ALTER TABLE ONLY "public"."msg_messages"
    ADD CONSTRAINT "msg_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."msg_presences"
    ADD CONSTRAINT "msg_presences_pkey" PRIMARY KEY ("compte_id");



ALTER TABLE ONLY "public"."msg_reunion_participants"
    ADD CONSTRAINT "msg_reunion_participants_pkey" PRIMARY KEY ("reunion_id", "compte_id");



ALTER TABLE ONLY "public"."msg_reunions"
    ADD CONSTRAINT "msg_reunions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications_envois"
    ADD CONSTRAINT "notifications_envois_dedup_key_key" UNIQUE ("dedup_key");



ALTER TABLE ONLY "public"."notifications_envois"
    ADD CONSTRAINT "notifications_envois_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."paiements"
    ADD CONSTRAINT "paiements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."parent_eleves"
    ADD CONSTRAINT "parent_eleves_pkey" PRIMARY KEY ("compte_id", "eleve_id");



ALTER TABLE ONLY "public"."personnel"
    ADD CONSTRAINT "personnel_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."postes"
    ADD CONSTRAINT "postes_ecole_id_cle_key" UNIQUE ("ecole_id", "cle");



ALTER TABLE ONLY "public"."postes"
    ADD CONSTRAINT "postes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_subs"
    ADD CONSTRAINT "push_subs_pkey" PRIMARY KEY ("ecole_id", "user_id");



ALTER TABLE ONLY "public"."recettes"
    ADD CONSTRAINT "recettes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."salaires"
    ADD CONSTRAINT "salaires_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."superadmin_message_lectures"
    ADD CONSTRAINT "superadmin_message_lectures_pkey" PRIMARY KEY ("message_id", "user_id");



ALTER TABLE ONLY "public"."superadmin_messages"
    ADD CONSTRAINT "superadmin_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tarifs"
    ADD CONSTRAINT "tarifs_ecole_id_classe_key" UNIQUE ("ecole_id", "classe");



ALTER TABLE ONLY "public"."tarifs"
    ADD CONSTRAINT "tarifs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transferts"
    ADD CONSTRAINT "transferts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transferts"
    ADD CONSTRAINT "transferts_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."versements"
    ADD CONSTRAINT "versements_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_absences_eleve" ON "public"."absences" USING "btree" ("eleve_id");



CREATE INDEX "idx_annonces_ecole" ON "public"."annonces" USING "btree" ("ecole_id");



CREATE INDEX "idx_appreciations_ecole_annee" ON "public"."appreciations" USING "btree" ("ecole_id", "annee");



CREATE INDEX "idx_audit_ecole" ON "public"."audit" USING "btree" ("ecole_id", "created_at");



CREATE INDEX "idx_bons_ecole" ON "public"."bons" USING "btree" ("ecole_id", "annee");



CREATE INDEX "idx_classes_ecole_section" ON "public"."classes" USING "btree" ("ecole_id", "section");



CREATE INDEX "idx_codes_reinit_compte" ON "public"."codes_reinitialisation" USING "btree" ("compte_id", "created_at" DESC);



CREATE INDEX "idx_codes_reinit_ecole" ON "public"."codes_reinitialisation" USING "btree" ("ecole_id", "created_at" DESC);



CREATE INDEX "idx_comptes_ecole" ON "public"."comptes" USING "btree" ("ecole_id");



CREATE UNIQUE INDEX "idx_comptes_ecole_email" ON "public"."comptes" USING "btree" ("ecole_id", "lower"("email")) WHERE ("email" IS NOT NULL);



CREATE INDEX "idx_comptes_poste" ON "public"."comptes" USING "btree" ("poste_id");



CREATE INDEX "idx_comptes_telephone" ON "public"."comptes" USING "btree" ("ecole_id", "telephone") WHERE ("telephone" IS NOT NULL);



CREATE INDEX "idx_comptes_user" ON "public"."comptes" USING "btree" ("user_id");



CREATE INDEX "idx_demandes_ecole" ON "public"."demandes_plan" USING "btree" ("ecole_id");



CREATE INDEX "idx_depenses_ecole" ON "public"."depenses" USING "btree" ("ecole_id", "annee");



CREATE INDEX "idx_documents_ecole" ON "public"."documents" USING "btree" ("ecole_id");



CREATE INDEX "idx_eleves_classe" ON "public"."eleves" USING "btree" ("ecole_id", "section", "classe");



CREATE INDEX "idx_eleves_ecole_section" ON "public"."eleves" USING "btree" ("ecole_id", "section");



CREATE INDEX "idx_eleves_ien" ON "public"."eleves" USING "btree" ("ecole_id", "ien");



CREATE INDEX "idx_emplois_ecole_section" ON "public"."emplois" USING "btree" ("ecole_id", "section");



CREATE INDEX "idx_ens_classes_ecole" ON "public"."enseignant_classes" USING "btree" ("ecole_id");



CREATE INDEX "idx_ens_classes_user" ON "public"."enseignant_classes" USING "btree" ("user_id");



CREATE INDEX "idx_ens_ecole_section" ON "public"."enseignants" USING "btree" ("ecole_id", "section");



CREATE INDEX "idx_enseignements_ecole_section" ON "public"."enseignements" USING "btree" ("ecole_id", "section");



CREATE INDEX "idx_evenements_ecole" ON "public"."evenements" USING "btree" ("ecole_id");



CREATE INDEX "idx_examens_ecole" ON "public"."examens" USING "btree" ("ecole_id");



CREATE INDEX "idx_historique_ecole" ON "public"."historique" USING "btree" ("ecole_id");



CREATE INDEX "idx_honneurs_ecole" ON "public"."honneurs" USING "btree" ("ecole_id");



CREATE INDEX "idx_livrets_ecole" ON "public"."livrets" USING "btree" ("ecole_id");



CREATE INDEX "idx_matieres_ecole_section" ON "public"."matieres" USING "btree" ("ecole_id", "section");



CREATE INDEX "idx_membres_ecole" ON "public"."membres" USING "btree" ("ecole_id");



CREATE INDEX "idx_messages_ecole" ON "public"."messages" USING "btree" ("ecole_id");



CREATE INDEX "idx_messages_eleve" ON "public"."messages" USING "btree" ("eleve_id");



CREATE INDEX "idx_msg_annonces_ecole" ON "public"."msg_annonces" USING "btree" ("ecole_id", "created_at" DESC);



CREATE INDEX "idx_msg_appels_appele" ON "public"."msg_appels" USING "btree" ("appele_id", "created_at" DESC);



CREATE INDEX "idx_msg_conv_ecole" ON "public"."msg_conversations" USING "btree" ("ecole_id", "dernier_message_at" DESC);



CREATE INDEX "idx_msg_int_dest" ON "public"."messages_internes" USING "btree" ("a_compte_id");



CREATE INDEX "idx_msg_int_ecole" ON "public"."messages_internes" USING "btree" ("ecole_id", "created_at" DESC);



CREATE INDEX "idx_msg_membres_compte" ON "public"."msg_membres" USING "btree" ("compte_id");



CREATE INDEX "idx_msg_messages_conv" ON "public"."msg_messages" USING "btree" ("conversation_id", "created_at" DESC);



CREATE INDEX "idx_msg_messages_ecole" ON "public"."msg_messages" USING "btree" ("ecole_id", "created_at" DESC);



CREATE INDEX "idx_msg_presences_ecole" ON "public"."msg_presences" USING "btree" ("ecole_id");



CREATE UNIQUE INDEX "idx_msg_reunion_active" ON "public"."msg_reunions" USING "btree" ("conversation_id") WHERE ("statut" = 'en_cours'::"text");



CREATE INDEX "idx_notes_eleve" ON "public"."notes" USING "btree" ("eleve_id");



CREATE INDEX "idx_notes_matiere" ON "public"."notes" USING "btree" ("ecole_id", "section", "matiere");



CREATE INDEX "idx_notes_scope" ON "public"."notes" USING "btree" ("ecole_id", "section", "annee", "periode");



CREATE INDEX "idx_notif_ecole" ON "public"."notifications_envois" USING "btree" ("ecole_id", "created_at" DESC);



CREATE INDEX "idx_notif_eleve" ON "public"."notifications_envois" USING "btree" ("eleve_id");



CREATE INDEX "idx_paiements_ecole_annee" ON "public"."paiements" USING "btree" ("ecole_id", "annee");



CREATE INDEX "idx_paiements_ecole_date" ON "public"."paiements" USING "btree" ("ecole_id", "date_paiement");



CREATE INDEX "idx_paiements_eleve" ON "public"."paiements" USING "btree" ("eleve_id");



CREATE INDEX "idx_parent_eleves_eleve" ON "public"."parent_eleves" USING "btree" ("eleve_id");



CREATE INDEX "idx_personnel_ecole" ON "public"."personnel" USING "btree" ("ecole_id");



CREATE INDEX "idx_postes_ecole" ON "public"."postes" USING "btree" ("ecole_id");



CREATE INDEX "idx_push_subs_ecole" ON "public"."push_subs" USING "btree" ("ecole_id");



CREATE INDEX "idx_push_subs_endpoint" ON "public"."push_subs" USING "btree" ((("subscription" ->> 'endpoint'::"text")));



CREATE INDEX "idx_recettes_ecole" ON "public"."recettes" USING "btree" ("ecole_id", "annee");



CREATE INDEX "idx_salaires_ecole" ON "public"."salaires" USING "btree" ("ecole_id");



CREATE INDEX "idx_salaires_ecole_annee" ON "public"."salaires" USING "btree" ("ecole_id", "annee");



CREATE INDEX "idx_transferts_source" ON "public"."transferts" USING "btree" ("ecole_source_id");



CREATE INDEX "idx_versements_ecole" ON "public"."versements" USING "btree" ("ecole_id", "annee");



CREATE OR REPLACE TRIGGER "trg_annonces_updated" BEFORE UPDATE ON "public"."annonces" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_bons_updated" BEFORE UPDATE ON "public"."bons" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_comptes_guard" BEFORE UPDATE ON "public"."comptes" FOR EACH ROW EXECUTE FUNCTION "public"."comptes_guard"();



CREATE OR REPLACE TRIGGER "trg_depenses_updated" BEFORE UPDATE ON "public"."depenses" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_documents_updated" BEFORE UPDATE ON "public"."documents" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_ecoles_guard" BEFORE UPDATE ON "public"."ecoles" FOR EACH ROW EXECUTE FUNCTION "public"."ecoles_guard"();



CREATE OR REPLACE TRIGGER "trg_evenements_updated" BEFORE UPDATE ON "public"."evenements" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_examens_updated" BEFORE UPDATE ON "public"."examens" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_garde_ecriture_ecole" BEFORE INSERT OR DELETE OR UPDATE ON "public"."absences" FOR EACH STATEMENT EXECUTE FUNCTION "public"."garde_ecriture_ecole"();



CREATE OR REPLACE TRIGGER "trg_garde_ecriture_ecole" BEFORE INSERT OR DELETE OR UPDATE ON "public"."annonces" FOR EACH STATEMENT EXECUTE FUNCTION "public"."garde_ecriture_ecole"();



CREATE OR REPLACE TRIGGER "trg_garde_ecriture_ecole" BEFORE INSERT OR DELETE OR UPDATE ON "public"."appreciations" FOR EACH STATEMENT EXECUTE FUNCTION "public"."garde_ecriture_ecole"();



CREATE OR REPLACE TRIGGER "trg_garde_ecriture_ecole" BEFORE INSERT OR DELETE OR UPDATE ON "public"."bons" FOR EACH STATEMENT EXECUTE FUNCTION "public"."garde_ecriture_ecole"();



CREATE OR REPLACE TRIGGER "trg_garde_ecriture_ecole" BEFORE INSERT OR DELETE OR UPDATE ON "public"."classes" FOR EACH STATEMENT EXECUTE FUNCTION "public"."garde_ecriture_ecole"();



CREATE OR REPLACE TRIGGER "trg_garde_ecriture_ecole" BEFORE INSERT OR DELETE ON "public"."comptes" FOR EACH STATEMENT EXECUTE FUNCTION "public"."garde_ecriture_ecole"();



CREATE OR REPLACE TRIGGER "trg_garde_ecriture_ecole" BEFORE INSERT OR DELETE OR UPDATE ON "public"."depenses" FOR EACH STATEMENT EXECUTE FUNCTION "public"."garde_ecriture_ecole"();



CREATE OR REPLACE TRIGGER "trg_garde_ecriture_ecole" BEFORE INSERT OR DELETE OR UPDATE ON "public"."documents" FOR EACH STATEMENT EXECUTE FUNCTION "public"."garde_ecriture_ecole"();



CREATE OR REPLACE TRIGGER "trg_garde_ecriture_ecole" BEFORE INSERT OR DELETE OR UPDATE ON "public"."ecoles" FOR EACH STATEMENT EXECUTE FUNCTION "public"."garde_ecriture_ecole"();



CREATE OR REPLACE TRIGGER "trg_garde_ecriture_ecole" BEFORE INSERT OR DELETE OR UPDATE ON "public"."eleves" FOR EACH STATEMENT EXECUTE FUNCTION "public"."garde_ecriture_ecole"();



CREATE OR REPLACE TRIGGER "trg_garde_ecriture_ecole" BEFORE INSERT OR DELETE OR UPDATE ON "public"."emplois" FOR EACH STATEMENT EXECUTE FUNCTION "public"."garde_ecriture_ecole"();



CREATE OR REPLACE TRIGGER "trg_garde_ecriture_ecole" BEFORE INSERT OR DELETE OR UPDATE ON "public"."enseignant_classes" FOR EACH STATEMENT EXECUTE FUNCTION "public"."garde_ecriture_ecole"();



CREATE OR REPLACE TRIGGER "trg_garde_ecriture_ecole" BEFORE INSERT OR DELETE OR UPDATE ON "public"."enseignants" FOR EACH STATEMENT EXECUTE FUNCTION "public"."garde_ecriture_ecole"();



CREATE OR REPLACE TRIGGER "trg_garde_ecriture_ecole" BEFORE INSERT OR DELETE OR UPDATE ON "public"."enseignements" FOR EACH STATEMENT EXECUTE FUNCTION "public"."garde_ecriture_ecole"();



CREATE OR REPLACE TRIGGER "trg_garde_ecriture_ecole" BEFORE INSERT OR DELETE OR UPDATE ON "public"."evenements" FOR EACH STATEMENT EXECUTE FUNCTION "public"."garde_ecriture_ecole"();



CREATE OR REPLACE TRIGGER "trg_garde_ecriture_ecole" BEFORE INSERT OR DELETE OR UPDATE ON "public"."examens" FOR EACH STATEMENT EXECUTE FUNCTION "public"."garde_ecriture_ecole"();



CREATE OR REPLACE TRIGGER "trg_garde_ecriture_ecole" BEFORE INSERT OR DELETE OR UPDATE ON "public"."historique" FOR EACH STATEMENT EXECUTE FUNCTION "public"."garde_ecriture_ecole"();



CREATE OR REPLACE TRIGGER "trg_garde_ecriture_ecole" BEFORE INSERT OR DELETE OR UPDATE ON "public"."honneurs" FOR EACH STATEMENT EXECUTE FUNCTION "public"."garde_ecriture_ecole"();



CREATE OR REPLACE TRIGGER "trg_garde_ecriture_ecole" BEFORE INSERT OR DELETE OR UPDATE ON "public"."livrets" FOR EACH STATEMENT EXECUTE FUNCTION "public"."garde_ecriture_ecole"();



CREATE OR REPLACE TRIGGER "trg_garde_ecriture_ecole" BEFORE INSERT OR DELETE OR UPDATE ON "public"."matieres" FOR EACH STATEMENT EXECUTE FUNCTION "public"."garde_ecriture_ecole"();



CREATE OR REPLACE TRIGGER "trg_garde_ecriture_ecole" BEFORE INSERT OR DELETE OR UPDATE ON "public"."membres" FOR EACH STATEMENT EXECUTE FUNCTION "public"."garde_ecriture_ecole"();



CREATE OR REPLACE TRIGGER "trg_garde_ecriture_ecole" BEFORE INSERT OR DELETE OR UPDATE ON "public"."messages" FOR EACH STATEMENT EXECUTE FUNCTION "public"."garde_ecriture_ecole"();



CREATE OR REPLACE TRIGGER "trg_garde_ecriture_ecole" BEFORE INSERT OR DELETE OR UPDATE ON "public"."messages_internes" FOR EACH STATEMENT EXECUTE FUNCTION "public"."garde_ecriture_ecole"();



CREATE OR REPLACE TRIGGER "trg_garde_ecriture_ecole" BEFORE INSERT OR DELETE OR UPDATE ON "public"."msg_annonces" FOR EACH STATEMENT EXECUTE FUNCTION "public"."garde_ecriture_ecole"();



CREATE OR REPLACE TRIGGER "trg_garde_ecriture_ecole" BEFORE INSERT OR DELETE OR UPDATE ON "public"."msg_appels" FOR EACH STATEMENT EXECUTE FUNCTION "public"."garde_ecriture_ecole"();



CREATE OR REPLACE TRIGGER "trg_garde_ecriture_ecole" BEFORE INSERT OR DELETE OR UPDATE ON "public"."msg_conversations" FOR EACH STATEMENT EXECUTE FUNCTION "public"."garde_ecriture_ecole"();



CREATE OR REPLACE TRIGGER "trg_garde_ecriture_ecole" BEFORE INSERT OR DELETE ON "public"."msg_membres" FOR EACH STATEMENT EXECUTE FUNCTION "public"."garde_ecriture_ecole"();



CREATE OR REPLACE TRIGGER "trg_garde_ecriture_ecole" BEFORE INSERT OR DELETE OR UPDATE ON "public"."msg_messages" FOR EACH STATEMENT EXECUTE FUNCTION "public"."garde_ecriture_ecole"();



CREATE OR REPLACE TRIGGER "trg_garde_ecriture_ecole" BEFORE INSERT OR DELETE OR UPDATE ON "public"."msg_reunion_participants" FOR EACH STATEMENT EXECUTE FUNCTION "public"."garde_ecriture_ecole"();



CREATE OR REPLACE TRIGGER "trg_garde_ecriture_ecole" BEFORE INSERT OR DELETE OR UPDATE ON "public"."msg_reunions" FOR EACH STATEMENT EXECUTE FUNCTION "public"."garde_ecriture_ecole"();



CREATE OR REPLACE TRIGGER "trg_garde_ecriture_ecole" BEFORE INSERT OR DELETE OR UPDATE ON "public"."notes" FOR EACH STATEMENT EXECUTE FUNCTION "public"."garde_ecriture_ecole"();



CREATE OR REPLACE TRIGGER "trg_garde_ecriture_ecole" BEFORE INSERT OR DELETE OR UPDATE ON "public"."paiements" FOR EACH STATEMENT EXECUTE FUNCTION "public"."garde_ecriture_ecole"();



CREATE OR REPLACE TRIGGER "trg_garde_ecriture_ecole" BEFORE INSERT OR DELETE OR UPDATE ON "public"."parent_eleves" FOR EACH STATEMENT EXECUTE FUNCTION "public"."garde_ecriture_ecole"();



CREATE OR REPLACE TRIGGER "trg_garde_ecriture_ecole" BEFORE INSERT OR DELETE OR UPDATE ON "public"."personnel" FOR EACH STATEMENT EXECUTE FUNCTION "public"."garde_ecriture_ecole"();



CREATE OR REPLACE TRIGGER "trg_garde_ecriture_ecole" BEFORE INSERT OR DELETE OR UPDATE ON "public"."postes" FOR EACH STATEMENT EXECUTE FUNCTION "public"."garde_ecriture_ecole"();



CREATE OR REPLACE TRIGGER "trg_garde_ecriture_ecole" BEFORE INSERT OR DELETE OR UPDATE ON "public"."recettes" FOR EACH STATEMENT EXECUTE FUNCTION "public"."garde_ecriture_ecole"();



CREATE OR REPLACE TRIGGER "trg_garde_ecriture_ecole" BEFORE INSERT OR DELETE OR UPDATE ON "public"."salaires" FOR EACH STATEMENT EXECUTE FUNCTION "public"."garde_ecriture_ecole"();



CREATE OR REPLACE TRIGGER "trg_garde_ecriture_ecole" BEFORE INSERT OR DELETE OR UPDATE ON "public"."tarifs" FOR EACH STATEMENT EXECUTE FUNCTION "public"."garde_ecriture_ecole"();



CREATE OR REPLACE TRIGGER "trg_garde_ecriture_ecole" BEFORE INSERT OR DELETE OR UPDATE ON "public"."transferts" FOR EACH STATEMENT EXECUTE FUNCTION "public"."garde_ecriture_ecole"();



CREATE OR REPLACE TRIGGER "trg_garde_ecriture_ecole" BEFORE INSERT OR DELETE OR UPDATE ON "public"."versements" FOR EACH STATEMENT EXECUTE FUNCTION "public"."garde_ecriture_ecole"();



CREATE OR REPLACE TRIGGER "trg_historique_updated" BEFORE UPDATE ON "public"."historique" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_honneurs_updated" BEFORE UPDATE ON "public"."honneurs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_livrets_updated" BEFORE UPDATE ON "public"."livrets" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_membres_updated" BEFORE UPDATE ON "public"."membres" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_messages_updated" BEFORE UPDATE ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_msg_apres_message" AFTER INSERT ON "public"."msg_messages" FOR EACH ROW EXECUTE FUNCTION "public"."msg_apres_message"();



CREATE OR REPLACE TRIGGER "trg_msg_avant_annonce" BEFORE INSERT ON "public"."msg_annonces" FOR EACH ROW EXECUTE FUNCTION "public"."msg_avant_annonce"();



CREATE OR REPLACE TRIGGER "trg_msg_reprise_interne" AFTER INSERT ON "public"."messages_internes" FOR EACH ROW EXECUTE FUNCTION "public"."msg_reprendre_message_interne"();



CREATE OR REPLACE TRIGGER "trg_paiements_updated" BEFORE UPDATE ON "public"."paiements" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_personnel_updated" BEFORE UPDATE ON "public"."personnel" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_postes_guard" BEFORE DELETE OR UPDATE ON "public"."postes" FOR EACH ROW EXECUTE FUNCTION "public"."postes_guard"();



CREATE OR REPLACE TRIGGER "trg_postes_updated" BEFORE UPDATE ON "public"."postes" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_powersync_perms" BEFORE INSERT OR UPDATE ON "public"."comptes" FOR EACH ROW EXECUTE FUNCTION "public"."powersync_perms_compute"();



CREATE OR REPLACE TRIGGER "trg_powersync_perms_propagate" AFTER UPDATE OF "permissions", "actif" ON "public"."postes" FOR EACH ROW EXECUTE FUNCTION "public"."powersync_perms_propagate"();



CREATE OR REPLACE TRIGGER "trg_push_subs_identite" BEFORE INSERT OR UPDATE ON "public"."push_subs" FOR EACH ROW EXECUTE FUNCTION "public"."push_subs_identite"();



CREATE OR REPLACE TRIGGER "trg_push_subs_un_navigateur" AFTER INSERT OR UPDATE OF "subscription" ON "public"."push_subs" FOR EACH ROW EXECUTE FUNCTION "public"."push_subs_un_navigateur"();



CREATE OR REPLACE TRIGGER "trg_recettes_updated" BEFORE UPDATE ON "public"."recettes" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_updated_at" BEFORE UPDATE ON "public"."absences" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_updated_at" BEFORE UPDATE ON "public"."appreciations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_updated_at" BEFORE UPDATE ON "public"."classes" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_updated_at" BEFORE UPDATE ON "public"."comptes" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_updated_at" BEFORE UPDATE ON "public"."ecoles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_updated_at" BEFORE UPDATE ON "public"."eleves" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_updated_at" BEFORE UPDATE ON "public"."emplois" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_updated_at" BEFORE UPDATE ON "public"."enseignants" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_updated_at" BEFORE UPDATE ON "public"."matieres" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_updated_at" BEFORE UPDATE ON "public"."notes" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_updated_at" BEFORE UPDATE ON "public"."paiements" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_versements_updated" BEFORE UPDATE ON "public"."versements" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."absences"
    ADD CONSTRAINT "absences_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "public"."ecoles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."absences"
    ADD CONSTRAINT "absences_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "public"."eleves"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."annonces"
    ADD CONSTRAINT "annonces_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "public"."ecoles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appreciations"
    ADD CONSTRAINT "appreciations_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "public"."ecoles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appreciations"
    ADD CONSTRAINT "appreciations_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "public"."eleves"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."audit"
    ADD CONSTRAINT "audit_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "public"."ecoles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bons"
    ADD CONSTRAINT "bons_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "public"."ecoles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "public"."ecoles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_enseignant_id_fkey" FOREIGN KEY ("enseignant_id") REFERENCES "public"."enseignants"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."codes_reinitialisation"
    ADD CONSTRAINT "codes_reinitialisation_compte_id_fkey" FOREIGN KEY ("compte_id") REFERENCES "public"."comptes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."codes_reinitialisation"
    ADD CONSTRAINT "codes_reinitialisation_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "public"."ecoles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comptes"
    ADD CONSTRAINT "comptes_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "public"."ecoles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comptes"
    ADD CONSTRAINT "comptes_poste_id_fkey" FOREIGN KEY ("poste_id") REFERENCES "public"."postes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."comptes"
    ADD CONSTRAINT "comptes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."demandes_plan"
    ADD CONSTRAINT "demandes_plan_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "public"."ecoles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."depenses"
    ADD CONSTRAINT "depenses_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "public"."ecoles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "public"."ecoles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."eleves"
    ADD CONSTRAINT "eleves_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "public"."ecoles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."emplois"
    ADD CONSTRAINT "emplois_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "public"."ecoles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."enseignant_classes"
    ADD CONSTRAINT "enseignant_classes_compte_id_fkey" FOREIGN KEY ("compte_id") REFERENCES "public"."comptes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."enseignant_classes"
    ADD CONSTRAINT "enseignant_classes_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "public"."ecoles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."enseignant_classes"
    ADD CONSTRAINT "enseignant_classes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."enseignants"
    ADD CONSTRAINT "enseignants_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "public"."ecoles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."enseignements"
    ADD CONSTRAINT "enseignements_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "public"."ecoles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."evenements"
    ADD CONSTRAINT "evenements_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "public"."ecoles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."examens"
    ADD CONSTRAINT "examens_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "public"."ecoles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."historique"
    ADD CONSTRAINT "historique_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "public"."ecoles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."honneurs"
    ADD CONSTRAINT "honneurs_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "public"."ecoles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."livrets"
    ADD CONSTRAINT "livrets_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "public"."ecoles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matieres"
    ADD CONSTRAINT "matieres_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "public"."ecoles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."membres"
    ADD CONSTRAINT "membres_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "public"."ecoles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "public"."ecoles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "public"."eleves"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages_internes"
    ADD CONSTRAINT "messages_internes_a_compte_id_fkey" FOREIGN KEY ("a_compte_id") REFERENCES "public"."comptes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages_internes"
    ADD CONSTRAINT "messages_internes_de_compte_id_fkey" FOREIGN KEY ("de_compte_id") REFERENCES "public"."comptes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages_internes"
    ADD CONSTRAINT "messages_internes_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "public"."ecoles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages_internes_lus"
    ADD CONSTRAINT "messages_internes_lus_compte_id_fkey" FOREIGN KEY ("compte_id") REFERENCES "public"."comptes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages_internes_lus"
    ADD CONSTRAINT "messages_internes_lus_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages_internes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."msg_annonces"
    ADD CONSTRAINT "msg_annonces_de_compte_id_fkey" FOREIGN KEY ("de_compte_id") REFERENCES "public"."comptes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."msg_annonces"
    ADD CONSTRAINT "msg_annonces_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "public"."ecoles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."msg_annonces_lus"
    ADD CONSTRAINT "msg_annonces_lus_annonce_id_fkey" FOREIGN KEY ("annonce_id") REFERENCES "public"."msg_annonces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."msg_annonces_lus"
    ADD CONSTRAINT "msg_annonces_lus_compte_id_fkey" FOREIGN KEY ("compte_id") REFERENCES "public"."comptes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."msg_appels"
    ADD CONSTRAINT "msg_appels_appelant_id_fkey" FOREIGN KEY ("appelant_id") REFERENCES "public"."comptes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."msg_appels"
    ADD CONSTRAINT "msg_appels_appele_id_fkey" FOREIGN KEY ("appele_id") REFERENCES "public"."comptes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."msg_appels"
    ADD CONSTRAINT "msg_appels_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."msg_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."msg_appels"
    ADD CONSTRAINT "msg_appels_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "public"."ecoles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."msg_conversations"
    ADD CONSTRAINT "msg_conversations_cree_par_fkey" FOREIGN KEY ("cree_par") REFERENCES "public"."comptes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."msg_conversations"
    ADD CONSTRAINT "msg_conversations_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "public"."ecoles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."msg_membres"
    ADD CONSTRAINT "msg_membres_compte_id_fkey" FOREIGN KEY ("compte_id") REFERENCES "public"."comptes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."msg_membres"
    ADD CONSTRAINT "msg_membres_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."msg_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."msg_membres"
    ADD CONSTRAINT "msg_membres_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "public"."ecoles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."msg_messages"
    ADD CONSTRAINT "msg_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."msg_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."msg_messages"
    ADD CONSTRAINT "msg_messages_de_compte_id_fkey" FOREIGN KEY ("de_compte_id") REFERENCES "public"."comptes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."msg_messages"
    ADD CONSTRAINT "msg_messages_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "public"."ecoles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."msg_messages"
    ADD CONSTRAINT "msg_messages_reponse_a_fkey" FOREIGN KEY ("reponse_a") REFERENCES "public"."msg_messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."msg_presences"
    ADD CONSTRAINT "msg_presences_compte_id_fkey" FOREIGN KEY ("compte_id") REFERENCES "public"."comptes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."msg_presences"
    ADD CONSTRAINT "msg_presences_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "public"."ecoles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."msg_reunion_participants"
    ADD CONSTRAINT "msg_reunion_participants_compte_id_fkey" FOREIGN KEY ("compte_id") REFERENCES "public"."comptes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."msg_reunion_participants"
    ADD CONSTRAINT "msg_reunion_participants_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "public"."ecoles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."msg_reunion_participants"
    ADD CONSTRAINT "msg_reunion_participants_reunion_id_fkey" FOREIGN KEY ("reunion_id") REFERENCES "public"."msg_reunions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."msg_reunions"
    ADD CONSTRAINT "msg_reunions_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."msg_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."msg_reunions"
    ADD CONSTRAINT "msg_reunions_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "public"."ecoles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."msg_reunions"
    ADD CONSTRAINT "msg_reunions_lance_par_fkey" FOREIGN KEY ("lance_par") REFERENCES "public"."comptes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "public"."ecoles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "public"."eleves"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications_envois"
    ADD CONSTRAINT "notifications_envois_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "public"."ecoles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications_envois"
    ADD CONSTRAINT "notifications_envois_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "public"."eleves"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."paiements"
    ADD CONSTRAINT "paiements_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "public"."ecoles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."paiements"
    ADD CONSTRAINT "paiements_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "public"."eleves"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."parent_eleves"
    ADD CONSTRAINT "parent_eleves_compte_id_fkey" FOREIGN KEY ("compte_id") REFERENCES "public"."comptes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."parent_eleves"
    ADD CONSTRAINT "parent_eleves_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "public"."eleves"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."personnel"
    ADD CONSTRAINT "personnel_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "public"."ecoles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."postes"
    ADD CONSTRAINT "postes_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "public"."ecoles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."push_subs"
    ADD CONSTRAINT "push_subs_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "public"."ecoles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recettes"
    ADD CONSTRAINT "recettes_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "public"."ecoles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."salaires"
    ADD CONSTRAINT "salaires_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "public"."ecoles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."superadmin_message_lectures"
    ADD CONSTRAINT "superadmin_message_lectures_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."superadmin_messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tarifs"
    ADD CONSTRAINT "tarifs_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "public"."ecoles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transferts"
    ADD CONSTRAINT "transferts_ecole_source_id_fkey" FOREIGN KEY ("ecole_source_id") REFERENCES "public"."ecoles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."versements"
    ADD CONSTRAINT "versements_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "public"."ecoles"("id") ON DELETE CASCADE;



ALTER TABLE "public"."absences" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "absences_select" ON "public"."absences" FOR SELECT TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND (("public"."auth_role"() <> 'parent'::"public"."role_compte") OR ("eleve_id" IN ( SELECT "public"."my_eleve_ids"() AS "my_eleve_ids")))));



CREATE POLICY "absences_superadmin" ON "public"."absences" TO "authenticated" USING ("public"."is_superadmin"()) WITH CHECK ("public"."is_superadmin"());



CREATE POLICY "absences_write" ON "public"."absences" TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND ("public"."has_module_write"("public"."section_module"("section")) OR "public"."has_module_write"('discipline'::"text") OR ("eleve_id" IN ( SELECT "public"."my_teacher_eleve_ids"() AS "my_teacher_eleve_ids"))))) WITH CHECK ((("ecole_id" = "public"."auth_ecole_id"()) AND ("public"."has_module_write"("public"."section_module"("section")) OR "public"."has_module_write"('discipline'::"text") OR ("eleve_id" IN ( SELECT "public"."my_teacher_eleve_ids"() AS "my_teacher_eleve_ids")))));



ALTER TABLE "public"."annonces" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "annonces_select" ON "public"."annonces" FOR SELECT TO "authenticated" USING (("ecole_id" = "public"."auth_ecole_id"()));



CREATE POLICY "annonces_superadmin" ON "public"."annonces" TO "authenticated" USING ("public"."is_superadmin"()) WITH CHECK ("public"."is_superadmin"());



CREATE POLICY "annonces_write" ON "public"."annonces" TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."has_module_write"('messages'::"text"))) WITH CHECK ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."has_module_write"('messages'::"text")));



ALTER TABLE "public"."appreciations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "appreciations_select" ON "public"."appreciations" FOR SELECT TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND (("public"."auth_role"() <> 'parent'::"public"."role_compte") OR ("eleve_id" IN ( SELECT "public"."my_eleve_ids"() AS "my_eleve_ids")))));



CREATE POLICY "appreciations_superadmin" ON "public"."appreciations" TO "authenticated" USING ("public"."is_superadmin"()) WITH CHECK ("public"."is_superadmin"());



CREATE POLICY "appreciations_write" ON "public"."appreciations" TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."has_module_write"("public"."section_module"("section")))) WITH CHECK ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."has_module_write"("public"."section_module"("section"))));



ALTER TABLE "public"."audit" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_insert" ON "public"."audit" FOR INSERT TO "authenticated" WITH CHECK (("ecole_id" = "public"."auth_ecole_id"()));



CREATE POLICY "audit_select" ON "public"."audit" FOR SELECT TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."is_staff"()));



CREATE POLICY "audit_superadmin" ON "public"."audit" TO "authenticated" USING ("public"."is_superadmin"()) WITH CHECK ("public"."is_superadmin"());



ALTER TABLE "public"."bons" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bons_select" ON "public"."bons" FOR SELECT TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."has_module_read"('compta'::"text")));



CREATE POLICY "bons_superadmin" ON "public"."bons" TO "authenticated" USING ("public"."is_superadmin"()) WITH CHECK ("public"."is_superadmin"());



CREATE POLICY "bons_write" ON "public"."bons" TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."has_module_write"('compta'::"text"))) WITH CHECK ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."has_module_write"('compta'::"text")));



ALTER TABLE "public"."classes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "classes_select" ON "public"."classes" FOR SELECT TO "authenticated" USING (("ecole_id" = "public"."auth_ecole_id"()));



CREATE POLICY "classes_superadmin" ON "public"."classes" TO "authenticated" USING ("public"."is_superadmin"()) WITH CHECK ("public"."is_superadmin"());



CREATE POLICY "classes_write" ON "public"."classes" TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND ("public"."has_module_write"("public"."section_module"("section")) OR "public"."has_module_write"('compta'::"text")))) WITH CHECK ((("ecole_id" = "public"."auth_ecole_id"()) AND ("public"."has_module_write"("public"."section_module"("section")) OR "public"."has_module_write"('compta'::"text"))));



ALTER TABLE "public"."codes_reinitialisation" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comptes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "comptes_select" ON "public"."comptes" FOR SELECT TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND ("public"."is_staff"() OR ("user_id" = "auth"."uid"()))));



CREATE POLICY "comptes_superadmin" ON "public"."comptes" TO "authenticated" USING ("public"."is_superadmin"()) WITH CHECK ("public"."is_superadmin"());



CREATE POLICY "comptes_write" ON "public"."comptes" TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND (("user_id" = "auth"."uid"()) OR "public"."has_module_write"('admin_panel'::"text") OR ("public"."is_staff"() AND ("role" = ANY (ARRAY['parent'::"public"."role_compte", 'enseignant'::"public"."role_compte"])))))) WITH CHECK ((("ecole_id" = "public"."auth_ecole_id"()) AND (("user_id" = "auth"."uid"()) OR "public"."has_module_write"('admin_panel'::"text") OR ("public"."is_staff"() AND ("role" = ANY (ARRAY['parent'::"public"."role_compte", 'enseignant'::"public"."role_compte"]))))));



ALTER TABLE "public"."demandes_plan" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "demandes_plan_school" ON "public"."demandes_plan" TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."is_staff"())) WITH CHECK ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."is_staff"()));



CREATE POLICY "demandes_plan_superadmin" ON "public"."demandes_plan" TO "authenticated" USING ("public"."is_superadmin"()) WITH CHECK ("public"."is_superadmin"());



ALTER TABLE "public"."depenses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "depenses_select" ON "public"."depenses" FOR SELECT TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."has_module_read"('compta'::"text")));



CREATE POLICY "depenses_superadmin" ON "public"."depenses" TO "authenticated" USING ("public"."is_superadmin"()) WITH CHECK ("public"."is_superadmin"());



CREATE POLICY "depenses_write" ON "public"."depenses" TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."has_module_write"('compta'::"text"))) WITH CHECK ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."has_module_write"('compta'::"text")));



ALTER TABLE "public"."documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "documents_select" ON "public"."documents" FOR SELECT TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."has_module_read"('fondation'::"text")));



CREATE POLICY "documents_superadmin" ON "public"."documents" TO "authenticated" USING ("public"."is_superadmin"()) WITH CHECK ("public"."is_superadmin"());



CREATE POLICY "documents_write" ON "public"."documents" TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."has_module_write"('fondation'::"text"))) WITH CHECK ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."has_module_write"('fondation'::"text")));



ALTER TABLE "public"."ecoles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ecoles_select" ON "public"."ecoles" FOR SELECT TO "authenticated" USING (("id" = "public"."auth_ecole_id"()));



CREATE POLICY "ecoles_superadmin" ON "public"."ecoles" TO "authenticated" USING ("public"."is_superadmin"()) WITH CHECK ("public"."is_superadmin"());



CREATE POLICY "ecoles_update" ON "public"."ecoles" FOR UPDATE TO "authenticated" USING ((("id" = "public"."auth_ecole_id"()) AND ("public"."has_module_write"('parametres'::"text") OR "public"."has_module_write"('admin_panel'::"text"))));



ALTER TABLE "public"."eleves" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "eleves_select" ON "public"."eleves" FOR SELECT TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND (("public"."auth_role"() <> 'parent'::"public"."role_compte") OR ("id" IN ( SELECT "public"."my_eleve_ids"() AS "my_eleve_ids")))));



CREATE POLICY "eleves_superadmin" ON "public"."eleves" TO "authenticated" USING ("public"."is_superadmin"()) WITH CHECK ("public"."is_superadmin"());



CREATE POLICY "eleves_write" ON "public"."eleves" TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND ("public"."has_module_write"("public"."section_module"("section")) OR "public"."has_module_write"('compta'::"text")))) WITH CHECK ((("ecole_id" = "public"."auth_ecole_id"()) AND ("public"."has_module_write"("public"."section_module"("section")) OR "public"."has_module_write"('compta'::"text"))));



ALTER TABLE "public"."emplois" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "emplois_select" ON "public"."emplois" FOR SELECT TO "authenticated" USING (("ecole_id" = "public"."auth_ecole_id"()));



CREATE POLICY "emplois_superadmin" ON "public"."emplois" TO "authenticated" USING ("public"."is_superadmin"()) WITH CHECK ("public"."is_superadmin"());



CREATE POLICY "emplois_write" ON "public"."emplois" TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."has_module_write"("public"."section_module"("section")))) WITH CHECK ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."has_module_write"("public"."section_module"("section"))));



ALTER TABLE "public"."enseignant_classes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "enseignant_classes_select" ON "public"."enseignant_classes" FOR SELECT TO "authenticated" USING (("ecole_id" = "public"."auth_ecole_id"()));



CREATE POLICY "enseignant_classes_superadmin" ON "public"."enseignant_classes" TO "authenticated" USING ("public"."is_superadmin"()) WITH CHECK ("public"."is_superadmin"());



CREATE POLICY "enseignant_classes_write" ON "public"."enseignant_classes" TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."is_staff"())) WITH CHECK ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."is_staff"()));



ALTER TABLE "public"."enseignants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "enseignants_select" ON "public"."enseignants" FOR SELECT TO "authenticated" USING (("ecole_id" = "public"."auth_ecole_id"()));



CREATE POLICY "enseignants_superadmin" ON "public"."enseignants" TO "authenticated" USING ("public"."is_superadmin"()) WITH CHECK ("public"."is_superadmin"());



CREATE POLICY "enseignants_write" ON "public"."enseignants" TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND ("public"."has_module_write"("public"."section_module"("section")) OR "public"."has_module_write"('compta'::"text")))) WITH CHECK ((("ecole_id" = "public"."auth_ecole_id"()) AND ("public"."has_module_write"("public"."section_module"("section")) OR "public"."has_module_write"('compta'::"text"))));



ALTER TABLE "public"."enseignements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "enseignements_select" ON "public"."enseignements" FOR SELECT TO "authenticated" USING (("ecole_id" = "public"."auth_ecole_id"()));



CREATE POLICY "enseignements_superadmin" ON "public"."enseignements" TO "authenticated" USING ("public"."is_superadmin"()) WITH CHECK ("public"."is_superadmin"());



CREATE POLICY "enseignements_write" ON "public"."enseignements" TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."has_module_write"("public"."section_module"("section")))) WITH CHECK ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."has_module_write"("public"."section_module"("section"))));



ALTER TABLE "public"."evenements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "evenements_select" ON "public"."evenements" FOR SELECT TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."has_module_read"('calendrier'::"text")));



CREATE POLICY "evenements_superadmin" ON "public"."evenements" TO "authenticated" USING ("public"."is_superadmin"()) WITH CHECK ("public"."is_superadmin"());



CREATE POLICY "evenements_write" ON "public"."evenements" TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."has_module_write"('calendrier'::"text"))) WITH CHECK ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."has_module_write"('calendrier'::"text")));



ALTER TABLE "public"."examens" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "examens_select" ON "public"."examens" FOR SELECT TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."has_module_read"('examens'::"text")));



CREATE POLICY "examens_superadmin" ON "public"."examens" TO "authenticated" USING ("public"."is_superadmin"()) WITH CHECK ("public"."is_superadmin"());



CREATE POLICY "examens_write" ON "public"."examens" TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."has_module_write"('examens'::"text"))) WITH CHECK ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."has_module_write"('examens'::"text")));



ALTER TABLE "public"."historique" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "historique_delete" ON "public"."historique" FOR DELETE TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."has_module_write"('historique'::"text")));



CREATE POLICY "historique_insert" ON "public"."historique" FOR INSERT TO "authenticated" WITH CHECK ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."is_staff"()));



CREATE POLICY "historique_select" ON "public"."historique" FOR SELECT TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."has_module_read"('historique'::"text")));



CREATE POLICY "historique_superadmin" ON "public"."historique" TO "authenticated" USING ("public"."is_superadmin"()) WITH CHECK ("public"."is_superadmin"());



CREATE POLICY "historique_update" ON "public"."historique" FOR UPDATE TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."has_module_write"('historique'::"text")));



ALTER TABLE "public"."honneurs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "honneurs_select" ON "public"."honneurs" FOR SELECT TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."has_module_read"('examens'::"text")));



CREATE POLICY "honneurs_superadmin" ON "public"."honneurs" TO "authenticated" USING ("public"."is_superadmin"()) WITH CHECK ("public"."is_superadmin"());



CREATE POLICY "honneurs_write" ON "public"."honneurs" TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."has_module_write"('examens'::"text"))) WITH CHECK ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."has_module_write"('examens'::"text")));



ALTER TABLE "public"."livrets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "livrets_select" ON "public"."livrets" FOR SELECT TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."has_module_read"('examens'::"text")));



CREATE POLICY "livrets_superadmin" ON "public"."livrets" TO "authenticated" USING ("public"."is_superadmin"()) WITH CHECK ("public"."is_superadmin"());



CREATE POLICY "livrets_write" ON "public"."livrets" TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."has_module_write"('examens'::"text"))) WITH CHECK ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."has_module_write"('examens'::"text")));



ALTER TABLE "public"."matieres" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "matieres_select" ON "public"."matieres" FOR SELECT TO "authenticated" USING (("ecole_id" = "public"."auth_ecole_id"()));



CREATE POLICY "matieres_superadmin" ON "public"."matieres" TO "authenticated" USING ("public"."is_superadmin"()) WITH CHECK ("public"."is_superadmin"());



CREATE POLICY "matieres_write" ON "public"."matieres" TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."has_module_write"("public"."section_module"("section")))) WITH CHECK ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."has_module_write"("public"."section_module"("section"))));



ALTER TABLE "public"."membres" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "membres_select" ON "public"."membres" FOR SELECT TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."has_module_read"('fondation'::"text")));



CREATE POLICY "membres_superadmin" ON "public"."membres" TO "authenticated" USING ("public"."is_superadmin"()) WITH CHECK ("public"."is_superadmin"());



CREATE POLICY "membres_write" ON "public"."membres" TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."has_module_write"('fondation'::"text"))) WITH CHECK ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."has_module_write"('fondation'::"text")));



ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages_internes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages_internes_lus" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "messages_select" ON "public"."messages" FOR SELECT TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND ("public"."has_module_read"('messages'::"text") OR ("eleve_id" IN ( SELECT "public"."my_eleve_ids"() AS "my_eleve_ids")))));



CREATE POLICY "messages_superadmin" ON "public"."messages" TO "authenticated" USING ("public"."is_superadmin"()) WITH CHECK ("public"."is_superadmin"());



CREATE POLICY "messages_write" ON "public"."messages" TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND ("public"."has_module_write"('messages'::"text") OR ("eleve_id" IN ( SELECT "public"."my_eleve_ids"() AS "my_eleve_ids"))))) WITH CHECK ((("ecole_id" = "public"."auth_ecole_id"()) AND ("public"."has_module_write"('messages'::"text") OR ("eleve_id" IN ( SELECT "public"."my_eleve_ids"() AS "my_eleve_ids")))));



ALTER TABLE "public"."msg_annonces" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "msg_annonces_delete" ON "public"."msg_annonces" FOR DELETE TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND (("de_compte_id" = "public"."my_compte_id"()) OR (("public"."auth_role"())::"text" = ANY (ARRAY['direction'::"text", 'admin'::"text"])))));



CREATE POLICY "msg_annonces_insert" ON "public"."msg_annonces" FOR INSERT TO "authenticated" WITH CHECK ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."est_membre_messagerie"() AND (("public"."auth_role"())::"text" <> ALL (ARRAY['enseignant'::"text", 'parent'::"text"])) AND ("de_compte_id" = "public"."my_compte_id"()) AND (NOT "hors_pyramide") AND ("a_tous" OR "a_personnel" OR "a_enseignants" OR "a_parents" OR (COALESCE("array_length"("a_postes", 1), 0) > 0) OR (COALESCE("array_length"("a_comptes", 1), 0) > 0) OR (COALESCE("array_length"("a_parents_sections", 1), 0) > 0) OR (COALESCE("array_length"("a_parents_classes", 1), 0) > 0))));



ALTER TABLE "public"."msg_annonces_lus" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "msg_annonces_lus_select" ON "public"."msg_annonces_lus" FOR SELECT TO "authenticated" USING (("compte_id" = "public"."my_compte_id"()));



CREATE POLICY "msg_annonces_select" ON "public"."msg_annonces" FOR SELECT TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."est_membre_messagerie"() AND (("de_compte_id" = "public"."my_compte_id"()) OR (
CASE
    WHEN (("public"."auth_role"())::"text" = 'parent'::"text") THEN (("public"."my_compte_id"() = ANY (COALESCE("a_comptes", '{}'::"uuid"[]))) OR "public"."msg_suis_parent_vise"("a_parents", "a_parents_sections", "a_parents_classes"))
    ELSE ("a_tous" OR ("a_personnel" AND (("public"."auth_role"())::"text" <> 'enseignant'::"text")) OR ("a_enseignants" AND (("public"."auth_role"())::"text" = 'enseignant'::"text")) OR ("public"."my_poste_cle"() = ANY (COALESCE("a_postes", '{}'::"text"[]))) OR ("public"."my_compte_id"() = ANY (COALESCE("a_comptes", '{}'::"uuid"[]))))
END AND ("hors_pyramide" OR ("de_compte_id" IS NULL) OR "public"."msg_peut_contacter"("de_compte_id", "public"."my_compte_id"()))))));



ALTER TABLE "public"."msg_appels" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "msg_appels_select" ON "public"."msg_appels" FOR SELECT TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND (("appelant_id" = "public"."my_compte_id"()) OR ("appele_id" = "public"."my_compte_id"()))));



CREATE POLICY "msg_conv_select" ON "public"."msg_conversations" FOR SELECT TO "authenticated" USING (("id" IN ( SELECT "public"."msg_mes_conversations"() AS "msg_mes_conversations")));



ALTER TABLE "public"."msg_conversations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "msg_int_delete" ON "public"."messages_internes" FOR DELETE TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND ("de_compte_id" = "public"."my_compte_id"())));



CREATE POLICY "msg_int_insert" ON "public"."messages_internes" FOR INSERT TO "authenticated" WITH CHECK ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."is_staff"() AND ("de_compte_id" = "public"."my_compte_id"()) AND ("a_tous" OR ("a_compte_id" IS NOT NULL) OR (COALESCE("array_length"("a_postes", 1), 0) > 0))));



CREATE POLICY "msg_int_lus_insert" ON "public"."messages_internes_lus" FOR INSERT TO "authenticated" WITH CHECK (("compte_id" = "public"."my_compte_id"()));



CREATE POLICY "msg_int_lus_select" ON "public"."messages_internes_lus" FOR SELECT TO "authenticated" USING (("compte_id" = "public"."my_compte_id"()));



CREATE POLICY "msg_int_lus_superadmin" ON "public"."messages_internes_lus" TO "authenticated" USING ("public"."is_superadmin"()) WITH CHECK ("public"."is_superadmin"());



CREATE POLICY "msg_int_select" ON "public"."messages_internes" FOR SELECT TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."is_staff"() AND (("de_compte_id" = "public"."my_compte_id"()) OR "a_tous" OR ("a_compte_id" = "public"."my_compte_id"()) OR ("public"."my_poste_cle"() = ANY (COALESCE("a_postes", '{}'::"text"[]))))));



CREATE POLICY "msg_int_superadmin" ON "public"."messages_internes" TO "authenticated" USING ("public"."is_superadmin"()) WITH CHECK ("public"."is_superadmin"());



ALTER TABLE "public"."msg_membres" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "msg_membres_select" ON "public"."msg_membres" FOR SELECT TO "authenticated" USING (("conversation_id" IN ( SELECT "public"."msg_mes_conversations"() AS "msg_mes_conversations")));



ALTER TABLE "public"."msg_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "msg_messages_insert" ON "public"."msg_messages" FOR INSERT TO "authenticated" WITH CHECK ((("ecole_id" = "public"."auth_ecole_id"()) AND ("de_compte_id" = "public"."my_compte_id"()) AND ("type" = ANY (ARRAY['texte'::"text", 'audio'::"text", 'fichier'::"text"])) AND (NOT "supprime") AND ("modifie_at" IS NULL) AND ("conversation_id" IN ( SELECT "public"."msg_mes_conversations"() AS "msg_mes_conversations")) AND (("type" <> 'texte'::"text") OR (COALESCE("char_length"(TRIM(BOTH FROM "corps")), 0) > 0)) AND (("type" <> 'audio'::"text") OR ("audio_path" IS NOT NULL)) AND (("type" <> 'fichier'::"text") OR (("fichier_path" IS NOT NULL) AND ("fichier_nom" IS NOT NULL))) AND (("audio_path" IS NULL) OR ("audio_path" ~~ (((("public"."auth_ecole_id"())::"text" || '/'::"text") || ("conversation_id")::"text") || '/%'::"text"))) AND (("fichier_path" IS NULL) OR ("fichier_path" ~~ (((("public"."auth_ecole_id"())::"text" || '/'::"text") || ("conversation_id")::"text") || '/%'::"text")))));



CREATE POLICY "msg_messages_select" ON "public"."msg_messages" FOR SELECT TO "authenticated" USING (("conversation_id" IN ( SELECT "public"."msg_mes_conversations"() AS "msg_mes_conversations")));



ALTER TABLE "public"."msg_presences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."msg_reunion_participants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "msg_reunion_participants_select" ON "public"."msg_reunion_participants" FOR SELECT TO "authenticated" USING (("reunion_id" IN ( SELECT "r"."id"
   FROM "public"."msg_reunions" "r"
  WHERE ("r"."conversation_id" IN ( SELECT "public"."msg_mes_conversations"() AS "msg_mes_conversations")))));



ALTER TABLE "public"."msg_reunions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "msg_reunions_select" ON "public"."msg_reunions" FOR SELECT TO "authenticated" USING (("conversation_id" IN ( SELECT "public"."msg_mes_conversations"() AS "msg_mes_conversations")));



ALTER TABLE "public"."notes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notes_select" ON "public"."notes" FOR SELECT TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND (("public"."auth_role"() <> 'parent'::"public"."role_compte") OR ("eleve_id" IN ( SELECT "public"."my_eleve_ids"() AS "my_eleve_ids")))));



CREATE POLICY "notes_superadmin" ON "public"."notes" TO "authenticated" USING ("public"."is_superadmin"()) WITH CHECK ("public"."is_superadmin"());



CREATE POLICY "notes_write" ON "public"."notes" TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND ("public"."has_module_write"("public"."section_module"("section")) OR "public"."teacher_can_write_note"("eleve_id", "matiere", "section")))) WITH CHECK ((("ecole_id" = "public"."auth_ecole_id"()) AND ("public"."has_module_write"("public"."section_module"("section")) OR "public"."teacher_can_write_note"("eleve_id", "matiere", "section"))));



CREATE POLICY "notif_select" ON "public"."notifications_envois" FOR SELECT TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."is_staff"()));



ALTER TABLE "public"."notifications_envois" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."paiements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "paiements_insert" ON "public"."paiements" FOR INSERT TO "authenticated" WITH CHECK ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."is_staff"()));



CREATE POLICY "paiements_select" ON "public"."paiements" FOR SELECT TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND (("public"."auth_role"() <> 'parent'::"public"."role_compte") OR ("eleve_id" IN ( SELECT "public"."my_eleve_ids"() AS "my_eleve_ids")))));



CREATE POLICY "paiements_superadmin" ON "public"."paiements" TO "authenticated" USING ("public"."is_superadmin"()) WITH CHECK ("public"."is_superadmin"());



ALTER TABLE "public"."parent_eleves" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "parent_eleves_select" ON "public"."parent_eleves" FOR SELECT TO "authenticated" USING ((("compte_id" = "public"."my_compte_id"()) OR ("public"."is_staff"() AND (EXISTS ( SELECT 1
   FROM "public"."eleves" "e"
  WHERE (("e"."id" = "parent_eleves"."eleve_id") AND ("e"."ecole_id" = "public"."auth_ecole_id"())))))));



CREATE POLICY "parent_eleves_superadmin" ON "public"."parent_eleves" TO "authenticated" USING ("public"."is_superadmin"()) WITH CHECK ("public"."is_superadmin"());



ALTER TABLE "public"."personnel" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "personnel_select" ON "public"."personnel" FOR SELECT TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."has_module_read"('compta'::"text")));



CREATE POLICY "personnel_superadmin" ON "public"."personnel" TO "authenticated" USING ("public"."is_superadmin"()) WITH CHECK ("public"."is_superadmin"());



CREATE POLICY "personnel_write" ON "public"."personnel" TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."has_module_write"('compta'::"text"))) WITH CHECK ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."has_module_write"('compta'::"text")));



ALTER TABLE "public"."postes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "postes_select" ON "public"."postes" FOR SELECT TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."is_staff"()));



CREATE POLICY "postes_superadmin" ON "public"."postes" TO "authenticated" USING ("public"."is_superadmin"()) WITH CHECK ("public"."is_superadmin"());



CREATE POLICY "postes_write" ON "public"."postes" TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND ("public"."auth_role"() = ANY (ARRAY['direction'::"public"."role_compte", 'superadmin'::"public"."role_compte"])))) WITH CHECK ((("ecole_id" = "public"."auth_ecole_id"()) AND ("public"."auth_role"() = ANY (ARRAY['direction'::"public"."role_compte", 'superadmin'::"public"."role_compte"]))));



ALTER TABLE "public"."push_subs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "push_subs_self" ON "public"."push_subs" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK ((("user_id" = "auth"."uid"()) AND ("ecole_id" = "public"."auth_ecole_id"()) AND ("role" = ("public"."auth_role"())::"text")));



CREATE POLICY "push_subs_superadmin" ON "public"."push_subs" TO "authenticated" USING ("public"."is_superadmin"()) WITH CHECK ("public"."is_superadmin"());



ALTER TABLE "public"."recettes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "recettes_select" ON "public"."recettes" FOR SELECT TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."has_module_read"('compta'::"text")));



CREATE POLICY "recettes_superadmin" ON "public"."recettes" TO "authenticated" USING ("public"."is_superadmin"()) WITH CHECK ("public"."is_superadmin"());



CREATE POLICY "recettes_write" ON "public"."recettes" TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."has_module_write"('compta'::"text"))) WITH CHECK ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."has_module_write"('compta'::"text")));



ALTER TABLE "public"."salaires" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "salaires_select" ON "public"."salaires" FOR SELECT TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."has_module_read"('compta'::"text")));



CREATE POLICY "salaires_select_enseignant" ON "public"."salaires" FOR SELECT TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND ("public"."nom_paie_normalise"("nom") IN ( SELECT "unnest"("public"."mes_noms_paie"()) AS "unnest"))));



CREATE POLICY "salaires_superadmin" ON "public"."salaires" TO "authenticated" USING ("public"."is_superadmin"()) WITH CHECK ("public"."is_superadmin"());



CREATE POLICY "salaires_write" ON "public"."salaires" TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."has_module_write"('compta'::"text"))) WITH CHECK ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."has_module_write"('compta'::"text")));



CREATE POLICY "sam_school_select" ON "public"."superadmin_messages" FOR SELECT TO "authenticated" USING (((("cardinality"(COALESCE("cible_schools", '{}'::"text"[])) = 0) OR (( SELECT "ecoles"."code"
   FROM "public"."ecoles"
  WHERE ("ecoles"."id" = "public"."auth_ecole_id"())) = ANY ("cible_schools"))) AND (("cardinality"(COALESCE("cible_roles", '{}'::"text"[])) = 0) OR (("public"."auth_role"())::"text" = ANY ("cible_roles")))));



CREATE POLICY "sam_superadmin" ON "public"."superadmin_messages" TO "authenticated" USING ("public"."is_superadmin"()) WITH CHECK ("public"."is_superadmin"());



CREATE POLICY "saml_self" ON "public"."superadmin_message_lectures" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "saml_superadmin" ON "public"."superadmin_message_lectures" TO "authenticated" USING ("public"."is_superadmin"()) WITH CHECK ("public"."is_superadmin"());



ALTER TABLE "public"."superadmin_message_lectures" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."superadmin_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tarifs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tarifs_select" ON "public"."tarifs" FOR SELECT TO "authenticated" USING (("ecole_id" = "public"."auth_ecole_id"()));



CREATE POLICY "tarifs_superadmin" ON "public"."tarifs" TO "authenticated" USING ("public"."is_superadmin"()) WITH CHECK ("public"."is_superadmin"());



CREATE POLICY "tarifs_write" ON "public"."tarifs" TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."has_module_write"('compta'::"text"))) WITH CHECK ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."has_module_write"('compta'::"text")));



ALTER TABLE "public"."transferts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "transferts_source" ON "public"."transferts" TO "authenticated" USING ((("ecole_source_id" = "public"."auth_ecole_id"()) AND "public"."is_staff"())) WITH CHECK ((("ecole_source_id" = "public"."auth_ecole_id"()) AND "public"."is_staff"()));



CREATE POLICY "transferts_superadmin" ON "public"."transferts" TO "authenticated" USING ("public"."is_superadmin"()) WITH CHECK ("public"."is_superadmin"());



ALTER TABLE "public"."versements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "versements_select" ON "public"."versements" FOR SELECT TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."has_module_read"('compta'::"text")));



CREATE POLICY "versements_superadmin" ON "public"."versements" TO "authenticated" USING ("public"."is_superadmin"()) WITH CHECK ("public"."is_superadmin"());



CREATE POLICY "versements_write" ON "public"."versements" TO "authenticated" USING ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."has_module_write"('compta'::"text"))) WITH CHECK ((("ecole_id" = "public"."auth_ecole_id"()) AND "public"."has_module_write"('compta'::"text")));



CREATE PUBLICATION "powersync" WITH (publish = 'insert, update, delete, truncate');


ALTER PUBLICATION "powersync" OWNER TO "postgres";




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "powersync" ADD TABLE ONLY "public"."absences";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."absences";



ALTER PUBLICATION "powersync" ADD TABLE ONLY "public"."annonces";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."annonces";



ALTER PUBLICATION "powersync" ADD TABLE ONLY "public"."appreciations";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."appreciations";



ALTER PUBLICATION "powersync" ADD TABLE ONLY "public"."bons";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."bons";



ALTER PUBLICATION "powersync" ADD TABLE ONLY "public"."classes";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."classes";



ALTER PUBLICATION "powersync" ADD TABLE ONLY "public"."comptes";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."comptes";



ALTER PUBLICATION "powersync" ADD TABLE ONLY "public"."depenses";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."depenses";



ALTER PUBLICATION "powersync" ADD TABLE ONLY "public"."documents";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."documents";



ALTER PUBLICATION "powersync" ADD TABLE ONLY "public"."ecoles";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."ecoles" ("id", "code", "nom", "logo", "couleur1", "couleur2", "pays", "devise", "plan", "plan_expiry", "modele_bulletin", "role_settings", "legal", "extra", "actif", "supprime", "updated_at");



ALTER PUBLICATION "powersync" ADD TABLE ONLY "public"."eleves";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."eleves";



ALTER PUBLICATION "powersync" ADD TABLE ONLY "public"."emplois";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."emplois";



ALTER PUBLICATION "powersync" ADD TABLE ONLY "public"."enseignant_classes";



ALTER PUBLICATION "powersync" ADD TABLE ONLY "public"."enseignants";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."enseignants";



ALTER PUBLICATION "powersync" ADD TABLE ONLY "public"."enseignements";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."enseignements";



ALTER PUBLICATION "powersync" ADD TABLE ONLY "public"."evenements";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."evenements";



ALTER PUBLICATION "powersync" ADD TABLE ONLY "public"."examens";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."examens";



ALTER PUBLICATION "powersync" ADD TABLE ONLY "public"."historique";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."historique";



ALTER PUBLICATION "powersync" ADD TABLE ONLY "public"."honneurs";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."honneurs";



ALTER PUBLICATION "powersync" ADD TABLE ONLY "public"."livrets";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."livrets";



ALTER PUBLICATION "powersync" ADD TABLE ONLY "public"."matieres";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."matieres";



ALTER PUBLICATION "powersync" ADD TABLE ONLY "public"."membres";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."membres";



ALTER PUBLICATION "powersync" ADD TABLE ONLY "public"."messages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."messages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."msg_annonces";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."msg_appels";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."msg_membres";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."msg_messages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."msg_reunion_participants";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."msg_reunions";



ALTER PUBLICATION "powersync" ADD TABLE ONLY "public"."notes";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notes";



ALTER PUBLICATION "powersync" ADD TABLE ONLY "public"."paiements";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."paiements";



ALTER PUBLICATION "powersync" ADD TABLE ONLY "public"."personnel";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."personnel";



ALTER PUBLICATION "powersync" ADD TABLE ONLY "public"."postes";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."postes";



ALTER PUBLICATION "powersync" ADD TABLE ONLY "public"."recettes";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."recettes";



ALTER PUBLICATION "powersync" ADD TABLE ONLY "public"."salaires";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."salaires";



ALTER PUBLICATION "powersync" ADD TABLE ONLY "public"."tarifs";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."tarifs";



ALTER PUBLICATION "powersync" ADD TABLE ONLY "public"."versements";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."versements";



GRANT USAGE ON SCHEMA "api" TO "anon";
GRANT USAGE ON SCHEMA "api" TO "authenticated";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."annonces_publiques"("p_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."annonces_publiques"("p_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."annonces_publiques"("p_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."auth_ecole_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."auth_ecole_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auth_ecole_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auth_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."auth_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auth_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."can_grade"() TO "anon";
GRANT ALL ON FUNCTION "public"."can_grade"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_grade"() TO "service_role";



GRANT ALL ON FUNCTION "public"."comptes_guard"() TO "anon";
GRANT ALL ON FUNCTION "public"."comptes_guard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."comptes_guard"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."ecole_blocage_ecriture"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ecole_blocage_ecriture"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ecole_blocage_ecriture"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ecoles_guard"() TO "anon";
GRANT ALL ON FUNCTION "public"."ecoles_guard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ecoles_guard"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."est_membre_messagerie"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."est_membre_messagerie"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."est_membre_messagerie"() TO "service_role";



GRANT ALL ON FUNCTION "public"."etat_ecole"("p_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."etat_ecole"("p_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."etat_ecole"("p_code" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."garde_ecriture_ecole"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."garde_ecriture_ecole"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_module_read"("p_module" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_module_read"("p_module" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_module_read"("p_module" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_module_write"("p_module" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_module_write"("p_module" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_module_write"("p_module" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_staff"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_staff"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_staff"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_superadmin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_superadmin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_superadmin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."login_pour_email"("p_code" "text", "p_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."login_pour_email"("p_code" "text", "p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."login_pour_email"("p_code" "text", "p_email" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."maj_reglages_compta"("p_champs" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."maj_reglages_compta"("p_champs" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."maj_reglages_compta"("p_champs" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."mes_noms_paie"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mes_noms_paie"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."mes_noms_paie"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_ajouter_membres"("p_conv" "uuid", "p_membres" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_ajouter_membres"("p_conv" "uuid", "p_membres" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."msg_ajouter_membres"("p_conv" "uuid", "p_membres" "uuid"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_annonce_destinataires"("p_annonce" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_annonce_destinataires"("p_annonce" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_annonce_epingler"("p_id" "uuid", "p_epinglee" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_annonce_epingler"("p_id" "uuid", "p_epinglee" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."msg_annonce_epingler"("p_id" "uuid", "p_epinglee" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_annonce_gerable"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_annonce_gerable"("p_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_annonce_joindre"("p_id" "uuid", "p_pieces" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_annonce_joindre"("p_id" "uuid", "p_pieces" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."msg_annonce_joindre"("p_id" "uuid", "p_pieces" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_annonce_lire"("p_id" "uuid", "p_confirmer" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_annonce_lire"("p_id" "uuid", "p_confirmer" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."msg_annonce_lire"("p_id" "uuid", "p_confirmer" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_annonce_lisible"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_annonce_lisible"("p_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_annonce_objet_auteur"("p_segment" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_annonce_objet_auteur"("p_segment" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."msg_annonce_objet_auteur"("p_segment" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_annonce_objet_gerable"("p_segment" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_annonce_objet_gerable"("p_segment" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."msg_annonce_objet_gerable"("p_segment" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_annonce_objet_lisible"("p_segment" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_annonce_objet_lisible"("p_segment" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."msg_annonce_objet_lisible"("p_segment" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_annonce_suivi"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_annonce_suivi"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."msg_annonce_suivi"("p_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_annonces_stats"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_annonces_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."msg_annonces_stats"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_annuaire"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_annuaire"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."msg_annuaire"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_appel_lancer"("p_conv" "uuid", "p_offre" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_appel_lancer"("p_conv" "uuid", "p_offre" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."msg_appel_lancer"("p_conv" "uuid", "p_offre" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_appel_repondre"("p_id" "uuid", "p_reponse" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_appel_repondre"("p_id" "uuid", "p_reponse" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."msg_appel_repondre"("p_id" "uuid", "p_reponse" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_appel_terminer"("p_id" "uuid", "p_statut" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_appel_terminer"("p_id" "uuid", "p_statut" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."msg_appel_terminer"("p_id" "uuid", "p_statut" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_apres_message"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_apres_message"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_avant_annonce"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_avant_annonce"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_boite"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_boite"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."msg_boite"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_branches_de"("p_sections" "text"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_branches_de"("p_sections" "text"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_branches_dirigees"("p_ecole" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_branches_dirigees"("p_ecole" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_branches_eff"("p" "text"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_branches_eff"("p" "text"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_compte_joignable"("p_compte" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_compte_joignable"("p_compte" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_contactables"("p_de" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_contactables"("p_de" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_creer_groupe"("p_titre" "text", "p_membres" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_creer_groupe"("p_titre" "text", "p_membres" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."msg_creer_groupe"("p_titre" "text", "p_membres" "uuid"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_definir_admin"("p_conv" "uuid", "p_compte" "uuid", "p_admin" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_definir_admin"("p_conv" "uuid", "p_compte" "uuid", "p_admin" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."msg_definir_admin"("p_conv" "uuid", "p_compte" "uuid", "p_admin" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_enfants"("p_parent" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_enfants"("p_parent" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_exiger_contactables"("p_comptes" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_exiger_contactables"("p_comptes" "uuid"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_marquer_lu"("p_conv" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_marquer_lu"("p_conv" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."msg_marquer_lu"("p_conv" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_mes_conversations"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_mes_conversations"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."msg_mes_conversations"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_modifier_message"("p_id" "uuid", "p_corps" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_modifier_message"("p_id" "uuid", "p_corps" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."msg_modifier_message"("p_id" "uuid", "p_corps" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_nom_compte"("p_compte" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_nom_compte"("p_compte" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_ouvrir_directe"("p_compte" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_ouvrir_directe"("p_compte" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."msg_ouvrir_directe"("p_compte" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_parent_vise"("p_parent" "uuid", "p_tous" boolean, "p_sections" "text"[], "p_classes" "text"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_parent_vise"("p_parent" "uuid", "p_tous" boolean, "p_sections" "text"[], "p_classes" "text"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_peut_contacter"("p_de" "uuid", "p_vers" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_peut_contacter"("p_de" "uuid", "p_vers" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."msg_peut_contacter"("p_de" "uuid", "p_vers" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_poste_compte"("p_compte" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_poste_compte"("p_compte" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_preferences"("p_conv" "uuid", "p_archive" boolean, "p_epingle" boolean, "p_sourdine" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_preferences"("p_conv" "uuid", "p_archive" boolean, "p_epingle" boolean, "p_sourdine" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."msg_preferences"("p_conv" "uuid", "p_archive" boolean, "p_epingle" boolean, "p_sourdine" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_presence"("p_etat" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_presence"("p_etat" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."msg_presence"("p_etat" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_presences"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_presences"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."msg_presences"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_profils"("p_ecole" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_profils"("p_ecole" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_profils_ecole"("p_ecole" "uuid", "p_compte" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_profils_ecole"("p_ecole" "uuid", "p_compte" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_regle"("de_niv" "text", "de_br" "text"[], "de_cle" "text", "vers_niv" "text", "vers_br" "text"[], "vers_cle" "text", "dirigees" "text"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_regle"("de_niv" "text", "de_br" "text"[], "de_cle" "text", "vers_niv" "text", "vers_br" "text"[], "vers_cle" "text", "dirigees" "text"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_renommer_groupe"("p_conv" "uuid", "p_titre" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_renommer_groupe"("p_conv" "uuid", "p_titre" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."msg_renommer_groupe"("p_conv" "uuid", "p_titre" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_reprendre_message_interne"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_reprendre_message_interne"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_retirer_membre"("p_conv" "uuid", "p_compte" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_retirer_membre"("p_conv" "uuid", "p_compte" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."msg_retirer_membre"("p_conv" "uuid", "p_compte" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_reunion_clore"("p_reunion" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_reunion_clore"("p_reunion" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_reunion_demarrer"("p_conv" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_reunion_demarrer"("p_conv" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."msg_reunion_demarrer"("p_conv" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_reunion_etat"("p_reunion" "uuid", "p_micro" boolean, "p_camera" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_reunion_etat"("p_reunion" "uuid", "p_micro" boolean, "p_camera" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."msg_reunion_etat"("p_reunion" "uuid", "p_micro" boolean, "p_camera" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_reunion_presents"("p_reunion" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_reunion_presents"("p_reunion" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_reunion_quitter"("p_reunion" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_reunion_quitter"("p_reunion" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."msg_reunion_quitter"("p_reunion" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_reunions_actives"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_reunions_actives"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."msg_reunions_actives"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_suis_admin"("p_conv" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_suis_admin"("p_conv" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_suis_parent_vise"("p_tous" boolean, "p_sections" "text"[], "p_classes" "text"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_suis_parent_vise"("p_tous" boolean, "p_sections" "text"[], "p_classes" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."msg_suis_parent_vise"("p_tous" boolean, "p_sections" "text"[], "p_classes" "text"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_supprimer_message"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_supprimer_message"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."msg_supprimer_message"("p_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_systeme"("p_conv" "uuid", "p_texte" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_systeme"("p_conv" "uuid", "p_texte" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."msg_uuid_ou_null"("p" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."msg_uuid_ou_null"("p" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."msg_uuid_ou_null"("p" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."msg_visibles"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."msg_visibles"() TO "service_role";



GRANT ALL ON FUNCTION "public"."my_compte_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."my_compte_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."my_compte_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."my_eleve_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."my_eleve_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."my_eleve_ids"() TO "service_role";



GRANT ALL ON FUNCTION "public"."my_permissions"() TO "anon";
GRANT ALL ON FUNCTION "public"."my_permissions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."my_permissions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."my_poste_cle"() TO "anon";
GRANT ALL ON FUNCTION "public"."my_poste_cle"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."my_poste_cle"() TO "service_role";



GRANT ALL ON FUNCTION "public"."my_teacher_eleve_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."my_teacher_eleve_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."my_teacher_eleve_ids"() TO "service_role";



GRANT ALL ON FUNCTION "public"."nom_paie_normalise"("p_nom" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."nom_paie_normalise"("p_nom" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."nom_paie_normalise"("p_nom" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."postes_guard"() TO "anon";
GRANT ALL ON FUNCTION "public"."postes_guard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postes_guard"() TO "service_role";



GRANT ALL ON FUNCTION "public"."powersync_perms_compute"() TO "anon";
GRANT ALL ON FUNCTION "public"."powersync_perms_compute"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."powersync_perms_compute"() TO "service_role";



GRANT ALL ON FUNCTION "public"."powersync_perms_propagate"() TO "anon";
GRANT ALL ON FUNCTION "public"."powersync_perms_propagate"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."powersync_perms_propagate"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."push_subs_identite"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."push_subs_identite"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."push_subs_un_navigateur"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."push_subs_un_navigateur"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."section_module"("p_section" "public"."section_scolaire") TO "anon";
GRANT ALL ON FUNCTION "public"."section_module"("p_section" "public"."section_scolaire") TO "authenticated";
GRANT ALL ON FUNCTION "public"."section_module"("p_section" "public"."section_scolaire") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."teacher_can_write_note"("p_eleve" "uuid", "p_matiere" "text", "p_section" "public"."section_scolaire") TO "anon";
GRANT ALL ON FUNCTION "public"."teacher_can_write_note"("p_eleve" "uuid", "p_matiere" "text", "p_section" "public"."section_scolaire") TO "authenticated";
GRANT ALL ON FUNCTION "public"."teacher_can_write_note"("p_eleve" "uuid", "p_matiere" "text", "p_section" "public"."section_scolaire") TO "service_role";



REVOKE ALL ON FUNCTION "public"."transfert_accepter"("p_token" "uuid", "p_classe" "text", "p_matricule" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."transfert_accepter"("p_token" "uuid", "p_classe" "text", "p_matricule" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."transfert_accepter"("p_token" "uuid", "p_classe" "text", "p_matricule" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."transfert_verifier"("p_token" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."transfert_verifier"("p_token" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."transfert_verifier"("p_token" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."verifier_code_reinitialisation"("p_compte_id" "uuid", "p_empreinte" "text", "p_essais_max" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."verifier_code_reinitialisation"("p_compte_id" "uuid", "p_empreinte" "text", "p_essais_max" integer) TO "service_role";


















GRANT ALL ON TABLE "public"."absences" TO "anon";
GRANT ALL ON TABLE "public"."absences" TO "authenticated";
GRANT ALL ON TABLE "public"."absences" TO "service_role";
GRANT SELECT ON TABLE "public"."absences" TO "powersync_role";



GRANT ALL ON TABLE "public"."annonces" TO "anon";
GRANT ALL ON TABLE "public"."annonces" TO "authenticated";
GRANT ALL ON TABLE "public"."annonces" TO "service_role";
GRANT SELECT ON TABLE "public"."annonces" TO "powersync_role";



GRANT ALL ON TABLE "public"."appreciations" TO "anon";
GRANT ALL ON TABLE "public"."appreciations" TO "authenticated";
GRANT ALL ON TABLE "public"."appreciations" TO "service_role";
GRANT SELECT ON TABLE "public"."appreciations" TO "powersync_role";



GRANT ALL ON TABLE "public"."audit" TO "anon";
GRANT ALL ON TABLE "public"."audit" TO "authenticated";
GRANT ALL ON TABLE "public"."audit" TO "service_role";
GRANT SELECT ON TABLE "public"."audit" TO "powersync_role";



GRANT ALL ON TABLE "public"."bons" TO "anon";
GRANT ALL ON TABLE "public"."bons" TO "authenticated";
GRANT ALL ON TABLE "public"."bons" TO "service_role";
GRANT SELECT ON TABLE "public"."bons" TO "powersync_role";



GRANT ALL ON TABLE "public"."classes" TO "anon";
GRANT ALL ON TABLE "public"."classes" TO "authenticated";
GRANT ALL ON TABLE "public"."classes" TO "service_role";
GRANT SELECT ON TABLE "public"."classes" TO "powersync_role";



GRANT ALL ON TABLE "public"."codes_reinitialisation" TO "anon";
GRANT ALL ON TABLE "public"."codes_reinitialisation" TO "authenticated";
GRANT ALL ON TABLE "public"."codes_reinitialisation" TO "service_role";
GRANT SELECT ON TABLE "public"."codes_reinitialisation" TO "powersync_role";



GRANT ALL ON TABLE "public"."comptes" TO "anon";
GRANT ALL ON TABLE "public"."comptes" TO "authenticated";
GRANT ALL ON TABLE "public"."comptes" TO "service_role";
GRANT SELECT ON TABLE "public"."comptes" TO "powersync_role";



GRANT ALL ON TABLE "public"."demandes_plan" TO "anon";
GRANT ALL ON TABLE "public"."demandes_plan" TO "authenticated";
GRANT ALL ON TABLE "public"."demandes_plan" TO "service_role";
GRANT SELECT ON TABLE "public"."demandes_plan" TO "powersync_role";



GRANT ALL ON TABLE "public"."depenses" TO "anon";
GRANT ALL ON TABLE "public"."depenses" TO "authenticated";
GRANT ALL ON TABLE "public"."depenses" TO "service_role";
GRANT SELECT ON TABLE "public"."depenses" TO "powersync_role";



GRANT ALL ON TABLE "public"."documents" TO "anon";
GRANT ALL ON TABLE "public"."documents" TO "authenticated";
GRANT ALL ON TABLE "public"."documents" TO "service_role";
GRANT SELECT ON TABLE "public"."documents" TO "powersync_role";



GRANT ALL ON TABLE "public"."ecoles" TO "anon";
GRANT ALL ON TABLE "public"."ecoles" TO "authenticated";
GRANT ALL ON TABLE "public"."ecoles" TO "service_role";
GRANT SELECT ON TABLE "public"."ecoles" TO "powersync_role";



GRANT ALL ON TABLE "public"."ecoles_public" TO "anon";
GRANT ALL ON TABLE "public"."ecoles_public" TO "authenticated";
GRANT ALL ON TABLE "public"."ecoles_public" TO "service_role";
GRANT SELECT ON TABLE "public"."ecoles_public" TO "powersync_role";



GRANT ALL ON TABLE "public"."eleves" TO "anon";
GRANT ALL ON TABLE "public"."eleves" TO "authenticated";
GRANT ALL ON TABLE "public"."eleves" TO "service_role";
GRANT SELECT ON TABLE "public"."eleves" TO "powersync_role";



GRANT ALL ON TABLE "public"."emplois" TO "anon";
GRANT ALL ON TABLE "public"."emplois" TO "authenticated";
GRANT ALL ON TABLE "public"."emplois" TO "service_role";
GRANT SELECT ON TABLE "public"."emplois" TO "powersync_role";



GRANT ALL ON TABLE "public"."enseignant_classes" TO "anon";
GRANT ALL ON TABLE "public"."enseignant_classes" TO "authenticated";
GRANT ALL ON TABLE "public"."enseignant_classes" TO "service_role";
GRANT SELECT ON TABLE "public"."enseignant_classes" TO "powersync_role";



GRANT ALL ON TABLE "public"."enseignants" TO "anon";
GRANT ALL ON TABLE "public"."enseignants" TO "authenticated";
GRANT ALL ON TABLE "public"."enseignants" TO "service_role";
GRANT SELECT ON TABLE "public"."enseignants" TO "powersync_role";



GRANT ALL ON TABLE "public"."enseignements" TO "anon";
GRANT ALL ON TABLE "public"."enseignements" TO "authenticated";
GRANT ALL ON TABLE "public"."enseignements" TO "service_role";
GRANT SELECT ON TABLE "public"."enseignements" TO "powersync_role";



GRANT ALL ON TABLE "public"."evenements" TO "anon";
GRANT ALL ON TABLE "public"."evenements" TO "authenticated";
GRANT ALL ON TABLE "public"."evenements" TO "service_role";
GRANT SELECT ON TABLE "public"."evenements" TO "powersync_role";



GRANT ALL ON TABLE "public"."examens" TO "anon";
GRANT ALL ON TABLE "public"."examens" TO "authenticated";
GRANT ALL ON TABLE "public"."examens" TO "service_role";
GRANT SELECT ON TABLE "public"."examens" TO "powersync_role";



GRANT ALL ON TABLE "public"."historique" TO "anon";
GRANT ALL ON TABLE "public"."historique" TO "authenticated";
GRANT ALL ON TABLE "public"."historique" TO "service_role";
GRANT SELECT ON TABLE "public"."historique" TO "powersync_role";



GRANT ALL ON TABLE "public"."honneurs" TO "anon";
GRANT ALL ON TABLE "public"."honneurs" TO "authenticated";
GRANT ALL ON TABLE "public"."honneurs" TO "service_role";
GRANT SELECT ON TABLE "public"."honneurs" TO "powersync_role";



GRANT ALL ON TABLE "public"."livrets" TO "anon";
GRANT ALL ON TABLE "public"."livrets" TO "authenticated";
GRANT ALL ON TABLE "public"."livrets" TO "service_role";
GRANT SELECT ON TABLE "public"."livrets" TO "powersync_role";



GRANT ALL ON TABLE "public"."matieres" TO "anon";
GRANT ALL ON TABLE "public"."matieres" TO "authenticated";
GRANT ALL ON TABLE "public"."matieres" TO "service_role";
GRANT SELECT ON TABLE "public"."matieres" TO "powersync_role";



GRANT ALL ON TABLE "public"."membres" TO "anon";
GRANT ALL ON TABLE "public"."membres" TO "authenticated";
GRANT ALL ON TABLE "public"."membres" TO "service_role";
GRANT SELECT ON TABLE "public"."membres" TO "powersync_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";
GRANT SELECT ON TABLE "public"."messages" TO "powersync_role";



GRANT ALL ON TABLE "public"."messages_internes" TO "anon";
GRANT ALL ON TABLE "public"."messages_internes" TO "authenticated";
GRANT ALL ON TABLE "public"."messages_internes" TO "service_role";
GRANT SELECT ON TABLE "public"."messages_internes" TO "powersync_role";



GRANT ALL ON TABLE "public"."messages_internes_lus" TO "anon";
GRANT ALL ON TABLE "public"."messages_internes_lus" TO "authenticated";
GRANT ALL ON TABLE "public"."messages_internes_lus" TO "service_role";
GRANT SELECT ON TABLE "public"."messages_internes_lus" TO "powersync_role";



GRANT ALL ON TABLE "public"."msg_annonces" TO "anon";
GRANT ALL ON TABLE "public"."msg_annonces" TO "authenticated";
GRANT ALL ON TABLE "public"."msg_annonces" TO "service_role";
GRANT SELECT ON TABLE "public"."msg_annonces" TO "powersync_role";



GRANT ALL ON TABLE "public"."msg_annonces_lus" TO "anon";
GRANT ALL ON TABLE "public"."msg_annonces_lus" TO "authenticated";
GRANT ALL ON TABLE "public"."msg_annonces_lus" TO "service_role";
GRANT SELECT ON TABLE "public"."msg_annonces_lus" TO "powersync_role";



GRANT ALL ON TABLE "public"."msg_appels" TO "anon";
GRANT ALL ON TABLE "public"."msg_appels" TO "authenticated";
GRANT ALL ON TABLE "public"."msg_appels" TO "service_role";
GRANT SELECT ON TABLE "public"."msg_appels" TO "powersync_role";



GRANT ALL ON TABLE "public"."msg_conversations" TO "anon";
GRANT ALL ON TABLE "public"."msg_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."msg_conversations" TO "service_role";
GRANT SELECT ON TABLE "public"."msg_conversations" TO "powersync_role";



GRANT ALL ON TABLE "public"."msg_membres" TO "anon";
GRANT ALL ON TABLE "public"."msg_membres" TO "authenticated";
GRANT ALL ON TABLE "public"."msg_membres" TO "service_role";
GRANT SELECT ON TABLE "public"."msg_membres" TO "powersync_role";



GRANT ALL ON TABLE "public"."msg_messages" TO "anon";
GRANT ALL ON TABLE "public"."msg_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."msg_messages" TO "service_role";
GRANT SELECT ON TABLE "public"."msg_messages" TO "powersync_role";



GRANT ALL ON TABLE "public"."msg_presences" TO "anon";
GRANT ALL ON TABLE "public"."msg_presences" TO "authenticated";
GRANT ALL ON TABLE "public"."msg_presences" TO "service_role";
GRANT SELECT ON TABLE "public"."msg_presences" TO "powersync_role";



GRANT ALL ON TABLE "public"."msg_reunion_participants" TO "anon";
GRANT ALL ON TABLE "public"."msg_reunion_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."msg_reunion_participants" TO "service_role";
GRANT SELECT ON TABLE "public"."msg_reunion_participants" TO "powersync_role";



GRANT ALL ON TABLE "public"."msg_reunions" TO "anon";
GRANT ALL ON TABLE "public"."msg_reunions" TO "authenticated";
GRANT ALL ON TABLE "public"."msg_reunions" TO "service_role";
GRANT SELECT ON TABLE "public"."msg_reunions" TO "powersync_role";



GRANT ALL ON TABLE "public"."notes" TO "anon";
GRANT ALL ON TABLE "public"."notes" TO "authenticated";
GRANT ALL ON TABLE "public"."notes" TO "service_role";
GRANT SELECT ON TABLE "public"."notes" TO "powersync_role";



GRANT ALL ON TABLE "public"."notifications_envois" TO "anon";
GRANT ALL ON TABLE "public"."notifications_envois" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications_envois" TO "service_role";
GRANT SELECT ON TABLE "public"."notifications_envois" TO "powersync_role";



GRANT ALL ON TABLE "public"."paiements" TO "anon";
GRANT ALL ON TABLE "public"."paiements" TO "authenticated";
GRANT ALL ON TABLE "public"."paiements" TO "service_role";
GRANT SELECT ON TABLE "public"."paiements" TO "powersync_role";



GRANT ALL ON TABLE "public"."parent_eleves" TO "anon";
GRANT ALL ON TABLE "public"."parent_eleves" TO "authenticated";
GRANT ALL ON TABLE "public"."parent_eleves" TO "service_role";
GRANT SELECT ON TABLE "public"."parent_eleves" TO "powersync_role";



GRANT ALL ON TABLE "public"."personnel" TO "anon";
GRANT ALL ON TABLE "public"."personnel" TO "authenticated";
GRANT ALL ON TABLE "public"."personnel" TO "service_role";
GRANT SELECT ON TABLE "public"."personnel" TO "powersync_role";



GRANT ALL ON TABLE "public"."postes" TO "anon";
GRANT ALL ON TABLE "public"."postes" TO "authenticated";
GRANT ALL ON TABLE "public"."postes" TO "service_role";
GRANT SELECT ON TABLE "public"."postes" TO "powersync_role";



GRANT ALL ON TABLE "public"."push_subs" TO "anon";
GRANT ALL ON TABLE "public"."push_subs" TO "authenticated";
GRANT ALL ON TABLE "public"."push_subs" TO "service_role";
GRANT SELECT ON TABLE "public"."push_subs" TO "powersync_role";



GRANT ALL ON TABLE "public"."recettes" TO "anon";
GRANT ALL ON TABLE "public"."recettes" TO "authenticated";
GRANT ALL ON TABLE "public"."recettes" TO "service_role";
GRANT SELECT ON TABLE "public"."recettes" TO "powersync_role";



GRANT ALL ON TABLE "public"."salaires" TO "anon";
GRANT ALL ON TABLE "public"."salaires" TO "authenticated";
GRANT ALL ON TABLE "public"."salaires" TO "service_role";
GRANT SELECT ON TABLE "public"."salaires" TO "powersync_role";



GRANT ALL ON TABLE "public"."superadmin_message_lectures" TO "anon";
GRANT ALL ON TABLE "public"."superadmin_message_lectures" TO "authenticated";
GRANT ALL ON TABLE "public"."superadmin_message_lectures" TO "service_role";
GRANT SELECT ON TABLE "public"."superadmin_message_lectures" TO "powersync_role";



GRANT ALL ON TABLE "public"."superadmin_messages" TO "anon";
GRANT ALL ON TABLE "public"."superadmin_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."superadmin_messages" TO "service_role";
GRANT SELECT ON TABLE "public"."superadmin_messages" TO "powersync_role";



GRANT ALL ON TABLE "public"."tarifs" TO "anon";
GRANT ALL ON TABLE "public"."tarifs" TO "authenticated";
GRANT ALL ON TABLE "public"."tarifs" TO "service_role";
GRANT SELECT ON TABLE "public"."tarifs" TO "powersync_role";



GRANT ALL ON TABLE "public"."transferts" TO "anon";
GRANT ALL ON TABLE "public"."transferts" TO "authenticated";
GRANT ALL ON TABLE "public"."transferts" TO "service_role";
GRANT SELECT ON TABLE "public"."transferts" TO "powersync_role";



GRANT ALL ON TABLE "public"."versements" TO "anon";
GRANT ALL ON TABLE "public"."versements" TO "authenticated";
GRANT ALL ON TABLE "public"."versements" TO "service_role";
GRANT SELECT ON TABLE "public"."versements" TO "powersync_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT ON TABLES TO "powersync_role";





































-- ── 3. Storage : buckets + policies (hors du dump du schéma public) ─────────
-- Valeurs relevées en production le 2026-10-08 (identiques à storage.sql,
-- messagerie-v2.sql §8 et messagerie-v3.sql §3 de supabase/historique/).
-- Le dump a remis search_path à '' : on le rétablit pour les helpers publics.
set search_path = public, extensions;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('photos', 'photos', true, 5242880,
   array['image/jpeg','image/png','image/webp','image/gif','application/pdf']),
  ('messagerie', 'messagerie', false, 10485760, array[
   'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/wav',
   'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
   'application/pdf',
   'application/msword',
   'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
   'application/vnd.ms-excel',
   'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
   'application/vnd.ms-powerpoint',
   'application/vnd.openxmlformats-officedocument.presentationml.presentation',
   'application/vnd.oasis.opendocument.text',
   'application/vnd.oasis.opendocument.spreadsheet',
   'text/plain', 'text/csv'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Photos : bucket public en lecture ; écriture par le personnel, dans le
-- dossier <code_ecole>/ de SON école.
drop policy if exists photos_lecture on storage.objects;
create policy photos_lecture on storage.objects for select to public
  using (bucket_id = 'photos');

drop policy if exists photos_insert on storage.objects;
create policy photos_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'photos'
    and is_staff()
    and (storage.foldername(name))[1]
        = (select e.code from ecoles e where e.id = auth_ecole_id())
  );

drop policy if exists photos_update on storage.objects;
create policy photos_update on storage.objects for update to authenticated
  using (
    bucket_id = 'photos'
    and is_staff()
    and (storage.foldername(name))[1]
        = (select e.code from ecoles e where e.id = auth_ecole_id())
  );

drop policy if exists photos_delete on storage.objects;
create policy photos_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'photos'
    and is_staff()
    and (storage.foldername(name))[1]
        = (select e.code from ecoles e where e.id = auth_ecole_id())
  );

-- Messagerie (privé) : <ecole_id>/<conversation_id>/<fichier>, membres de
-- la discussion seulement ; effacement par l'auteur du dépôt.
drop policy if exists msg_vocaux_lecture on storage.objects;
create policy msg_vocaux_lecture on storage.objects for select to authenticated
  using (bucket_id = 'messagerie'
         and (storage.foldername(name))[1] = auth_ecole_id()::text
         and (storage.foldername(name))[2] in (select x::text from msg_mes_conversations() x));

drop policy if exists msg_vocaux_insert on storage.objects;
create policy msg_vocaux_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'messagerie'
              and (storage.foldername(name))[1] = auth_ecole_id()::text
              and (storage.foldername(name))[2] in (select x::text from msg_mes_conversations() x));

drop policy if exists msg_vocaux_delete on storage.objects;
create policy msg_vocaux_delete on storage.objects for delete to authenticated
  using (bucket_id = 'messagerie' and owner_id = auth.uid()::text);

-- Pièces jointes des annonces : <ecole_id>/annonces/<annonce_id>/<fichier>.
drop policy if exists msg_annonces_pj_lecture on storage.objects;
create policy msg_annonces_pj_lecture on storage.objects for select to authenticated
  using (bucket_id = 'messagerie'
         and (storage.foldername(name))[1] = auth_ecole_id()::text
         and (storage.foldername(name))[2] = 'annonces'
         and msg_annonce_objet_lisible((storage.foldername(name))[3]));

drop policy if exists msg_annonces_pj_insert on storage.objects;
create policy msg_annonces_pj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'messagerie'
              and (storage.foldername(name))[1] = auth_ecole_id()::text
              and (storage.foldername(name))[2] = 'annonces'
              and msg_annonce_objet_auteur((storage.foldername(name))[3]));

-- Retrait par l'auteur OU la direction (qui peut supprimer l'annonce).
drop policy if exists msg_annonces_pj_delete on storage.objects;
create policy msg_annonces_pj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'messagerie'
         and (storage.foldername(name))[2] = 'annonces'
         and msg_annonce_objet_gerable((storage.foldername(name))[3]));
