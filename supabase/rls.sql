-- ════════════════════════════════════════════════════════════════════════
--  EduGest — Row Level Security (Supabase)
-- ════════════════════════════════════════════════════════════════════════
-- Équivalent des firestore.rules : « qui voit/écrit quoi ».
-- À appliquer APRÈS schema.sql.
--
-- Modèle v1 :
--   • Isolation par école : on ne voit/écrit que les lignes de SON école.
--   • Lecture : le personnel voit toute son école ; un PARENT ne voit que les
--     données de SES enfants (table parent_eleves).
--   • Écriture : réservée au personnel (et aux enseignants pour notes/absences).
--   • Le filtrage fin « enseignant → seulement ses classes » reste à porter
--     (phase 2 — aujourd'hui assuré côté serveur dans /api/teacher-portal).
-- ════════════════════════════════════════════════════════════════════════

-- ── Helpers (SECURITY DEFINER : lisent le profil de l'utilisateur courant) ──
create or replace function auth_ecole_id() returns uuid
  language sql stable security definer set search_path = public as $$
  select ecole_id from comptes where user_id = auth.uid() limit 1;
$$;

create or replace function auth_role() returns role_compte
  language sql stable security definer set search_path = public as $$
  select role from comptes where user_id = auth.uid() limit 1;
$$;

create or replace function my_compte_id() returns uuid
  language sql stable security definer set search_path = public as $$
  select id from comptes where user_id = auth.uid() limit 1;
$$;

create or replace function is_staff() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce(auth_role() in
    ('superadmin','direction','admin','comptable','primaire','college'), false);
$$;

-- Peut écrire des notes/absences : personnel + enseignant.
create or replace function can_grade() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce(is_staff() or auth_role() = 'enseignant', false);
$$;

-- Superadmin : compte transversal (aucune école) avec accès complet.
create or replace function is_superadmin() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce(auth_role() = 'superadmin', false);
$$;

-- Élèves rattachés au parent courant.
create or replace function my_eleve_ids() returns setof uuid
  language sql stable security definer set search_path = public as $$
  select eleve_id from parent_eleves where compte_id = my_compte_id();
$$;

-- Résolution PUBLIQUE de l'état d'une école (écran de connexion, avant auth).
create or replace function etat_ecole(p_code text)
  returns table(id uuid, code text, nom text, logo text,
                couleur1 text, couleur2 text, actif boolean, supprime boolean)
  language sql stable security definer set search_path = public as $$
  select id, code, nom, logo, couleur1, couleur2, actif, supprime
  from ecoles where code = lower(p_code);
$$;
grant execute on function etat_ecole(text) to anon, authenticated;

-- ── Activation RLS sur toutes les tables ───────────────────────────────────
do $$
declare t text;
begin
  for t in select unnest(array[
    'ecoles','comptes','enseignants','classes','matieres','eleves','notes',
    'absences','emplois','enseignements','appreciations','paiements','tarifs',
    'salaires','parent_eleves','audit'])
  loop
    execute format('alter table %I enable row level security;', t);
  end loop;
end $$;

-- ── ÉCOLES ─────────────────────────────────────────────────────────────────
drop policy if exists ecoles_select on ecoles;
create policy ecoles_select on ecoles for select to authenticated
  using (id = auth_ecole_id());
drop policy if exists ecoles_update on ecoles;
create policy ecoles_update on ecoles for update to authenticated
  using (id = auth_ecole_id() and is_staff());

-- ── COMPTES ────────────────────────────────────────────────────────────────
drop policy if exists comptes_select on comptes;
create policy comptes_select on comptes for select to authenticated
  using (ecole_id = auth_ecole_id() and (is_staff() or user_id = auth.uid()));
drop policy if exists comptes_write on comptes;
create policy comptes_write on comptes for all to authenticated
  using (ecole_id = auth_ecole_id() and (is_staff() or user_id = auth.uid()))
  with check (ecole_id = auth_ecole_id() and (is_staff() or user_id = auth.uid()));

-- ── Macro : table « personnel lit/écrit son école » ────────────────────────
-- (enseignants, classes, matieres, emplois, enseignements, tarifs, salaires)
do $$
declare t text;
begin
  for t in select unnest(array[
    'enseignants','classes','matieres','emplois','enseignements','tarifs','salaires'])
  loop
    execute format('drop policy if exists %1$s_select on %1$s;', t);
    execute format(
      'create policy %1$s_select on %1$s for select to authenticated
         using (ecole_id = auth_ecole_id());', t);
    execute format('drop policy if exists %1$s_write on %1$s;', t);
    execute format(
      'create policy %1$s_write on %1$s for all to authenticated
         using (ecole_id = auth_ecole_id() and is_staff())
         with check (ecole_id = auth_ecole_id() and is_staff());', t);
  end loop;
end $$;

-- ── ÉLÈVES (parent : seulement ses enfants en lecture) ─────────────────────
drop policy if exists eleves_select on eleves;
create policy eleves_select on eleves for select to authenticated
  using (ecole_id = auth_ecole_id()
         and (auth_role() <> 'parent' or id in (select my_eleve_ids())));
drop policy if exists eleves_write on eleves;
create policy eleves_write on eleves for all to authenticated
  using (ecole_id = auth_ecole_id() and is_staff())
  with check (ecole_id = auth_ecole_id() and is_staff());

-- ── NOTES (parent : enfants ; écriture : personnel + enseignant) ───────────
drop policy if exists notes_select on notes;
create policy notes_select on notes for select to authenticated
  using (ecole_id = auth_ecole_id()
         and (auth_role() <> 'parent' or eleve_id in (select my_eleve_ids())));
drop policy if exists notes_write on notes;
create policy notes_write on notes for all to authenticated
  using (ecole_id = auth_ecole_id() and can_grade())
  with check (ecole_id = auth_ecole_id() and can_grade());

-- ── ABSENCES (idem notes) ──────────────────────────────────────────────────
drop policy if exists absences_select on absences;
create policy absences_select on absences for select to authenticated
  using (ecole_id = auth_ecole_id()
         and (auth_role() <> 'parent' or eleve_id in (select my_eleve_ids())));
drop policy if exists absences_write on absences;
create policy absences_write on absences for all to authenticated
  using (ecole_id = auth_ecole_id() and can_grade())
  with check (ecole_id = auth_ecole_id() and can_grade());

-- ── APPRÉCIATIONS (parent lit ses enfants ; écriture personnel) ────────────
drop policy if exists appreciations_select on appreciations;
create policy appreciations_select on appreciations for select to authenticated
  using (ecole_id = auth_ecole_id()
         and (auth_role() <> 'parent' or eleve_id in (select my_eleve_ids())));
drop policy if exists appreciations_write on appreciations;
create policy appreciations_write on appreciations for all to authenticated
  using (ecole_id = auth_ecole_id() and is_staff())
  with check (ecole_id = auth_ecole_id() and is_staff());

-- ── PAIEMENTS (parent lit ses enfants ; écriture personnel) ────────────────
drop policy if exists paiements_select on paiements;
create policy paiements_select on paiements for select to authenticated
  using (ecole_id = auth_ecole_id()
         and (auth_role() <> 'parent' or eleve_id in (select my_eleve_ids())));
drop policy if exists paiements_write on paiements;
create policy paiements_write on paiements for all to authenticated
  using (ecole_id = auth_ecole_id() and is_staff())
  with check (ecole_id = auth_ecole_id() and is_staff());

-- ── PARENT_ELEVES (liens) — gérés par le personnel ; parent lit les siens ──
drop policy if exists parent_eleves_select on parent_eleves;
create policy parent_eleves_select on parent_eleves for select to authenticated
  using (compte_id = my_compte_id() or is_staff());
drop policy if exists parent_eleves_write on parent_eleves;
create policy parent_eleves_write on parent_eleves for all to authenticated
  using (is_staff()) with check (is_staff());

-- ── AUDIT (inaltérable : insertion par tout membre, jamais update/delete) ──
drop policy if exists audit_insert on audit;
create policy audit_insert on audit for insert to authenticated
  with check (ecole_id = auth_ecole_id());
drop policy if exists audit_select on audit;
create policy audit_select on audit for select to authenticated
  using (ecole_id = auth_ecole_id() and is_staff());
-- (Pas de policy update/delete → impossible par défaut sous RLS.)

-- ── SUPERADMIN : accès complet à toutes les écoles (politique permissive) ───
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
