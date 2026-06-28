-- ════════════════════════════════════════════════════════════════════════
--  EduGest — Schéma Postgres (Supabase)   — reconstruction parallèle
-- ════════════════════════════════════════════════════════════════════════
-- Principe : ce que Firestore stockait dans des collections SÉPARÉES PAR
-- SECTION (elevesPrimaire / elevesCollege / elevesLycee, idem notes/classes/
-- matieres…) devient ICI une SEULE table avec une colonne `section`.
-- Multi-écoles : chaque ligne porte `ecole_id`. La sécurité (qui voit quoi)
-- est dans rls.sql.
--
-- À appliquer dans : Supabase Studio → SQL Editor (ce fichier puis rls.sql).
-- ════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";          -- gen_random_uuid()

-- Domaines réutilisables -----------------------------------------------------
do $$ begin
  create type section_scolaire as enum ('primaire', 'college', 'lycee');
exception when duplicate_object then null; end $$;

do $$ begin
  create type role_compte as enum
    ('superadmin','direction','admin','comptable','primaire','college','enseignant','parent');
exception when duplicate_object then null; end $$;

-- ── Écoles ─────────────────────────────────────────────────────────────────
create table if not exists ecoles (
  id            uuid primary key default gen_random_uuid(),
  code          text unique not null,                 -- ex. "lacitadelle" (ancien schoolId)
  nom           text not null,
  logo          text,
  couleur1      text,
  couleur2      text,
  pays          text default 'République de Guinée',
  devise        text,
  plan          text default 'gratuit',
  plan_expiry   bigint,                                -- epoch ms (compat appli)
  modele_bulletin text default 'classique',
  role_settings jsonb default '{}'::jsonb,
  legal         jsonb default '{}'::jsonb,             -- profil officiel (ministère, agrément…)
  extra         jsonb default '{}'::jsonb,             -- champs additionnels / legacy
  actif         boolean default true,
  supprime      boolean default false,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Vue PUBLIQUE (lecture avant connexion : résolution de l'état d'une école).
-- N'expose que des champs non sensibles.
create or replace view ecoles_public as
  select id, code, nom, logo, couleur1, couleur2, actif, supprime
  from ecoles;

-- ── Comptes (profil applicatif lié à auth.users) ───────────────────────────
-- L'identité/mot de passe vit dans auth.users (Supabase Auth, email synthétisé
-- login.codeecole@edugest.app). Cette table porte le rôle et le périmètre.
create table if not exists comptes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid unique references auth.users(id) on delete cascade,
  -- nullable : le superadmin est transversal (aucune école). Voir superadmin.sql / rls.sql.
  ecole_id        uuid references ecoles(id) on delete cascade,
  login           text not null,
  role            role_compte not null,
  nom             text,
  label           text,
  section         section_scolaire,
  sections        section_scolaire[] default '{}',
  enseignant_id   uuid,                                -- → enseignants.id (si rôle enseignant)
  enseignant_nom  text,
  matiere         text,                                -- matière du prof (secondaire)
  statut          text default 'Actif',
  premiere_co     boolean default true,
  extra           jsonb default '{}'::jsonb,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique (ecole_id, login)
);
create index if not exists idx_comptes_ecole on comptes(ecole_id);
create index if not exists idx_comptes_user  on comptes(user_id);

