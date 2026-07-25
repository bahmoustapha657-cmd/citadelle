-- ════════════════════════════════════════════════════════════════════════
--  Préscolaire — ÉTAPE 2/2 : permissions par module
-- ════════════════════════════════════════════════════════════════════════
-- À exécuter APRÈS prescolaire-1-enum.sql (la valeur 'prescolaire' doit être
-- committée, sinon SQLSTATE 55P04).
--
-- Ordre général du projet : rls.sql → teacher-security.sql → postes.sql
-- (→ powersync-scope.sql → powersync-perms.sql) → prescolaire-1 → prescolaire-2.
-- Idempotent.

-- ── Le préscolaire a SON module de permissions ──────────────────────────────
-- section_module() traduit la section d'une ligne en module (cf.
-- has_module_read/write dans postes.sql). Sans cette mise à jour, les lignes
-- 'prescolaire' tomberaient dans le module 'secondaire' — un enseignant du
-- secondaire aurait pu écrire les notes de maternelle.
create or replace function section_module(p_section section_scolaire) returns text
  language sql immutable as $$
  select case
    when p_section = 'primaire'    then 'primaire'
    when p_section = 'prescolaire' then 'prescolaire'
    else 'secondaire'
  end;
$$;
grant execute on function section_module(section_scolaire) to authenticated;

-- ── Permission dénormalisée pour PowerSync (hors ligne), si installé ────────
-- Miroir de powersync-perms.sql : les Parameter Queries ne lisent qu'une table
-- et pas de jsonb, d'où une colonne booléenne par module.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_name = 'comptes' and column_name = 'perm_compta') then
    alter table comptes add column if not exists perm_prescolaire boolean not null default false;
  end if;
end $$;

-- Note : le périmètre académique hors ligne (eleves/notes/classes…) est déjà
-- couvert par les buckets school_data / staff_notes / teacher_notes, qui
-- filtrent par ecole_id et section — le préscolaire y entre sans changement de
-- Sync Rules. `perm_prescolaire` n'est utile que si vous ajoutez plus tard un
-- bucket dédié ; pensez alors à l'alimenter dans powersync_perms_compute().

-- ── Contrôle ────────────────────────────────────────────────────────────────
select
  section_module('prescolaire'::section_scolaire) as module_prescolaire,
  section_module('primaire'::section_scolaire)    as module_primaire,
  section_module('college'::section_scolaire)     as module_college;
