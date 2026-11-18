-- 20261118160243_enseignant_plusieurs_etablissements.sql
-- Pourquoi : un enseignant indépendant enseigne souvent dans plusieurs
-- établissements (décision du 2026-11-18, étape 2). Chacun a son espace
-- (ecoles.type_espace = 'enseignant'), et ses espaces sont RELIÉS par
-- comptes.personne_id. Il voit toutes ses classes d'un seul coup d'œil
-- (« Toutes mes classes ») et passe d'un établissement à l'autre sans
-- mot de passe (Edge account-manage, changer_espace).
--
-- Le lien entre espaces de deux établissements n'est posé que par l'Edge
-- account-manage (action ajouter_etablissement, service_role) :
-- comptes_personne_guard refuse toujours qu'un compte l'écrive lui-même.
-- Entre deux ÉCOLES, rien ne change : les espaces d'une personne restent
-- ceux de sa propre école.
--
-- Règles (docs/migrations-sql.md) :
--  - appliquée UNE fois, dans l'ordre, par la CI au déploiement — jamais à
--    la main dans l'éditeur SQL ;
--  - compatible avec le front encore en ligne (ajouter avant de retirer) :
--    mes_espaces() garde ses colonnes et en ajoute trois.
--  - ne jamais modifier une migration déjà fusionnée : en écrire une autre.

-- Espaces de la personne CONNECTÉE (son compte compris), pour le choix
-- d'espace. Ceux de son école, et — pour un espace enseignant — ses autres
-- espaces enseignants (ses autres établissements), avec leur code et leur
-- nom : le choix affiche l'établissement, et la session s'ouvre sur son code.
-- Le type de retour change : la fonction est recréée.
drop function if exists public.mes_espaces();

create function public.mes_espaces()
returns table (
  id uuid, role public.role_compte, label text, nom text, login text, actuel boolean,
  ecole_code text, ecole_nom text, type_espace text
)
    language sql stable security definer
    set search_path to 'public'
    as $$
  with moi as (
    select c.id, c.ecole_id, c.personne_id, e.type_espace from comptes c
    join ecoles e on e.id = c.ecole_id
    where c.user_id = auth.uid() and c.personne_id is not null
    limit 1
  )
  select c.id, c.role, coalesce(p.label, c.label, c.role::text), c.nom, c.login, c.id = moi.id,
         e.code, e.nom, e.type_espace
  from comptes c
  join moi on c.personne_id = moi.personne_id
  join ecoles e on e.id = c.ecole_id
  left join postes p on p.id = c.poste_id
  where c.user_id is not null
    and coalesce(p.actif, true)
    and (c.extra ->> 'fusionneDans') is null
    and (
      c.ecole_id = moi.ecole_id
      or (moi.type_espace = 'enseignant' and e.type_espace = 'enseignant'
          and e.actif is not false and e.supprime is not true)
    )
  order by c.id = moi.id desc, e.nom, c.role;
$$;

revoke all on function public.mes_espaces() from public, anon;
grant execute on function public.mes_espaces() to authenticated, service_role;

-- « Toutes mes classes » : les classes de TOUS les établissements de
-- l'enseignant connecté (le sien d'abord), avec leur effectif. Un
-- établissement encore sans classe figure avec une ligne sans classe.
-- Rien pour un compte d'école : la vue n'existe que dans un espace
-- enseignant. Effectif = élèves actifs de la classe.
create or replace function public.mes_classes()
returns table (
  compte_id uuid, ecole_code text, ecole_nom text, actuel boolean,
  classe_id uuid, section public.section_scolaire, classe text, effectif integer
)
    language sql stable security definer
    set search_path to 'public'
    as $$
  with moi as (
    select c.id, c.personne_id from comptes c
    join ecoles e on e.id = c.ecole_id
    where c.user_id = auth.uid() and e.type_espace = 'enseignant'
    limit 1
  ),
  espaces as (
    select c.id as compte_id, c.ecole_id, c.id = moi.id as actuel
    from comptes c
    join moi on c.id = moi.id or (moi.personne_id is not null and c.personne_id = moi.personne_id)
    join ecoles e on e.id = c.ecole_id
    where e.type_espace = 'enseignant' and e.actif is not false and e.supprime is not true
      and c.user_id is not null and (c.extra ->> 'fusionneDans') is null
  )
  select s.compte_id, e.code, e.nom, s.actuel, cl.id, cl.section, cl.nom,
         (select count(*)::int from eleves el
           where el.ecole_id = cl.ecole_id and el.section = cl.section and el.classe = cl.nom
             and coalesce(el.statut, 'Actif') = 'Actif')
  from espaces s
  join ecoles e on e.id = s.ecole_id
  left join classes cl on cl.ecole_id = s.ecole_id
  order by s.actuel desc, e.nom, cl.section, cl.nom;
$$;

revoke all on function public.mes_classes() from public, anon;
grant execute on function public.mes_classes() to authenticated, service_role;
