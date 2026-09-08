-- ════════════════════════════════════════════════════════════════════════
--  EduGest — Vitrine publique : annonces marquées « publique »   [delta]
-- ════════════════════════════════════════════════════════════════════════
-- À exécuter dans Supabase → SQL Editor, après modules.sql. Idempotent.
--
-- POURQUOI : la vitrine publique (écran pré-connexion) affichait les annonces
-- publiques en lisant FIRESTORE — un reste de l'ère Firebase qui ne ramenait
-- plus rien depuis la migration. Le simple portage sur Supabase ne suffit pas :
-- la table `annonces` est réservée au personnel authentifié
-- (`for select to authenticated ... is_staff()`, cf. modules.sql), donc un
-- visiteur anonyme ne peut rien y lire, et c'est très bien ainsi — les annonces
-- destinées aux parents ne doivent pas fuiter.
--
-- On expose donc UNIQUEMENT les annonces que leur auteur a explicitement
-- marquées `publique = true`, par une fonction SECURITY DEFINER, sur le modèle
-- exact d'`etat_ecole` (rls.sql) déjà utilisé par l'écran de connexion.
--
-- ⚠️ Le tableau d'honneur de cette même page reste vide : contrairement aux
--    annonces, les honneurs ne portent AUCUN indicateur de publication. Les
--    exposer reviendrait à décider à la place de l'école que les noms de ses
--    élèves sont publics. À trancher séparément — si le tableau d'honneur doit
--    figurer sur la vitrine, ajouter d'abord un indicateur explicite.

create or replace function annonces_publiques(p_code text)
  returns table(id uuid, extra jsonb)
  language sql stable security definer set search_path = public as $$
  select a.id, a.extra
  from annonces a
  join ecoles e on e.id = a.ecole_id
  where e.code = lower(btrim(p_code))
    and e.actif is not false
    and e.supprime is not true
    -- Le drapeau vit dans le jsonb (table « document »). On accepte le booléen
    -- JSON comme la chaîne "true" : les écrans ont écrit les deux au fil du temps.
    and coalesce(a.extra->>'publique', 'false') in ('true', 't')
  order by (a.extra->>'date') desc nulls last
  limit 20;
$$;

grant execute on function annonces_publiques(text) to anon, authenticated;

-- ── Vérification ────────────────────────────────────────────────────────
-- Doit renvoyer les annonces publiques de l'école, et rien d'autre.
-- select * from annonces_publiques('citadelle');
