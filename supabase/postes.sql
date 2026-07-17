-- ════════════════════════════════════════════════════════════════════════
--  EduGest — Postes flexibles & permissions par module (RLS v2)
-- ════════════════════════════════════════════════════════════════════════
-- À exécuter dans Supabase → SQL Editor. Idempotent.
--
-- ⚠️ ORDRE D'APPLICATION : schema.sql → rls.sql → teacher-security.sql →
--    postes.sql (CE FICHIER EN DERNIER). Tout re-run de rls.sql ou de
--    teacher-security.sql doit être suivi d'un re-run de ce fichier :
--    il redéfinit is_staff() (rôle 'staff'), comptes_guard() (colonne
--    poste_id) et remplace les policies par module.
--    surveillant.sql est SUPERSÉDÉ par ce fichier (is_staff y est repris).
--
-- NB : la nouvelle valeur d'enum 'staff' n'est jamais utilisée comme littéral
--    enum dans ce fichier (comparaisons en ::text) — le SQL Editor peut donc
--    tout exécuter en UNE transaction sans l'erreur « unsafe use of new value ».
--
-- Modèle v2 :
--   • `postes` : définitions de postes PAR ÉCOLE (label libre + permissions
--     par module { "compta":"ecriture", "primaire":"lecture", … }).
--   • `comptes.poste_id` : chaque compte du personnel pointe un poste ;
--     plusieurs comptes peuvent partager le même poste. Modifier le poste
--     change les droits de tous ses comptes.
--   • Modules permissibles : accueil, historique, admin_panel, parametres,
--     compta, primaire, secondaire, calendrier, examens, messages, fondation.
--     Valeur absente = module invisible ; 'lecture' ; 'ecriture'.
--   • direction / superadmin : TOUJOURS tous droits (garde-fou : une école
--     ne peut pas s'enfermer dehors). Le poste 'direction' est indésactivable.
--   • Repli legacy : un compte SANS poste_id garde des droits dérivés de son
--     rôle enum, alignés sur les capacités historiques de l'interface
--     (shared/role-config.js) — le personnel existant continue de travailler
--     sans migration préalable.
--   • enseignant / parent : mécanique inchangée (teacher-security.sql,
--     parent_eleves) — hors du système de postes.
--   • Correction au passage : les tables de COMPTA (salaires compris)
--     n'étaient lisibles que par « toute personne authentifiée de l'école »
--     (parents inclus !) via le bloc macro de rls.sql — désormais réservées
--     au module compta.

-- ── 1. Enum : rôle générique des nouveaux comptes de personnel ─────────────
alter type role_compte add value if not exists 'staff' after 'college';

-- ── 2. Table des postes ────────────────────────────────────────────────────
create table if not exists postes (
  id          uuid primary key default gen_random_uuid(),
  ecole_id    uuid not null references ecoles(id) on delete cascade,
  cle         text not null,                      -- slug stable ('direction', 'comptable', 'censeur'…)
  label       text not null,                      -- libellé affiché, libre
  systeme     boolean not null default false,     -- issu des 6 rôles historiques
  actif       boolean not null default true,
  permissions jsonb not null default '{}'::jsonb, -- { module: 'lecture'|'ecriture' }
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique (ecole_id, cle)
);
create index if not exists idx_postes_ecole on postes (ecole_id);

drop trigger if exists trg_postes_updated on postes;
create trigger trg_postes_updated before update on postes
  for each row execute function set_updated_at();

alter table comptes add column if not exists poste_id uuid references postes(id) on delete set null;
create index if not exists idx_comptes_poste on comptes (poste_id);

-- ── 3. is_staff() : inclut le rôle générique 'staff' ───────────────────────
-- Comparaison en ::text : évite « unsafe use of new value » quand l'enum
-- 'staff' vient d'être ajouté dans la même transaction.
create or replace function is_staff() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce(auth_role()::text in
    ('superadmin','direction','admin','comptable','surveillant','primaire','college','staff'), false);
$$;

-- ── 4. Permissions effectives du compte courant ────────────────────────────
-- direction/superadmin → tout ; poste actif → permissions du poste ; poste
-- inactif → rien ; pas de poste → repli sur les capacités legacy du rôle
-- enum (mêmes périmètres que l'interface historique, écriture DB alignée).
create or replace function my_permissions() returns jsonb
  language sql stable security definer set search_path = public as $$
  select case
    when c.role in ('direction','superadmin') then
      '{"accueil":"ecriture","historique":"ecriture","admin_panel":"ecriture",
        "parametres":"ecriture","compta":"ecriture","primaire":"ecriture",
        "secondaire":"ecriture","calendrier":"ecriture","examens":"ecriture",
        "messages":"ecriture","fondation":"ecriture"}'::jsonb
    -- Les portails (parent/enseignant) n'ont JAMAIS de droits de poste, même
    -- si un poste_id a été posé sur leur ligne (anti-escalade par rattachement).
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
grant execute on function my_permissions() to authenticated;

create or replace function has_module_read(p_module text) returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce(my_permissions() ->> p_module, '') in ('lecture', 'ecriture');
$$;
grant execute on function has_module_read(text) to authenticated;

create or replace function has_module_write(p_module text) returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce(my_permissions() ->> p_module, '') = 'ecriture';
$$;
grant execute on function has_module_write(text) to authenticated;

-- Module pédagogique propriétaire d'une ligne sectionnée.
create or replace function section_module(p_section section_scolaire) returns text
  language sql immutable as $$
  select case when p_section = 'primaire' then 'primaire' else 'secondaire' end;
$$;
grant execute on function section_module(section_scolaire) to authenticated;

-- ── 5. RLS de la table postes ───────────────────────────────────────────────
-- Lecture : tout le personnel de l'école. Écriture : direction/superadmin
-- uniquement (un admin ne peut pas s'auto-attribuer des droits).
alter table postes enable row level security;
drop policy if exists postes_select on postes;
create policy postes_select on postes for select to authenticated
  using (ecole_id = auth_ecole_id() and is_staff());
drop policy if exists postes_write on postes;
create policy postes_write on postes for all to authenticated
  using (ecole_id = auth_ecole_id() and auth_role() in ('direction', 'superadmin'))
  with check (ecole_id = auth_ecole_id() and auth_role() in ('direction', 'superadmin'));
drop policy if exists postes_superadmin on postes;
create policy postes_superadmin on postes for all to authenticated
  using (is_superadmin()) with check (is_superadmin());

-- Garde-fou : le poste 'direction' ne peut être ni désactivé ni supprimé.
create or replace function postes_guard() returns trigger
  language plpgsql security definer set search_path = public as $$
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
drop trigger if exists trg_postes_guard on postes;
create trigger trg_postes_guard before update or delete on postes
  for each row execute function postes_guard();

-- ── 6. comptes_guard : anti-escalade adapté aux postes ─────────────────────
-- (redéfinition de la version teacher-security.sql.) Maintenant que les
-- postes DIFFÉRENCIENT les droits du personnel, « être staff » ne suffit plus
-- à contourner la garde : un surveillant pourrait sinon pointer son propre
-- compte vers le poste direction. Règles :
--   • service_role (Edge Functions, scripts : auth.role() = 'service_role',
--     ou null en connexion directe) → passe ;
--   • direction / superadmin / poste avec admin_panel en écriture → passent
--     (ce sont les gestionnaires de comptes légitimes) ;
--   • SA PROPRE ligne → toutes les colonnes sensibles figées (seul
--     premiere_co & co. restent auto-modifiables) ;
--   • la ligne d'un AUTRE (le staff gère parents/enseignants via
--     comptes_write) → role/ecole/user/login/poste figés : on ne transforme
--     pas un compte parent en compte à poste.
create or replace function comptes_guard() returns trigger
  language plpgsql security definer set search_path = public as $$
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
drop trigger if exists trg_comptes_guard on comptes;
create trigger trg_comptes_guard before update on comptes
  for each row execute function comptes_guard();

-- ── 7. COMPTES : écriture réservée (soi-même / gestion des comptes) ─────────
-- Avant : tout staff écrivait tout compte. Désormais : sa propre ligne
-- (premiere_co), le module admin_panel en écriture, ou un staff qui gère des
-- comptes parent/enseignant (flux inscription & enseignants existants).
drop policy if exists comptes_write on comptes;
create policy comptes_write on comptes for all to authenticated
  using (ecole_id = auth_ecole_id()
         and (user_id = auth.uid()
              or has_module_write('admin_panel')
              or (is_staff() and role in ('parent', 'enseignant'))))
  with check (ecole_id = auth_ecole_id()
         and (user_id = auth.uid()
              or has_module_write('admin_panel')
              or (is_staff() and role in ('parent', 'enseignant'))));

-- ── 8. ÉCOLES : mise à jour réservée aux gestionnaires ─────────────────────
drop policy if exists ecoles_update on ecoles;
create policy ecoles_update on ecoles for update to authenticated
  using (id = auth_ecole_id()
         and (has_module_write('parametres') or has_module_write('admin_panel')));

-- ── 9. COMPTA : lecture ET écriture par le module compta ───────────────────
-- (corrige la lecture école entière — parents compris — du bloc macro.)
do $$
declare t text;
begin
  for t in select unnest(array[
    'recettes','depenses','versements','bons','personnel','salaires'])
  loop
    execute format('drop policy if exists %1$s_select on %1$s;', t);
    execute format(
      'create policy %1$s_select on %1$s for select to authenticated
         using (ecole_id = auth_ecole_id() and has_module_read(''compta''));', t);
    execute format('drop policy if exists %1$s_write on %1$s;', t);
    execute format(
      'create policy %1$s_write on %1$s for all to authenticated
         using (ecole_id = auth_ecole_id() and has_module_write(''compta''))
         with check (ecole_id = auth_ecole_id() and has_module_write(''compta''));', t);
  end loop;
end $$;

-- tarifs : lecture école entière (le portail parent affiche les tarifs),
-- écriture compta.
drop policy if exists tarifs_write on tarifs;
create policy tarifs_write on tarifs for all to authenticated
  using (ecole_id = auth_ecole_id() and has_module_write('compta'))
  with check (ecole_id = auth_ecole_id() and has_module_write('compta'));

-- paiements : lecture compta ou parent (ses enfants) ; écriture compta.
drop policy if exists paiements_select on paiements;
create policy paiements_select on paiements for select to authenticated
  using (ecole_id = auth_ecole_id()
         and (has_module_read('compta') or eleve_id in (select my_eleve_ids())));
drop policy if exists paiements_write on paiements;
create policy paiements_write on paiements for all to authenticated
  using (ecole_id = auth_ecole_id() and has_module_write('compta'))
  with check (ecole_id = auth_ecole_id() and has_module_write('compta'));

-- ── 10. PÉDAGOGIE : écriture par section (primaire / secondaire) ────────────
-- Lectures référentielles (classes, matieres, emplois, enseignements,
-- enseignants) inchangées : école entière (portail enseignant & parent).
-- eleves/classes/enseignants : la compta écrit aussi (inscriptions,
-- mensualités sur la fiche élève, création de classes et d'enseignants
-- depuis le module salaires).
drop policy if exists eleves_write on eleves;
create policy eleves_write on eleves for all to authenticated
  using (ecole_id = auth_ecole_id()
         and (has_module_write(section_module(section)) or has_module_write('compta')))
  with check (ecole_id = auth_ecole_id()
         and (has_module_write(section_module(section)) or has_module_write('compta')));

drop policy if exists classes_write on classes;
create policy classes_write on classes for all to authenticated
  using (ecole_id = auth_ecole_id()
         and (has_module_write(section_module(section)) or has_module_write('compta')))
  with check (ecole_id = auth_ecole_id()
         and (has_module_write(section_module(section)) or has_module_write('compta')));

drop policy if exists enseignants_write on enseignants;
create policy enseignants_write on enseignants for all to authenticated
  using (ecole_id = auth_ecole_id()
         and (has_module_write(section_module(section)) or has_module_write('compta')))
  with check (ecole_id = auth_ecole_id()
         and (has_module_write(section_module(section)) or has_module_write('compta')));

drop policy if exists matieres_write on matieres;
create policy matieres_write on matieres for all to authenticated
  using (ecole_id = auth_ecole_id() and has_module_write(section_module(section)))
  with check (ecole_id = auth_ecole_id() and has_module_write(section_module(section)));

drop policy if exists emplois_write on emplois;
create policy emplois_write on emplois for all to authenticated
  using (ecole_id = auth_ecole_id() and has_module_write(section_module(section)))
  with check (ecole_id = auth_ecole_id() and has_module_write(section_module(section)));

drop policy if exists enseignements_write on enseignements;
create policy enseignements_write on enseignements for all to authenticated
  using (ecole_id = auth_ecole_id() and has_module_write(section_module(section)))
  with check (ecole_id = auth_ecole_id() and has_module_write(section_module(section)));

-- appreciations : écriture par section (jamais l'enseignant — inchangé).
drop policy if exists appreciations_write on appreciations;
create policy appreciations_write on appreciations for all to authenticated
  using (ecole_id = auth_ecole_id() and has_module_write(section_module(section)))
  with check (ecole_id = auth_ecole_id() and has_module_write(section_module(section)));

-- notes : écriture par section OU enseignant scopé (teacher-security.sql).
drop policy if exists notes_write on notes;
create policy notes_write on notes for all to authenticated
  using (ecole_id = auth_ecole_id()
         and (has_module_write(section_module(section))
              or teacher_can_write_note(eleve_id, matiere, section)))
  with check (ecole_id = auth_ecole_id()
         and (has_module_write(section_module(section))
              or teacher_can_write_note(eleve_id, matiere, section)));

-- absences : idem notes (périmètre enseignant conservé).
drop policy if exists absences_write on absences;
create policy absences_write on absences for all to authenticated
  using (ecole_id = auth_ecole_id()
         and (has_module_write(section_module(section))
              or eleve_id in (select my_teacher_eleve_ids())))
  with check (ecole_id = auth_ecole_id()
         and (has_module_write(section_module(section))
              or eleve_id in (select my_teacher_eleve_ids())));

-- ── 11. MODULES « document » ────────────────────────────────────────────────
-- messages : staff du module messages OU parent (ses enfants) — inchangé côté parent.
drop policy if exists messages_select on messages;
create policy messages_select on messages for select to authenticated
  using (ecole_id = auth_ecole_id()
         and (has_module_read('messages') or eleve_id in (select my_eleve_ids())));
drop policy if exists messages_write on messages;
create policy messages_write on messages for all to authenticated
  using (ecole_id = auth_ecole_id()
         and (has_module_write('messages') or eleve_id in (select my_eleve_ids())))
  with check (ecole_id = auth_ecole_id()
         and (has_module_write('messages') or eleve_id in (select my_eleve_ids())));

-- annonces : lecture école entière (inchangé) ; écriture module messages.
drop policy if exists annonces_write on annonces;
create policy annonces_write on annonces for all to authenticated
  using (ecole_id = auth_ecole_id() and has_module_write('messages'))
  with check (ecole_id = auth_ecole_id() and has_module_write('messages'));

-- calendrier / examens / fondation : module dédié.
drop policy if exists evenements_select on evenements;
create policy evenements_select on evenements for select to authenticated
  using (ecole_id = auth_ecole_id() and has_module_read('calendrier'));
drop policy if exists evenements_write on evenements;
create policy evenements_write on evenements for all to authenticated
  using (ecole_id = auth_ecole_id() and has_module_write('calendrier'))
  with check (ecole_id = auth_ecole_id() and has_module_write('calendrier'));

do $$
declare t text;
begin
  for t in select unnest(array['examens','livrets','honneurs'])
  loop
    execute format('drop policy if exists %1$s_select on %1$s;', t);
    execute format(
      'create policy %1$s_select on %1$s for select to authenticated
         using (ecole_id = auth_ecole_id() and has_module_read(''examens''));', t);
    execute format('drop policy if exists %1$s_write on %1$s;', t);
    execute format(
      'create policy %1$s_write on %1$s for all to authenticated
         using (ecole_id = auth_ecole_id() and has_module_write(''examens''))
         with check (ecole_id = auth_ecole_id() and has_module_write(''examens''));', t);
  end loop;
end $$;

do $$
declare t text;
begin
  for t in select unnest(array['membres','documents'])
  loop
    execute format('drop policy if exists %1$s_select on %1$s;', t);
    execute format(
      'create policy %1$s_select on %1$s for select to authenticated
         using (ecole_id = auth_ecole_id() and has_module_read(''fondation''));', t);
    execute format('drop policy if exists %1$s_write on %1$s;', t);
    execute format(
      'create policy %1$s_write on %1$s for all to authenticated
         using (ecole_id = auth_ecole_id() and has_module_write(''fondation''))
         with check (ecole_id = auth_ecole_id() and has_module_write(''fondation''));', t);
  end loop;
end $$;

-- historique : tout le personnel INSÈRE (journal d'actions) ; la lecture et
-- la modification restent au module historique (admin/direction).
drop policy if exists historique_select on historique;
create policy historique_select on historique for select to authenticated
  using (ecole_id = auth_ecole_id() and has_module_read('historique'));
drop policy if exists historique_write on historique;
drop policy if exists historique_insert on historique;
create policy historique_insert on historique for insert to authenticated
  with check (ecole_id = auth_ecole_id() and is_staff());
drop policy if exists historique_update on historique;
create policy historique_update on historique for update to authenticated
  using (ecole_id = auth_ecole_id() and has_module_write('historique'));
drop policy if exists historique_delete on historique;
create policy historique_delete on historique for delete to authenticated
  using (ecole_id = auth_ecole_id() and has_module_write('historique'));

-- ── 12. Push : ciblage par clé de poste (en plus du rôle) ──────────────────
-- Les abonnements portent la clé du poste ; l'Edge Function push cible
-- role IN (…) OU poste_cle IN (…) — les cibles historiques ('admin',
-- 'direction'…) continuent de matcher les postes système de même clé.
alter table if exists push_subs add column if not exists poste_cle text;

-- ── 13. Bypass superadmin sur les nouvelles tables ─────────────────────────
-- (postes couvert au § 5 ; les policies superadmin existantes des autres
--  tables restent en place — politiques permissives, rien à retoucher.)
