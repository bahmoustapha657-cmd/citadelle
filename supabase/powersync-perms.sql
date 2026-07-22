-- ════════════════════════════════════════════════════════════════════════
--  PowerSync — permissions dénormalisées sur `comptes` (hors ligne total)
-- ════════════════════════════════════════════════════════════════════════
-- Les Parameter Queries PowerSync ne lisent qu'UNE table (pas de JOIN, pas
-- de jsonb) : impossible de gate les buckets par postes.permissions (jsonb
-- sur une autre table). On dénormalise donc les permissions de LECTURE par
-- module en colonnes booléennes sur `comptes`, maintenues par trigger —
-- miroir exact de my_permissions() (postes.sql) et de
-- legacyPermissionsForRole (shared/postes-config.js).
--
-- À exécuter APRÈS rls.sql → teacher-security.sql → postes.sql →
-- powersync-scope.sql. Idempotent (re-run sans danger).
--
-- Sécurité : un client qui tenterait d'écrire perm_* directement est
-- neutralisé — le trigger BEFORE recalcule TOUJOURS ces colonnes depuis le
-- poste/rôle, quelle que soit la valeur soumise (self-healing).

-- ── 1. Colonnes ─────────────────────────────────────────────────────────────
alter table comptes add column if not exists perm_compta      boolean not null default false;
alter table comptes add column if not exists perm_calendrier  boolean not null default false;
alter table comptes add column if not exists perm_examens     boolean not null default false;
alter table comptes add column if not exists perm_messages    boolean not null default false;
alter table comptes add column if not exists perm_fondation   boolean not null default false;
alter table comptes add column if not exists perm_historique  boolean not null default false;
alter table comptes add column if not exists perm_admin_panel boolean not null default false;

-- ── 2. Recalcul (BEFORE INSERT/UPDATE sur comptes) ──────────────────────────
create or replace function powersync_perms_compute() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  p jsonb := null;
begin
  -- Permissions du poste (si rattaché et actif) ; poste inactif = aucun accès.
  if new.poste_id is not null then
    select case when actif then permissions else '{}'::jsonb end
      into p from postes where id = new.poste_id;
  end if;

  if new.role in ('direction', 'superadmin') then
    -- Super-poste : toujours tout (garde-fou anti-verrouillage, cf. postes.sql).
    new.perm_compta      := true;
    new.perm_calendrier  := true;
    new.perm_examens     := true;
    new.perm_messages    := true;
    new.perm_fondation   := true;
    new.perm_historique  := true;
    new.perm_admin_panel := true;
  elsif p is not null then
    -- Compte à poste : lecture = 'lecture' ou 'ecriture' dans la carte.
    new.perm_compta      := coalesce(p->>'compta'      in ('lecture','ecriture'), false);
    new.perm_calendrier  := coalesce(p->>'calendrier'  in ('lecture','ecriture'), false);
    new.perm_examens     := coalesce(p->>'examens'     in ('lecture','ecriture'), false);
    new.perm_messages    := coalesce(p->>'messages'    in ('lecture','ecriture'), false);
    new.perm_fondation   := coalesce(p->>'fondation'   in ('lecture','ecriture'), false);
    new.perm_historique  := coalesce(p->>'historique'  in ('lecture','ecriture'), false);
    new.perm_admin_panel := coalesce(p->>'admin_panel' in ('lecture','ecriture'), false);
  else
    -- Repli legacy (poste_id null) : capacités de lecture historiques du rôle
    -- enum — MÊME mapping que legacyPermissionsForRole (postes-config.js).
    new.perm_compta      := new.role in ('admin', 'comptable');
    new.perm_calendrier  := new.role in ('admin', 'surveillant', 'primaire', 'college');
    new.perm_examens     := new.role in ('admin', 'primaire', 'college');
    new.perm_messages    := new.role in ('admin');
    new.perm_fondation   := false;
    new.perm_historique  := new.role in ('admin');
    new.perm_admin_panel := new.role in ('admin');
  end if;
  return new;
end; $$;

drop trigger if exists trg_powersync_perms on comptes;
create trigger trg_powersync_perms before insert or update on comptes
  for each row execute function powersync_perms_compute();

-- ── 3. Propagation : modifier un poste recalcule ses comptes ────────────────
create or replace function powersync_perms_propagate() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  -- Touch no-op : déclenche trg_powersync_perms sur chaque compte du poste.
  update comptes set poste_id = poste_id where poste_id = new.id;
  return new;
end; $$;

drop trigger if exists trg_powersync_perms_propagate on postes;
create trigger trg_powersync_perms_propagate
  after update of permissions, actif on postes
  for each row execute function powersync_perms_propagate();

-- ── 4. Backfill (recalcule tous les comptes existants) ──────────────────────
update comptes set poste_id = poste_id;

-- Contrôle rapide : répartition des permissions par rôle.
select role, count(*) as n,
       count(*) filter (where perm_compta)      as compta,
       count(*) filter (where perm_calendrier)  as calendrier,
       count(*) filter (where perm_examens)     as examens,
       count(*) filter (where perm_messages)    as messages,
       count(*) filter (where perm_fondation)   as fondation,
       count(*) filter (where perm_historique)  as historique,
       count(*) filter (where perm_admin_panel) as admin_panel
from comptes group by role order by role;