-- ── Enseignants (registre, ex. ensPrimaire/ensCollege/ensLycee) ────────────
create table if not exists enseignants (
  id            uuid primary key default gen_random_uuid(),
  ecole_id      uuid not null references ecoles(id) on delete cascade,
  section       section_scolaire not null,
  nom           text,
  prenom        text,
  matiere       text,
  classe_title  text,                                  -- classe dont il est TITULAIRE
  contact       text,
  statut        text default 'Actif',
  extra         jsonb default '{}'::jsonb,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
create index if not exists idx_ens_ecole_section on enseignants(ecole_id, section);

-- ── Classes ────────────────────────────────────────────────────────────────
create table if not exists classes (
  id            uuid primary key default gen_random_uuid(),
  ecole_id      uuid not null references ecoles(id) on delete cascade,
  section       section_scolaire not null,
  nom           text not null,
  effectif      int default 0,
  enseignant    text,                                  -- nom du titulaire (compat)
  enseignant_id uuid references enseignants(id) on delete set null,
  salle         text,
  extra         jsonb default '{}'::jsonb,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique (ecole_id, section, nom)
);
create index if not exists idx_classes_ecole_section on classes(ecole_id, section);

-- ── Matières (coefficients, classes concernées) ────────────────────────────
create table if not exists matieres (
  id            uuid primary key default gen_random_uuid(),
  ecole_id      uuid not null references ecoles(id) on delete cascade,
  section       section_scolaire not null,
  nom           text not null,
  coefficient   numeric default 1,
  classes       text[] default '{}',                   -- vide = s'applique à toutes
  extra         jsonb default '{}'::jsonb,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique (ecole_id, section, nom)
);
create index if not exists idx_matieres_ecole_section on matieres(ecole_id, section);

-- ── Élèves ─────────────────────────────────────────────────────────────────
create table if not exists eleves (
  id              uuid primary key default gen_random_uuid(),
  ecole_id        uuid not null references ecoles(id) on delete cascade,
  section         section_scolaire not null,
  nom             text,
  prenom          text,
  sexe            text check (sexe in ('M','F') or sexe is null),
  matricule       text,
  ien             text,                                -- matricule national
  classe          text,
  date_naissance  text,
  lieu_naissance  text,
  filiation       text,
  tuteur          text,
  contact_tuteur  text,
  domicile        text,
  photo           text,
  statut          text default 'Actif',
  extra           jsonb default '{}'::jsonb,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index if not exists idx_eleves_ecole_section on eleves(ecole_id, section);
create index if not exists idx_eleves_classe on eleves(ecole_id, section, classe);
create index if not exists idx_eleves_ien on eleves(ecole_id, ien);

-- ── Notes ──────────────────────────────────────────────────────────────────
create table if not exists notes (
  id              uuid primary key default gen_random_uuid(),
  ecole_id        uuid not null references ecoles(id) on delete cascade,
  section         section_scolaire not null,
  eleve_id        uuid not null references eleves(id) on delete cascade,
  matiere         text not null,
  type            text not null,                       -- Devoir, Composition, Oral…
  periode         text not null,                       -- T1, S1, M1…
  note            numeric not null,
  annee           text not null,                       -- "2025-2026"
  enseignant_id   uuid,
  enseignant_nom  text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index if not exists idx_notes_eleve on notes(eleve_id);
create index if not exists idx_notes_scope on notes(ecole_id, section, annee, periode);
create index if not exists idx_notes_matiere on notes(ecole_id, section, matiere);

-- ── Incidents (absences / retards / discipline) ────────────────────────────
create table if not exists absences (
  id              uuid primary key default gen_random_uuid(),
  ecole_id        uuid not null references ecoles(id) on delete cascade,
  section         section_scolaire not null,
  eleve_id        uuid not null references eleves(id) on delete cascade,
  type            text not null,                       -- Absence, Retard, Sanction…
  date            text,
  justifie        text default 'Non',
  motif           text,
  matiere         text,
  signale_par_id  uuid,                                -- enseignant signaleur
  signale_par_nom text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index if not exists idx_absences_eleve on absences(eleve_id);

-- ── Emplois du temps ───────────────────────────────────────────────────────
create table if not exists emplois (
  id            uuid primary key default gen_random_uuid(),
  ecole_id      uuid not null references ecoles(id) on delete cascade,
  section       section_scolaire not null,
  classe        text,
  jour          text,
  heure_debut   text,
  heure_fin     text,
  matiere       text,
  enseignant    text,
  salle         text,
  extra         jsonb default '{}'::jsonb,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
create index if not exists idx_emplois_ecole_section on emplois(ecole_id, section);

-- ── Cahier de textes / enseignements ───────────────────────────────────────
create table if not exists enseignements (
  id              uuid primary key default gen_random_uuid(),
  ecole_id        uuid not null references ecoles(id) on delete cascade,
  section         section_scolaire not null,
  classe          text,
  matiere         text,
  enseignant_nom  text,
  date            bigint,                              -- epoch ms (compat)
  contenu         text,
  extra           jsonb default '{}'::jsonb,
  created_at      timestamptz default now()
);
create index if not exists idx_enseignements_ecole_section on enseignements(ecole_id, section);

-- ── Appréciations (conseil de classe) ──────────────────────────────────────
create table if not exists appreciations (
  id            uuid primary key default gen_random_uuid(),
  ecole_id      uuid not null references ecoles(id) on delete cascade,
  section       section_scolaire not null,
  eleve_id      uuid not null references eleves(id) on delete cascade,
  periode       text not null,
  texte         text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique (eleve_id, periode)
);

-- ── Comptabilité : paiements de scolarité ──────────────────────────────────
create table if not exists paiements (
  id            uuid primary key default gen_random_uuid(),
  ecole_id      uuid not null references ecoles(id) on delete cascade,
  eleve_id      uuid not null references eleves(id) on delete cascade,
  mois          text,                                  -- ex. "Octobre" / "Inscription"
  statut        text default 'Impayé',                 -- Payé / Impayé
  montant       numeric default 0,
  date_paiement text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
create index if not exists idx_paiements_eleve on paiements(eleve_id);

-- ── Tarifs par classe ──────────────────────────────────────────────────────
create table if not exists tarifs (
  id            uuid primary key default gen_random_uuid(),
  ecole_id      uuid not null references ecoles(id) on delete cascade,
  section       section_scolaire,
  classe        text not null,
  montant       numeric default 0,
  extra         jsonb default '{}'::jsonb,
  unique (ecole_id, classe)
);

-- ── Salaires / fiches de paie ──────────────────────────────────────────────
create table if not exists salaires (
  id            uuid primary key default gen_random_uuid(),
  ecole_id      uuid not null references ecoles(id) on delete cascade,
  nom           text,                                  -- enseignant/personnel
  section       text,
  mois          text,
  montant_net   numeric default 0,
  details       jsonb default '{}'::jsonb,             -- primes, heures, bons, révisions…
  created_at    timestamptz default now()
);
create index if not exists idx_salaires_ecole on salaires(ecole_id);

-- ── Parents ↔ élèves (un parent peut suivre plusieurs enfants) ─────────────
create table if not exists parent_eleves (
  compte_id  uuid not null references comptes(id) on delete cascade,
  eleve_id   uuid not null references eleves(id) on delete cascade,
  primary key (compte_id, eleve_id)
);

-- ── Audit / historique (traces inaltérables) ───────────────────────────────
create table if not exists audit (
  id            uuid primary key default gen_random_uuid(),
  ecole_id      uuid not null references ecoles(id) on delete cascade,
  action        text not null,
  auteur        jsonb default '{}'::jsonb,
  cible         jsonb default '{}'::jsonb,
  details       jsonb default '{}'::jsonb,
  created_at    timestamptz default now()
);
create index if not exists idx_audit_ecole on audit(ecole_id, created_at);

-- updated_at automatique ----------------------------------------------------
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

do $$
declare t text;
begin
  for t in select unnest(array[
    'ecoles','comptes','enseignants','classes','matieres','eleves',
    'notes','absences','emplois','appreciations','paiements'])
  loop
    execute format(
      'drop trigger if exists trg_updated_at on %I;
       create trigger trg_updated_at before update on %I
       for each row execute function set_updated_at();', t, t);
  end loop;
end $$;
