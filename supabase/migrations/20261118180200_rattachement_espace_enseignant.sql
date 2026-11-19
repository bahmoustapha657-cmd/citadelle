-- 20261118180200_rattachement_espace_enseignant.sql
-- Pourquoi : quand l'école d'un enseignant indépendant adopte EduGest, ses
-- classes, ses élèves et ses notes appartiennent à l'école (décision du
-- 2026-11-18, étape 3). L'ENSEIGNANT propose le rattachement depuis son
-- espace (code de l'école) ; la DIRECTION de l'école relie ses élèves aux
-- siens et accepte. Ses notes, absences et appréciations passent alors chez
-- l'école, son compte enseignant y est créé (ou relié), et son espace pour
-- cet établissement est FERMÉ.
--
-- Connexion de l'enseignant : son numéro et son mot de passe restent ceux de
-- son espace, même fermé — l'école ne peut ni les réinitialiser ni les
-- supprimer. Il passe de ses espaces au compte de l'école, jamais l'inverse :
-- un compte d'école est entre les mains de la direction (mot de passe,
-- e-mail), il ne doit pas ouvrir les espaces personnels de l'enseignant.
--
-- Règles (docs/migrations-sql.md) :
--  - appliquée UNE fois, dans l'ordre, par la CI au déploiement — jamais à
--    la main dans l'éditeur SQL ;
--  - compatible avec le front encore en ligne (ajouter avant de retirer) :
--    etat_ecole() et mes_classes() gardent leurs colonnes et en ajoutent ;
--  - ne jamais modifier une migration déjà fusionnée : en écrire une autre.

-- ── Demandes de rattachement ───────────────────────────────────────────
-- Écrites et lues par l'Edge account-manage (service_role) et par les
-- fonctions ci-dessous seulement : aucun accès direct pour les comptes.
create table if not exists public.rattachements (
  id uuid primary key default gen_random_uuid(),
  espace_id uuid not null references public.ecoles(id) on delete cascade,
  ecole_id uuid not null references public.ecoles(id) on delete cascade,
  demandeur_id uuid references public.comptes(id) on delete set null,
  statut text not null default 'en_attente'
    check (statut in ('en_attente', 'acceptee', 'refusee', 'annulee')),
  created_at timestamptz not null default now(),
  traitee_le timestamptz,
  traitee_par jsonb,
  bilan jsonb not null default '{}'::jsonb
);

comment on table public.rattachements is
  'Rattachement d''un espace enseignant (ecoles.type_espace = enseignant) à l''école qui adopte EduGest. Une seule demande en attente par espace.';

create unique index if not exists rattachements_une_en_attente
  on public.rattachements (espace_id) where statut = 'en_attente';
create index if not exists rattachements_ecole_statut
  on public.rattachements (ecole_id, statut);

alter table public.rattachements enable row level security;
revoke all on table public.rattachements from public, anon, authenticated;
grant all on table public.rattachements to service_role;

-- ── État public d'un code (écran de connexion) ─────────────────────────
-- Deux colonnes de plus : le type d'espace, et `rattache` — espace
-- enseignant fermé parce que ses classes ont rejoint une école. La
-- connexion par son numéro l'emmène alors dans ses espaces ouverts au lieu
-- de dire « établissement désactivé ». L'école de destination n'est PAS
-- exposée ici (fonction publique).
drop function if exists public.etat_ecole(text);

create function public.etat_ecole(p_code text)
returns table (
  id uuid, code text, nom text, logo text, couleur1 text, couleur2 text,
  actif boolean, supprime boolean, type_espace text, rattache boolean
)
    language sql stable security definer
    set search_path to 'public'
    as $$
  select id, code, nom, logo, couleur1, couleur2, actif, supprime, type_espace,
         (type_espace = 'enseignant' and actif is false and coalesce(extra ? 'rattachement', false))
  from ecoles where code = lower(p_code);
$$;

grant execute on function public.etat_ecole(text) to anon, authenticated, service_role;

