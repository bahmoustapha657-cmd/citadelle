-- ════════════════════════════════════════════════════════════════════════
--  EduGest — Abonnements push : école, rôle et poste fixés PAR LA BASE  [delta]
-- ════════════════════════════════════════════════════════════════════════
-- À exécuter dans Supabase → SQL Editor, APRÈS push.sql et postes.sql.
-- Idempotent. Ne supprime aucune ligne : le nettoyage de l'existant est dans
-- push-subs-purge.sql (contrôle d'abord, suppression sur confirmation).
-- Puis redéployer l'Edge Function : supabase functions deploy push
--
-- FAILLE (2026-10-07, côté réception) : la policy push_subs_self ne vérifiait
-- que user_id = auth.uid(). ecole_id, role et poste_cle étaient écrits tels
-- quels par le navigateur (push-supabase.js, sAbonnerAuxPush) : un parent de
-- l'école A pouvait s'inscrire avec ecole_id = école B et role = 'direction'
-- et recevoir les notifications ciblées de B (paiements, absences avec le
-- nom de l'élève…). La clé (ecole_id, user_id) permettait une ligne par école.
--
-- RÈGLES
--   1. Déclencheur push_subs_identite : role et poste_cle sont RECALCULÉS
--      depuis le compte du user_id à chaque écriture (ce que le navigateur
--      envoie est ignoré) ; un abonnement n'existe que pour un compte, et
--      dans l'école de ce compte — le superadmin (sans école) excepté.
--      Vaut pour tous les écrivains, service_role compris.
--   2. Policy push_subs_self : on n'écrit que SA ligne, dans SON école
--      (auth_ecole_id(), qui rend NULL pour une école hors service →
--      ecole-hors-service.sql), avec SON rôle.
--   3. Superadmin : push_subs_superadmin (push.sql) inchangée.
--   4. L'Edge Function push ne se fie plus à ces colonnes : elle relit
--      `comptes` avant chaque envoi (functions/push/destinataires.ts).
--
-- ecole-hors-service.sql : push_subs reste hors de sa garde d'écriture
-- (trg_garde_ecriture_ecole) ; le déclencheur ci-dessous a un autre nom, son
-- rejeu n'y touche pas. Une école EXPIRÉE garde ses abonnements (lecture
-- seule ailleurs) ; une école HORS SERVICE ne peut plus s'abonner.

-- ── 1. Déclencheur : rôle et poste recalculés, école du compte ──────────────
-- Clé de ciblage = clé du poste, sinon le rôle ; parents et enseignants hors
-- des postes (même règle que my_permissions() et que l'Edge Function).
create or replace function push_subs_identite() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  v_role  text;
  v_ecole uuid;
  v_cle   text;
begin
  select c.role::text, c.ecole_id,
         case when c.role::text in ('parent', 'enseignant') then c.role::text
              else coalesce(p.cle, c.role::text) end
    into v_role, v_ecole, v_cle
    from comptes c
    left join postes p on p.id = c.poste_id
   where c.user_id = new.user_id;

  if v_role is null then
    raise exception 'Abonnement push refusé : aucun compte pour cet utilisateur.'
      using errcode = '42501';
  end if;
  if v_role <> 'superadmin' and new.ecole_id is distinct from v_ecole then
    raise exception 'Abonnement push refusé : école différente de celle du compte.'
      using errcode = '42501';
  end if;

  new.role := v_role;
  new.poste_cle := v_cle;
  return new;
end $$;
-- Jamais appelable en direct (piège EXECUTE à PUBLIC) ; le déclencheur, lui,
-- s'exécute sans ce droit.
revoke execute on function push_subs_identite() from public, anon, authenticated;

drop trigger if exists trg_push_subs_identite on push_subs;
create trigger trg_push_subs_identite before insert or update on push_subs
  for each row execute function push_subs_identite();

-- ── 2. Policy : sa ligne, son école, son rôle ───────────────────────────────
-- (WITH CHECK est évalué APRÈS le déclencheur BEFORE : role vaut déjà celui
-- du compte ; le contrôle reste utile si le déclencheur venait à manquer.)
drop policy if exists push_subs_self on push_subs;
create policy push_subs_self on push_subs for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid()
              and ecole_id = auth_ecole_id()
              and role = auth_role()::text);

-- Contrôle : trg_push_subs_identite présent, policy durcie, EXECUTE fermé.
--   select tgname from pg_trigger where tgrelid = 'push_subs'::regclass and not tgisinternal;
--   select policyname, with_check from pg_policies where tablename = 'push_subs';
--   select has_function_privilege('anon', 'push_subs_identite()', 'execute');           -- false
--   select has_function_privilege('authenticated', 'push_subs_identite()', 'execute');  -- false
