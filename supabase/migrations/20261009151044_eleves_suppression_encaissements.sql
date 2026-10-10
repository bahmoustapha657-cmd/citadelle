-- 20261009151044_eleves_suppression_encaissements.sql
-- Pourquoi : supprimer une fiche élève (Comptabilité → Élèves → « Suppr. »)
-- effaçait aussi, par la cascade paiements_eleve_id_fkey (ON DELETE
-- CASCADE), TOUTES ses lignes du journal de caisse. L'argent réellement
-- encaissé disparaissait et les bilans de caisse changeaient après coup —
-- alors que le journal est en AJOUT SEUL (aucune policy de modification ni
-- de suppression : la cascade était la seule brèche). Mesuré le 2026-10-09
-- (sauvegardes comparées à la production) : 30 lignes, 8 élèves, 3 écoles,
-- 8 615 000 GNF disparus avec leur fiche depuis l'ouverture du journal.
--
-- Désormais une fiche qui porte de l'argent ne se supprime plus : un élève
-- qui s'en va se déclare PARTI (statut « Transféré », bouton 📤).
--  1. Garde explicite, message en français (hint eleve_avec_encaissements,
--     lu par l'appli) :
--       - lignes au journal de caisse : refus pour TOUS (service_role compris) ;
--       - encaissement porté par la fiche ou par l'archive d'une année close
--         (la caisse lit ces champs quand le journal ne connaît pas le
--         paiement) : refus pour les comptes de l'appli. service_role / SQL
--         Editor gardent la main, comme pour garde_ecriture_ecole.
--  2. Dernier filet : paiements.eleve_id passe en ON DELETE NO ACTION. Même
--     sans la garde, la base refuse de vider le journal.
-- Supprimer une ÉCOLE entière (super-admin) emporte toujours tout, journal
-- compris : la garde s'efface quand l'école n'existe déjà plus.
-- Notes, absences et appréciations gardent leur cascade (fiche sans argent
-- créée par erreur) ; l'écran prévient avant de les effacer.
--
-- Contrôlé par la CI (job migrations) : refus avec et sans la garde,
-- suppression d'une fiche vide et d'une école entière.
--
-- Règles (docs/migrations-sql.md) :
--  - appliquée UNE fois, dans l'ordre, par la CI au déploiement — jamais à
--    la main dans l'éditeur SQL ;
--  - compatible avec le front encore en ligne (ajouter avant de retirer) ;
--  - ne jamais modifier une migration déjà fusionnée : en écrire une autre.

-- Valeur jsonb « vraie » au sens de JavaScript (Boolean(v)) : la fiche est
-- écrite par l'appli, c'est sa sémantique qui fait foi.
create or replace function public.jsonb_est_vrai(v jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when v is null then false
    else case jsonb_typeof(v)
      when 'boolean' then v = 'true'::jsonb
      when 'number' then v <> '0'::jsonb
      when 'string' then v <> '""'::jsonb
      when 'null' then false
      else true -- objet ou tableau
    end
  end;
$$;

-- La fiche (ou l'archive d'une année) porte-t-elle un encaissement ?
-- MÊME RÈGLE que aDesPaiements (src/components/admin/cloture-annee-utils.js) :
-- toute évolution de l'une se reporte sur l'autre.
create or replace function public.fiche_porte_un_encaissement(f jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case when f is null or jsonb_typeof(f) <> 'object' then false else
    -- une mensualité payée
    exists (
      select 1
      from jsonb_each_text(case when jsonb_typeof(f -> 'mens') = 'object' then f -> 'mens' else '{}'::jsonb end) m
      where m.value = 'Payé'
    )
    -- inscription ou « autre frais » réglés
    or public.jsonb_est_vrai(f -> 'inscriptionPayee')
    or public.jsonb_est_vrai(f -> 'autrePayee')
    -- acompte d'inscription (Number(x) > 0)
    or case jsonb_typeof(f -> 'inscriptionAcompte')
         when 'number' then (f ->> 'inscriptionAcompte')::numeric > 0
         when 'string' then case when btrim(f ->> 'inscriptionAcompte') ~ '^[0-9]+([.][0-9]+)?$'
                                 then btrim(f ->> 'inscriptionAcompte')::numeric > 0
                                 else false end
         when 'boolean' then f -> 'inscriptionAcompte' = 'true'::jsonb
         else false
       end
    -- frais annexes payés, acomptes sur des mois ou des frais
    or exists (
      select 1
      from unnest(array['fraisPayes', 'mensAcomptes', 'fraisAcomptes']) as c(cle),
      lateral (
        select x.value
        from jsonb_each(case when jsonb_typeof(f -> c.cle) = 'object' then f -> c.cle else '{}'::jsonb end) x
        union all
        select y.value
        from jsonb_array_elements(case when jsonb_typeof(f -> c.cle) = 'array' then f -> c.cle else '[]'::jsonb end) y
      ) v(valeur)
      where public.jsonb_est_vrai(v.valeur)
    )
  end;
$$;

-- SECURITY DEFINER : la garde doit voir TOUT le journal de l'élève, quelle
-- que soit la RLS de la personne qui supprime.
create or replace function public.eleves_garde_suppression()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Suppression de l'école entière (cascade depuis ecoles) : tout part,
  -- c'est voulu. À ce stade l'école n'existe déjà plus.
  if not exists (select 1 from ecoles where id = old.ecole_id) then
    return old;
  end if;

  if exists (select 1 from paiements where eleve_id = old.id)
     or (coalesce(auth.role(), 'service_role') = 'authenticated'
         and (fiche_porte_un_encaissement(old.extra)
              or exists (
                select 1
                from jsonb_each(case when jsonb_typeof(old.extra -> 'historique') = 'object'
                                     then old.extra -> 'historique' else '{}'::jsonb end) h
                where fiche_porte_un_encaissement(h.value)
              ))) then
    raise exception 'Suppression refusée : cet élève a des encaissements (journal de caisse, fiche ou année archivée). Sa fiche est conservée pour que la caisse et les bilans restent justes : déclarez plutôt son départ.'
      using errcode = 'P0001', hint = 'eleve_avec_encaissements';
  end if;
  return old;
end $$;

drop trigger if exists trg_eleves_garde_suppression on public.eleves;
create trigger trg_eleves_garde_suppression
  before delete on public.eleves
  for each row execute function public.eleves_garde_suppression();

-- Le journal ne se vide plus par cascade (NO ACTION : contrôle en fin
-- d'instruction, ce qui laisse passer la suppression d'une école entière,
-- où journal et élèves partent ensemble).
alter table public.paiements drop constraint if exists paiements_eleve_id_fkey;
alter table public.paiements
  add constraint paiements_eleve_id_fkey
  foreign key (eleve_id) references public.eleves(id) on delete no action;

-- Fonctions internes : rien à appeler depuis l'API (cf. piège EXECUTE à
-- PUBLIC). Le déclencheur s'exécute avec les droits de son propriétaire.
revoke execute on function public.jsonb_est_vrai(jsonb) from public, anon, authenticated;
revoke execute on function public.fiche_porte_un_encaissement(jsonb) from public, anon, authenticated;
revoke execute on function public.eleves_garde_suppression() from public, anon, authenticated;

comment on function public.eleves_garde_suppression() is
  'Refuse la suppression d''une fiche élève qui porte de l''argent (journal de caisse, fiche, archive) : déclarer un départ à la place.';
comment on constraint paiements_eleve_id_fkey on public.paiements is
  'NO ACTION : le journal de caisse ne se vide jamais par la suppression d''une fiche élève.';