-- ── Espaces de la personne connectée ───────────────────────────────────
-- Depuis un espace enseignant (même fermé : c'est son accès de connexion),
-- ses autres espaces enseignants ouverts ET ses comptes enseignants dans les
-- écoles où ses classes ont été rattachées. Depuis un compte d'école : ceux
-- de son école seulement (sens unique, voir l'en-tête).
create or replace function public.mes_espaces()
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
      or (moi.type_espace = 'enseignant'
          and e.actif is not false and e.supprime is not true
          and (e.type_espace = 'enseignant' or c.role = 'enseignant'))
    )
  order by c.id = moi.id desc, e.nom, c.role;
$$;

-- ── « Toutes mes classes » : état du rattachement de chaque espace ─────
-- Deux colonnes de plus : la dernière demande de l'espace, si elle attend
-- la direction ou a été refusée, et le nom de l'école visée.
drop function if exists public.mes_classes();

create function public.mes_classes()
returns table (
  compte_id uuid, ecole_code text, ecole_nom text, actuel boolean,
  classe_id uuid, section public.section_scolaire, classe text, effectif integer,
  rattachement_statut text, rattachement_ecole text
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
             and coalesce(el.statut, 'Actif') = 'Actif'),
         case when ra.statut in ('en_attente', 'refusee') then ra.statut end,
         case when ra.statut in ('en_attente', 'refusee') then ra.ecole_nom end
  from espaces s
  join ecoles e on e.id = s.ecole_id
  left join classes cl on cl.ecole_id = s.ecole_id
  left join lateral (
    select r.statut, ec.nom as ecole_nom from rattachements r
    join ecoles ec on ec.id = r.ecole_id
    where r.espace_id = s.ecole_id
    order by r.created_at desc limit 1
  ) ra on true
  order by s.actuel desc, e.nom, cl.section, cl.nom;
$$;

revoke all on function public.mes_classes() from public, anon;
grant execute on function public.mes_classes() to authenticated, service_role;

-- ── Direction : demandes reçues par son école ──────────────────────────
create or replace function public.rattachements_recus()
returns table (
  id uuid, created_at timestamptz, enseignant text, telephone text, etablissement text,
  nb_classes integer, nb_eleves integer
)
    language sql stable security definer
    set search_path to 'public'
    as $$
  with moi as (
    select c.ecole_id from comptes c
    join ecoles e on e.id = c.ecole_id
    where c.user_id = auth.uid() and c.role = 'direction' and e.type_espace = 'ecole'
      and e.actif is not false and e.supprime is not true
    limit 1
  )
  select r.id, r.created_at,
         coalesce(nullif(d.nom, ''), es.extra ->> 'responsable', ''),
         coalesce(nullif(d.telephone, ''), es.extra ->> 'telephone', ''),
         es.nom,
         (select count(distinct (el.section, el.classe))::int from eleves el
           where el.ecole_id = r.espace_id and el.classe is not null
             and coalesce(el.statut, 'Actif') = 'Actif'),
         (select count(*)::int from eleves el
           where el.ecole_id = r.espace_id and coalesce(el.statut, 'Actif') = 'Actif')
  from rattachements r
  join moi on moi.ecole_id = r.ecole_id
  join ecoles es on es.id = r.espace_id
  left join comptes d on d.id = r.demandeur_id
  where r.statut = 'en_attente'
  order by r.created_at;
$$;

revoke all on function public.rattachements_recus() from public, anon;
grant execute on function public.rattachements_recus() to authenticated, service_role;

-- ── Direction : ce que l'enseignant apporte ────────────────────────────
-- Ses classes et leurs élèves (actifs) avec leur nombre de notes, les
-- matières de ses notes, ses périodes et les totaux. null si la demande
-- n'attend pas la direction de l'école connectée.
create or replace function public.rattachement_apercu(p_demande uuid)
returns jsonb
    language plpgsql stable security definer
    set search_path to 'public'
    as $$
declare
  v_espace uuid;
  v_ecole uuid;
begin
  select r.espace_id, r.ecole_id into v_espace, v_ecole
  from rattachements r where r.id = p_demande and r.statut = 'en_attente';
  if v_espace is null then return null; end if;
  if not exists (
    select 1 from comptes c
    where c.user_id = auth.uid() and c.role = 'direction' and c.ecole_id = v_ecole
  ) or auth_ecole_id() is distinct from v_ecole then
    return null;
  end if;

  return jsonb_build_object(
    'classes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'section', k.section, 'nom', k.classe,
        'eleves', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', el.id, 'nom', el.nom, 'prenom', el.prenom, 'sexe', el.sexe,
            'dateNaissance', el.date_naissance,
            'notes', (select count(*) from notes n where n.ecole_id = v_espace and n.eleve_id = el.id)
          ) order by el.nom, el.prenom)
          from eleves el
          where el.ecole_id = v_espace and el.section = k.section and el.classe = k.classe
            and coalesce(el.statut, 'Actif') = 'Actif'
        ), '[]'::jsonb)
      ) order by k.section, k.classe)
      from (
        select distinct el.section, el.classe from eleves el
        where el.ecole_id = v_espace and el.classe is not null
          and coalesce(el.statut, 'Actif') = 'Actif'
      ) k
    ), '[]'::jsonb),
    'matieres', coalesce((
      select jsonb_agg(jsonb_build_object('nom', m.matiere, 'notes', m.nb) order by m.matiere)
      from (
        select min(n.matiere) as matiere, count(*) as nb from notes n
        where n.ecole_id = v_espace group by lower(btrim(n.matiere))
      ) m
    ), '[]'::jsonb),
    'periodes', coalesce((
      select jsonb_agg(distinct n.periode) from notes n where n.ecole_id = v_espace
    ), '[]'::jsonb),
    'totaux', jsonb_build_object(
      'notes', (select count(*) from notes n where n.ecole_id = v_espace),
      'absences', (select count(*) from absences a where a.ecole_id = v_espace),
      'appreciations', (select count(*) from appreciations a where a.ecole_id = v_espace)
    )
  );
