-- ════════════════════════════════════════════════════════════════════════
--  EduGest — Messagerie : enseignants d'une même branche + comptes PARENTS
-- ════════════════════════════════════════════════════════════════════════
-- À exécuter dans Supabase → SQL Editor APRÈS messagerie-v2.sql,
-- messagerie-v3.sql, presence.sql et messagerie-hierarchie.sql. Idempotent.
-- ⚠️ Rejouer un de ces fichiers APRÈS celui-ci en annule une partie (règle de
--    contact, annuaire, annonces, présence) : rejouer alors celui-ci.
--
-- Décisions de l'établissement (2026-10-07), en plus de la pyramide :
--   • ENSEIGNANTS d'une même branche (collège + lycée ; primaire + maternelle)
--     se contactent librement : discussion, appel, groupe.
--   • PARENTS : ils entrent dans la messagerie et échangent, dans les deux
--     sens, avec le sommet (Fondateur, Administrateur), le chef de section de
--     leurs enfants (Principal·e pour collège / lycée, Directeur pour primaire
--     / maternelle) et le Comptable. Jamais entre parents, ni avec les
--     enseignants, ni dans un groupe. Messages, vocaux, documents, appels
--     audio 1-à-1.
--   • ANNONCES AUX PARENTS : à tous les parents, à ceux d'une section ou
--     d'une classe — coupées, comme les autres, au périmètre de l'expéditeur.
--     « Toute l'équipe » (a_tous) reste interne : jamais aux parents.
--   • CONFIDENTIALITÉ : un parent ne voit jamais l'annuaire de l'école — seules
--     les personnes qu'il peut contacter, ou avec qui il a une discussion.

-- ── 1. Accès : les parents entrent (le superadmin reste dehors) ─────────────
create or replace function est_membre_messagerie() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce((
    select c.ecole_id is not null and c.role::text <> 'superadmin'
    from comptes c where c.user_id = auth.uid() limit 1), false);
$$;

create or replace function msg_compte_joignable(p_compte uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from comptes c
    left join postes p on p.id = c.poste_id
    where c.id = p_compte
      and c.ecole_id = auth_ecole_id()
      and c.role::text <> 'superadmin'
      and coalesce(c.statut, 'Actif') = 'Actif'
      and coalesce(p.actif, true));
$$;

-- Enfants ACTUELS d'un parent : élèves liés, hors sortis (transférés,
-- exclus, diplômés… — STATUTS_SORTIE de src/constants.js).
create or replace function msg_enfants(p_parent uuid)
returns table (eleve_id uuid, section text, classe text, nom text)
  language sql stable security definer set search_path = public as $$
  select e.id, e.section::text, coalesce(e.classe, ''),
         trim(coalesce(e.prenom, '') || ' ' || coalesce(e.nom, ''))
  from parent_eleves pe
  join eleves e on e.id = pe.eleve_id
  where pe.compte_id = p_parent
    and coalesce(e.statut, '') not in ('Transféré', 'Exclu', 'Abandonné', 'Décédé', 'Diplômé');
$$;

-- ── 2. La règle « qui peut contacter qui » ──────────────────────────────────
-- Branches d'une liste de sections : collège / lycée → secondaire, sinon
-- (primaire, maternelle) → primaire.
create or replace function msg_branches_de(p_sections text[]) returns text[]
  language sql immutable as $$
  select coalesce(array(
    select distinct case when s in ('college', 'lycee') then 'secondaire' else 'primaire' end
    from unnest(coalesce(p_sections, '{}')) s where s is not null), '{}');
$$;

-- Sans branche connue (enseignant sans section, parent sans enfant actuel) :
-- relève des deux.
create or replace function msg_branches_eff(p text[]) returns text[]
  language sql immutable as $$
  select case when coalesce(cardinality(p), 0) = 0 then array['secondaire', 'primaire'] else p end;
$$;

