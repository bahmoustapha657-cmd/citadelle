-- ════════════════════════════════════════════════════════════════════════
--  EduGest — user_id direct sur enseignant_classes (pour PowerSync)
-- ════════════════════════════════════════════════════════════════════════
-- Les "Parameter Queries" des Sync Rules PowerSync ne supportent qu'UNE
-- SEULE table (pas de JOIN). Le bucket `teacher_notes` de
-- supabase/powersync-sync-rules.yaml doit résoudre auth.uid() → classes
-- enseignées en UNE requête sur `enseignant_classes` seule — on y duplique
-- donc `user_id` (déjà sur `comptes`, protégé par comptes_guard() dans
-- teacher-security.sql, donc pas de risque d'auto-élévation via ce doublon).
--
-- À exécuter dans Supabase → SQL Editor, APRÈS teacher-security.sql.
-- Idempotent (peut être relancé sans risque).

alter table enseignant_classes
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

update enseignant_classes ec
set user_id = c.user_id
from comptes c
where c.id = ec.compte_id
  and ec.user_id is distinct from c.user_id;

create index if not exists idx_ens_classes_user on enseignant_classes (user_id);

-- Lecture : déjà couverte par la policy enseignant_classes_select existante
-- (ecole_id = auth_ecole_id()) — aucune policy supplémentaire nécessaire,
-- `user_id` n'est qu'une colonne de plus sur une ligne déjà lisible.
