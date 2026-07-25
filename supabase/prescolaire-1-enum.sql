-- ════════════════════════════════════════════════════════════════════════
--  Préscolaire — ÉTAPE 1/2 : ajout de la valeur d'enum
-- ════════════════════════════════════════════════════════════════════════
-- À exécuter SEUL, puis exécuter prescolaire-2-permissions.sql.
--
-- Pourquoi deux fichiers : Postgres refuse d'UTILISER une valeur d'enum dans
-- la même transaction que son ajout (« unsafe use of new value … / New enum
-- values must be committed before they can be used », SQLSTATE 55P04). Or
-- l'éditeur SQL de Supabase exécute tout le contenu d'un onglet dans UNE
-- transaction. La valeur doit donc être committée par une exécution séparée.
--
-- Idempotent : ré-exécutable sans erreur.

alter type section_scolaire add value if not exists 'prescolaire';

-- Contrôle : 'prescolaire' doit apparaître dans la liste.
select unnest(enum_range(null::section_scolaire)) as sections_disponibles;
