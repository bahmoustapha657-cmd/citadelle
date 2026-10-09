-- 20261009113003_paiement_en_ligne.sql
-- Pourquoi : les parents doivent pouvoir payer la scolarité par Mobile Money
-- (Orange Money, MTN MoMo… via un agrégateur), et le paiement doit s'imputer
-- tout seul sur la fiche de l'élève, avec les règles de la caisse.
--
-- L'argent va sur le compte marchand de CHAQUE école (identifiants dans
-- paiement_config) : EduGest ne détient jamais de fonds. Le parent paie les
-- frais de l'opérateur en plus (frais_pourcent).
--
-- Tout s'écrit côté serveur (Edge Function `paiement`, service_role) : le
-- navigateur ne fait que LIRE les paiements, jamais les créer ni les valider.
--
-- Règles (docs/migrations-sql.md) :
--  - appliquée UNE fois, dans l'ordre, par la CI au déploiement — jamais à
--    la main dans l'éditeur SQL ;
--  - compatible avec le front encore en ligne (ajouter avant de retirer) ;
--  - ne jamais modifier une migration déjà fusionnée : en écrire une autre.

-- ── Configuration du paiement en ligne, par école ──────────────────────────
-- `identifiants` : clés du compte marchand (API key, site id, clé secrète de
-- signature). AUCUNE policy : ni lecture ni écriture depuis le navigateur,
-- seule la service_role (Edge Functions) y accède.
create table public.paiement_config (
  ecole_id uuid primary key references public.ecoles(id) on delete cascade,
  fournisseur text not null,
  mode text not null default 'test' check (mode in ('test', 'production')),
  actif boolean not null default false,
  frais_pourcent numeric not null default 0 check (frais_pourcent >= 0 and frais_pourcent <= 20),
  identifiants jsonb not null default '{}'::jsonb,
  modifie_par uuid references public.comptes(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_updated_at before update on public.paiement_config
  for each row execute function public.set_updated_at();
alter table public.paiement_config enable row level security;
revoke all on table public.paiement_config from anon, authenticated;

-- ── Paiements en ligne ─────────────────────────────────────────────────────
-- Un paiement naît « en_attente » quand le parent le lance, puis :
--   impute     : payé ET appliqué à la fiche (mois soldés, journal de caisse) ;
--   echoue     : refusé, annulé ou expiré chez l'opérateur — rien n'est dû ;
--   a_verifier : payé, mais impossible à appliquer tel quel (la caisse a
--                encaissé la même chose entre-temps…) — l'argent est reçu,
--                le comptable décide (affecter ailleurs ou rembourser).
-- `montant` : la part imputée sur la scolarité ; `frais` : les frais de
-- l'opérateur, payés en plus par le parent.
create table public.paiements_en_ligne (
  id uuid primary key default gen_random_uuid(),
  ecole_id uuid not null references public.ecoles(id) on delete cascade,
  eleve_id uuid not null references public.eleves(id) on delete cascade,
  reference text not null unique,
  fournisseur text not null,
  annee text not null,
  cible jsonb not null,
  montant numeric not null check (montant > 0),
  frais numeric not null default 0 check (frais >= 0),
  devise text not null default 'GNF',
  statut text not null default 'en_attente'
    check (statut in ('en_attente', 'impute', 'echoue', 'a_verifier')),
  lien text,
  initie_par uuid references public.comptes(id) on delete set null,
  detail jsonb not null default '{}'::jsonb,
  confirme_le timestamptz,
  impute_le timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_paiements_en_ligne_ecole on public.paiements_en_ligne (ecole_id, created_at desc);
create index idx_paiements_en_ligne_eleve on public.paiements_en_ligne (eleve_id, created_at desc);
create trigger trg_updated_at before update on public.paiements_en_ligne
  for each row execute function public.set_updated_at();
alter table public.paiements_en_ligne enable row level security;
revoke all on table public.paiements_en_ligne from anon, authenticated;
grant select on table public.paiements_en_ligne to authenticated;

-- Lecture : un parent, les paiements de ses enfants ; le personnel qui voit
-- la comptabilité, ceux de l'école. Aucune écriture depuis le navigateur.
create policy paiements_en_ligne_select on public.paiements_en_ligne
  for select to authenticated
  using (
    ecole_id = public.auth_ecole_id()
    and (
      (public.auth_role() = 'parent' and eleve_id in (select public.my_eleve_ids()))
      or (public.auth_role() <> 'parent' and public.has_module_read('compta'))
    )
  );
create policy paiements_en_ligne_superadmin on public.paiements_en_ligne
  to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

-- ── Imputation atomique ────────────────────────────────────────────────────
-- Applique un paiement confirmé en UNE transaction : fiche élève (fusion des
-- clés de `extra` calculées par les règles de la caisse), lignes du journal
-- des encaissements, trace dans l'historique, statut « impute ».
--   • verrou sur le paiement : deux confirmations simultanées (notification
--     de l'opérateur + retour du parent) n'imputent qu'une fois ;
--   • fiche relue : `p_eleve_maj` est le updated_at sur lequel le calcul a
--     été fait. Si la fiche a changé depuis (encaissement en caisse, saisie
--     hors ligne remontée), rien n'est écrit et l'appelant recalcule.
-- Renvoie 'impute', 'deja_traite' (statut déjà final) ou 'conflit'.
create or replace function public.imputer_paiement_en_ligne(
  p_paiement uuid,
  p_eleve_maj timestamptz,
  p_extra jsonb,
  p_journal jsonb,
  p_historique jsonb,
  p_detail jsonb default '{}'::jsonb
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paiement paiements_en_ligne%rowtype;
  v_lignes int;
begin
  select * into v_paiement from paiements_en_ligne where id = p_paiement for update;
  if not found then
    raise exception 'Paiement en ligne introuvable : %', p_paiement;
  end if;
  if v_paiement.statut <> 'en_attente' then
    return 'deja_traite';
  end if;

  update eleves
     set extra = coalesce(extra, '{}'::jsonb) || coalesce(p_extra, '{}'::jsonb)
   where id = v_paiement.eleve_id
     and ecole_id = v_paiement.ecole_id
     and updated_at = p_eleve_maj;
  get diagnostics v_lignes = row_count;
  if v_lignes = 0 then
    return 'conflit';
  end if;

  insert into paiements (id, ecole_id, eleve_id, annee, type, statut, mois, libelle,
                         montant, date_paiement, eleve_nom, classe, auteur, extra)
  select coalesce(l.id, gen_random_uuid()), v_paiement.ecole_id, v_paiement.eleve_id,
         l.annee, l.type, coalesce(l.statut, 'encaisse'), l.mois, l.libelle,
         l.montant, l.date_paiement, l.eleve_nom, l.classe, l.auteur, coalesce(l.extra, '{}'::jsonb)
    from jsonb_to_recordset(coalesce(p_journal, '[]'::jsonb)) as l(
      id uuid, annee text, type text, statut text, mois text, libelle text, montant numeric,
      date_paiement text, eleve_nom text, classe text, auteur text, extra jsonb);

  if p_historique is not null then
    insert into historique (ecole_id, extra) values (v_paiement.ecole_id, p_historique);
  end if;

  update paiements_en_ligne
     set statut = 'impute',
         confirme_le = coalesce(confirme_le, now()),
         impute_le = now(),
         detail = detail || coalesce(p_detail, '{}'::jsonb)
   where id = p_paiement;
  return 'impute';
end;
$$;

revoke all on function public.imputer_paiement_en_ligne(uuid, timestamptz, jsonb, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.imputer_paiement_en_ligne(uuid, timestamptz, jsonb, jsonb, jsonb, jsonb)
  to service_role;