end $$;

revoke all on function public.rattachement_apercu(uuid) from public, anon;
grant execute on function public.rattachement_apercu(uuid) to authenticated, service_role;

-- ── Acceptation : tout en UNE transaction ──────────────────────────────
-- Appelée par l'Edge account-manage (accepter_rattachement) après ses
-- contrôles, avec le service_role. `p` :
--   eleves    : { "<élève de l'enseignant>": "<élève de l'école>" } — les
--               élèves absents de l'objet sont laissés de côté ;
--   matieres  : { "<matière de ses notes>": "<matière de l'école>" } ;
--   classes   : [{ section, classe }] de l'école, attribuées à son compte ;
--   compteId  : compte enseignant EXISTANT de l'école, ou bien
--   nouveau   : { userId, login, nom, prenom, section, matiere, email,
--               telephone } pour créer sa fiche et son compte ;
--   auteur    : qui accepte (journal).
-- Une note, une absence ou une appréciation déjà présente chez l'école pour
-- le même élève (même matière, type, période, année…) n'est pas doublée :
-- celle de l'école est gardée.
create or replace function public.rattachement_appliquer(p_demande uuid, p jsonb)
returns jsonb
    language plpgsql security definer
    set search_path to 'public'
    as $$
declare
  v_dem public.rattachements%rowtype;
  v_espace public.ecoles%rowtype;
  v_ecole public.ecoles%rowtype;
  v_demandeur public.comptes%rowtype;
  v_compte public.comptes%rowtype;
  v_ens uuid;
  v_ens_nom text;
  v_personne uuid;
  v_section public.section_scolaire;
  v_email text;
  v_notes_total int;
  v_notes int;
  v_notes_deja int;
  v_absences int;
  v_appreciations int;
  v_eleves_total int;
  v_eleves_relies int;
  v_bilan jsonb;
