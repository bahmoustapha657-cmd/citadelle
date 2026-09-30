-- ════════════════════════════════════════════════════════════════════════
--  EduGest — L'enseignant lit SES fiches de paie   [delta]
-- ════════════════════════════════════════════════════════════════════════
-- À exécuter dans Supabase → SQL Editor, APRÈS postes.sql. Idempotent.
--
-- PROBLÈME CORRIGÉ : l'onglet « Salaire » du portail enseignant est vide.
--   • Depuis postes.sql (§ 9, 2026-07-17), `salaires` n'est lisible que par
--     le module compta (has_module_read('compta')), et my_permissions() vaut
--     {} pour un enseignant : sa lecture renvoie zéro ligne, sans erreur.
--   • Depuis le hors ligne total (2026-07-22), le portail lisait en plus le
--     miroir PowerSync, où `salaires` n'arrive que par le bucket compta_data.
-- Le handler Firebase /teacher-portal, lui, lisait toutes les fiches côté
-- serveur et ne renvoyait que celles au nom de l'enseignant.
--
-- REMÈDE : une policy de LECTURE de plus. Les policies permissives se
-- cumulent en OU : salaires_select (compta) est inchangée, et celle-ci
-- n'ouvre rien à qui n'est pas enseignant (mes_noms_paie() est alors vide).
-- Un compte `enseignant` lit les fiches de SON école dont le nom est l'un
-- des siens :
--   • enseignant_nom et nom de son compte (les noms que filtrait le portail) ;
--   • prénom + nom de SA fiche enseignant (enseignant_id) : c'est de là que
--     vient le nom inscrit sur la fiche de paie (buildTeacherFullName), qui
--     reste donc trouvé si la fiche a été renommée après la création du compte.
-- Les noms sont comparés sous la même forme que matchesTeacherAlias côté
-- application (casse, accents, espaces, suffixe « (prof) »).
--
-- Aucune usurpation : comptes_guard interdit à l'intéressé de changer son
-- nom, son enseignant_nom ou son enseignant_id. Homonymes : deux enseignants
-- de même nom voient les fiches l'un de l'autre — comme sous Firebase.
-- Écriture inchangée : module compta seulement (salaires_write).
--
-- Le portail lit ces fiches par le RÉSEAU (teacher-portal-supabase.js) : les
-- règles PowerSync ne changent pas. Rejouer rls.sql ou postes.sql ne touche
-- pas cette policy (ils ne suppriment que salaires_select / salaires_write).

-- Forme comparable d'un nom, miroir de normalizeText(stripLegacyTeacherSuffix())
-- (src/backend/teacher-scope.js) : suffixe « (…) » final retiré, accents
-- ôtés, minuscules, espaces réduits. Les deux listes de translate() sont
-- celles que donne la décomposition NFD du JavaScript sur U+00C0–U+017F ;
-- tests/salaires-portail-enseignant.test.js vérifie qu'elles le restent.
-- Fonction pure, sans accès aux données : pas de SECURITY DEFINER.
create or replace function nom_paie_normalise(p_nom text) returns text
  language sql immutable set search_path = public as $$
  select btrim(regexp_replace(
    lower(translate(
      regexp_replace(coalesce(p_nom, ''), '\s*\([^)]*\)\s*$', ''),
      'ÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝàáâãäåçèéêëìíîïñòóôõöùúûüýÿ'
        || 'ĀāĂăĄąĆćĈĉĊċČčĎďĒēĔĕĖėĘęĚěĜĝĞğĠġĢģĤĥĨĩĪīĬĭĮįİĴĵĶķĹĺĻļĽľŃńŅņŇňŌōŎŏŐőŔŕŖŗŘřŚśŜŝŞşŠšŢţŤťŨũŪūŬŭŮůŰűŲųŴŵŶŷŸŹźŻżŽž',
      'aaaaaaceeeeiiiinooooouuuuyaaaaaaceeeeiiiinooooouuuuyy'
        || 'aaaaaaccccccccddeeeeeeeeeegggggggghhiiiiiiiiijjkkllllllnnnnnnoooooorrrrrrssssssssttttuuuuuuuuuuuuwwyyyzzzzzz')),
    '\s+', ' ', 'g'));
$$;

-- Noms (normalisés) sous lesquels le compte courant touche une paie : vide
-- pour tout compte qui n'est pas enseignant. SECURITY DEFINER : lit comptes
-- et enseignants sans dépendre de leur RLS, pour le seul auth.uid().
create or replace function mes_noms_paie() returns text[]
  language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct n) filter (where n <> ''), '{}')
  from comptes c
  left join enseignants e on e.id = c.enseignant_id and e.ecole_id = c.ecole_id
  cross join lateral unnest(array[
    nom_paie_normalise(c.enseignant_nom),
    nom_paie_normalise(c.nom),
    nom_paie_normalise(concat_ws(' ', e.prenom, e.nom))
  ]) as noms(n)
  where c.user_id = auth.uid() and c.role = 'enseignant';
$$;

-- Postgres accorde EXECUTE à PUBLIC sur toute nouvelle fonction, et Supabase
-- l'accorde en plus nommément à anon : on ferme les deux.
revoke execute on function mes_noms_paie() from public, anon;
grant execute on function mes_noms_paie() to authenticated;

-- Sous-requête sans corrélation : mes_noms_paie() est évaluée UNE fois par
-- requête, pas par ligne. (Pas de `= any ((select …))` : Postgres y lit une
-- sous-requête et compare le nom au TABLEAU entier → text = text[].)
drop policy if exists salaires_select_enseignant on salaires;
create policy salaires_select_enseignant on salaires for select to authenticated
  using (ecole_id = auth_ecole_id()
         and nom_paie_normalise(nom) in (select unnest(mes_noms_paie())));

-- Contrôle :
--   select policyname, cmd, qual from pg_policies where tablename = 'salaires';
--   select nom_paie_normalise('  AÏSSATOU   Bah (prof) ');   -- 'aissatou bah'
-- Sondes réelles (école DEMO, comptes temporaires) :
--   node supabase/test-salaires-enseignant.mjs
