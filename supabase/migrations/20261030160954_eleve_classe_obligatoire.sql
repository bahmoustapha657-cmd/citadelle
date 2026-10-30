-- 20261030160954_eleve_classe_obligatoire.sql
-- Pourquoi : un élève sans classe n'apparaît dans aucune liste de classe. Le
-- formulaire ne l'exigeait pas et l'import ne faisait qu'avertir. L'écran
-- l'exige désormais partout ; la base aussi, pour qu'aucun autre chemin (une
-- version de l'application encore en cache, un transfert au dossier sans
-- classe) ne puisse en créer. Refusés :
--   - une inscription sans classe ;
--   - une fiche qui perd sa classe.
-- Les fiches anciennes déjà sans classe ne sont pas touchées et restent
-- modifiables (paiements, départ). Mêmes règles que classeManquante
-- (src/enrollment-utils.ts).
-- Hors ligne : une version en cache qui inscrit sans classe est refusée à la
-- synchro (23514 n'est pas un incident passager) ; l'utilisateur est averti
-- à l'écran et ressaisit l'élève avec sa classe.
--
-- Règles (docs/migrations-sql.md) :
--  - appliquée UNE fois, dans l'ordre, par la CI au déploiement — jamais à
--    la main dans l'éditeur SQL ;
--  - compatible avec le front encore en ligne (ajouter avant de retirer) ;
--  - ne jamais modifier une migration déjà fusionnée : en écrire une autre.

create or replace function public.eleves_classe_obligatoire() returns trigger
    language plpgsql
    set search_path to 'public'
    as $$
begin
  if btrim(coalesce(new.classe, '')) = ''
     and (tg_op = 'INSERT' or btrim(coalesce(old.classe, '')) <> '') then
    raise exception 'Classe obligatoire : % % n''a pas de classe.', new.nom, new.prenom
      using errcode = '23514';
  end if;
  return new;
end; $$;

revoke all on function public.eleves_classe_obligatoire() from public, anon, authenticated;

drop trigger if exists trg_eleves_classe_obligatoire on public.eleves;
create trigger trg_eleves_classe_obligatoire
  before insert or update of classe on public.eleves
  for each row execute function public.eleves_classe_obligatoire();
