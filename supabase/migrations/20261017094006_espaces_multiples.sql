-- 20261017094006_espaces_multiples.sql
-- Pourquoi : une même personne peut être à la fois enseignant, parent d'élève
-- et membre du personnel. Elle avait trois comptes sans lien, trois
-- identifiants, trois mots de passe. Les comptes d'une même personne sont
-- désormais RELIÉS (même personne_id) : connectée sur l'un, elle passe aux
-- autres sans mot de passe (Edge account-manage, action changer_espace).
-- Chaque compte garde son rôle et ses droits : la RLS n'est pas touchée.
--
-- SÉCURITÉ — personne_id ouvre l'accès aux comptes reliés. Il ne s'écrit
-- QUE par l'Edge Function (service_role), qui vérifie que c'est la Direction
-- qui relie. Sans la garde ci-dessous, un utilisateur aurait pu se relier
-- lui-même au compte d'un autre (comptes_write autorise la mise à jour de son
-- propre compte, et le personnel celle des comptes parents/enseignants).
--
-- Règles (docs/migrations-sql.md) :
--  - appliquée UNE fois, dans l'ordre, par la CI au déploiement — jamais à
--    la main dans l'éditeur SQL ;
--  - compatible avec le front encore en ligne (ajouter avant de retirer) ;
--  - ne jamais modifier une migration déjà fusionnée : en écrire une autre.

alter table public.comptes add column if not exists personne_id uuid;

create index if not exists idx_comptes_ecole_personne
  on public.comptes (ecole_id, personne_id) where personne_id is not null;

-- Garde : personne_id n'est posé ou changé que par le service_role (Edge).
-- Trigger distinct de comptes_guard, qu'on ne réécrit pas (cf. historique :
-- rejouer rls.sql avait rouvert une faille).
create or replace function public.comptes_personne_guard() returns trigger
    language plpgsql security definer
    set search_path to 'public'
    as $$
begin
  if coalesce(auth.role(), 'service_role') = 'service_role' then return new; end if;
  if tg_op = 'INSERT' then
    if new.personne_id is not null then
      raise exception 'Le lien entre comptes se pose depuis Comptes & Postes (Direction).';
    end if;
  elsif new.personne_id is distinct from old.personne_id then
    raise exception 'Le lien entre comptes se pose depuis Comptes & Postes (Direction).';
  end if;
  return new;
end; $$;

revoke all on function public.comptes_personne_guard() from public, anon, authenticated;

drop trigger if exists trg_comptes_personne_guard on public.comptes;
create trigger trg_comptes_personne_guard
  before insert or update on public.comptes
  for each row execute function public.comptes_personne_guard();

-- Espaces de la personne CONNECTÉE (son compte compris), pour le choix
-- d'espace. Rien avant connexion : on ne peut pas deviner qu'un numéro est à
-- la fois celui d'un enseignant et d'un parent. Comptes regroupés (fusion de
-- doublons parents) et postes désactivés exclus.
create or replace function public.mes_espaces()
returns table (id uuid, role public.role_compte, label text, nom text, login text, actuel boolean)
    language sql stable security definer
    set search_path to 'public'
    as $$
  with moi as (
    select c.id, c.ecole_id, c.personne_id from comptes c
    where c.user_id = auth.uid() and c.personne_id is not null
    limit 1
  )
  select c.id, c.role, coalesce(p.label, c.label, c.role::text), c.nom, c.login, c.id = moi.id
  from comptes c
  join moi on c.ecole_id = moi.ecole_id and c.personne_id = moi.personne_id
  left join postes p on p.id = c.poste_id
  where c.user_id is not null
    and coalesce(p.actif, true)
    and (c.extra ->> 'fusionneDans') is null
  order by c.id = moi.id desc, c.role;
$$;

revoke all on function public.mes_espaces() from public, anon;
grant execute on function public.mes_espaces() to authenticated, service_role;
