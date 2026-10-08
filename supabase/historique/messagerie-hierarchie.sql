-- ════════════════════════════════════════════════════════════════════════
--  EduGest — Messagerie : communication pyramidale (qui peut contacter qui)
-- ════════════════════════════════════════════════════════════════════════
-- À exécuter dans Supabase → SQL Editor APRÈS messagerie-v2.sql et
-- messagerie-v3.sql. Idempotent.
--
-- La pyramide (décision de l'établissement, 2026-09-30) :
--
--   SOMMET       Fondateur (rôle direction) et Administrateur (rôle admin)
--                → contactent tout le monde.
--   RESPONSABLES tout autre compte du personnel (Principal·e, Directeur du
--                primaire, Comptable, Surveillance, postes créés par l'école)
--                → contactent le sommet et s'écrivent librement entre eux.
--                Les CHEFS DE SECTION contactent en plus LEURS enseignants :
--                  poste « college »  → enseignants du collège et du lycée,
--                  poste « primaire » → enseignants du primaire et de la maternelle.
--                (Clé du poste, et non ses droits : la Surveillance a souvent
--                l'écriture sur Primaire/Secondaire sans être responsable des
--                enseignants — pas de lien direct voulu.)
--   ENSEIGNANTS  → contactent UNIQUEMENT leur(s) chef(s) de section. Si leur
--                section n'a pas de chef dans l'école, le sommet en tient lieu.
--
-- « Contacter » = OUVRIR une discussion, créer un groupe / y ajouter
-- quelqu'un, APPELER, adresser une annonce. Répondre par message dans une
-- discussion ouverte par un supérieur reste possible (sinon la discussion
-- serait à sens unique) ; le rappeler, non, s'il n'est pas son responsable.

-- ── 1. Profil hiérarchique des comptes d'une école ──────────────────────────
-- niveau : sommet | responsable | enseignant ; branches : sections dirigées
-- (chef) ou enseignées (enseignant), parmi 'secondaire' / 'primaire'.
create or replace function msg_profils(p_ecole uuid)
returns table (compte_id uuid, niveau text, branches text[])
  language sql stable security definer set search_path = public as $$
  select c.id,
         case when c.role::text in ('direction', 'admin') then 'sommet'
              when c.role::text = 'enseignant' then 'enseignant'
              else 'responsable' end,
         case when c.role::text = 'enseignant' then
                array(select distinct case when s::text in ('college', 'lycee') then 'secondaire' else 'primaire' end
                      from unnest(coalesce(c.sections, '{}')
                                  || case when c.section is null then '{}'::section_scolaire[] else array[c.section] end) s)
              when c.role::text in ('direction', 'admin') then '{}'::text[]
              when coalesce(p.cle, c.role::text) = 'college' then array['secondaire']
              when coalesce(p.cle, c.role::text) = 'primaire' then array['primaire']
              else '{}'::text[] end
  from comptes c
  left join postes p on p.id = c.poste_id
  where c.ecole_id = p_ecole
    and c.role::text not in ('parent', 'superadmin')
    and coalesce(c.statut, 'Actif') = 'Actif'
    and coalesce(p.actif, true);
$$;

-- Comptes que `p_de` peut contacter (ensemble, calculé en une passe).
create or replace function msg_contactables(p_de uuid) returns setof uuid
  language sql stable security definer set search_path = public as $$
  with profils as (
    select * from msg_profils((select ecole_id from comptes where id = p_de))
  ),
  moi as (select * from profils where compte_id = p_de),
  -- Enseignant dont une branche n'a aucun chef : le sommet est son responsable.
  -- (Sans section connue, il relève des deux branches.)
  orphelin as (
    select exists (
      select 1 from moi,
        unnest(case when cardinality(moi.branches) = 0 then array['secondaire', 'primaire'] else moi.branches end) b
      where not exists (select 1 from profils r where r.niveau = 'responsable' and b = any(r.branches))
    ) as oui
  )
  select autre.compte_id
  from profils autre, moi
  where autre.compte_id <> moi.compte_id
    and (
      moi.niveau = 'sommet'
      or (moi.niveau = 'responsable'
          and (autre.niveau in ('sommet', 'responsable')
               or (autre.niveau = 'enseignant' and cardinality(moi.branches) > 0
                   and (moi.branches && autre.branches or cardinality(autre.branches) = 0))))
      or (moi.niveau = 'enseignant'
          and ((autre.niveau = 'responsable' and cardinality(autre.branches) > 0
                and (autre.branches && moi.branches or cardinality(moi.branches) = 0))
               or (autre.niveau = 'sommet' and (select oui from orphelin))))
    );
$$;

create or replace function msg_peut_contacter(p_de uuid, p_vers uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select p_de is not null and p_vers is not null
     and exists (select 1 from msg_contactables(p_de) x where x = p_vers);
$$;

-- ── 2. Annuaire : + « contactable » par le compte courant ───────────────────
-- (Tout le monde reste dans l'annuaire : noms des membres d'un groupe, des
-- expéditeurs d'annonces… ; seuls les sélecteurs filtrent.)
drop function if exists msg_annuaire();
create function msg_annuaire()
returns table (id uuid, user_id uuid, login text, nom text, poste text, role text, poste_cle text, contactable boolean)
  language sql stable security definer set search_path = public as $$
  with joignables as (select msg_contactables(my_compte_id()) as id)
  select c.id, c.user_id, c.login, msg_nom_compte(c.id),
         case when c.role::text = 'enseignant'
              then 'Enseignant' || coalesce(' · ' || nullif(trim(c.matiere), ''), '')
              else coalesce(p.label, c.label, c.role::text) end,
         c.role::text, coalesce(p.cle, c.role::text),
         c.id in (select id from joignables)
  from comptes c
  left join postes p on p.id = c.poste_id
  where est_membre_messagerie()
    and c.ecole_id = auth_ecole_id()
    and c.role::text not in ('parent', 'superadmin')
    and coalesce(c.statut, 'Actif') = 'Actif'
    and coalesce(p.actif, true)
  order by 4;
$$;

-- ── 3. Discussions : ouvrir, créer un groupe, ajouter ───────────────────────
create or replace function msg_ouvrir_directe(p_compte uuid) returns uuid
  language plpgsql security definer set search_path = public as $$
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

-- Garde commune : tous les comptes visés doivent être contactables.
create or replace function msg_exiger_contactables(p_comptes uuid[]) returns void
  language plpgsql stable security definer set search_path = public as $$
declare
  hors text;
begin
  select string_agg(msg_nom_compte(x), ', ') into hors
  from unnest(coalesce(p_comptes, '{}')) x
  where x is distinct from my_compte_id() and not msg_peut_contacter(my_compte_id(), x);
  if hors is not null then
    raise exception 'Hors de votre périmètre (hiérarchie de l''établissement) : %', hors using errcode = '42501';
  end if;
end $$;

create or replace function msg_creer_groupe(p_titre text, p_membres uuid[]) returns uuid
  language plpgsql security definer set search_path = public as $$
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

create or replace function msg_ajouter_membres(p_conv uuid, p_membres uuid[]) returns void
  language plpgsql security definer set search_path = public as $$
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

-- ── 4. Appels ───────────────────────────────────────────────────────────────
create or replace function msg_appel_lancer(p_conv uuid, p_offre jsonb) returns uuid
  language plpgsql security definer set search_path = public as $$
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

-- Appel de groupe : REJOINDRE un appel en cours reste ouvert à tout membre ;
-- le LANCER demande d'être administrateur du groupe ou de pouvoir contacter
-- chacun de ses membres (un enseignant n'appelle pas le Fondateur par ce biais).
create or replace function msg_reunion_demarrer(p_conv uuid) returns uuid
  language plpgsql security definer set search_path = public as $$
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

-- ── 5. Annonces : restreintes au périmètre de l'expéditeur ──────────────────
-- Les cibles (tout le monde, enseignants, postes…) sont COUPÉES au périmètre :
-- l'annonce « à tous » du Principal atteint le sommet, les responsables et
-- les enseignants du secondaire — pas ceux du primaire.
-- `hors_pyramide` : messages système (reprise de messages_internes, dont les
-- alertes « mot de passe oublié » d'un enseignant vers la direction).
alter table msg_annonces add column if not exists hors_pyramide boolean not null default false;
update msg_annonces set hors_pyramide = true
 where not hors_pyramide and id in (select id from messages_internes);

create or replace function msg_annonce_destinataires(p_annonce uuid) returns setof uuid
  language sql stable security definer set search_path = public as $$
  select c.id
  from msg_annonces a
  join comptes c on c.ecole_id = a.ecole_id
  left join postes p on p.id = c.poste_id
  where a.id = p_annonce
    and c.role::text not in ('parent', 'superadmin')
    and coalesce(c.statut, 'Actif') = 'Actif'
    and c.id is distinct from a.de_compte_id
    and (a.a_tous
         or (a.a_personnel and c.role::text <> 'enseignant')
         or (a.a_enseignants and c.role::text = 'enseignant')
         or coalesce(p.cle, c.role::text) = any(coalesce(a.a_postes, '{}'))
         or c.id = any(coalesce(a.a_comptes, '{}')))
    and (a.hors_pyramide or a.de_compte_id is null
         or c.id in (select msg_contactables(a.de_compte_id)));
$$;

drop policy if exists msg_annonces_select on msg_annonces;
create policy msg_annonces_select on msg_annonces for select to authenticated
  using (ecole_id = auth_ecole_id() and est_membre_messagerie()
         and (de_compte_id = my_compte_id()
              or ((a_tous
                   or (a_personnel and auth_role()::text <> 'enseignant')
                   or (a_enseignants and auth_role()::text = 'enseignant')
                   or my_poste_cle() = any(coalesce(a_postes, '{}'))
                   or my_compte_id() = any(coalesce(a_comptes, '{}')))
                  and (hors_pyramide or de_compte_id is null
                       or msg_peut_contacter(de_compte_id, my_compte_id())))));

drop policy if exists msg_annonces_insert on msg_annonces;
create policy msg_annonces_insert on msg_annonces for insert to authenticated
  with check (ecole_id = auth_ecole_id() and est_membre_messagerie()
              and auth_role()::text <> 'enseignant'
              and de_compte_id = my_compte_id()
              and not hors_pyramide
              and (a_tous or a_personnel or a_enseignants
                   or coalesce(array_length(a_postes, 1), 0) > 0
                   or coalesce(array_length(a_comptes, 1), 0) > 0));

-- La reprise de messages_internes (password-reset) passe hors pyramide.
create or replace function msg_reprendre_message_interne() returns trigger
  language plpgsql security definer set search_path = public as $$
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

-- ── 6. Droits d'exécution ───────────────────────────────────────────────────
do $$
declare
  f text;
begin
  -- Appelées par la RLS (policy des annonces) ou par l'interface.
  foreach f in array array[
    'msg_peut_contacter(uuid, uuid)', 'msg_annuaire()', 'msg_ouvrir_directe(uuid)',
    'msg_creer_groupe(text, uuid[])', 'msg_ajouter_membres(uuid, uuid[])',
    'msg_appel_lancer(uuid, jsonb)', 'msg_reunion_demarrer(uuid)']
  loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  foreach f in array array[
    'msg_profils(uuid)', 'msg_contactables(uuid)', 'msg_exiger_contactables(uuid[])',
    'msg_annonce_destinataires(uuid)', 'msg_reprendre_message_interne()']
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;

-- Sondes : node supabase/test-rls-messagerie.mjs
