-- ════════════════════════════════════════════════════════════════════════
--  Préscolaire — ÉTAPE 3 : enseignants de maternelle (portail enseignant)
-- ════════════════════════════════════════════════════════════════════════
-- À exécuter dans Supabase → SQL Editor, après teacher-security.sql (table
-- enseignant_classes). Idempotent ; ordre indifférent vis-à-vis de
-- prescolaire-1/2 (aucun littéral d'enum, cf. ::text).
--
-- Un enseignant de maternelle est, comme au primaire, TITULAIRE de sa classe :
-- il y saisit toutes les matières (les domaines d'apprentissage). La RLS ne
-- dispensait du filtre matière que la section 'primaire' : un compte de
-- section 'prescolaire' — souvent sans matière de profil — voyait donc TOUTES
-- ses notes refusées.
--
-- Ce fichier ne redéfinit QUE teacher_can_write_note(), à l'identique de
-- teacher-security.sql (qui en porte la même version) : pas besoin de rejouer
-- teacher-security.sql, ce qui obligerait à rejouer ensuite postes.sql,
-- discipline-module.sql et prescolaire-2-permissions.sql.
--
-- Le reste du périmètre suit déjà la section 'prescolaire' sans changement :
-- enseignant_classes.section, my_teacher_eleve_ids() (absences), et le bucket
-- PowerSync teacher_notes (paramétré par enseignant_classes.section).
--
-- Ensuite : déployer l'Edge Function account-manage et le front, PUIS
-- reprendre les comptes existants (node supabase/reprendre-comptes-prescolaire.mjs).

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
      and (ec.section::text in ('primaire', 'prescolaire')
           or (coalesce(btrim(c.matiere), '') <> ''
               and lower(btrim(p_matiere)) = lower(btrim(c.matiere))))
  );
$$;
grant execute on function teacher_can_write_note(uuid, text, section_scolaire) to authenticated;

-- ── Contrôle ────────────────────────────────────────────────────────────────
-- Attendu : true (la maternelle est dispensée du filtre matière).
select pg_get_functiondef('teacher_can_write_note(uuid, text, section_scolaire)'::regprocedure)
       like '%''prescolaire''%' as maternelle_dispensee;
