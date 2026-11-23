-- 20261123184655_codes_ecole_courts.sql
-- Pourquoi : un code d'école tiré du nom complet
-- (« groupe-scolaire-prenom-nom-de-famille ») est pénible à taper. Une école
-- peut désormais avoir EN PLUS un code court : un seul mot de son nom,
-- accepté partout où un code d'école est saisi (connexion, mot de passe
-- oublié, rattachement d'un enseignant, lien de la page vitrine).
--
-- Le code d'origine ne change pas et reste accepté : c'est l'identifiant
-- interne de l'école (e-mails de connexion `login.code@…`, secret des QR des
-- documents imprimés, chemins des fichiers). ecoles_guard le garde immuable.
-- Le code court n'est qu'un autre nom pour le même code : la saisie est
-- traduite en code d'origine dès l'écran, rien d'autre ne le voit.
--
-- Les codes (d'origine et courts) sont uniques TOUS ENSEMBLE, sans tenir
-- compte des majuscules ni des accents. Le code court est posé par EduGest
-- (superadmin ou script), jamais par l'école elle-même.
--
-- Règles (docs/migrations-sql.md) :
--  - appliquée UNE fois, dans l'ordre, par la CI au déploiement — jamais à
--    la main dans l'éditeur SQL ;
--  - compatible avec le front encore en ligne (ajouter avant de retirer) ;
--  - ne jamais modifier une migration déjà fusionnée : en écrire une autre.

-- ── 1. Saisie d'un code → forme comparable ─────────────────────────────
-- Sans espaces autour, sans accents, en minuscules. Même règle que le
-- navigateur (src/components/connexion/code-ecole.js). `translate` plutôt
-- que l'extension unaccent : rien à installer, et la fonction reste
-- IMMUABLE. Les majuscules accentuées sont traduites AVANT lower(), qui
-- dépend de la collation de la base pour les lettres hors ASCII.
create or replace function public.normaliser_code_ecole(p_code text)
returns text
    language sql immutable parallel safe
    set search_path to ''
    as $$
  select lower(translate(btrim(coalesce(p_code, '')),
    'ÀÁÂÃÄÅĀĂĄÇĆČĎÈÉÊËĒĖĘĚÌÍÎÏĪĮÑŃŇÒÓÔÕÖØŌŐŔŘŚŠŞŢŤÙÚÛÜŪŮŰŲÝŸŽŹŻàáâãäåāăąçćčďèéêëēėęěìíîïīįñńňòóôõöøōőŕřśšşţťùúûüūůűųýÿžźż',
    'aaaaaaaaacccdeeeeeeeeiiiiiinnnoooooooorrsssttuuuuuuuuyyzzzaaaaaaaaacccdeeeeeeeeiiiiiinnnoooooooorrsssttuuuuuuuuyyzzz'));
$$;

comment on function public.normaliser_code_ecole(text) is
  'Code d''école saisi → forme comparable : sans espaces autour, sans accents, en minuscules.';

-- ── 2. La colonne ──────────────────────────────────────────────────────
-- Un seul mot : une lettre d'abord (un code fait de chiffres est celui d'un
-- espace enseignant, son numéro de téléphone), puis lettres ou chiffres,
-- sans tiret. Les mots réservés de l'inscription en sont exclus.
alter table public.ecoles
  add column if not exists code_court text;

alter table public.ecoles
  drop constraint if exists ecoles_code_court_format;
alter table public.ecoles
  add constraint ecoles_code_court_format check (
    code_court is null
    or (code_court ~ '^[a-z][a-z0-9]{1,29}$'
        and code_court not in ('superadmin', 'admin', 'api', 'www', 'demo'))
  );

create unique index if not exists ecoles_code_court_key
  on public.ecoles (code_court) where code_court is not null;

comment on column public.ecoles.code_court is
  'Code court de l''école (un mot de son nom), accepté à la saisie en plus de `code`, qui reste l''identifiant interne. Unique avec tous les codes. Posé par EduGest seulement (ecoles_guard).';

