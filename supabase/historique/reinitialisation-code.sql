-- ════════════════════════════════════════════════════════════════════════
--  EduGest — Mot de passe oublié par code SMS / WhatsApp (étape 4)   [delta]
-- ════════════════════════════════════════════════════════════════════════
-- À exécuter dans Supabase → SQL Editor, APRÈS comptes-parents.sql.
-- Idempotent. Déployer ensuite : supabase functions deploy password-reset
--
-- Un parent sans e-mail qui a oublié son mot de passe reçoit un code à 6
-- chiffres sur le numéro de son compte (comptes.telephone) et choisit lui-même
-- un nouveau mot de passe, sans attendre la Direction. Réservé aux écoles du
-- plan Premium (chaque SMS est facturé) et actif seulement si un fournisseur
-- SMS ou WhatsApp est configuré (secrets de supabase/functions/_shared/
-- messagerie.ts) ; sinon la demande continue d'aller à la Direction.
--
-- Seule l'Edge Function password-reset (service_role) lit et écrit cette
-- table : RLS activée SANS politique → invisible pour anon et authenticated.
-- Le code n'y est jamais en clair (empreinte HMAC-SHA256). Règles : 15 min
-- de validité, 5 essais, 3 codes par heure et par compte, un nouveau code
-- annule le précédent (supabase/functions/password-reset/code.ts).

create table if not exists codes_reinitialisation (
  id          uuid primary key default gen_random_uuid(),
  ecole_id    uuid not null references ecoles(id) on delete cascade,
  compte_id   uuid not null references comptes(id) on delete cascade,
  empreinte   text not null,
  canal       text,                              -- 'sms' | 'whatsapp' (suivi du coût)
  essais      int  not null default 0,           -- codes faux saisis
  expire_le   timestamptz not null,
  utilise_le  timestamptz,                       -- mot de passe enregistré
  created_at  timestamptz not null default now()
);
create index if not exists idx_codes_reinit_compte on codes_reinitialisation (compte_id, created_at desc);
create index if not exists idx_codes_reinit_ecole  on codes_reinitialisation (ecole_id, created_at desc);

alter table codes_reinitialisation enable row level security;
-- (Aucune politique : seul service_role, qui contourne la RLS, y accède.)

-- Vérification d'un code saisi, ATOMIQUE : le verrou de ligne (for update)
-- sérialise les essais simultanés, qui ne peuvent donc pas dépasser la limite.
-- Seul le dernier code non utilisé du compte compte. Un code faux est compté ;
-- un code juste n'est PAS consommé ici : l'Edge Function le marque utilisé une
-- fois le mot de passe enregistré (un mot de passe refusé ne grille pas le code).
-- Retour : { statut: 'ok' | 'faux' | 'epuise' | 'expire', codeId, essaisRestants }.
create or replace function verifier_code_reinitialisation(p_compte_id uuid, p_empreinte text, p_essais_max int)
returns jsonb language plpgsql set search_path = public as $$
declare
  c codes_reinitialisation%rowtype;
begin
  select * into c from codes_reinitialisation
   where compte_id = p_compte_id and utilise_le is null
   order by created_at desc
   limit 1
   for update;
  if not found or c.expire_le <= now() then
    return jsonb_build_object('statut', 'expire');
  end if;
  if c.essais >= p_essais_max then
    return jsonb_build_object('statut', 'epuise', 'codeId', c.id);
  end if;
  if c.empreinte is distinct from p_empreinte then
    update codes_reinitialisation set essais = essais + 1 where id = c.id;
    return jsonb_build_object(
      'statut', case when c.essais + 1 >= p_essais_max then 'epuise' else 'faux' end,
      'codeId', c.id,
      'essaisRestants', greatest(p_essais_max - c.essais - 1, 0));
  end if;
  return jsonb_build_object('statut', 'ok', 'codeId', c.id, 'essaisRestants', p_essais_max - c.essais);
end $$;
-- Postgres accorde EXECUTE à PUBLIC sur toute nouvelle fonction, et Supabase
-- l'accorde en plus nommément à anon et authenticated : on ferme les trois.
revoke execute on function verifier_code_reinitialisation(uuid, text, int) from public, anon, authenticated;
grant execute on function verifier_code_reinitialisation(uuid, text, int) to service_role;

-- Contrôle : rls_active = true, aucune politique, et EXECUTE réservé à service_role.
select relrowsecurity as rls_active,
       (select count(*) from pg_policies where tablename = 'codes_reinitialisation') as politiques,
       has_function_privilege('anon', 'verifier_code_reinitialisation(uuid, text, int)', 'execute') as anon_peut_verifier
from pg_class where relname = 'codes_reinitialisation';
