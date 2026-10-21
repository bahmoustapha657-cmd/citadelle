-- 20261021165259_doublon_eleve_filiation.sql
-- Pourquoi : la direction identifie un élève par sa FILIATION (règle du
-- 2026-10-21), plus par la seule date de naissance, souvent absente. Refusés :
--   - même nom, prénom et filiation, SAUF si les deux fiches portent des
--     dates de naissance différentes (deux enfants des mêmes parents) ;
--   - même matricule ;
--   - même IEN.
-- Remplace la règle « homonyme sans date » de
-- 20261016101603_eleve_inscription_unique.sql. Matricule : il est numéroté sur
-- l'appareil, deux postes hors ligne peuvent tirer le même ; la base refuse
-- alors le second à la synchro (avertissement à l'écran, à ressaisir).
-- Mêmes règles et mêmes normalisations que findEnrollmentDuplicate
-- (src/enrollment-utils.ts). La filiation est exigée à l'inscription par
-- l'écran ; la base ne l'exige pas, pour ne pas jeter une inscription faite
-- hors ligne par une version de l'application encore en cache.
--
-- Règles (docs/migrations-sql.md) :
--  - appliquée UNE fois, dans l'ordre, par la CI au déploiement — jamais à
--    la main dans l'éditeur SQL ;
--  - compatible avec le front encore en ligne (ajouter avant de retirer) ;
--  - ne jamais modifier une migration déjà fusionnée : en écrire une autre.

-- Clé d'une filiation : sans accents, ponctuation ni mots de liaison —
-- « Fils de Mamadou Diallo et de Aïssatou Bah » = « Père : Mamadou Diallo /
-- Mère : Aissatou Bah ». Comme normalizeFiliation côté écran.
create or replace function public.eleve_cle_filiation(p text) returns text
    language sql immutable
    set search_path to 'public'
    as $$
  select coalesce(string_agg(t.mot, ' ' order by t.n), '')
    from regexp_split_to_table(
           btrim(regexp_replace(eleve_cle_texte(p), '[^a-z0-9]+', ' ', 'g')), ' '
         ) with ordinality as t(mot, n)
   where t.mot <> '' and t.mot not in ('pere', 'mere', 'fils', 'fille', 'de', 'd', 'du', 'et');
$$;

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

  if v_nom <> '' and v_prenom <> '' and v_filiation <> '' then
    -- Deux postes qui inscrivent le même élève au même instant : le second
    -- attend la fin du premier, puis le voit.
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
      raise exception 'Élève déjà inscrit : % %, même filiation (%, matricule %).',
        v_autre.nom, v_autre.prenom, coalesce(v_autre.classe, '?'), coalesce(v_autre.matricule, '?')
        using errcode = '23505';
    end if;
  end if;

  if v_matricule <> '' then
    perform pg_advisory_xact_lock(hashtextextended(new.ecole_id::text || '|matricule|' || v_matricule, 0));
    select * into v_autre from eleves e
     where e.ecole_id = new.ecole_id and e.id <> new.id
       and replace(eleve_cle_texte(e.matricule), ' ', '') = v_matricule
     limit 1;
    if found then
      raise exception 'Matricule % déjà utilisé : % % (%).',
        new.matricule, v_autre.nom, v_autre.prenom, coalesce(v_autre.classe, '?')
        using errcode = '23505';
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

revoke all on function public.eleves_inscription_unique() from public, anon, authenticated;

-- Colonnes surveillées : celles de l'identité.
drop trigger if exists trg_eleves_inscription_unique on public.eleves;
create trigger trg_eleves_inscription_unique
  before insert or update of ecole_id, nom, prenom, filiation, date_naissance, matricule, ien on public.eleves
  for each row execute function public.eleves_inscription_unique();
