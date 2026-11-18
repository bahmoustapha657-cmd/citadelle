-- 20261118100213_espace_enseignant.sql
-- Pourquoi : un enseignant seul peut désormais ouvrir son propre espace
-- EduGest, gratuit, sans que son école adopte le système (décision du
-- 2026-11-18). Cet espace est une petite école marquée « enseignant » :
-- tout le reste du code (classes, élèves, notes, bulletins, hors ligne)
-- fonctionne tel quel. La marque est une COLONNE gardée par ecoles_guard,
-- comme le plan : dans `extra`, que l'école modifie elle-même, un espace
-- enseignant pourrait se déclarer « école » et le contraire.
--
-- Un espace enseignant n'a ni comptabilité, ni comptes parents, ni comptes
-- pour d'autres personnes (refusés par l'Edge account-manage) ; il n'a pas
-- de limite d'élèves.
--
-- Règles (docs/migrations-sql.md) :
--  - appliquée UNE fois, dans l'ordre, par la CI au déploiement — jamais à
--    la main dans l'éditeur SQL ;
--  - compatible avec le front encore en ligne (ajouter avant de retirer) ;
--  - ne jamais modifier une migration déjà fusionnée : en écrire une autre.

alter table public.ecoles
  add column if not exists type_espace text not null default 'ecole';

alter table public.ecoles
  drop constraint if exists ecoles_type_espace_check;
alter table public.ecoles
  add constraint ecoles_type_espace_check check (type_espace in ('ecole', 'enseignant'));

comment on column public.ecoles.type_espace is
  'ecole = établissement complet ; enseignant = espace gratuit d''un enseignant indépendant. Fixé à l''inscription, modifiable par EduGest seulement (ecoles_guard).';

-- Même garde que la baseline, plus le type d'espace.
create or replace function public.ecoles_guard() returns trigger
    language plpgsql security definer
    set search_path to 'public'
    as $$
begin
  -- service_role : Edge Functions (inscription, school-lifecycle, plans) et
  -- scripts d'administration. Ils opèrent hors session utilisateur.
  if coalesce(auth.role(), 'service_role') = 'service_role' then return new; end if;

  -- Le superadmin est le propriétaire légitime de ces colonnes.
  if is_superadmin() then return new; end if;

  if new.plan is distinct from old.plan
     or new.plan_expiry is distinct from old.plan_expiry then
    raise exception 'Le plan d''abonnement est géré par EduGest et ne peut pas être modifié depuis l''école.';
  end if;

  -- Type d'espace : un espace enseignant est gratuit et sans limite
  -- d'élèves ; passé en « école » depuis l'application, il deviendrait une
  -- école complète gratuite et sans limite.
  if new.type_espace is distinct from old.type_espace then
    raise exception 'Le type d''espace est géré par EduGest et ne peut pas être modifié depuis l''école.';
  end if;

  -- Activation : DISSYMÉTRIQUE, et c'est voulu.
  -- Se désactiver ou se retirer soi-même est un droit de l'établissement
  -- (Paramètres → Zone dangereuse, réservée à la direction). REVENIR en
  -- service après une désactivation par EduGest ne l'est pas : sans cette
  -- règle, une école suspendue se rallumait toute seule.
  if new.actif is distinct from old.actif and new.actif = true then
    raise exception 'La réactivation d''une école est réservée à EduGest.';
  end if;
  if new.supprime is distinct from old.supprime and new.supprime = false then
    raise exception 'La restauration d''une école est réservée à EduGest.';
  end if;

  -- Le code est l'identifiant immuable de l'école : il sert de secret au
  -- chiffrement des QR des documents imprimés (src/reports/qr-crypto.js).
  -- Le changer rendrait illisibles tous les bulletins et reçus déjà émis.
  if new.code is distinct from old.code then
    raise exception 'Le code de l''école est immuable.';
  end if;

  return new;
end $$;
