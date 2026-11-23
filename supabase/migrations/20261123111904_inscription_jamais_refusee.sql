-- 20261123111904_inscription_jamais_refusee.sql
-- Pourquoi : la base REFUSAIT un élève « en double » (même nom, prénom et
-- filiation sans dates de naissance différentes, même code élève, même
-- matricule DGECS). À l'écran, le contrôle se fait avant d'enregistrer, rien
-- n'est perdu. Mais une inscription saisie HORS LIGNE n'est contrôlée par la
-- base qu'à la synchronisation : refusée, elle disparaissait avec ses
-- encaissements, alors que le reçu était déjà remis à la famille. Dans une
-- école qui ne saisit jamais les dates de naissance, des élèves
-- payés ont ainsi disparu ; ressaisis sans leur reçu, ils ont ensuite été
-- supprimés comme « non réinscrits ».
--
-- Règle de l'utilisateur (2026-11-23) : un élève ne doit plus JAMAIS se
-- perdre. La base n'oppose plus de refus :
--   - même identité (nom + prénom + filiation) ou même matricule DGECS :
--     l'élève est enregistré, la fiche porte `extra.doublonPossible` (avec
--     quelle fiche, pourquoi) et une ligne « Doublon possible enregistré »
--     part à l'historique, pour que l'école vérifie ;
--   - code élève déjà pris (deux postes hors ligne tirent le même numéro) :
--     à l'inscription, l'élève reçoit le numéro libre suivant du même
--     préfixe (P26/680 pris → P26/691) ; sur une modification, il garde son
--     ancien code. Même signalement.
-- Le contrôle de l'écran (enrollment-utils.ts) reste : il empêche de créer
-- le doublon quand l'autre fiche est visible sur l'appareil.
-- Une modification qui fait disparaître le doublon (nom corrigé…) retire le
-- signalement.
--
-- Règles (docs/migrations-sql.md) :
--  - appliquée UNE fois, dans l'ordre, par la CI au déploiement — jamais à
--    la main dans l'éditeur SQL ;
--  - compatible avec le front encore en ligne (ajouter avant de retirer) ;
--  - ne jamais modifier une migration déjà fusionnée : en écrire une autre.

create or replace function public.eleves_inscription_unique() returns trigger
    language plpgsql security definer
    set search_path to 'public'
    as $$
declare
  v_nom       text := eleve_cle_texte(new.nom);
  v_prenom    text := eleve_cle_texte(new.prenom);
  v_filiation text := eleve_cle_filiation(new.filiation);
  v_date      text := btrim(coalesce(new.date_naissance, ''));
  v_ien       text := replace(eleve_cle_texte(new.ien), ' ', '');
  v_matricule text := replace(eleve_cle_texte(new.matricule), ' ', '');
  v_autre     eleves%rowtype;
  v_signaux   jsonb := '[]'::jsonb;
  v_code      text := btrim(coalesce(new.matricule, ''));
  v_prefixe   text;
  v_largeur   int;
  v_max       numeric;
  v_nouveau   text;
  v_detail    text;
  v_s         jsonb;
