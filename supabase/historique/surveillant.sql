-- ════════════════════════════════════════════════════════════════════════
--  EduGest — Migration : rôle « Surveillant Général »
-- ════════════════════════════════════════════════════════════════════════
-- À exécuter dans le SQL Editor du dashboard Supabase (base EXISTANTE).
-- Ne PAS relancer rls.sql en entier (régression connue vs teacher-security.sql).
--
-- 1) La valeur d'enum doit être commitée avant d'être utilisable : exécuter
--    ce fichier en DEUX fois si le SQL Editor enveloppe tout dans une seule
--    transaction (d'abord l'ALTER TYPE, puis le reste), ou tel quel si chaque
--    statement est commité séparément (comportement par défaut de l'éditeur).

-- ── 1. Nouvelle valeur d'enum ───────────────────────────────────────────────
alter type role_compte add value if not exists 'surveillant' after 'comptable';

-- ── 2. is_staff() : le surveillant fait partie du personnel ────────────────
--     (lecture école entière + écriture RLS staff, comme les autres rôles ;
--      le périmètre fin — pas de notes, pas de compta — est appliqué par
--      l'interface et, côté Firebase prod, par les rules serveur).
create or replace function is_staff() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce(auth_role() in
    ('superadmin','direction','admin','comptable','surveillant','primaire','college'), false);
$$;
