-- ════════════════════════════════════════════════════════════════════════
--  EduGest — Durcissement RLS : périmètre d'écriture de l'enseignant
-- ════════════════════════════════════════════════════════════════════════
-- À exécuter dans Supabase → SQL Editor (après rls.sql). Idempotent.
-- ⚠️ Après tout re-run de ce fichier, RÉ-APPLIQUER postes.sql : il redéfinit
--    comptes_guard() (colonne poste_id) et les policies notes/absences_write
--    avec les permissions par module.
--
-- Problème : la RLS laissait un enseignant (can_grade) écrire N'IMPORTE quelle
-- note/absence de son école — le périmètre fin (ses classes) n'était imposé que
-- côté client. On ne peut PAS stocker ce périmètre sur `comptes` (l'enseignant
-- peut éditer sa propre ligne → auto-élargissement). On utilise donc une table
-- dédiée `enseignant_classes`, écrite UNIQUEMENT par le staff, et on restreint
-- notes_write / absences_write aux élèves des classes autorisées.
--
-- Peupler / mettre à jour : node supabase/populate-teacher-classes.mjs
-- (à relancer quand les affectations emploi/cahier/titulaire changent).

-- ── Table de périmètre (qui écrit pour quelles classes) ─────────────────────
create table if not exists enseignant_classes (
  compte_id  uuid not null references comptes(id) on delete cascade,
  ecole_id   uuid not null references ecoles(id) on delete cascade,
  section    section_scolaire not null,
  classe     text not null,
  primary key (compte_id, section, classe)
);
create index if not exists idx_ens_classes_ecole on enseignant_classes (ecole_id);

alter table enseignant_classes enable row level security;
-- Lecture : tout le personnel de l'école (et l'enseignant concerné).
drop policy if exists enseignant_classes_select on enseignant_classes;
create policy enseignant_classes_select on enseignant_classes for select to authenticated
  using (ecole_id = auth_ecole_id());
-- Écriture : STAFF uniquement (jamais l'enseignant lui-même).
drop policy if exists enseignant_classes_write on enseignant_classes;
create policy enseignant_classes_write on enseignant_classes for all to authenticated
  using (ecole_id = auth_ecole_id() and is_staff())
  with check (ecole_id = auth_ecole_id() and is_staff());

-- ── Élèves écrivables par l'enseignant courant (son périmètre) ──────────────
create or replace function my_teacher_eleve_ids() returns setof uuid
  language sql stable security definer set search_path = public as $$
  select e.id
  from eleves e
  join comptes c on c.user_id = auth.uid()
  join enseignant_classes ec on ec.compte_id = c.id
  where e.ecole_id = auth_ecole_id()
    and e.section = ec.section
    and e.classe = ec.classe;
$$;
grant execute on function my_teacher_eleve_ids() to authenticated;

-- ── Une note est-elle écrivable par l'enseignant courant ? ─────────────────
-- Réplique la validation du handler Firebase (noteBelongsToTeacherScope) :
--   • l'élève appartient à une classe du périmètre (enseignant_classes) ;
--   • la section de la NOTE égale celle de l'ÉLÈVE (sinon un prof du
--     secondaire poserait section='primaire' pour esquiver le filtre matière) ;
--   • au secondaire (college/lycee), la matière de la note = la matière du
--     profil — profil sans matière ⇒ REFUS (échec sécurisé, comme le 403 du
--     handler). Au primaire, le titulaire est multi-matières : pas de filtre.
create or replace function teacher_can_write_note(
    p_eleve uuid, p_matiere text, p_section section_scolaire) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from comptes c
    join enseignant_classes ec on ec.compte_id = c.id
    join eleves e on e.ecole_id = ec.ecole_id
                 and e.section = ec.section and e.classe = ec.classe
    where c.user_id = auth.uid()
      and e.id = p_eleve
      and e.section = p_section
      and (ec.section = 'primaire'
           or (coalesce(btrim(c.matiere), '') <> ''
               and lower(btrim(p_matiere)) = lower(btrim(c.matiere))))
  );
$$;
grant execute on function teacher_can_write_note(uuid, text, section_scolaire) to authenticated;

-- ── NOTES : écriture = staff (tout) OU enseignant scopé classes + matière ──
drop policy if exists notes_write on notes;
create policy notes_write on notes for all to authenticated
  using (ecole_id = auth_ecole_id()
         and (is_staff() or teacher_can_write_note(eleve_id, matiere, section)))
  with check (ecole_id = auth_ecole_id()
         and (is_staff() or teacher_can_write_note(eleve_id, matiere, section)));

-- ── ABSENCES (incidents) : même règle ──────────────────────────────────────
drop policy if exists absences_write on absences;
create policy absences_write on absences for all to authenticated
  using (ecole_id = auth_ecole_id()
         and (is_staff() or eleve_id in (select my_teacher_eleve_ids())))
  with check (ecole_id = auth_ecole_id()
         and (is_staff() or eleve_id in (select my_teacher_eleve_ids())));

-- ── Anti-élévation de privilège sur `comptes` ───────────────────────────────
-- comptes_write autorise l'utilisateur à éditer SA propre ligne (nécessaire
-- pour premiere_co — seule auto-écriture légitime du client). On empêche donc,
-- pour un non-staff, de modifier :
--   • role/ecole_id/user_id/login : sinon auto-promotion « direction »
--     (is_staff) et contournement de tout le périmètre ;
--   • section/sections/matiere : pilotent teacher_can_write_note ;
--   • nom/enseignant_id/enseignant_nom/extra : servent à l'appariement des
--     classes (populate-teacher-classes.mjs lit aussi extra.classesTitulaire…)
--     — modifiables ⇒ vol du périmètre d'un collègue au prochain peuplement.
create or replace function comptes_guard() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if is_staff() then return new; end if;
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
     or new.extra is distinct from old.extra then
    raise exception 'Champs protégés (rôle/école/login/périmètre) non modifiables.';
  end if;
  return new;
end; $$;
drop trigger if exists trg_comptes_guard on comptes;
create trigger trg_comptes_guard before update on comptes
  for each row execute function comptes_guard();
