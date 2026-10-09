-- 20261008234227_fusion_extra_ecole.sql
-- Pourquoi : la fiche école (ecoles.extra, jsonb) était modifiée par
-- lecture → fusion côté navigateur → réécriture du jsonb ENTIER. Deux
-- écritures proches s'écrasaient : la seconde, partie d'une lecture
-- antérieure, effaçait la première. Constaté par les tests e2e : à la
-- première ouverture de « Comptes & Postes », la création des postes par
-- défaut (6 réécritures de extra) a effacé `anneeScolaire` et le repère
-- `clotures` posés par une clôture d'année — fiches élèves remises à zéro,
-- école restée sur l'ancienne année, promotion impossible.
--
-- La fusion se fait désormais EN BASE, en une instruction : seules les clés
-- envoyées changent (fusion de premier niveau, `||`). SECURITY INVOKER : la
-- RLS (ecoles_update) et le trigger ecoles_guard s'appliquent comme avant.
-- Renvoie le nouvel extra, ou NULL si aucune ligne n'a été modifiée (refus
-- RLS, école introuvable) — l'appelant le traite en erreur.
--
-- Règles (docs/migrations-sql.md) :
--  - appliquée UNE fois, dans l'ordre, par la CI au déploiement — jamais à
--    la main dans l'éditeur SQL ;
--  - compatible avec le front encore en ligne (ajouter avant de retirer) ;
--  - ne jamais modifier une migration déjà fusionnée : en écrire une autre.

create or replace function public.fusionner_extra_ecole(p_code text, p_champs jsonb)
returns jsonb
language sql
security invoker
set search_path = public
as $$
  update ecoles
     set extra = coalesce(extra, '{}'::jsonb) || coalesce(p_champs, '{}'::jsonb)
   where code = lower(btrim(p_code))
  returning extra;
$$;

revoke execute on function public.fusionner_extra_ecole(text, jsonb) from public, anon;
grant execute on function public.fusionner_extra_ecole(text, jsonb) to authenticated, service_role;

comment on function public.fusionner_extra_ecole(text, jsonb) is
  'Fusion atomique de clés dans ecoles.extra (sans lecture-réécriture côté client). NULL = rien modifié.';
