-- 20261009134926_paiement_regularisation.sql
-- Pourquoi : un paiement en ligne « à vérifier » (argent reçu, imputation
-- automatique impossible) restait signalé pour toujours. Le comptable le
-- règle à la main (affecté ailleurs en caisse, ou remboursé) puis le marque
-- « régularisé », avec une note — via l'Edge Function `paiement`
-- (service_role), jamais depuis le navigateur.
--
-- Règles (docs/migrations-sql.md) :
--  - appliquée UNE fois, dans l'ordre, par la CI au déploiement — jamais à
--    la main dans l'éditeur SQL ;
--  - compatible avec le front encore en ligne (ajouter avant de retirer) ;
--  - ne jamais modifier une migration déjà fusionnée : en écrire une autre.

alter table public.paiements_en_ligne
  drop constraint paiements_en_ligne_statut_check;
alter table public.paiements_en_ligne
  add constraint paiements_en_ligne_statut_check
  check (statut in ('en_attente', 'impute', 'echoue', 'a_verifier', 'regularise'));
