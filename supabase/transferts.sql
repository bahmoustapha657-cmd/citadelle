-- ════════════════════════════════════════════════════════════════════════
--  EduGest — Transferts d'élèves entre écoles   [delta]
-- ════════════════════════════════════════════════════════════════════════
-- À exécuter dans Supabase → SQL Editor (après rls.sql). Idempotent.
-- Flux par TOKEN (capability) : l'école A génère un token + snapshot élève ;
-- l'école B (autre école) vérifie le token puis accepte → l'élève est créé chez
-- elle. Le token (uuid imprévisible) autorise la lecture cross-école ; on passe
-- par des fonctions SECURITY DEFINER pour ne pas exposer la table en lecture
-- globale.

create table if not exists transferts (
  id                uuid primary key default gen_random_uuid(),
  token             uuid unique not null default gen_random_uuid(),
  ecole_source_id   uuid not null references ecoles(id) on delete cascade,
  ecole_destination text,                              -- info (code/nom saisi)
  eleve_snapshot    jsonb not null,
  statut            text default 'en_attente',         -- en_attente / accepte
  accepted_eleve_id uuid,
  created_at        timestamptz default now()
);
create index if not exists idx_transferts_source on transferts (ecole_source_id);

alter table transferts enable row level security;
-- L'école SOURCE gère ses propres transferts (génération + suivi).
drop policy if exists transferts_source on transferts;
create policy transferts_source on transferts for all to authenticated
  using (ecole_source_id = auth_ecole_id() and is_staff())
  with check (ecole_source_id = auth_ecole_id() and is_staff());
-- Superadmin : accès total.
drop policy if exists transferts_superadmin on transferts;
create policy transferts_superadmin on transferts for all to authenticated
  using (is_superadmin()) with check (is_superadmin());

-- ── Vérifier un token (cross-école) → renvoie le snapshot si en attente ─────
create or replace function transfert_verifier(p_token uuid)
  returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
           'eleveSnapshot', eleve_snapshot,
           'ecoleDestination', ecole_destination,
           'statut', statut)
  from transferts where token = p_token and statut = 'en_attente';
$$;
grant execute on function transfert_verifier(uuid) to authenticated;

-- ── Accepter un token → crée l'élève dans l'école de l'appelant ────────────
create or replace function transfert_accepter(p_token uuid)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t transferts%rowtype;
  snap jsonb;
  new_id uuid;
begin
  if not is_staff() then
    return jsonb_build_object('error', 'Droits insuffisants.');
  end if;
  select * into t from transferts where token = p_token and statut = 'en_attente' for update;
  if not found then
    return jsonb_build_object('error', 'Token introuvable ou déjà utilisé.');
  end if;
  snap := t.eleve_snapshot;

  insert into eleves (ecole_id, section, nom, prenom, sexe, matricule, ien, classe, statut, extra)
  values (
    auth_ecole_id(),
    (snap->>'section')::section_scolaire,
    snap->>'nom', snap->>'prenom', snap->>'sexe', snap->>'matricule', snap->>'ien',
    snap->>'classe', 'Actif',
    snap - '_id' - 'id'                                 -- évite d'écraser le nouvel _id
  )
  returning id into new_id;

  update transferts set statut = 'accepte', accepted_eleve_id = new_id where id = t.id;
  return jsonb_build_object('ok', true, 'eleveId', new_id);
end; $$;
grant execute on function transfert_accepter(uuid) to authenticated;
