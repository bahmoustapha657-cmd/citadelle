-- 20261109210000_fusion_jsonb.sql
-- Pourquoi : la fiche élève (eleves.extra, jsonb : mois payés, acomptes,
-- frais, archives des années closes…) était réécrite EN ENTIER à chaque
-- modification. Hors ligne, la file PowerSync remontait tout `extra` calculé
-- sur le miroir de l'appareil ; en ligne, modifierChampDoc relisait puis
-- réécrivait le jsonb. Deux postes qui touchent le même élève (deux mois
-- encaissés sur deux postes, un poste resté hors ligne, un paiement en ligne
-- imputé pendant ce temps) s'effaçaient : le dernier envoi gagnait sur tout
-- le jsonb. Même défaut que celui corrigé pour ecoles.extra
-- (20261008234227_fusion_extra_ecole), cette fois pour toutes les tables.
--
-- La fusion se fait désormais EN BASE, en une instruction UPDATE : seuls les
-- chemins envoyés changent, à n'importe quelle profondeur (« mens.Oct » sans
-- toucher « mens.Nov »). Une écriture concurrente sur la même ligne est
-- attendue puis la fusion se rejoue sur la version à jour (READ COMMITTED) :
-- rien n'est perdu. SECURITY INVOKER : RLS et triggers s'appliquent comme
-- pour un update ordinaire.
--
-- Règles (docs/migrations-sql.md) :
--  - appliquée UNE fois, dans l'ordre, par la CI au déploiement — jamais à
--    la main dans l'éditeur SQL ;
--  - compatible avec le front encore en ligne (ajouter avant de retirer) :
--    l'ancien front ne l'appelle pas ;
--  - ne jamais modifier une migration déjà fusionnée : en écrire une autre.

-- Applique une liste d'opérations à un objet jsonb. Chaque opération :
--   {"chemin": ["mens", "Oct"], "valeur": "Payé"}  → pose la valeur (crée
--     les objets intermédiaires manquants) ;
--   {"chemin": ["mens", "Oct"]}                    → retire la clé.
-- Fonction pure, sans accès aux tables.
create or replace function public.jsonb_appliquer_operations(p_base jsonb, p_operations jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v jsonb := coalesce(p_base, '{}'::jsonb);
  op jsonb;
  chemin text[];
  i int;
begin
  if jsonb_typeof(v) is distinct from 'object' then
    v := '{}'::jsonb;
  end if;
  if jsonb_typeof(p_operations) is distinct from 'array' then
    return v;
  end if;
  for op in select e from jsonb_array_elements(p_operations) as t(e) loop
    if jsonb_typeof(op -> 'chemin') is distinct from 'array' then
      continue;
    end if;
    select array_agg(x order by n) into chemin
      from jsonb_array_elements_text(op -> 'chemin') with ordinality as c(x, n);
    if chemin is null or cardinality(chemin) = 0 then
      continue;
    end if;
    if op ? 'valeur' then
      -- jsonb_set ne crée que le DERNIER niveau : les parents manquants (ou
      -- qui ne sont pas des objets) sont d'abord posés à {}.
      for i in 1 .. cardinality(chemin) - 1 loop
        if jsonb_typeof(v #> chemin[1:i]) is distinct from 'object' then
          v := jsonb_set(v, chemin[1:i], '{}'::jsonb, true);
        end if;
      end loop;
      v := jsonb_set(v, chemin, op -> 'valeur', true);
    else
      v := v #- chemin;
    end if;
  end loop;
  return v;
end;
$$;

-- Fusionne des opérations dans la colonne jsonb `p_colonne` (extra, details)
-- de la ligne `p_id` de `p_table`. Renvoie true si la ligne a été modifiée,
-- false sinon (refus RLS, ligne supprimée) — l'appelant le traite en refus.
create or replace function public.fusionner_jsonb(p_table text, p_id uuid, p_colonne text, p_operations jsonb)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  n int;
begin
  if p_colonne not in ('extra', 'details') or not exists (
    select 1
      from pg_attribute a
      join pg_class c on c.oid = a.attrelid
      join pg_namespace s on s.oid = c.relnamespace
     where s.nspname = 'public' and c.relname = p_table and c.relkind = 'r'
       and a.attname = p_colonne and a.atttypid = 'jsonb'::regtype
       and a.attnum > 0 and not a.attisdropped
  ) then
    raise exception 'fusionner_jsonb : colonne %.% non prise en charge', p_table, p_colonne
      using errcode = '22023';
  end if;

  execute format(
    'update public.%I set %I = public.jsonb_appliquer_operations(%I, $2) where id = $1',
    p_table, p_colonne, p_colonne
  ) using p_id, p_operations;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

revoke execute on function public.fusionner_jsonb(text, uuid, text, jsonb) from public, anon;
grant execute on function public.fusionner_jsonb(text, uuid, text, jsonb) to authenticated, service_role;

comment on function public.jsonb_appliquer_operations(jsonb, jsonb) is
  'Applique [{chemin, valeur?}] à un objet jsonb : valeur = poser, sans valeur = retirer.';
comment on function public.fusionner_jsonb(text, uuid, text, jsonb) is
  'Fusion atomique (chemin par chemin) dans la colonne jsonb extra/details d''une ligne. false = rien modifié.';