-- Profil hiérarchique : niveau (sommet | responsable | enseignant | parent),
-- branches (dirigées par un chef de section, enseignées, ou celles des
-- enfants d'un parent) et clé du poste. Le chef de section se lit à la CLÉ
-- du poste, jamais à ses droits (cf. messagerie-hierarchie.sql).
-- p_compte null : toute l'école.
create or replace function msg_profils_ecole(p_ecole uuid, p_compte uuid)
returns table (compte_id uuid, niveau text, branches text[], cle text)
  language sql stable security definer set search_path = public as $$
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

-- Ancienne signature (messagerie-hierarchie.sql), gardée pour compatibilité.
create or replace function msg_profils(p_ecole uuid)
returns table (compte_id uuid, niveau text, branches text[])
  language sql stable security definer set search_path = public as $$
  select compte_id, niveau, branches from msg_profils_ecole(p_ecole, null);
$$;

-- Branches qui ont un chef de section dans l'école.
create or replace function msg_branches_dirigees(p_ecole uuid) returns text[]
  language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct b), '{}')
  from msg_profils_ecole(p_ecole, null) r, unnest(r.branches) b
  where r.niveau = 'responsable';
$$;

-- LA règle, en un seul endroit (fonction pure) : `de` peut-il contacter
-- `vers` ? `dirigees` ne sert qu'à l'enseignant sans chef de section (le
-- sommet en tient lieu).
create or replace function msg_regle(de_niv text, de_br text[], de_cle text,
                                     vers_niv text, vers_br text[], vers_cle text,
                                     dirigees text[]) returns boolean
  language sql immutable as $$
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

-- Comptes que `p_de` peut contacter (ensemble, en une passe : annuaire,
-- annonces).
create or replace function msg_contactables(p_de uuid) returns setof uuid
  language sql stable security definer set search_path = public as $$
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

