-- 20261015122715_mois_garantie.sql
-- Pourquoi : les écoles font payer d'avance le dernier mois de l'année —
-- certaines les DEUX derniers. Nouvelle clé `moisGarantie` (0 à 3) de
-- ecoles.extra, écrite par la comptabilité via maj_reglages_compta : elle
-- fixe l'ordre d'encaissement et rend ces mois dus dès la rentrée dans
-- l'alerte mensualités. Le reste de la fonction est inchangé (copie de
-- 20261014102902_alerte_mensualites.sql).
--
-- Règles (docs/migrations-sql.md) :
--  - appliquée UNE fois, dans l'ordre, par la CI au déploiement — jamais à
--    la main dans l'éditeur SQL ;
--  - compatible avec le front encore en ligne (ajouter avant de retirer) ;
--  - ne jamais modifier une migration déjà fusionnée : en écrire une autre.

create or replace function public.maj_reglages_compta(p_champs jsonb) returns jsonb
    language plpgsql security definer
    set search_path to 'public'
    as $$
declare
  v_cle   text;
  v_patch jsonb := '{}'::jsonb;
  v_val   jsonb;
  v_jours jsonb;
  v_ret   jsonb;
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
      -- Jours travaillés (1 = lundi … 6 = samedi, au moins un) et nombre de
      -- retards valant une demi-journée d'absence.
      when 'reglagesPresences' then
        v_val := p_champs -> v_cle;
        v_jours := v_val -> 'joursTravail';
        v_ret := v_val -> 'retardsParDemiJournee';
        if jsonb_typeof(v_val) <> 'object'
           or jsonb_typeof(v_jours) <> 'array'
           or jsonb_array_length(v_jours) = 0
           or exists (select 1 from jsonb_array_elements(v_jours) j
                      where jsonb_typeof(j) <> 'number' or (j #>> '{}') !~ '^[1-6]$')
           or jsonb_typeof(v_ret) <> 'number'
           or (v_ret #>> '{}') !~ '^[0-9]+$'
           or (v_ret #>> '{}')::int not between 1 and 20 then
          raise exception 'Réglages des présences invalides.';
        end if;
        v_patch := v_patch || jsonb_build_object(v_cle, jsonb_build_object(
          'joursTravail', (select jsonb_agg(distinct (j #>> '{}')::int order by (j #>> '{}')::int)
                           from jsonb_array_elements(v_jours) j),
          'retardsParDemiJournee', (v_ret #>> '{}')::int));
      -- Alerte mensualités : jour du mois à partir duquel un mois non payé
      -- est en retard, et nombre de mois de retard déclenchant l'alerte.
      -- Mêmes bornes que l'écran (alerte-mensualites.js).
      when 'alerteMensualites' then
        v_val := p_champs -> v_cle;
        if jsonb_typeof(v_val) <> 'object'
           or jsonb_typeof(v_val -> 'jourEcheance') <> 'number'
           or (v_val ->> 'jourEcheance') !~ '^[0-9]+$'
           or (v_val ->> 'jourEcheance')::int not between 1 and 28
           or jsonb_typeof(v_val -> 'seuilMois') <> 'number'
           or (v_val ->> 'seuilMois') !~ '^[0-9]+$'
           or (v_val ->> 'seuilMois')::int not between 1 and 12 then
          raise exception 'Réglages de l''alerte mensualités invalides.';
        end if;
        v_patch := v_patch || jsonb_build_object(v_cle, jsonb_build_object(
          'jourEcheance', (v_val ->> 'jourEcheance')::int,
          'seuilMois', (v_val ->> 'seuilMois')::int));
      -- Mois de garantie : nombre de derniers mois payés d'avance (0 à 3).
      -- Mêmes bornes que l'écran (moisGarantieEcole, paiements-scolarite.js).
      when 'moisGarantie' then
        if jsonb_typeof(p_champs -> v_cle) <> 'number'
           or (p_champs ->> v_cle) !~ '^[0-3]$' then
          raise exception 'Mois de garantie invalide (0 à 3).';
        end if;
        v_patch := v_patch || jsonb_build_object(v_cle, (p_champs ->> v_cle)::int);
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

-- CREATE OR REPLACE garde les droits existants ; on les réaffirme quand même
-- (cf. piège EXECUTE à PUBLIC des fonctions SECURITY DEFINER).
revoke all on function public.maj_reglages_compta(jsonb) from public;
grant execute on function public.maj_reglages_compta(jsonb) to authenticated;
grant execute on function public.maj_reglages_compta(jsonb) to service_role;
