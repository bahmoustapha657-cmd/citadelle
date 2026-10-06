-- ════════════════════════════════════════════════════════════════════════
--  PowerSync : le journal des encaissements (`paiements`) passe hors ligne
-- ════════════════════════════════════════════════════════════════════════
-- Pourquoi : hors ligne, un encaissement s'écrivait sur la fiche élève (miroir
-- local, remonté plus tard) mais sa ligne de journal partait directement au
-- réseau et se perdait. Constaté au G.S. Fatoumata Falilou Diallo : 345 mois
-- encaissés les 04 et 05/10/2026 sans aucune ligne au journal de caisse.
--
-- À exécuter UNE fois (SQL Editor), AVANT de déployer le front qui lit le
-- journal dans le miroir local — sinon la caisse le verrait vide.
-- Ordre complet :
--   1. ce fichier ;
--   2. coller supabase/powersync-sync-rules.min.yaml dans le dashboard
--      PowerSync → Validate → Deploy (heure creuse : chaque appareil
--      re-télécharge une fois ses données) ;
--   3. déployer le front.
--
-- La RLS ne change pas : le journal reste en AJOUT SEUL côté base. Le
-- connecteur PowerSync y envoie un INSERT (jamais d'upsert), cf.
-- src/backend/powersync/connector.js.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'powersync' and schemaname = 'public' and tablename = 'paiements'
  ) then
    alter publication powersync add table paiements;
  end if;
end $$;

-- Contrôle : doit renvoyer une ligne.
select pubname, tablename from pg_publication_tables
where pubname = 'powersync' and tablename = 'paiements';
