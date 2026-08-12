-- ════════════════════════════════════════════════════════════════════════
--  EduGest — Temps réel (Realtime / postgres_changes)   [delta]
-- ════════════════════════════════════════════════════════════════════════
-- À exécuter UNE FOIS dans Supabase → SQL Editor, après schema.sql + modules.sql.
-- Idempotent : ré-exécutable sans effet de bord.
--
-- POURQUOI : l'app affichait des données figées jusqu'au remontage du composant
-- (un changement fait sur un autre poste n'apparaissait jamais tout seul). Le
-- front s'abonne désormais aux changements via src/backend/realtime-supabase.js ;
-- encore faut-il que Postgres les PUBLIE — c'est l'objet de ce fichier.
--
-- COÛT : Realtime lit le WAL et diffuse par WebSocket. Contrairement aux
-- listeners Firestore qui avaient vidé le quota de lectures, ça ne consomme
-- aucune requête PostgREST.
--
-- SÉCURITÉ : les événements passent par la RLS exactement comme les lectures
-- (un parent ne reçoit que les lignes de ses enfants, un enseignant que son
-- périmètre). Aucune policy supplémentaire n'est requise : ne PAS publier une
-- table qui n'aurait pas de RLS.
--
-- ⚠️ REPLICA IDENTITY FULL est indispensable ici, pas décoratif :
--   • sans elle, un DELETE ne transporte que la clé primaire — donc le filtre
--     serveur `ecole_id=eq.<uuid>` ne matche pas et la SUPPRESSION n'est jamais
--     livrée au client (la ligne resterait affichée jusqu'au rechargement) ;
--   • elle fournit aussi l'ancienne ligne sur UPDATE, ce qui permet au front de
--     rafraîchir les DEUX vues quand un enregistrement change de section ou
--     d'année.
--   Contrepartie : chaque UPDATE/DELETE écrit l'ancienne ligne entière dans le
--   WAL. Négligeable à la volumétrie d'un établissement (quelques milliers de
--   lignes par table), à réévaluer si une table dépasse le million de lignes.

do $$
declare
  t text;
  tables_rt text[] := array[
    -- Scolarité (schema.sql)
    'eleves', 'notes', 'classes', 'enseignants', 'absences', 'appreciations',
    'matieres', 'emplois', 'enseignements', 'comptes', 'tarifs',
    -- Comptabilité / RH
    'salaires', 'recettes', 'depenses', 'versements', 'bons', 'personnel',
    'paiements',
    -- Modules « document » (modules.sql)
    'messages', 'annonces', 'documents', 'examens', 'livrets', 'honneurs',
    'membres', 'evenements', 'historique'
  ];
begin
  -- La publication existe par défaut sur Supabase ; on la crée au cas où le
  -- projet aurait été monté sans (sinon les ALTER ci-dessous échoueraient tous).
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  foreach t in array tables_rt loop
    -- Table absente (module non déployé) : on passe, sans faire échouer le lot.
    if not exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      raise notice 'realtime : table % absente, ignorée', t;
      continue;
    end if;

    -- Garde-fou : le filtre côté client porte sur ecole_id. Une table sans cette
    -- colonne diffuserait à toutes les écoles → on refuse de la publier.
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t and column_name = 'ecole_id'
    ) then
      raise notice 'realtime : table % sans ecole_id, NON publiée', t;
      continue;
    end if;

    execute format('alter table public.%I replica identity full;', t);

    -- Déjà membre de la publication → rien à faire (idempotence).
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I;', t);
      raise notice 'realtime : % publiée', t;
    end if;
  end loop;
end $$;

-- ── Vérification ────────────────────────────────────────────────────────
-- Doit lister les tables ci-dessus (et rien d'autre d'inattendu).
select tablename
from pg_publication_tables
where pubname = 'supabase_realtime' and schemaname = 'public'
order by tablename;
