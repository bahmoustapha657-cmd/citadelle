-- ════════════════════════════════════════════════════════════════════════
--  Préscolaire — ÉTAPE 1/2 : ajout de la valeur d'enum
-- ════════════════════════════════════════════════════════════════════════
-- Ce fichier ne doit contenir QUE la ligne ci-dessous : aucune requête ne
-- peut UTILISER la valeur 'prescolaire' (même un simple enum_range de
-- contrôle) dans la transaction qui l'ajoute — Postgres répond alors
-- « unsafe use of new value … / New enum values must be committed before
-- they can be used » (SQLSTATE 55P04), et l'éditeur SQL de Supabase exécute
-- tout l'onglet en UNE transaction.
--
-- Exécuter ce fichier seul, puis prescolaire-2-permissions.sql (qui contient
-- les contrôles). Idempotent.

alter type section_scolaire add value if not exists 'prescolaire';
