-- ════════════════════════════════════════════════════════════════════════
--  Préscolaire — ÉTAPE 2/2 : rattachement aux permissions du PRIMAIRE
-- ════════════════════════════════════════════════════════════════════════
-- À exécuter APRÈS prescolaire-1-enum.sql (la valeur 'prescolaire' doit être
-- committée, sinon SQLSTATE 55P04).
--
-- Le préscolaire est un SOUS-ONGLET du module « Dir. Primaire » (comme le
-- lycée l'est du secondaire) : il n'a donc PAS de module de permissions
-- propre. section_module() doit renvoyer 'primaire' pour les lignes de
-- section 'prescolaire' — sinon la RLS exigerait une permission
-- « prescolaire » qui n'existe dans aucun poste, et les élèves/notes de
-- maternelle deviendraient invisibles.
--
-- Ordre général : rls.sql → teacher-security.sql → postes.sql
-- (→ powersync-scope.sql → powersync-perms.sql) → prescolaire-1 → prescolaire-2.
-- Idempotent : ré-exécutable sans danger (y compris si une version
-- précédente renvoyait 'prescolaire').

create or replace function section_module(p_section section_scolaire) returns text
  language sql immutable as $$
  select case
    when p_section in ('primaire', 'prescolaire') then 'primaire'
    else 'secondaire'
  end;
$$;
grant execute on function section_module(section_scolaire) to authenticated;

-- ── Contrôle ────────────────────────────────────────────────────────────────
-- Attendu : prescolaire → primaire | primaire → primaire | college → secondaire
select
  section_module('prescolaire'::section_scolaire) as prescolaire,
  section_module('primaire'::section_scolaire)    as primaire,
  section_module('college'::section_scolaire)     as college;
