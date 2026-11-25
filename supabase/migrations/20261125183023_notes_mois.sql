-- 20261125183023_notes_mois.sql
-- Pourquoi : au secondaire, la note de cours d'une période se calcule mois
-- par mois — (moyenne des oraux du mois + moyenne des écrits du mois) ÷ 2,
-- puis moyenne des mois de la période. Chaque oral et chaque écrit porte donc
-- le MOIS où il a eu lieu (« Oct », « Nov »… comme calcMoisAnnee). La
-- composition, la moyenne saisie directement et les notes du primaire et de
-- la maternelle n'en ont pas : la colonne reste vide.
--
-- Une note déjà saisie, sans mois, est rangée au calcul d'après sa date de
-- saisie (created_at) — rien n'est réécrit ici. La base n'impose pas le
-- mois : une application pas encore mise à jour (ou une saisie hors ligne en
-- file) continue d'enregistrer sans lui, et la note est alors rangée d'après
-- sa date.
--
-- Règles (docs/migrations-sql.md) :
--  - appliquée UNE fois, dans l'ordre, par la CI au déploiement — jamais à
--    la main dans l'éditeur SQL ;
--  - compatible avec le front encore en ligne (ajouter avant de retirer) ;
--  - ne jamais modifier une migration déjà fusionnée : en écrire une autre.

alter table public.notes add column if not exists mois text;

comment on column public.notes.mois is
  'Mois de l''évaluation (« Oct », « Nov »…) : oraux et écrits du secondaire. Vide pour la composition, la moyenne saisie, le primaire et la maternelle.';

-- Rattachement d'un enseignant à une école : ses notes copiées gardent leur
-- mois ET leur date de saisie (created_at), d'où se déduit le mois des notes
-- qui n'en ont pas — copiées avec la date du jour, des notes d'octobre et de
-- novembre tomberaient toutes dans le mois du rattachement. Deux notes de
-- même type et même période, de mois différents, sont deux évaluations : la
-- seconde n'est plus prise pour un doublon de la première. Le reste de la
-- fonction est celui de 20261118180200_rattachement_espace_enseignant.sql.
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
        and (x.mois is null or n.mois is null or x.mois = n.mois)
    );
  insert into notes (ecole_id, section, eleve_id, matiere, type, periode, mois, note, annee, enseignant_id, enseignant_nom, created_at)
  select v_ecole.id, ee.section, ee.id, mm.cible, n.type, n.periode, n.mois, n.note, n.annee, v_ens, v_ens_nom,
         coalesce(n.created_at, now())
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
        and (x.mois is null or n.mois is null or x.mois = n.mois)
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
