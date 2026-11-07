-- 20261016101603_eleve_inscription_unique.sql
-- Pourquoi : un même élève était inscrit deux fois dans une école (double
-- clic, deux postes, saisie hors ligne, fiche sans date de naissance que le
-- contrôle de l'écran laissait passer). La base refuse désormais la seconde
-- fiche, quel que soit le chemin (formulaire, saisie rapide, import, synchro
-- hors ligne, transfert). Mêmes règles que findEnrollmentDuplicate
-- (src/enrollment-utils.ts), mêmes normalisations (casse, accents, espaces) :
--   - même IEN ;
--   - même nom, prénom et date de naissance ;
--   - à la CRÉATION seulement, même nom et prénom quand l'une des deux fiches
--     n'a pas de date de naissance : rien ne distingue alors un autre enfant
--     du même élève. Les homonymes se départagent par leur date de naissance.
-- Les doublons déjà en base ne sont ni touchés ni bloquants : une fiche reste
-- modifiable tant que son identité (nom, prénom, date, IEN) ne change pas.
-- Pas de contrôle du matricule ici : il est numéroté sur l'appareil, et deux
-- postes hors ligne peuvent tomber sur le même — la base jetterait alors une
-- inscription légitime. L'écran continue de le vérifier.
--
-- Règles (docs/migrations-sql.md) :
--  - appliquée UNE fois, dans l'ordre, par la CI au déploiement — jamais à
--    la main dans l'éditeur SQL ;
--  - compatible avec le front encore en ligne (ajouter avant de retirer) ;
--  - ne jamais modifier une migration déjà fusionnée : en écrire une autre.

-- Clé de comparaison d'un texte : minuscules, sans accents, espaces réduits —
-- comme normalizeEnrollmentText côté écran.
create or replace function public.eleve_cle_texte(p text) returns text
    language sql immutable
    set search_path to 'public'
    as $$
  select btrim(regexp_replace(lower(translate(coalesce(p, ''),
    'ÀÁÂÃÄÅàáâãäåÇçÈÉÊËèéêëÌÍÎÏìíîïÑñÒÓÔÕÖòóôõöÙÚÛÜùúûüÝýÿ',
    'AAAAAAaaaaaaCcEEEEeeeeIIIIiiiiNnOOOOOoooooUUUUuuuuYyy')), '\s+', ' ', 'g'));
$$;

create or replace function public.eleves_inscription_unique() returns trigger
    language plpgsql security definer
    set search_path to 'public'
    as $$
declare
  v_nom    text := eleve_cle_texte(new.nom);
  v_prenom text := eleve_cle_texte(new.prenom);
  v_date   text := btrim(coalesce(new.date_naissance, ''));
  v_ien    text := replace(eleve_cle_texte(new.ien), ' ', '');
  v_autre  eleves%rowtype;
begin
  -- Modification : seul un changement d'identité est contrôlé (le reste de
  -- la fiche — classe, paiements, statut — se modifie librement).
  if tg_op = 'UPDATE'
     and new.ecole_id = old.ecole_id
     and v_nom = eleve_cle_texte(old.nom)
     and v_prenom = eleve_cle_texte(old.prenom)
     and v_date = btrim(coalesce(old.date_naissance, ''))
     and v_ien = replace(eleve_cle_texte(old.ien), ' ', '') then
    return new;
  end if;

  if v_nom <> '' and v_prenom <> '' then
    -- Deux postes qui inscrivent le même nom au même instant : le second
    -- attend la fin du premier, puis le voit.
    perform pg_advisory_xact_lock(hashtextextended(new.ecole_id::text || '|nom|' || v_nom || '|' || v_prenom, 0));
    select * into v_autre from eleves e
     where e.ecole_id = new.ecole_id and e.id <> new.id
       and eleve_cle_texte(e.nom) = v_nom
       and eleve_cle_texte(e.prenom) = v_prenom
       and ((v_date <> '' and btrim(coalesce(e.date_naissance, '')) = v_date)
            or (tg_op = 'INSERT' and (v_date = '' or btrim(coalesce(e.date_naissance, '')) = '')))
     limit 1;
    if found then
      raise exception 'Élève déjà inscrit : % % (%, matricule %).',
        v_autre.nom, v_autre.prenom, coalesce(v_autre.classe, '?'), coalesce(v_autre.matricule, '?')
        using errcode = '23505',
              hint = 'S''il s''agit d''un autre enfant, renseignez la date de naissance sur les deux fiches.';
    end if;
  end if;

  if v_ien <> '' then
    perform pg_advisory_xact_lock(hashtextextended(new.ecole_id::text || '|ien|' || v_ien, 0));
    select * into v_autre from eleves e
     where e.ecole_id = new.ecole_id and e.id <> new.id
       and replace(eleve_cle_texte(e.ien), ' ', '') = v_ien
     limit 1;
    if found then
      raise exception 'IEN % déjà utilisé : % % (%).',
        new.ien, v_autre.nom, v_autre.prenom, coalesce(v_autre.classe, '?')
        using errcode = '23505';
    end if;
  end if;

  return new;
end; $$;

-- Fonction de déclencheur : jamais appelée directement (piège EXECUTE à
-- PUBLIC des fonctions SECURITY DEFINER).
revoke all on function public.eleves_inscription_unique() from public, anon, authenticated;

drop trigger if exists trg_eleves_inscription_unique on public.eleves;
create trigger trg_eleves_inscription_unique
  before insert or update of ecole_id, nom, prenom, date_naissance, ien on public.eleves
  for each row execute function public.eleves_inscription_unique();
