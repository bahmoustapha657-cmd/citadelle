-- ════════════════════════════════════════════════════════════════════════
--  EduGest — Transferts d'élèves entre écoles   [delta]
-- ════════════════════════════════════════════════════════════════════════
-- À exécuter dans Supabase → SQL Editor (après rls.sql). Idempotent.
-- Flux par TOKEN (capability) : l'école A génère un token + snapshot élève ;
-- l'école B (autre école) vérifie le token puis accepte → l'élève est créé chez
-- elle. Le token (uuid imprévisible) autorise la lecture cross-école ; on passe
-- par des fonctions SECURITY DEFINER pour ne pas exposer la table en lecture
-- globale.
--
-- v2 (2026-09-24) — rejouer ce fichier en entier :
--  • l'élève accueilli ne reçoit que son IDENTITÉ. L'instantané entier partait
--    dans `extra`, qui prime sur les colonnes à la lecture : l'élève arrivait
--    « Transféré » chez sa nouvelle école, avec les mois payés, les dispenses
--    et l'historique de l'ancienne ;
--  • validité de 30 jours, annoncée à l'écran mais jamais appliquée ;
--  • une école n'accueille pas son propre transfert ;
--  • classe et matricule sont choisis par l'école d'accueil (ses classes et
--    sa numérotation ne sont pas celles de l'école d'origine) ;
--  • EXECUTE retiré à PUBLIC/anon : seules les sessions connectées appellent.

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

-- ── Vérifier un token (cross-école) → renvoie le snapshot s'il est valable ──
create or replace function transfert_verifier(p_token uuid)
  returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
           'eleveSnapshot', eleve_snapshot,
           'ecoleDestination', ecole_destination,
           'statut', statut,
           'expireLe', created_at + interval '30 days')
  from transferts
  where token = p_token and statut = 'en_attente'
    and created_at > now() - interval '30 days';
$$;
revoke execute on function transfert_verifier(uuid) from public, anon;
grant execute on function transfert_verifier(uuid) to authenticated;

-- ── Accepter un token → crée l'élève dans l'école de l'appelant ────────────
-- v1 n'avait que (p_token) : la retirer, sinon l'appel à un seul argument
-- serait ambigu entre les deux signatures.
drop function if exists transfert_accepter(uuid);
create or replace function transfert_accepter(p_token uuid, p_classe text default null, p_matricule text default null)
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
  if t.created_at <= now() - interval '30 days' then
    return jsonb_build_object('error', 'Token expiré (validité 30 jours) : demandez-en un nouveau à l''école d''origine.');
  end if;
  if t.ecole_source_id = auth_ecole_id() then
    return jsonb_build_object('error', 'Ce transfert vient de votre propre école.');
  end if;
  snap := t.eleve_snapshot;
  if coalesce(snap->>'section', '') = '' then
    return jsonb_build_object('error', 'Dossier de transfert incomplet (section manquante).');
  end if;

  -- L'identité seule, dans ses colonnes. Scolarité, paiements, dispenses,
  -- départ et historique restent à l'école d'origine : l'élève arrive neuf,
  -- inscrit comme tout élève venu d'ailleurs (réinscription + établissement
  -- d'origine), daté de ce jour.
  insert into eleves (
    ecole_id, section, nom, prenom, sexe, matricule, ien, classe,
    date_naissance, lieu_naissance, filiation, tuteur, contact_tuteur, domicile, photo,
    statut, extra
  )
  values (
    auth_ecole_id(),
    (snap->>'section')::section_scolaire,
    snap->>'nom', snap->>'prenom',
    case when snap->>'sexe' in ('M', 'F') then snap->>'sexe' end,
    coalesce(nullif(trim(p_matricule), ''), snap->>'matricule'),
    snap->>'ien',
    coalesce(nullif(trim(p_classe), ''), snap->>'classe'),
    snap->>'dateNaissance', snap->>'lieuNaissance', snap->>'filiation',
    snap->>'tuteur', snap->>'contactTuteur', snap->>'domicile', snap->>'photo',
    'Actif',
    jsonb_strip_nulls(jsonb_build_object(
      'typeInscription', 'Réinscription',
      'etablissementOrigine', snap->>'schoolNom',
      'dateArrivee', to_char(current_date, 'YYYY-MM-DD')
    ))
  )
  returning id into new_id;

  update transferts set statut = 'accepte', accepted_eleve_id = new_id where id = t.id;
  return jsonb_build_object('ok', true, 'eleveId', new_id);
end; $$;
revoke execute on function transfert_accepter(uuid, text, text) from public, anon;
grant execute on function transfert_accepter(uuid, text, text) to authenticated;