begin
  -- Modification : seul un changement d'identité est contrôlé (le reste de
  -- la fiche — classe, paiements, statut — se modifie librement).
  if tg_op = 'UPDATE'
     and new.ecole_id = old.ecole_id
     and v_nom = eleve_cle_texte(old.nom)
     and v_prenom = eleve_cle_texte(old.prenom)
     and v_filiation = eleve_cle_filiation(old.filiation)
     and v_date = btrim(coalesce(old.date_naissance, ''))
     and v_matricule = replace(eleve_cle_texte(old.matricule), ' ', '')
     and v_ien = replace(eleve_cle_texte(old.ien), ' ', '') then
    return new;
  end if;

  -- 1. Même identité : signalé, jamais refusé.
  if v_nom <> '' and v_prenom <> '' and v_filiation <> '' then
    perform pg_advisory_xact_lock(hashtextextended(
      new.ecole_id::text || '|nom|' || v_nom || '|' || v_prenom || '|' || v_filiation, 0));
    select * into v_autre from eleves e
     where e.ecole_id = new.ecole_id and e.id <> new.id
       and eleve_cle_texte(e.nom) = v_nom
       and eleve_cle_texte(e.prenom) = v_prenom
       and eleve_cle_filiation(e.filiation) = v_filiation
       and not (v_date <> '' and btrim(coalesce(e.date_naissance, '')) <> ''
                and btrim(coalesce(e.date_naissance, '')) <> v_date)
     limit 1;
    if found then
      v_signaux := v_signaux || jsonb_build_object(
        'motif', 'meme_identite', 'eleveId', v_autre.id, 'nom', v_autre.nom, 'prenom', v_autre.prenom,
        'classe', v_autre.classe, 'codeEleve', v_autre.matricule);
    end if;
  end if;

  -- 2. Code élève déjà pris : numéro libre suivant (inscription) ou ancien
  -- code gardé (modification).
  if v_matricule <> '' then
    perform pg_advisory_xact_lock(hashtextextended(new.ecole_id::text || '|matricule|' || v_matricule, 0));
    select * into v_autre from eleves e
     where e.ecole_id = new.ecole_id and e.id <> new.id
       and replace(eleve_cle_texte(e.matricule), ' ', '') = v_matricule
     limit 1;
    if found then
      if tg_op = 'UPDATE' and btrim(coalesce(old.matricule, '')) <> '' then
        v_nouveau := old.matricule;
      else
        -- Préfixe = le code sans ses chiffres de fin (« P26/680 » → « P26/ »).
        v_prefixe := regexp_replace(v_code, '[0-9]+$', '');
        if v_prefixe = v_code then
          v_prefixe := v_code || '-';
          v_largeur := 3;
        else
          v_largeur := length(v_code) - length(v_prefixe);
        end if;
        -- Un seul tirage à la fois par préfixe dans l'école.
        perform pg_advisory_xact_lock(hashtextextended(new.ecole_id::text || '|prefixe|' || v_prefixe, 0));
        select coalesce(max(substring(btrim(e.matricule) from length(v_prefixe) + 1)::numeric), 0) into v_max
          from eleves e
         where e.ecole_id = new.ecole_id
           and left(btrim(e.matricule), length(v_prefixe)) = v_prefixe
           and substring(btrim(e.matricule) from length(v_prefixe) + 1) ~ '^[0-9]{1,30}$';
        -- lpad tronquerait un numéro plus long que la largeur (1000 → « 100 »).
        v_nouveau := v_prefixe || case when length((v_max + 1)::text) >= v_largeur
          then (v_max + 1)::text else lpad((v_max + 1)::text, v_largeur, '0') end;
      end if;
      v_signaux := v_signaux || jsonb_build_object(
        'motif', 'code_eleve_pris', 'codeSaisi', new.matricule, 'codeAttribue', v_nouveau,
        'eleveId', v_autre.id, 'nom', v_autre.nom, 'prenom', v_autre.prenom, 'classe', v_autre.classe);
      new.matricule := v_nouveau;
    end if;
  end if;

  -- 3. Même matricule DGECS : signalé, jamais refusé.
  if v_ien <> '' then
    perform pg_advisory_xact_lock(hashtextextended(new.ecole_id::text || '|ien|' || v_ien, 0));
    select * into v_autre from eleves e
     where e.ecole_id = new.ecole_id and e.id <> new.id
       and replace(eleve_cle_texte(e.ien), ' ', '') = v_ien
     limit 1;
    if found then
      v_signaux := v_signaux || jsonb_build_object(
        'motif', 'matricule_dgecs_pris', 'matricule', new.ien, 'eleveId', v_autre.id,
        'nom', v_autre.nom, 'prenom', v_autre.prenom, 'classe', v_autre.classe, 'codeEleve', v_autre.matricule);
    end if;
  end if;

  if jsonb_array_length(v_signaux) = 0 then
    -- Plus de doublon (identité corrigée) : le signalement tombe.
    if tg_op = 'UPDATE' and new.extra ? 'doublonPossible' then
      new.extra := new.extra - 'doublonPossible';
    end if;
    return new;
  end if;

  new.extra := coalesce(new.extra, '{}'::jsonb)
    || jsonb_build_object('doublonPossible', jsonb_build_object('le', now(), 'signaux', v_signaux));

  -- Trace pour l'école, une fois par signalement nouveau.
  if tg_op = 'INSERT' or (old.extra -> 'doublonPossible' -> 'signaux') is distinct from v_signaux then
    v_detail := '';
    for v_s in select * from jsonb_array_elements(v_signaux) loop
      v_detail := v_detail || case when v_detail = '' then '' else ' ; ' end || case v_s ->> 'motif'
        when 'meme_identite' then format('même nom et même filiation que %s %s (%s, code élève %s)',
          v_s ->> 'nom', v_s ->> 'prenom', coalesce(v_s ->> 'classe', '?'), coalesce(v_s ->> 'codeEleve', '?'))
        when 'code_eleve_pris' then format('code élève %s déjà pris par %s %s (%s), remplacé par %s',
          v_s ->> 'codeSaisi', v_s ->> 'nom', v_s ->> 'prenom', coalesce(v_s ->> 'classe', '?'), v_s ->> 'codeAttribue')
        else format('matricule %s déjà porté par %s %s (%s)',
          v_s ->> 'matricule', v_s ->> 'nom', v_s ->> 'prenom', coalesce(v_s ->> 'classe', '?'))
      end;
    end loop;
    insert into historique (ecole_id, extra) values (new.ecole_id, jsonb_build_object(
      'action', 'Doublon possible enregistré',
      'auteur', 'EduGest (serveur)',
      'date', floor(extract(epoch from clock_timestamp()) * 1000)::bigint,
      'details', format('%s %s (%s, code élève %s) enregistré(e) sans refus : %s. À vérifier.',
        coalesce(new.nom, ''), coalesce(new.prenom, ''), coalesce(new.classe, '?'),
        coalesce(new.matricule, '?'), v_detail)));
  end if;
  return new;
end; $$;

revoke all on function public.eleves_inscription_unique() from public, anon, authenticated;