-- ── 3. Un code court ou d'origine n'appartient qu'à UNE école ──────────
-- L'index unique ci-dessus ne compare que les codes courts entre eux ; ce
-- déclencheur compare aussi chaque code court aux codes d'origine des
-- autres écoles, dans les deux sens (une école qui s'inscrit avec un nom
-- égal au code court d'une autre est refusée). Le verrou sérialise les
-- écritures concurrentes de codes (rares : inscription, pose d'un code).
create or replace function public.ecoles_codes_uniques() returns trigger
    language plpgsql security definer
    set search_path to 'public'
    as $$
begin
  new.code_court := nullif(public.normaliser_code_ecole(new.code_court), '');
  perform pg_advisory_xact_lock(hashtext('public.ecoles.codes'));

  if new.code_court is not null and exists (
    select 1 from ecoles e
    where e.id <> new.id and (e.code = new.code_court or e.code_court = new.code_court)
  ) then
    raise exception 'Le code « % » est déjà celui d''une autre école.', new.code_court
      using errcode = '23505', hint = 'code_ecole_pris';
  end if;

  if exists (select 1 from ecoles e where e.id <> new.id and e.code_court = new.code) then
    raise exception 'Le code « % » est déjà celui d''une autre école.', new.code
      using errcode = '23505', hint = 'code_ecole_pris';
  end if;

  return new;
end $$;

drop trigger if exists trg_ecoles_codes_uniques on public.ecoles;
create trigger trg_ecoles_codes_uniques
  before insert or update of code, code_court on public.ecoles
  for each row execute function public.ecoles_codes_uniques();

-- ── 4. Le code court est géré par EduGest ──────────────────────────────
-- Même garde que 20261118100213_espace_enseignant.sql, plus le code court :
-- l'école ne le pose ni ne le change elle-même (il pourrait prendre le mot
-- qu'une autre école attend).
create or replace function public.ecoles_guard() returns trigger
    language plpgsql security definer
    set search_path to 'public'
    as $$
begin
  -- service_role : Edge Functions (inscription, school-lifecycle, plans) et
  -- scripts d'administration. Ils opèrent hors session utilisateur.
  if coalesce(auth.role(), 'service_role') = 'service_role' then return new; end if;

  -- Le superadmin est le propriétaire légitime de ces colonnes.
  if is_superadmin() then return new; end if;

  if new.plan is distinct from old.plan
     or new.plan_expiry is distinct from old.plan_expiry then
    raise exception 'Le plan d''abonnement est géré par EduGest et ne peut pas être modifié depuis l''école.';
  end if;

  -- Type d'espace : un espace enseignant est gratuit et sans limite
  -- d'élèves ; passé en « école » depuis l'application, il deviendrait une
  -- école complète gratuite et sans limite.
  if new.type_espace is distinct from old.type_espace then
    raise exception 'Le type d''espace est géré par EduGest et ne peut pas être modifié depuis l''école.';
  end if;

  -- Activation : DISSYMÉTRIQUE, et c'est voulu.
  -- Se désactiver ou se retirer soi-même est un droit de l'établissement
  -- (Paramètres → Zone dangereuse, réservée à la direction). REVENIR en
  -- service après une désactivation par EduGest ne l'est pas : sans cette
  -- règle, une école suspendue se rallumait toute seule.
  if new.actif is distinct from old.actif and new.actif = true then
    raise exception 'La réactivation d''une école est réservée à EduGest.';
  end if;
  if new.supprime is distinct from old.supprime and new.supprime = false then
    raise exception 'La restauration d''une école est réservée à EduGest.';
  end if;

  -- Le code est l'identifiant immuable de l'école : il sert de secret au
  -- chiffrement des QR des documents imprimés (src/reports/qr-crypto.js).
  -- Le changer rendrait illisibles tous les bulletins et reçus déjà émis.
  if new.code is distinct from old.code then
    raise exception 'Le code de l''école est immuable.';
  end if;

  -- Code court : posé par EduGest, unique parmi toutes les écoles.
  if new.code_court is distinct from old.code_court then
    raise exception 'Le code court de l''école est géré par EduGest.';
  end if;

  return new;
end $$;

-- ── 5. Code saisi → école ──────────────────────────────────────────────
-- Code d'origine (tel quel en minuscules, ou normalisé) ou code court. Les
-- codes étant uniques tous ensemble, une saisie désigne une école au plus.
-- Réservée aux fonctions ci-dessous (security definer) : pas d'appel direct.
create or replace function public.ecole_id_par_code(p_code text)
returns uuid
    language sql stable security definer
    set search_path to 'public'
    as $$
  select e.id from ecoles e
  where e.code = lower(btrim(p_code))
     or e.code = public.normaliser_code_ecole(p_code)
     or e.code_court = public.normaliser_code_ecole(p_code)
  -- Par sécurité, le code d'origine l'emporte sur un code court.
  order by (e.code = lower(btrim(p_code))) desc
  limit 1;
$$;

revoke all on function public.ecole_id_par_code(text) from public, anon, authenticated;
grant execute on function public.ecole_id_par_code(text) to service_role;

-- ── 6. Les fonctions publiques qui reçoivent un code saisi ─────────────
-- État public d'un code (écran de connexion) : renvoie le code D'ORIGINE
-- (`code`), que l'application utilise ensuite, et le code court s'il y en
-- a un, pour le montrer. Une colonne de plus : drop + create.
drop function if exists public.etat_ecole(text);

create function public.etat_ecole(p_code text)
returns table (
  id uuid, code text, nom text, logo text, couleur1 text, couleur2 text,
  actif boolean, supprime boolean, type_espace text, rattache boolean,
  code_court text
)
    language sql stable security definer
    set search_path to 'public'
    as $$
  select id, code, nom, logo, couleur1, couleur2, actif, supprime, type_espace,
         (type_espace = 'enseignant' and actif is false and coalesce(extra ? 'rattachement', false)),
         code_court
  from ecoles where id = public.ecole_id_par_code(p_code);
$$;

revoke all on function public.etat_ecole(text) from public;
grant execute on function public.etat_ecole(text) to anon, authenticated, service_role;

-- Annonces publiques de la page vitrine (lien `?school=<code>`).
create or replace function public.annonces_publiques(p_code text)
returns table (id uuid, extra jsonb)
    language sql stable security definer
    set search_path to 'public'
    as $$
  select a.id, a.extra
  from annonces a
  join ecoles e on e.id = a.ecole_id
  where e.id = public.ecole_id_par_code(p_code)
    and e.actif is not false
    and e.supprime is not true
    -- Le drapeau vit dans le jsonb (table « document »). On accepte le booléen
    -- JSON comme la chaîne "true" : les écrans ont écrit les deux au fil du temps.
    and coalesce(a.extra->>'publique', 'false') in ('true', 't')
  order by (a.extra->>'date') desc nulls last
  limit 20;
$$;

-- Connexion par e-mail réel : identifiant du compte dans l'école saisie.
create or replace function public.login_pour_email(p_code text, p_email text)
returns text
    language sql stable security definer
    set search_path to 'public'
    as $$
  select c.login
  from comptes c
  where c.ecole_id = public.ecole_id_par_code(p_code)
    and lower(c.email) = lower(btrim(p_email))
  limit 1;
$$;