-- Même règle pour UNE paire (gardes des RPC, policy des annonces : appelée
-- ligne à ligne, elle ne recalcule pas toute l'école).
create or replace function msg_peut_contacter(p_de uuid, p_vers uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce((
    select msg_regle(de.niveau, de.branches, de.cle, vers.niveau, vers.branches, vers.cle,
                     case when de.niveau = 'enseignant' and vers.niveau = 'sommet'
                          then msg_branches_dirigees(c.ecole_id) end)
    from comptes c
    cross join lateral msg_profils_ecole(c.ecole_id, p_de) de
    cross join lateral msg_profils_ecole(c.ecole_id, p_vers) vers
    where c.id = p_de and p_de is distinct from p_vers), false);
$$;

-- ── 3. Ce que chacun voit : annuaire et présence ────────────────────────────
-- Personnel et enseignants : tout le personnel et tous les enseignants (comme
-- avant), plus les parents qu'ils peuvent contacter ou avec qui ils ont une
-- discussion. Parent : les seules personnes qu'il peut contacter ou avec qui
-- il a une discussion — jamais l'annuaire de l'école, jamais un autre parent.
create or replace function msg_visibles() returns setof uuid
  language sql stable security definer set search_path = public as $$
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

-- Libellé sous le nom : poste, matière d'un enseignant, enfants d'un parent.
create or replace function msg_poste_compte(p_compte uuid) returns text
  language sql stable security definer set search_path = public as $$
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

-- Annuaire : + `enfants` des parents (ciblage des annonces par classe).
drop function if exists msg_annuaire();
create function msg_annuaire()
returns table (id uuid, user_id uuid, login text, nom text, poste text, role text, poste_cle text,
               contactable boolean, enfants jsonb)
  language sql stable security definer set search_path = public as $$
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

-- Présence : les parents signalent la leur (le personnel sait s'il peut
-- appeler) ; chacun ne voit que celle des comptes qu'il voit.
create or replace function msg_presence(p_etat text) returns void
  language sql security definer set search_path = public as $$
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

create or replace function msg_presences()
returns table (compte_id uuid, etat text, depuis int)
  language sql stable security definer set search_path = public as $$
  select p.compte_id,
         case when p.vu_at > now() - interval '150 seconds' then p.etat else 'hors_ligne' end,
         greatest(0, extract(epoch from now() - p.vu_at))::int
  from msg_presences p
  where est_membre_messagerie() and p.ecole_id = auth_ecole_id()
    and p.compte_id in (select msg_visibles());
$$;

-- ── 4. Groupes : sans parents ───────────────────────────────────────────────
-- Garde commune de msg_creer_groupe et msg_ajouter_membres.
create or replace function msg_exiger_contactables(p_comptes uuid[]) returns void
  language plpgsql stable security definer set search_path = public as $$
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

-- ── 5. Annonces aux parents ─────────────────────────────────────────────────
alter table msg_annonces add column if not exists a_parents boolean not null default false;
alter table msg_annonces add column if not exists a_parents_sections text[];
-- 'section|classe' (ex. 'college|6ème A') : un même nom de classe peut
-- exister dans deux sections.
alter table msg_annonces add column if not exists a_parents_classes text[];

-- Un parent est-il visé (par ses enfants actuels) ?
create or replace function msg_parent_vise(p_parent uuid, p_tous boolean, p_sections text[], p_classes text[])
returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from msg_enfants(p_parent) e
    where coalesce(p_tous, false)
       or e.section = any(coalesce(p_sections, '{}'))
       or (e.section || '|' || e.classe) = any(coalesce(p_classes, '{}')));
$$;

-- Variante de la policy : ne répond que pour le compte courant (sinon on
-- pourrait sonder la classe des enfants d'un autre parent).
create or replace function msg_suis_parent_vise(p_tous boolean, p_sections text[], p_classes text[])
returns boolean
  language sql stable security definer set search_path = public as $$
  select auth_role()::text = 'parent'
     and msg_parent_vise(my_compte_id(), p_tous, p_sections, p_classes);
$$;

create or replace function msg_annonce_destinataires(p_annonce uuid) returns setof uuid
  language sql stable security definer set search_path = public as $$
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

drop policy if exists msg_annonces_select on msg_annonces;
create policy msg_annonces_select on msg_annonces for select to authenticated
  using (ecole_id = auth_ecole_id() and est_membre_messagerie()
         and (de_compte_id = my_compte_id()
              or ((case when auth_role()::text = 'parent' then
                     my_compte_id() = any(coalesce(a_comptes, '{}'))
                     or msg_suis_parent_vise(a_parents, a_parents_sections, a_parents_classes)
                   else
                     a_tous
                     or (a_personnel and auth_role()::text <> 'enseignant')
                     or (a_enseignants and auth_role()::text = 'enseignant')
                     or my_poste_cle() = any(coalesce(a_postes, '{}'))
                     or my_compte_id() = any(coalesce(a_comptes, '{}')) end)
                  and (hors_pyramide or de_compte_id is null
                       or msg_peut_contacter(de_compte_id, my_compte_id())))));

-- Publication : le personnel (ni enseignants ni parents), en son nom.
drop policy if exists msg_annonces_insert on msg_annonces;
create policy msg_annonces_insert on msg_annonces for insert to authenticated
  with check (ecole_id = auth_ecole_id() and est_membre_messagerie()
              and auth_role()::text not in ('enseignant', 'parent')
              and de_compte_id = my_compte_id()
              and not hors_pyramide
              and (a_tous or a_personnel or a_enseignants or a_parents
                   or coalesce(array_length(a_postes, 1), 0) > 0
                   or coalesce(array_length(a_comptes, 1), 0) > 0
                   or coalesce(array_length(a_parents_sections, 1), 0) > 0
                   or coalesce(array_length(a_parents_classes, 1), 0) > 0));

-- Suivi « Lu par » : le libellé dit de quels enfants un parent est le parent.
create or replace function msg_annonce_suivi(p_id uuid)
returns table (compte_id uuid, user_id uuid, nom text, poste text, lu_at timestamptz, confirme_at timestamptz)
  language plpgsql stable security definer set search_path = public as $$
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

-- ── 6. Droits d'exécution ───────────────────────────────────────────────────
do $$
declare
  f text;
begin
  -- Appelées par la RLS (au nom de l'utilisateur) ou par l'interface.
  foreach f in array array[
    'est_membre_messagerie()', 'msg_peut_contacter(uuid, uuid)', 'msg_annuaire()',
    'msg_presence(text)', 'msg_presences()', 'msg_annonce_suivi(uuid)',
    'msg_suis_parent_vise(boolean, text[], text[])']
  loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  -- Internes : appelées seulement depuis d'autres fonctions.
  foreach f in array array[
    'msg_compte_joignable(uuid)', 'msg_enfants(uuid)',
    'msg_branches_de(text[])', 'msg_branches_eff(text[])',
    'msg_profils_ecole(uuid, uuid)', 'msg_profils(uuid)', 'msg_branches_dirigees(uuid)',
    'msg_regle(text, text[], text, text, text[], text, text[])', 'msg_contactables(uuid)',
    'msg_visibles()', 'msg_poste_compte(uuid)', 'msg_exiger_contactables(uuid[])',
    'msg_parent_vise(uuid, boolean, text[], text[])', 'msg_annonce_destinataires(uuid)']
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;

-- Sondes : node supabase/test-rls-messagerie.mjs
