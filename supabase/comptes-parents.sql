-- ════════════════════════════════════════════════════════════════════════
--  EduGest — Comptes parents : un foyer, un compte (étape 2)   [delta]
-- ════════════════════════════════════════════════════════════════════════
-- À exécuter dans Supabase → SQL Editor, APRÈS rls.sql. Idempotent.
-- Déployer ensuite l'Edge Function : supabase functions deploy account-manage
-- (rattacher / détacher passent désormais par elle), puis remplir les
-- téléphones des comptes existants : node supabase/telephones-parents.mjs
--
-- 1. comptes.telephone : numéro du parent, normalisé +224XXXXXXXXX par
--    l'Edge Function account-manage. Sert à retrouver le parent, à lui
--    proposer son numéro comme identifiant et, plus tard, à lui écrire.
--    PAS unique : un même numéro sert parfois à plusieurs familles (celui de
--    l'école saisi pour des internes) ; l'identifiant, lui, reste unique par
--    école (contrainte comptes(ecole_id, login)).
--
-- 2. parent_eleves.lien (père, mère, tuteur, autre) et created_at : un enfant
--    peut être suivi par plusieurs comptes — le père et la mère chacun le sien.
--
-- 3. RLS parent_eleves — FAILLE CORRIGÉE. La politique d'origine (rls.sql)
--    était `using (is_staff())`, sans condition d'école : tout membre du
--    personnel de N'IMPORTE QUELLE école pouvait lire, créer et supprimer les
--    liens de toutes les écoles, donc rattacher un enfant à un compte parent
--    qui n'est pas le sien et lui ouvrir notes, absences et paiements.
--    Lecture : le parent (ses propres liens) ou le personnel de l'école de
--    l'élève. Écriture : plus aucune depuis le navigateur — l'Edge Function
--    account-manage (service_role) vérifie les droits et l'école. Aucun écran
--    n'écrivait ces liens directement. rls.sql porte la même correction.

-- ── 1. Téléphone du parent ─────────────────────────────────────────────────
alter table comptes add column if not exists telephone text;
create index if not exists idx_comptes_telephone
  on comptes (ecole_id, telephone) where telephone is not null;

-- ── 2. Lien de parenté ─────────────────────────────────────────────────────
alter table parent_eleves add column if not exists lien text;
alter table parent_eleves add column if not exists created_at timestamptz default now();
alter table parent_eleves drop constraint if exists parent_eleves_lien_check;
alter table parent_eleves add constraint parent_eleves_lien_check
  check (lien is null or lien in ('pere', 'mere', 'tuteur', 'autre'));
create index if not exists idx_parent_eleves_eleve on parent_eleves (eleve_id);

-- ── 3. RLS : lecture limitée à l'école, écriture par l'Edge Function seule ─
drop policy if exists parent_eleves_select on parent_eleves;
create policy parent_eleves_select on parent_eleves for select to authenticated
  using (compte_id = my_compte_id()
         or (is_staff() and exists (
               select 1 from eleves e
               where e.id = parent_eleves.eleve_id and e.ecole_id = auth_ecole_id())));
drop policy if exists parent_eleves_write on parent_eleves;
-- (Pas de policy d'écriture pour authenticated : seul service_role écrit.
--  La policy parent_eleves_superadmin de rls.sql reste en place.)

-- Contrôle : doit afficher parent_eleves_select et parent_eleves_superadmin,
-- plus aucune parent_eleves_write.
select policyname, cmd from pg_policies where tablename = 'parent_eleves' order by policyname;
