-- ════════════════════════════════════════════════════════════════════════
--  EduGest — JOURNAL DES PAIEMENTS (grand livre des encaissements)  [delta]
-- ════════════════════════════════════════════════════════════════════════
-- À exécuter UNE FOIS dans Supabase → SQL Editor, sur une base déjà créée via
-- schema.sql + rls.sql (+ comptabilite.sql). Idempotent.
--
-- POURQUOI : jusqu'ici, un encaissement de scolarité ne laissait de trace que
-- SUR la fiche élève (mens / mensDates / mensMontants / fraisPayes). Ces
-- champs sont un ÉTAT, pas un historique : ils sont écrasés au décochage et
-- remis à zéro à la clôture d'année. Le journal ci-dessous enregistre chaque
-- mouvement — qui, quoi, combien, quand — et ne perd jamais rien.
--
-- APPEND-ONLY : une annulation AJOUTE une ligne (statut 'annule'), elle n'en
-- supprime jamais. C'est ce qui rend le journal opposable.
--
-- La table `paiements` existait déjà dans schema.sql (id, ecole_id, eleve_id,
-- mois, statut, montant, date_paiement) mais n'était utilisée par personne :
-- on la complète plutôt que d'en créer une nouvelle.

-- ── Colonnes complémentaires ───────────────────────────────────────────────
alter table paiements add column if not exists annee      text;   -- "2025-2026"
alter table paiements add column if not exists type       text;   -- mensualite | inscription | frais
alter table paiements add column if not exists libelle    text;   -- "Novembre", "Cantine"…
alter table paiements add column if not exists eleve_nom  text;   -- figé : lisible même si la fiche change
alter table paiements add column if not exists classe     text;   -- figé : la classe AU MOMENT du paiement
alter table paiements add column if not exists auteur     text;   -- qui a encaissé
alter table paiements add column if not exists extra      jsonb default '{}'::jsonb;

-- statut : 'encaisse' (entrée) ou 'annule' (contre-passation).
-- L'ancienne valeur par défaut ('Impayé') n'a plus de sens pour un journal.
alter table paiements alter column statut set default 'encaisse';

-- ── Index ──────────────────────────────────────────────────────────────────
create index if not exists idx_paiements_ecole_annee on paiements (ecole_id, annee);
create index if not exists idx_paiements_ecole_date  on paiements (ecole_id, date_paiement);

-- ── updated_at automatique (trigger set_updated_at de schema.sql) ──────────
drop trigger if exists trg_paiements_updated on paiements;
create trigger trg_paiements_updated before update on paiements
  for each row execute function set_updated_at();

-- ── RLS : lecture (personnel + parent concerné), écriture en AJOUT SEUL ────
-- ⚠️ À RÉ-APPLIQUER APRÈS TOUT PASSAGE DE rls.sql : celui-ci pose sur
--    `paiements` une policy `paiements_write` « for all » qui rouvrirait
--    update et delete. Ce fichier la remplace par un insert seul.
alter table paiements enable row level security;

-- Lecture : identique à rls.sql — le personnel voit tout, un parent ne voit
-- que ses propres enfants. Reprise telle quelle pour ne rien restreindre.
drop policy if exists paiements_select on paiements;
create policy paiements_select on paiements for select to authenticated
  using (ecole_id = auth_ecole_id()
         and (auth_role() <> 'parent' or eleve_id in (select my_eleve_ids())));

-- Écriture : INSERT seulement. Sans policy update ni delete, l'opération est
-- refusée à tout le monde — y compris au comptable. C'est ce qui rend le
-- journal opposable : une annulation ajoute une ligne, elle n'en retire pas.
drop policy if exists paiements_write on paiements;
drop policy if exists paiements_insert on paiements;
create policy paiements_insert on paiements for insert to authenticated
  with check (ecole_id = auth_ecole_id() and is_staff());
