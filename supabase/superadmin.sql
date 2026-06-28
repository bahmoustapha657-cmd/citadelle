-- ════════════════════════════════════════════════════════════════════════
--  EduGest/GANDAL — Support du SUPERADMIN (transversal, sans école)   [delta]
-- ════════════════════════════════════════════════════════════════════════
-- À exécuter UNE FOIS dans Supabase → SQL Editor (sur une base déjà créée via
-- schema.sql + rls.sql). Rend `comptes.ecole_id` nullable (le superadmin n'a
-- pas d'école) et donne au rôle superadmin un accès COMPLET à toutes les écoles
-- via une politique permissive par table (s'ajoute aux règles existantes).
-- ════════════════════════════════════════════════════════════════════════

-- 1) Le superadmin n'appartient à aucune école.
alter table comptes alter column ecole_id drop not null;

-- 2) Helper : l'utilisateur courant est-il superadmin ?
create or replace function is_superadmin() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce(auth_role() = 'superadmin', false);
$$;

-- 3) Accès total du superadmin à chaque table (politique permissive additive).
do $$
declare t text;
begin
  for t in select unnest(array[
    'ecoles','comptes','enseignants','classes','matieres','eleves','notes',
    'absences','emplois','enseignements','appreciations','paiements','tarifs',
    'salaires','parent_eleves','audit'])
  loop
    execute format('drop policy if exists %1$s_superadmin on %1$s;', t);
    execute format(
      'create policy %1$s_superadmin on %1$s for all to authenticated
         using (is_superadmin()) with check (is_superadmin());', t);
  end loop;
end $$;
