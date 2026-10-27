-- 20261027171600_paie_enseignants.sql
-- Pourquoi : la paie des enseignants (forfait mensuel, prime horaire, primes
-- par classe) vit dans `enseignants.extra`, que TOUT compte de l'école lit
-- (policy enseignants_select) — chefs de section compris, par l'API comme
-- dans le miroir hors ligne. Elle doit être réservée à la Comptabilité.
--
-- PHASE 1 (cette migration) : nouvelle table `paie_enseignants`, lisible et
-- modifiable par la seule Comptabilité, remplie avec la paie existante, puis
-- tenue à jour par un déclencheur : la Comptabilité continue d'enregistrer la
-- paie sur la fiche enseignant (anciens écrans encore ouverts compris), et la
-- fiche se recopie dans la table. Le nouveau front lit la paie dans la table.
-- PHASE 2 (migration suivante, une fois ce front en ligne et les règles
-- PowerSync redéployées) : effacer la paie de `enseignants.extra`, et le
-- déclencheur la DÉPLACE au lieu de la recopier. C'est elle qui ferme l'accès.
--
-- Règles (docs/migrations-sql.md) :
--  - appliquée UNE fois, dans l'ordre, par la CI au déploiement — jamais à
--    la main dans l'éditeur SQL ;
--  - compatible avec le front encore en ligne (ajouter avant de retirer) ;
--  - ne jamais modifier une migration déjà fusionnée : en écrire une autre.

-- ── Clés de paie d'une fiche enseignant ────────────────────────────────────
-- Miroir de CLES_PAIE_ENSEIGNANT (src/paie-enseignants.js) : forfait (primaire
-- et maternelle), prime horaire et primes par classe (secondaire), plus deux
-- anciens noms du forfait encore lus par le calcul des salaires.
create or replace function public.paie_enseignant_extraire(p_extra jsonb) returns jsonb
    language sql immutable
    set search_path to 'public'
    as $$
  select coalesce(jsonb_object_agg(cle, p_extra -> cle), '{}'::jsonb)
    from unnest(array['montantForfait', 'salaireBase', 'forfait', 'primeHoraire', 'primeParClasse']) as cle
   where p_extra ? cle;
$$;

revoke all on function public.paie_enseignant_extraire(jsonb) from public, anon, authenticated;
grant execute on function public.paie_enseignant_extraire(jsonb) to service_role;

-- ── Table ──────────────────────────────────────────────────────────────────
-- Une ligne par enseignant, de MÊME id que sa fiche ; la paie dans `extra`.
-- La clé étrangère (id, ecole_id) interdit de rattacher une paie à
-- l'enseignant d'une autre école. Différée : la phase 2 écrira la paie d'un
-- enseignant pendant l'insertion même de sa fiche.
alter table public.enseignants
  add constraint enseignants_id_ecole_key unique (id, ecole_id);

create table public.paie_enseignants (
  id uuid not null primary key,
  ecole_id uuid not null references public.ecoles(id) on delete cascade,
  extra jsonb default '{}'::jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint paie_enseignants_enseignant_fkey foreign key (id, ecole_id)
    references public.enseignants (id, ecole_id) on delete cascade
    deferrable initially deferred
);

alter table only public.paie_enseignants replica identity full;
create index idx_paie_enseignants_ecole on public.paie_enseignants using btree (ecole_id);

create trigger trg_paie_enseignants_updated before update on public.paie_enseignants
  for each row execute function public.set_updated_at();
create trigger trg_garde_ecriture_ecole before insert or delete or update on public.paie_enseignants
  for each statement execute function public.garde_ecriture_ecole();

-- Mêmes droits que les fiches de paie (`salaires`) : la Comptabilité seule.
alter table public.paie_enseignants enable row level security;
create policy paie_enseignants_select on public.paie_enseignants for select to authenticated
  using (ecole_id = public.auth_ecole_id() and public.has_module_read('compta'));
create policy paie_enseignants_superadmin on public.paie_enseignants to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());
create policy paie_enseignants_write on public.paie_enseignants to authenticated
  using (ecole_id = public.auth_ecole_id() and public.has_module_write('compta'))
  with check (ecole_id = public.auth_ecole_id() and public.has_module_write('compta'));

grant select, insert, update, delete on table public.paie_enseignants to authenticated;
grant all on table public.paie_enseignants to service_role;
grant select on table public.paie_enseignants to powersync_role;

-- Miroir hors ligne (bucket compta_data) et temps réel, comme `salaires`.
alter publication powersync add table only public.paie_enseignants;
alter publication supabase_realtime add table only public.paie_enseignants;

-- ── Reprise de la paie existante ───────────────────────────────────────────
-- Recopie seulement : les fiches enseignants ne sont pas modifiées ici.
insert into public.paie_enseignants (id, ecole_id, extra)
select id, ecole_id, public.paie_enseignant_extraire(extra)
  from public.enseignants
 where extra ?| array['montantForfait', 'salaireBase', 'forfait', 'primeHoraire', 'primeParClasse']
on conflict (id) do nothing;

-- ── Recopie continue (phase 1) ─────────────────────────────────────────────
-- Toute paie écrite sur une fiche enseignant par la Comptabilité (ou par le
-- serveur : service_role, SQL) est recopiée dans la table. Celle qu'un autre
-- compte y écrirait (un chef de section qui réenregistre la fiche) est
-- ignorée : seule la Comptabilité fixe la paie.
create or replace function public.paie_enseignant_recopier() returns trigger
    language plpgsql security definer
    set search_path to 'public'
    as $$
declare
  v_paie jsonb;
begin
  v_paie := paie_enseignant_extraire(new.extra);
  if v_paie = '{}'::jsonb then return null; end if;
  if tg_op = 'UPDATE' and v_paie = paie_enseignant_extraire(old.extra) then return null; end if;
  if coalesce(auth.role(), 'service_role') = 'authenticated' and not has_module_write('compta') then
    return null;
  end if;
  insert into paie_enseignants (id, ecole_id, extra) values (new.id, new.ecole_id, v_paie)
  on conflict (id) do update set extra = paie_enseignants.extra || excluded.extra;
  return null;
end $$;

revoke all on function public.paie_enseignant_recopier() from public, anon, authenticated;
grant execute on function public.paie_enseignant_recopier() to service_role;

create trigger trg_paie_enseignant_recopier after insert or update of extra on public.enseignants
  for each row execute function public.paie_enseignant_recopier();
