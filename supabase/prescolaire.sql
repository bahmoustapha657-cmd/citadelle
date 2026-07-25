-- ════════════════════════════════════════════════════════════════════════
--  EduGest — Section PRÉSCOLAIRE (maternelle) : socle SQL
-- ════════════════════════════════════════════════════════════════════════
-- Ajoute 'prescolaire' à l'enum des sections et rattache cette section à son
-- propre module de permissions. Jusqu'ici la maternelle était noyée dans le
-- primaire (classes « Maternelle A/B… » de section 'primaire').
--
-- À exécuter APRÈS rls.sql → teacher-security.sql → postes.sql
-- (→ powersync-scope.sql → powersync-perms.sql si le hors ligne est en place).
-- Idempotent : ré-exécutable sans danger.
--
-- ⚠️ `alter type … add value` ne peut PAS tourner dans le même bloc de
-- transaction que son utilisation : d'où les deux étapes séparées ci-dessous.
-- Exécutez le fichier ENTIER (l'éditeur SQL de Supabase les enchaîne bien).

-- ── 1. Nouvelle valeur d'enum ───────────────────────────────────────────────
-- Irréversible (Postgres ne sait pas retirer une valeur d'enum) mais sans
-- danger : une valeur inutilisée ne coûte rien.
alter type section_scolaire add value if not exists 'prescolaire';

-- ── 2. Permissions : le préscolaire a SON module ────────────────────────────
-- section_module() traduit la section d'une ligne en module de permissions
-- (cf. has_module_read/write dans postes.sql). Sans cette mise à jour, les
-- lignes 'prescolaire' seraient gouvernées par le module 'secondaire' — un
-- enseignant du secondaire aurait pu écrire les notes de maternelle.
create or replace function section_module(p_section section_scolaire) returns text
  language sql immutable as $$
  select case
    when p_section = 'primaire'    then 'primaire'
    when p_section = 'prescolaire' then 'prescolaire'
    else 'secondaire'
  end;
$$;
grant execute on function section_module(section_scolaire) to authenticated;

-- ── 3. Permission dénormalisée pour PowerSync (hors ligne) ──────────────────
-- Miroir de powersync-perms.sql : les Parameter Queries ne lisent qu'une table
-- et pas de jsonb, d'où une colonne booléenne par module. Le trigger
-- powersync_perms_compute() la recalcule ; on l'étend ici seulement si le
-- socle hors ligne est déjà installé.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_name = 'comptes' and column_name = 'perm_compta') then
    alter table comptes add column if not exists perm_prescolaire boolean not null default false;
  end if;
end $$;

-- Note : si vous ajoutez `perm_prescolaire` aux Sync Rules, pensez à étendre
-- powersync_perms_compute() (powersync-perms.sql) de la même manière que les
-- autres modules. Le périmètre académique (eleves/notes/…) est déjà couvert
-- par les buckets school_data / staff_notes / teacher_notes, qui filtrent par
-- ecole_id et section — le préscolaire y entre donc sans changement.

-- ── Contrôle ────────────────────────────────────────────────────────────────
select unnest(enum_range(null::section_scolaire)) as sections_disponibles;
