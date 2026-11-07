-- 20261103184410_cachet_taille.sql
-- Pourquoi : le cachet personnel s'imprimait à une taille fixée par chaque
-- document (16 à 22 mm), jugée trop petite. Le titulaire règle désormais
-- lui-même un facteur de taille (comptes.cachet_taille, de 0,8 à 2 ; 1 =
-- taille d'origine), appliqué sur tous les documents qu'il imprime.
--
-- Comme cachet_url (20261103154315_cachet_personnel.sql) : seul le titulaire
-- du compte (ou le service_role) le change — sinon un tiers pourrait rendre
-- un cachet illisible ou envahissant. La garde comptes_cachet_guard est
-- étendue à la nouvelle colonne ; comptes_guard n'est pas réécrit.
--
-- Règles (docs/migrations-sql.md) :
--  - appliquée UNE fois, dans l'ordre, par la CI au déploiement — jamais à
--    la main dans l'éditeur SQL ;
--  - compatible avec le front encore en ligne (ajouter avant de retirer) ;
--  - ne jamais modifier une migration déjà fusionnée : en écrire une autre.

alter table public.comptes add column if not exists cachet_taille numeric(3, 2) not null default 1;

alter table public.comptes drop constraint if exists comptes_cachet_taille_check;
alter table public.comptes add constraint comptes_cachet_taille_check
  check (cachet_taille between 0.8 and 2);

create or replace function public.comptes_cachet_guard() returns trigger
    language plpgsql security definer
    set search_path to 'public'
    as $$
begin
  if coalesce(auth.role(), 'service_role') = 'service_role' then return new; end if;
  if tg_op = 'INSERT' then
    if new.cachet_url is not null or new.cachet_taille is distinct from 1 then
      raise exception 'Le cachet se dépose par son titulaire, depuis son menu profil.'
        using errcode = '42501';
    end if;
  elsif (new.cachet_url is distinct from old.cachet_url
         or new.cachet_taille is distinct from old.cachet_taille)
        and old.user_id is distinct from auth.uid() then
    raise exception 'Seul le titulaire du compte dépose, remplace ou retire son cachet.'
      using errcode = '42501';
  end if;
  return new;
end; $$;

revoke all on function public.comptes_cachet_guard() from public, anon, authenticated;
