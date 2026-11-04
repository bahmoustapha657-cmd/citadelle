-- 20261104085731_signature_personnelle.sql
-- Pourquoi : le titulaire déposait UNE image, tampon et signature ensemble.
-- Il dépose désormais sa signature à part (comptes.signature_url), avec sa
-- propre taille et sa propre position dans le bloc de signature : il place le
-- cachet et la signature où il veut, l'un par rapport à l'autre. L'image
-- existante (cachet_url) reste « le cachet » ; rien ne change pour qui ne
-- dépose pas de signature séparée.
--
-- Mêmes unités et mêmes bornes que le cachet : taille de 0,8 à 2 (facteur de
-- la hauteur prévue par le document), décalage en fraction de la hauteur de
-- l'image imprimée (signature_dx de -1 à 1, signature_dy de -0,5 à 0,5).
--
-- Comme les colonnes du cachet : seul le titulaire du compte (ou le
-- service_role) les change. La garde comptes_cachet_guard est étendue ;
-- comptes_guard n'est pas réécrit.
--
-- Règles (docs/migrations-sql.md) :
--  - appliquée UNE fois, dans l'ordre, par la CI au déploiement — jamais à
--    la main dans l'éditeur SQL ;
--  - compatible avec le front encore en ligne (ajouter avant de retirer) ;
--  - ne jamais modifier une migration déjà fusionnée : en écrire une autre.

alter table public.comptes add column if not exists signature_url text;
alter table public.comptes add column if not exists signature_taille numeric(3, 2) not null default 1;
alter table public.comptes add column if not exists signature_dx numeric(3, 2) not null default 0;
alter table public.comptes add column if not exists signature_dy numeric(3, 2) not null default 0;

alter table public.comptes drop constraint if exists comptes_signature_reglages_check;
alter table public.comptes add constraint comptes_signature_reglages_check
  check (signature_taille between 0.8 and 2
         and signature_dx between -1 and 1 and signature_dy between -0.5 and 0.5);

create or replace function public.comptes_cachet_guard() returns trigger
    language plpgsql security definer
    set search_path to 'public'
    as $$
begin
  if coalesce(auth.role(), 'service_role') = 'service_role' then return new; end if;
  if tg_op = 'INSERT' then
    if new.cachet_url is not null or new.cachet_taille is distinct from 1
       or new.cachet_dx is distinct from 0 or new.cachet_dy is distinct from 0
       or new.signature_url is not null or new.signature_taille is distinct from 1
       or new.signature_dx is distinct from 0 or new.signature_dy is distinct from 0 then
      raise exception 'Le cachet se dépose par son titulaire, depuis son menu profil.'
        using errcode = '42501';
    end if;
  elsif (new.cachet_url is distinct from old.cachet_url
         or new.cachet_taille is distinct from old.cachet_taille
         or new.cachet_dx is distinct from old.cachet_dx
         or new.cachet_dy is distinct from old.cachet_dy
         or new.signature_url is distinct from old.signature_url
         or new.signature_taille is distinct from old.signature_taille
         or new.signature_dx is distinct from old.signature_dx
         or new.signature_dy is distinct from old.signature_dy)
        and old.user_id is distinct from auth.uid() then
    raise exception 'Seul le titulaire du compte dépose, remplace ou retire son cachet.'
      using errcode = '42501';
  end if;
  return new;
end; $$;

revoke all on function public.comptes_cachet_guard() from public, anon, authenticated;
