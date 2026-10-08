-- ════════════════════════════════════════════════════════════════════════
--  EduGest — Abonnements push incohérents avec `comptes` : contrôle, puis purge
-- ════════════════════════════════════════════════════════════════════════
-- Compagnon de push-subs-verrou.sql (faille de réception push, 2026-10-07).
-- Exécuter tel quel dans Supabase → SQL Editor : ce fichier ne fait QUE LIRE.
-- L'éditeur n'affiche que le résultat de la DERNIÈRE requête : le détail
-- (étape 2) est donc placé en dernier ; pour la synthèse, sélectionner
-- l'étape 1 seule et « Run selected ».
-- Les étapes 3 et 4 (DELETE / UPDATE) sont commentées : les décommenter et
-- les lancer seulement après lecture des résultats.
--
-- Une ligne est INCOHÉRENTE quand :
--   • aucun compte n'a ce user_id (compte supprimé) ;
--   • ou le compte n'est pas de l'école de la ligne (superadmin excepté) —
--     c'est la forme de l'exploitation : une ligne « direction » posée par un
--     parent dans une autre école. Une telle ligne mérite d'être regardée
--     (qui, quand, quel rôle déclaré) avant d'être effacée.
-- Une ligne est À RÉALIGNER quand le compte est bon mais que role/poste_cle
-- diffèrent de ce que le compte dit (poste changé depuis, ligne antérieure à
-- postes.sql, ou valeur forgée dans sa propre école). L'Edge Function les
-- ignore déjà ; le réalignement garde la table lisible.
-- (La colonne `subscription`, qui contient les clés du navigateur, n'est
-- jamais lue ici.)

-- ── 1. Synthèse par école ────────────────────────────────────────────────────
select e.code as ecole, count(*) as abonnements,
       count(*) filter (where c.user_id is null) as sans_compte,
       count(*) filter (where c.user_id is not null and c.role::text <> 'superadmin'
                          and c.ecole_id is distinct from ps.ecole_id) as autre_ecole,
       count(*) filter (where c.user_id is not null
                          and (c.role::text = 'superadmin' or c.ecole_id = ps.ecole_id)
                          and (ps.role is distinct from c.role::text
                               or ps.poste_cle is distinct from
                                  case when c.role::text in ('parent', 'enseignant') then c.role::text
                                       else coalesce(p.cle, c.role::text) end)) as a_realigner
from push_subs ps
left join comptes c on c.user_id = ps.user_id
left join postes p on p.id = c.poste_id
left join ecoles e on e.id = ps.ecole_id
group by e.code
order by e.code;

-- ── 2. Détail des lignes à traiter (à montrer avant toute suppression) ───────
with lignes as (
  select ps.ecole_id, ps.user_id, ps.nom, ps.role as role_declare, ps.poste_cle as cle_declaree,
         ps.updated_at, c.login, c.role::text as role_compte, c.ecole_id as ecole_compte, c.statut,
         case when c.role::text in ('parent', 'enseignant') then c.role::text
              else coalesce(p.cle, c.role::text) end as cle_attendue,
         (c.user_id is not null) as a_compte
  from push_subs ps
  left join comptes c on c.user_id = ps.user_id
  left join postes p on p.id = c.poste_id
)
select case
         when not l.a_compte then '1. SANS COMPTE → supprimer'
         when l.role_compte <> 'superadmin' and l.ecole_compte is distinct from l.ecole_id
           then '2. AUTRE ÉCOLE → supprimer'
         else '3. rôle/poste à réaligner'
       end as diagnostic,
       e.code as ecole_ligne, ec.code as ecole_du_compte, l.login, l.nom,
       l.role_declare, l.cle_declaree, l.role_compte, l.cle_attendue, l.statut, l.updated_at, l.user_id
from lignes l
left join ecoles e on e.id = l.ecole_id
left join ecoles ec on ec.id = l.ecole_compte
where not l.a_compte
   or (l.role_compte <> 'superadmin' and l.ecole_compte is distinct from l.ecole_id)
   or l.role_declare is distinct from l.role_compte
   or l.cle_declaree is distinct from l.cle_attendue
order by diagnostic, ecole_ligne, l.login;

-- ── 3. PURGE (après confirmation) : lignes sans compte ou d'une autre école ──
-- Le nombre de lignes supprimées doit égaler sans_compte + autre_ecole (étape 1).
-- delete from push_subs ps
--  where not exists (
--    select 1 from comptes c
--     where c.user_id = ps.user_id
--       and (c.role::text = 'superadmin' or c.ecole_id = ps.ecole_id));

-- ── 4. RÉALIGNEMENT (après l'étape 3 et push-subs-verrou.sql) ────────────────
-- Non destructif : le déclencheur push_subs_identite recalcule role et
-- poste_cle depuis le compte ; updated_at est conservé. Nombre attendu :
-- a_realigner (étape 1).
-- update push_subs ps set updated_at = ps.updated_at
--   from comptes c
--   left join postes p on p.id = c.poste_id
--  where c.user_id = ps.user_id
--    and (c.role::text = 'superadmin' or c.ecole_id = ps.ecole_id)
--    and (ps.role is distinct from c.role::text
--         or ps.poste_cle is distinct from
--            case when c.role::text in ('parent', 'enseignant') then c.role::text
--                 else coalesce(p.cle, c.role::text) end);

-- Contrôle final : l'étape 2 doit renvoyer 0 ligne.
