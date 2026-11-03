-- 20261103154315_cachet_personnel.sql
-- Pourquoi : les comptables et les chefs de section veulent apposer LEUR
-- cachet et LEUR signature (une image) sur les documents qu'ils signent —
-- reçus, bulletins, préavis… Jusqu'ici l'école n'avait qu'une signature
-- scannée, déposée par la Direction et imprimée quel que soit le signataire.
--
-- Le cachet doit rester sous le contrôle de son titulaire : lui seul le
-- dépose, le remplace ou le retire, et l'application ne l'imprime que sur les
-- documents qu'il imprime lui-même (src/reports/signatures.js). Personne
-- d'autre — Direction comprise — ne peut le poser à sa place : sinon on
-- pourrait faire « signer » quelqu'un à son insu.
--
-- Colonne dédiée plutôt que comptes.extra : comptes_guard interdit à un
-- compte de toucher à son propre extra, et on ne réécrit pas comptes_guard
-- (cf. historique : rejouer un ancien garde avait rouvert une faille). La
-- policy comptes_write laisse déjà chacun modifier sa propre ligne ; la garde
-- ci-dessous réserve cette colonne-ci au titulaire.
--
-- Règles (docs/migrations-sql.md) :
--  - appliquée UNE fois, dans l'ordre, par la CI au déploiement — jamais à
--    la main dans l'éditeur SQL ;
--  - compatible avec le front encore en ligne (ajouter avant de retirer) ;
--  - ne jamais modifier une migration déjà fusionnée : en écrire une autre.

-- URL de l'image dans le stockage (bucket photos, <code_ecole>/cachets/…),
-- jamais l'image elle-même : un base64 repartirait à chaque lecture du compte.
alter table public.comptes add column if not exists cachet_url text;

alter table public.comptes drop constraint if exists comptes_cachet_url_check;
alter table public.comptes add constraint comptes_cachet_url_check
  check (cachet_url is null or (cachet_url like 'https://%' and char_length(cachet_url) <= 500));

-- Garde : seul le titulaire du compte (ou le service_role) pose, change ou
-- retire son cachet. Trigger distinct de comptes_guard, qu'on ne réécrit pas.
create or replace function public.comptes_cachet_guard() returns trigger
    language plpgsql security definer
    set search_path to 'public'
    as $$
begin
  if coalesce(auth.role(), 'service_role') = 'service_role' then return new; end if;
  if tg_op = 'INSERT' then
    if new.cachet_url is not null then
      raise exception 'Le cachet se dépose par son titulaire, depuis son menu profil.'
        using errcode = '42501';
    end if;
  elsif new.cachet_url is distinct from old.cachet_url
        and old.user_id is distinct from auth.uid() then
    raise exception 'Seul le titulaire du compte dépose, remplace ou retire son cachet.'
      using errcode = '42501';
  end if;
  return new;
end; $$;

revoke all on function public.comptes_cachet_guard() from public, anon, authenticated;

drop trigger if exists trg_comptes_cachet_guard on public.comptes;
create trigger trg_comptes_cachet_guard
  before insert or update on public.comptes
  for each row execute function public.comptes_cachet_guard();
