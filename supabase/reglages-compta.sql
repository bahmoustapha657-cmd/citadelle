-- ════════════════════════════════════════════════════════════════════════
--  EduGest — Réglages de l'école ouverts à la COMPTABILITÉ   [delta]
-- ════════════════════════════════════════════════════════════════════════
-- À exécuter dans Supabase → SQL Editor, APRÈS postes.sql. Idempotent.
--
-- PROBLÈME CORRIGÉ : deux écrans du comptable écrivent dans ecoles.extra —
--   • Compta → Bilan : bloquer le portail parents pour impayés
--     (extra.blocageParentImpaye) ;
--   • Paramètres école, vue comptable : la monnaie (extra.monnaie).
-- Or la policy `ecoles_update` (postes.sql § 8) réserve la mise à jour de
-- l'école aux modules `parametres` / `admin_panel`, et le comptable n'a que
-- {"compta":"ecriture"} — poste système comme repli legacy. Sous RLS, un
-- UPDATE refusé ne lève AUCUNE erreur : il modifie zéro ligne. L'écran
-- annonçait donc un succès sans que rien ne soit écrit (reproduit sur
-- l'École Démo le 2026-09-25 : 0 ligne, pas d'erreur). La direction étant en
-- lecture seule dans la Compta, plus personne ne pouvait activer le blocage.
--
-- Régression de la migration : la règle Firestore autorisait au comptable
-- exactement ces deux champs (firestore.rules, match /ecoles :
-- affectedKeys().hasOnly(["monnaie", "blocageParentImpaye"])).
--
-- REMÈDE : on N'ÉLARGIT PAS ecoles_update — le comptable ne doit toujours pas
-- toucher au nom, au logo, aux rôles… Une fonction SECURITY DEFINER accepte
-- une LISTE BLANCHE de clés de extra, pour qui écrit le module compta, sur
-- l'école de l'appelant uniquement. La fusion se fait en une requête côté
-- serveur (pas de lecture-modification-écriture du jsonb par le client).
-- ecoles_guard (plan, activation, code) continue de s'appliquer.
--
-- Ajouter une clé = un `when` de plus ci-dessous.

create or replace function maj_reglages_compta(p_champs jsonb)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_cle   text;
  v_patch jsonb := '{}'::jsonb;
begin
  -- Même autorité que les tables de compta (postes.sql § 9).
  if not has_module_write('compta') then
    raise exception 'Droits insuffisants : réservé à la comptabilité.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_champs) is distinct from 'object' or p_champs = '{}'::jsonb then
    raise exception 'Aucun réglage à enregistrer.';
  end if;

  for v_cle in select jsonb_object_keys(p_champs) loop
    case v_cle
      when 'blocageParentImpaye' then
        if jsonb_typeof(p_champs -> v_cle) <> 'boolean' then
          raise exception 'blocageParentImpaye : vrai ou faux attendu.';
        end if;
        v_patch := v_patch || jsonb_build_object(v_cle, p_champs -> v_cle);
      -- Mêmes bornes que l'écran (liste, ou « Autre… » limité à 5
      -- caractères) et même forme que normaliserMonnaie (parametres-api.js).
      when 'monnaie' then
        if jsonb_typeof(p_champs -> v_cle) <> 'string'
           or char_length(btrim(p_champs ->> v_cle)) not between 1 and 5 then
          raise exception 'Monnaie invalide (1 à 5 caractères).';
        end if;
        v_patch := v_patch || jsonb_build_object(v_cle, upper(btrim(p_champs ->> v_cle)));
      else
        raise exception 'Réglage « % » non modifiable depuis la comptabilité.', v_cle
          using errcode = '42501';
    end case;
  end loop;

  -- L'école de l'APPELANT, jamais un paramètre : aucune autre école visable.
  update ecoles set extra = coalesce(extra, '{}'::jsonb) || v_patch
   where id = auth_ecole_id();
  if not found then
    raise exception 'École introuvable.';
  end if;
  return v_patch;
end $$;

-- Postgres accorde EXECUTE à PUBLIC sur toute nouvelle fonction, et Supabase
-- l'accorde en plus nommément à anon : on ferme les deux.
revoke execute on function maj_reglages_compta(jsonb) from public, anon;
grant execute on function maj_reglages_compta(jsonb) to authenticated;

-- Contrôle :
--   select has_function_privilege('anon', 'maj_reglages_compta(jsonb)', 'execute');          -- false
--   select has_function_privilege('authenticated', 'maj_reglages_compta(jsonb)', 'execute'); -- true
-- Sondes : node supabase/test-rls-postes.mjs
