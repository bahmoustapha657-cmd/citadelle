-- 20261010180543_presences_personnel.sql
-- Pourquoi : les absences et retards du personnel (enseignants, personnel
-- administratif) n'étaient suivis nulle part, sauf les heures « Absent » du
-- secondaire ; aucune retenue possible sur un salaire au forfait. Nouvelle
-- table `presences` (registre du module Comptabilité, même forme et mêmes
-- droits que `bons`) + réglages de calcul de la retenue, modifiables par la
-- comptabilité via maj_reglages_compta.
--
-- Règles (docs/migrations-sql.md) :
--  - appliquée UNE fois, dans l'ordre, par la CI au déploiement — jamais à
--    la main dans l'éditeur SQL ;
--  - compatible avec le front encore en ligne (ajouter avant de retirer) ;
--  - ne jamais modifier une migration déjà fusionnée : en écrire une autre.

-- ── Registre ────────────────────────────────────────────────────────────────
-- Une ligne = un fait (absence, retard, permission…) d'un agent à une date.
-- Le détail (agent, type, durée, décision) vit dans `extra`, comme les bons.
create table public.presences (
  id uuid default gen_random_uuid() not null primary key,
  ecole_id uuid not null references public.ecoles(id) on delete cascade,
  annee text,
  date text,
  extra jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table only public.presences replica identity full;
create index idx_presences_ecole on public.presences using btree (ecole_id, annee);

create trigger trg_presences_updated before update on public.presences
  for each row execute function public.set_updated_at();
create trigger trg_garde_ecriture_ecole before insert or delete or update on public.presences
  for each statement execute function public.garde_ecriture_ecole();

-- Mêmes droits que les autres grands livres de la compta (bons, dépenses…).
alter table public.presences enable row level security;
create policy presences_select on public.presences for select to authenticated
  using (ecole_id = public.auth_ecole_id() and public.has_module_read('compta'));
create policy presences_superadmin on public.presences to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());
create policy presences_write on public.presences to authenticated
  using (ecole_id = public.auth_ecole_id() and public.has_module_write('compta'))
  with check (ecole_id = public.auth_ecole_id() and public.has_module_write('compta'));

grant select, insert, update, delete on table public.presences to authenticated;
grant all on table public.presences to service_role;
grant select on table public.presences to powersync_role;

-- Miroir hors ligne (bucket compta_data) et temps réel, comme `bons`.
alter publication powersync add table only public.presences;
alter publication supabase_realtime add table only public.presences;

-- ── Réglages de la retenue ─────────────────────────────────────────────────
-- Nouvelle clé `reglagesPresences` : { joursTravail: [1..6] (lundi = 1),
-- retardsParDemiJournee: 1..20 }. Le reste de la fonction est inchangé.
create or replace function public.maj_reglages_compta(p_champs jsonb) returns jsonb
    language plpgsql security definer
    set search_path to 'public'
    as $$
declare
  v_cle   text;
  v_patch jsonb := '{}'::jsonb;
  v_val   jsonb;
  v_jours jsonb;
  v_ret   jsonb;
begin
  -- Même autorité que les tables de compta (postes.sql § 9).
  if not has_module_write('compta') then
    raise exception 'Droits insuffisants : réservé à la comptabilité.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_champs) is distinct from 'object' or p_champs = '{}'::jsonb then
    raise exception 'Aucun réglage à enregistrer.';
  end if;

  for v_cle in select jsonb_object_keys(p_champs) loop
    case v_cle
      when 'blocageParentImpaye' then
        if jsonb_typeof(p_champs -> v_cle) <> 'boolean' then
          raise exception 'blocageParentImpaye : vrai ou faux attendu.';
        end if;
        v_patch := v_patch || jsonb_build_object(v_cle, p_champs -> v_cle);
      -- Mêmes bornes que l'écran (liste, ou « Autre… » limité à 5
      -- caractères) et même forme que normaliserMonnaie (parametres-api.js).
      when 'monnaie' then
        if jsonb_typeof(p_champs -> v_cle) <> 'string'
           or char_length(btrim(p_champs ->> v_cle)) not between 1 and 5 then
          raise exception 'Monnaie invalide (1 à 5 caractères).';
        end if;
        v_patch := v_patch || jsonb_build_object(v_cle, upper(btrim(p_champs ->> v_cle)));
      -- Jours travaillés (1 = lundi … 6 = samedi, au moins un) et nombre de
      -- retards valant une demi-journée d'absence.
      when 'reglagesPresences' then
        v_val := p_champs -> v_cle;
        v_jours := v_val -> 'joursTravail';
        v_ret := v_val -> 'retardsParDemiJournee';
        if jsonb_typeof(v_val) <> 'object'
           or jsonb_typeof(v_jours) <> 'array'
           or jsonb_array_length(v_jours) = 0
           or exists (select 1 from jsonb_array_elements(v_jours) j
                      where jsonb_typeof(j) <> 'number' or (j #>> '{}') !~ '^[1-6]$')
           or jsonb_typeof(v_ret) <> 'number'
           or (v_ret #>> '{}') !~ '^[0-9]+$'
           or (v_ret #>> '{}')::int not between 1 and 20 then
          raise exception 'Réglages des présences invalides.';
        end if;
        v_patch := v_patch || jsonb_build_object(v_cle, jsonb_build_object(
          'joursTravail', (select jsonb_agg(distinct (j #>> '{}')::int order by (j #>> '{}')::int)
                           from jsonb_array_elements(v_jours) j),
          'retardsParDemiJournee', (v_ret #>> '{}')::int));
      else
        raise exception 'Réglage « % » non modifiable depuis la comptabilité.', v_cle
          using errcode = '42501';
    end case;
  end loop;

  -- L'école de l'APPELANT, jamais un paramètre : aucune autre école visable.
  update ecoles set extra = coalesce(extra, '{}'::jsonb) || v_patch
   where id = auth_ecole_id();
  if not found then
    raise exception 'École introuvable.';
  end if;
  return v_patch;
end $$;

-- CREATE OR REPLACE garde les droits existants ; on les réaffirme quand même
-- (cf. piège EXECUTE à PUBLIC des fonctions SECURITY DEFINER).
revoke all on function public.maj_reglages_compta(jsonb) from public;
grant execute on function public.maj_reglages_compta(jsonb) to authenticated;
grant execute on function public.maj_reglages_compta(jsonb) to service_role;
