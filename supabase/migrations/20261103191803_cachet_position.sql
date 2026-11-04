-- 20261103191803_cachet_position.sql
-- Pourquoi : le cachet personnel s'imprimait toujours centré dans le bloc de
-- signature. Son titulaire le place désormais où il veut — plus à gauche, plus
-- haut… — et ce placement vaut sur tous les documents qu'il imprime.
--
-- Décalage en fraction de la HAUTEUR du cachet imprimé (comptes.cachet_dx
-- vers la droite, de -1 à 1 ; comptes.cachet_dy vers le bas, de -0,5 à 0,5 —
-- plus bas, il mordrait sur le second coupon d'un reçu ; 0 = centré) : la
-- même valeur donne le même placement relatif sur un reçu (16 mm) comme sur
-- une attestation (22 mm), quelle que soit la taille réglée.
--
-- Comme cachet_url et cachet_taille : seul le titulaire du compte (ou le
-- service_role) les change. La garde comptes_cachet_guard est étendue ;
-- comptes_guard n'est pas réécrit.
--
-- Règles (docs/migrations-sql.md) :
--  - appliquée UNE fois, dans l'ordre, par la CI au déploiement — jamais à
--    la main dans l'éditeur SQL ;
--  - compatible avec le front encore en ligne (ajouter avant de retirer) ;
--  - ne jamais modifier une migration déjà fusionnée : en écrire une autre.

alter table public.comptes add column if not exists cachet_dx numeric(3, 2) not null default 0;
alter table public.comptes add column if not exists cachet_dy numeric(3, 2) not null default 0;

alter table public.comptes drop constraint if exists comptes_cachet_position_check;
alter table public.comptes add constraint comptes_cachet_position_check
  check (cachet_dx between -1 and 1 and cachet_dy between -0.5 and 0.5);

create or replace function public.comptes_cachet_guard() returns trigger
    language plpgsql security definer
    set search_path to 'public'
    as $$
begin
  if coalesce(auth.role(), 'service_role') = 'service_role' then return new; end if;
  if tg_op = 'INSERT' then
    if new.cachet_url is not null or new.cachet_taille is distinct from 1
       or new.cachet_dx is distinct from 0 or new.cachet_dy is distinct from 0 then
      raise exception 'Le cachet se dépose par son titulaire, depuis son menu profil.'
        using errcode = '42501';
    end if;
  elsif (new.cachet_url is distinct from old.cachet_url
         or new.cachet_taille is distinct from old.cachet_taille
         or new.cachet_dx is distinct from old.cachet_dx
         or new.cachet_dy is distinct from old.cachet_dy)
        and old.user_id is distinct from auth.uid() then
    raise exception 'Seul le titulaire du compte dépose, remplace ou retire son cachet.'
      using errcode = '42501';
  end if;
  return new;
end; $$;

revoke all on function public.comptes_cachet_guard() from public, anon, authenticated;