begin
  select * into v_dem from rattachements where id = p_demande for update;
  if not found then
    raise exception 'Demande introuvable.' using errcode = 'P0002';
  end if;
  if v_dem.statut <> 'en_attente' then
    raise exception 'Cette demande a déjà été traitée.' using errcode = 'P0001', hint = 'deja_traitee';
  end if;

  select * into v_espace from ecoles where id = v_dem.espace_id;
  if v_espace.type_espace is distinct from 'enseignant' or v_espace.actif is false or v_espace.supprime is true then
    raise exception 'L''espace de l''enseignant n''est plus ouvert.' using errcode = 'P0001', hint = 'espace_ferme';
  end if;
  select * into v_ecole from ecoles where id = v_dem.ecole_id;
  if v_ecole.type_espace is distinct from 'ecole' or v_ecole.actif is false or v_ecole.supprime is true then
    raise exception 'L''école n''est plus en service.' using errcode = 'P0001', hint = 'ecole_hors_service';
  end if;
  select * into v_demandeur from comptes where id = v_dem.demandeur_id;
  if not found then
    raise exception 'Le compte de l''enseignant n''existe plus.' using errcode = 'P0002';
  end if;

  -- Correspondances, contrôlées : chaque élève de l'enseignant est bien de
  -- son espace, chaque élève visé bien de l'école, et un élève de l'école
  -- ne reçoit qu'un élève de l'enseignant (sinon ses notes seraient doublées).
  create temp table _rat_eleves on commit drop as
    select (t.k)::uuid as source, (t.v #>> '{}')::uuid as cible
    from jsonb_each(coalesce(p -> 'eleves', '{}'::jsonb)) as t(k, v)
    where jsonb_typeof(t.v) = 'string' and btrim(t.v #>> '{}') <> '';
  if exists (
    select 1 from _rat_eleves m
    left join eleves e on e.id = m.source and e.ecole_id = v_espace.id
    where e.id is null
  ) then
    raise exception 'Un élève de l''enseignant est introuvable.' using errcode = 'P0001', hint = 'eleve_source';
  end if;
  if exists (
    select 1 from _rat_eleves m
    left join eleves e on e.id = m.cible and e.ecole_id = v_ecole.id
    where e.id is null
  ) then
    raise exception 'Un élève de l''école est introuvable.' using errcode = 'P0001', hint = 'eleve_cible';
  end if;
  if exists (select 1 from _rat_eleves group by cible having count(*) > 1) then
    raise exception 'Deux élèves de l''enseignant sont reliés au même élève de l''école.' using errcode = 'P0001', hint = 'eleve_double';
  end if;

  create temp table _rat_matieres on commit drop as
    select lower(btrim(t.k)) as source, btrim(t.v #>> '{}') as cible
    from jsonb_each(coalesce(p -> 'matieres', '{}'::jsonb)) as t(k, v)
    where jsonb_typeof(t.v) = 'string' and btrim(t.v #>> '{}') <> '';

  -- Son compte dans l'école : existant (choisi par la direction) ou créé.
  if nullif(p ->> 'compteId', '') is not null then
    select * into v_compte from comptes
    where id = (p ->> 'compteId')::uuid and ecole_id = v_ecole.id and role = 'enseignant';
    if not found then
      raise exception 'Ce compte enseignant n''est pas de votre école.' using errcode = 'P0001', hint = 'compte_existant';
    end if;
    v_ens := v_compte.enseignant_id;
    v_ens_nom := coalesce(nullif(v_compte.enseignant_nom, ''), v_compte.nom);
  else
    if p -> 'nouveau' is null or nullif(p #>> '{nouveau,userId}', '') is null then
      raise exception 'Compte de l''enseignant manquant.' using errcode = 'P0001', hint = 'compte_manquant';
    end if;
    v_section := (p #>> '{nouveau,section}')::public.section_scolaire;
    v_ens_nom := btrim(coalesce(p #>> '{nouveau,prenom}', '') || ' ' || coalesce(p #>> '{nouveau,nom}', ''));
    -- E-mail déjà pris par un autre compte de l'école : le compte est créé
    -- sans (l'e-mail sert à « mot de passe oublié », pas à se connecter ici).
    v_email := nullif(lower(btrim(coalesce(p #>> '{nouveau,email}', ''))), '');
    if v_email is not null and exists (
      select 1 from comptes where ecole_id = v_ecole.id and lower(email) = v_email
    ) then
      v_email := null;
    end if;
    insert into enseignants (ecole_id, section, nom, prenom, matiere, contact, statut, extra)
    values (
      v_ecole.id, v_section, nullif(btrim(p #>> '{nouveau,nom}'), ''), nullif(btrim(p #>> '{nouveau,prenom}'), ''),
      nullif(btrim(p #>> '{nouveau,matiere}'), ''), nullif(btrim(p #>> '{nouveau,telephone}'), ''), 'Actif',
      jsonb_strip_nulls(jsonb_build_object('email', v_email, 'telephone', nullif(btrim(p #>> '{nouveau,telephone}'), '')))
    )
    returning id into v_ens;
    insert into comptes (
      user_id, ecole_id, login, role, label, nom, enseignant_id, enseignant_nom,
      section, sections, matiere, statut, premiere_co, email, extra
    ) values (
      (p #>> '{nouveau,userId}')::uuid, v_ecole.id, btrim(p #>> '{nouveau,login}'), 'enseignant', 'Enseignant',
      v_ens_nom, v_ens, v_ens_nom, v_section, array[v_section], nullif(btrim(p #>> '{nouveau,matiere}'), ''),
      'Actif', false, v_email, '{}'::jsonb
    )
    returning * into v_compte;
  end if;

  -- Une seule personne : ses espaces, son compte de l'école (et les comptes
  -- déjà reliés à celui-ci dans l'école, s'il en avait).
  v_personne := coalesce(v_demandeur.personne_id, v_compte.personne_id, gen_random_uuid());
  update comptes set personne_id = v_personne
  where id in (v_demandeur.id, v_compte.id)
     or (v_compte.personne_id is not null and personne_id = v_compte.personne_id);

  -- Notes : élève et matière reliés, pas déjà présentes chez l'école.
  select count(*) into v_notes_total from notes where ecole_id = v_espace.id;
  select count(*) into v_notes_deja
  from notes n
  join _rat_eleves me on me.source = n.eleve_id
  join _rat_matieres mm on mm.source = lower(btrim(n.matiere))
  where n.ecole_id = v_espace.id
    and exists (
      select 1 from notes x
      where x.ecole_id = v_ecole.id and x.eleve_id = me.cible
        and lower(btrim(x.matiere)) = lower(mm.cible)
        and x.type = n.type and x.periode = n.periode and x.annee = n.annee
    );
  insert into notes (ecole_id, section, eleve_id, matiere, type, periode, note, annee, enseignant_id, enseignant_nom)
  select v_ecole.id, ee.section, ee.id, mm.cible, n.type, n.periode, n.note, n.annee, v_ens, v_ens_nom
  from notes n
  join _rat_eleves me on me.source = n.eleve_id
  join eleves ee on ee.id = me.cible
  join _rat_matieres mm on mm.source = lower(btrim(n.matiere))
  where n.ecole_id = v_espace.id
    and not exists (
      select 1 from notes x
      where x.ecole_id = v_ecole.id and x.eleve_id = ee.id
        and lower(btrim(x.matiere)) = lower(mm.cible)
        and x.type = n.type and x.periode = n.periode and x.annee = n.annee
    );
  get diagnostics v_notes = row_count;

  -- Absences et retards : même élève, même jour, même type, même cours.
  insert into absences (
    ecole_id, section, eleve_id, type, date, justifie, motif, matiere,
    signale_par_id, signale_par_nom, heure_debut, heure_fin
  )
  select v_ecole.id, ee.section, ee.id, a.type, a.date, a.justifie, a.motif,
         coalesce(mm.cible, a.matiere), v_ens, v_ens_nom, a.heure_debut, a.heure_fin
  from absences a
  join _rat_eleves me on me.source = a.eleve_id
  join eleves ee on ee.id = me.cible
  left join _rat_matieres mm on mm.source = lower(btrim(a.matiere))
  where a.ecole_id = v_espace.id
    and not exists (
      select 1 from absences x
      where x.ecole_id = v_ecole.id and x.eleve_id = ee.id and x.type = a.type
        and x.date is not distinct from a.date
        and coalesce(x.heure_debut, '') = coalesce(a.heure_debut, '')
        and lower(coalesce(x.matiere, '')) = lower(coalesce(mm.cible, a.matiere, ''))
    );
  get diagnostics v_absences = row_count;

  -- Appréciations : une par élève, période et année (celle de l'école gardée).
  insert into appreciations (ecole_id, section, eleve_id, periode, texte, annee)
  select v_ecole.id, ee.section, ee.id, ap.periode, ap.texte, ap.annee
  from appreciations ap
  join _rat_eleves me on me.source = ap.eleve_id
  join eleves ee on ee.id = me.cible
  where ap.ecole_id = v_espace.id
  on conflict (eleve_id, periode, annee) do nothing;
  get diagnostics v_appreciations = row_count;

  -- Ses classes dans l'école : il y saisit (RLS, enseignant_classes) et les
  -- voit dans son portail (extra.classesRattachees) dès sa première visite.
  insert into enseignant_classes (compte_id, ecole_id, section, classe, user_id)
  select v_compte.id, v_ecole.id, (x ->> 'section')::public.section_scolaire, btrim(x ->> 'classe'), v_compte.user_id
  from jsonb_array_elements(coalesce(p -> 'classes', '[]'::jsonb)) x
  where btrim(coalesce(x ->> 'classe', '')) <> ''
  on conflict (compte_id, section, classe) do nothing;

  update comptes c set extra = coalesce(c.extra, '{}'::jsonb) || jsonb_build_object(
    'classesRattachees', coalesce((
      select jsonb_agg(distinct s.v order by s.v) from (
        select jsonb_array_elements_text(
          case when jsonb_typeof(c.extra -> 'classesRattachees') = 'array' then c.extra -> 'classesRattachees' else '[]'::jsonb end
        ) as v
        union
        select btrim(x ->> 'classe') from jsonb_array_elements(coalesce(p -> 'classes', '[]'::jsonb)) x
      ) s where coalesce(s.v, '') <> ''
    ), '[]'::jsonb)
  )
  where c.id = v_compte.id;

  select count(*) into v_eleves_total from eleves
  where ecole_id = v_espace.id and coalesce(statut, 'Actif') = 'Actif';
  select count(*) into v_eleves_relies from _rat_eleves;

  -- L'espace est fermé : ses données sont désormais celles de l'école. Il
  -- reste en base (rien n'est effacé) et sert encore d'accès de connexion.
  update ecoles set actif = false,
    extra = coalesce(extra, '{}'::jsonb) || jsonb_build_object('rattachement', jsonb_build_object(
      'ecoleId', v_ecole.id, 'ecoleCode', v_ecole.code, 'ecoleNom', v_ecole.nom,
      'demandeId', v_dem.id, 'le', now()
    ))
  where id = v_espace.id;

  v_bilan := jsonb_build_object(
    'compteId', v_compte.id, 'login', v_compte.login, 'enseignantId', v_ens,
    'eleves', jsonb_build_object('relies', v_eleves_relies, 'total', v_eleves_total),
    'notes', jsonb_build_object('copiees', v_notes, 'dejaPresentes', v_notes_deja, 'total', v_notes_total),
    'absences', v_absences,
    'appreciations', v_appreciations
  );

  update rattachements set statut = 'acceptee', traitee_le = now(),
    traitee_par = p -> 'auteur', bilan = v_bilan
  where id = v_dem.id;

  return v_bilan;
end $$;

revoke all on function public.rattachement_appliquer(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.rattachement_appliquer(uuid, jsonb) to service_role;
