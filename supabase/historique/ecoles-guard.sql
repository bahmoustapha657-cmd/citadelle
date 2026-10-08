-- ════════════════════════════════════════════════════════════════════════
--  EduGest — Le PLAN appartient au superadmin, pas à l'école   [delta]
-- ════════════════════════════════════════════════════════════════════════
-- À exécuter APRÈS rls.sql. Idempotent.
--
-- FAILLE CORRIGÉE : la policy `ecoles_update` autorise tout membre du
-- personnel à modifier N'IMPORTE QUELLE colonne de sa propre école —
-- `plan` et `plan_expiry` compris, sans aucune restriction de colonne :
--
--     create policy ecoles_update on ecoles for update to authenticated
--       using (id = auth_ecole_id() and is_staff());
--
-- Une direction, un comptable ou même un surveillant pouvait donc, avec son
-- jeton de session ordinaire :
--     PATCH /rest/v1/ecoles { "plan": "premium", "plan_expiry": 9999999999999 }
--
-- Et ce n'était pas cosmétique : la fonction Edge `ia`, présentée comme
-- L'AUTORITÉ du gating premium, relit ce plan DANS CETTE MÊME TABLE
-- (select plan, plan_expiry from ecoles where id = compte.ecole_id).
-- Le contrôle serveur reposait donc sur une colonne que l'école réécrivait
-- elle-même : génération d'appréciations facturée au jeton Anthropic et
-- notifications SMS/WhatsApp facturées au fournisseur, toutes deux ouvertes.
--
-- Même logique pour `actif` et `supprime` : une école désactivée ou
-- supprimée par le superadmin pouvait se réactiver seule.
--
-- Le remède suit le modèle déjà en place pour les comptes (comptes_guard,
-- postes.sql) : un déclencheur qui refuse la modification des colonnes
-- réservées. Tout le reste — nom, logo, couleurs, paramètres, extra — reste
-- librement modifiable par le personnel, rien ne change à l'usage.

create or replace function ecoles_guard() returns trigger
  language plpgsql security definer set search_path = public as $$
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

drop trigger if exists trg_ecoles_guard on ecoles;
create trigger trg_ecoles_guard before update on ecoles
  for each row execute function ecoles_guard();

-- Contrôle :
--   select tgname from pg_trigger where tgrelid='ecoles'::regclass and not tgisinternal;
