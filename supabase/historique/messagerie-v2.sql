-- ════════════════════════════════════════════════════════════════════════
--  EduGest — Messagerie v2 : discussions, groupes, vocaux, appels, annonces
-- ════════════════════════════════════════════════════════════════════════
-- À exécuter dans Supabase → SQL Editor APRÈS postes.sql et
-- messagerie-interne.sql. Idempotent : ré-exécutable sans effet de bord.
--
-- Remplace la boîte « à plat » de messagerie-interne.sql par :
--   • des DISCUSSIONS (directes à deux, ou groupes nommés) avec réponses,
--     messages vocaux, modification / suppression et accusés « Lu par » ;
--   • des APPELS audio 1-à-1 (WebRTC) dont la signalisation passe par la
--     table msg_appels, diffusée en temps réel ;
--   • des ANNONCES (diffusion à tout le monde, au personnel, aux enseignants,
--     à des postes ou des comptes) avec priorité, épinglage et accusé de
--     lecture obligatoire.
-- Les ENSEIGNANTS entrent dans le périmètre (portail enseignant) ; parents et
-- superadmin restent dehors — confidentialité : pas de bypass superadmin.
--
-- L'ancienne table messages_internes est CONSERVÉE : ses messages sont repris
-- en annonces (section 7), et un trigger recopie ceux qu'on y écrit encore
-- (l'Edge Function password-reset y signale « mot de passe oublié ») — aucun
-- redéploiement d'Edge Function n'est nécessaire.
--
-- Toutes les écritures sensibles passent par des fonctions SECURITY DEFINER
-- qui vérifient l'appelant ; leur EXECUTE est retiré à PUBLIC/anon (sinon
-- anon pourrait les appeler — cf. piège EXECUTE à PUBLIC sur Supabase).

-- ── 1. Qui a accès à la messagerie ──────────────────────────────────────────
-- Tout compte rattaché à une école, sauf parent et superadmin.
create or replace function est_membre_messagerie() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce((
    select c.ecole_id is not null and c.role::text not in ('parent', 'superadmin')
    from comptes c where c.user_id = auth.uid() limit 1), false);
$$;

-- Un compte peut-il être joint (même école, hors parent/superadmin, actif) ?
create or replace function msg_compte_joignable(p_compte uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from comptes c
    left join postes p on p.id = c.poste_id
    where c.id = p_compte
      and c.ecole_id = auth_ecole_id()
      and c.role::text not in ('parent', 'superadmin')
      and coalesce(c.statut, 'Actif') = 'Actif'
      and coalesce(p.actif, true));
$$;

-- Nom affiché d'un compte : nom de signature (postes à plusieurs comptes,
-- où comptes.nom n'est pas un nom de personne), puis nom, puis identifiant.
create or replace function msg_nom_compte(p_compte uuid) returns text
  language sql stable security definer set search_path = public as $$
  select coalesce(nullif(trim(c.extra->>'nomSignature'), ''),
                  nullif(trim(c.enseignant_nom), ''),
                  nullif(trim(c.nom), ''), c.login)
  from comptes c where c.id = p_compte;
$$;

-- ── 2. Tables ───────────────────────────────────────────────────────────────
create table if not exists msg_conversations (
  id                 uuid primary key default gen_random_uuid(),
  ecole_id           uuid not null references ecoles(id) on delete cascade,
  type               text not null check (type in ('direct', 'groupe')),
  titre              text check (char_length(titre) <= 80),
  -- 'idMin:idMax' : une seule discussion directe par paire de comptes.
  cle_directe        text,
  cree_par           uuid references comptes(id) on delete set null,
  created_at         timestamptz not null default now(),
  dernier_message_at timestamptz not null default now(),
  dernier_apercu     text,
  unique (ecole_id, cle_directe)
);
create index if not exists idx_msg_conv_ecole on msg_conversations (ecole_id, dernier_message_at desc);

create table if not exists msg_membres (
  conversation_id uuid not null references msg_conversations(id) on delete cascade,
  compte_id       uuid not null references comptes(id) on delete cascade,
  ecole_id        uuid not null references ecoles(id) on delete cascade,
  admin           boolean not null default false,
  -- Accusés de lecture : tout message antérieur est lu. « Lu par » d'un
  -- message = membres dont dernier_lu_at >= sa date (pas de ligne par message).
  dernier_lu_at   timestamptz not null default now(),
  archive         boolean not null default false,
  epingle         boolean not null default false,
  sourdine        boolean not null default false,
  rejoint_at      timestamptz not null default now(),
  primary key (conversation_id, compte_id)
);
create index if not exists idx_msg_membres_compte on msg_membres (compte_id);

create table if not exists msg_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references msg_conversations(id) on delete cascade,
  ecole_id        uuid not null references ecoles(id) on delete cascade,
  de_compte_id    uuid references comptes(id) on delete set null,
  -- systeme : « X a créé le groupe »… ; appel : trace d'un appel (corps =
  -- 'termine:<secondes>' | 'manque' | 'refuse' | 'occupe' | 'echec').
  type            text not null default 'texte' check (type in ('texte', 'audio', 'systeme', 'appel')),
  corps           text check (char_length(corps) <= 4000),
  audio_path      text,
  audio_duree     int check (audio_duree between 0 and 600),
  reponse_a       uuid references msg_messages(id) on delete set null,
  modifie_at      timestamptz,
  supprime        boolean not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists idx_msg_messages_conv on msg_messages (conversation_id, created_at desc);
create index if not exists idx_msg_messages_ecole on msg_messages (ecole_id, created_at desc);

create table if not exists msg_appels (
  id              uuid primary key default gen_random_uuid(),
  ecole_id        uuid not null references ecoles(id) on delete cascade,
  conversation_id uuid not null references msg_conversations(id) on delete cascade,
  appelant_id     uuid not null references comptes(id) on delete cascade,
  appele_id       uuid not null references comptes(id) on delete cascade,
  statut          text not null default 'sonne'
                  check (statut in ('sonne', 'en_cours', 'refuse', 'occupe', 'manque', 'annule', 'termine', 'echec')),
  offre           jsonb,   -- description de session WebRTC de l'appelant
  reponse         jsonb,   -- … et de l'appelé
  created_at      timestamptz not null default now(),
  repondu_at      timestamptz,
  fin_at          timestamptz
);
create index if not exists idx_msg_appels_appele on msg_appels (appele_id, created_at desc);

create table if not exists msg_annonces (
  id            uuid primary key default gen_random_uuid(),
  ecole_id      uuid not null references ecoles(id) on delete cascade,
  de_compte_id  uuid references comptes(id) on delete set null,
  de_nom        text not null default '',
  de_poste      text,
  titre         text check (char_length(titre) <= 160),
  corps         text not null check (char_length(corps) <= 8000),
  priorite      text not null default 'normale' check (priorite in ('normale', 'importante', 'urgente')),
  accuse_requis boolean not null default false,
  epinglee      boolean not null default false,
  -- Cibles (cumulables) :
  a_tous        boolean not null default false,  -- personnel + enseignants
  a_personnel   boolean not null default false,  -- personnel administratif
  a_enseignants boolean not null default false,
  a_postes      text[],                          -- clés de postes
  a_comptes     uuid[],
  created_at    timestamptz not null default now()
);
create index if not exists idx_msg_annonces_ecole on msg_annonces (ecole_id, created_at desc);

create table if not exists msg_annonces_lus (
  annonce_id  uuid not null references msg_annonces(id) on delete cascade,
  compte_id   uuid not null references comptes(id) on delete cascade,
  lu_at       timestamptz not null default now(),
  confirme_at timestamptz,
  primary key (annonce_id, compte_id)
);

-- ── 3. Helpers d'appartenance (utilisés par la RLS) ─────────────────────────
-- SECURITY DEFINER : évite la récursion d'une policy de msg_membres qui
-- relirait msg_membres.
create or replace function msg_mes_conversations() returns setof uuid
  language sql stable security definer set search_path = public as $$
  select conversation_id from msg_membres where compte_id = my_compte_id();
$$;

create or replace function msg_suis_admin(p_conv uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from msg_membres
                 where conversation_id = p_conv and compte_id = my_compte_id() and admin);
$$;

-- Destinataires d'une annonce (comptes visés, expéditeur exclu). Même
-- ciblage que la policy msg_annonces_select ci-dessous.
create or replace function msg_annonce_destinataires(p_annonce uuid) returns setof uuid
  language sql stable security definer set search_path = public as $$
  select c.id
  from msg_annonces a
  join comptes c on c.ecole_id = a.ecole_id
  left join postes p on p.id = c.poste_id
  where a.id = p_annonce
    and c.role::text not in ('parent', 'superadmin')
    and coalesce(c.statut, 'Actif') = 'Actif'
    and c.id is distinct from a.de_compte_id
    and (a.a_tous
         or (a.a_personnel and c.role::text <> 'enseignant')
         or (a.a_enseignants and c.role::text = 'enseignant')
         or coalesce(p.cle, c.role::text) = any(coalesce(a.a_postes, '{}'))
         or c.id = any(coalesce(a.a_comptes, '{}')));
$$;

-- ── 4. RLS ──────────────────────────────────────────────────────────────────
alter table msg_conversations enable row level security;
alter table msg_membres       enable row level security;
alter table msg_messages      enable row level security;
alter table msg_appels        enable row level security;
alter table msg_annonces      enable row level security;
alter table msg_annonces_lus  enable row level security;

-- Discussions et membres : lecture par les membres ; écritures par RPC.
drop policy if exists msg_conv_select on msg_conversations;
create policy msg_conv_select on msg_conversations for select to authenticated
  using (id in (select msg_mes_conversations()));

drop policy if exists msg_membres_select on msg_membres;
create policy msg_membres_select on msg_membres for select to authenticated
  using (conversation_id in (select msg_mes_conversations()));

-- Messages : les membres lisent ; chacun écrit EN SON NOM, texte ou vocal
-- (système / appel : par les fonctions ci-dessous). Modification et
-- suppression passent par msg_modifier_message / msg_supprimer_message.
drop policy if exists msg_messages_select on msg_messages;
create policy msg_messages_select on msg_messages for select to authenticated
  using (conversation_id in (select msg_mes_conversations()));

drop policy if exists msg_messages_insert on msg_messages;
create policy msg_messages_insert on msg_messages for insert to authenticated
  with check (ecole_id = auth_ecole_id()
              and de_compte_id = my_compte_id()
              and type in ('texte', 'audio')
              and not supprime and modifie_at is null
              and conversation_id in (select msg_mes_conversations())
              and (type = 'audio' or coalesce(char_length(trim(corps)), 0) > 0)
              and (type = 'texte' or audio_path is not null)
              and (audio_path is null
                   or audio_path like auth_ecole_id()::text || '/' || conversation_id::text || '/%'));

-- Appels : visibles des deux participants ; écritures par RPC.
drop policy if exists msg_appels_select on msg_appels;
create policy msg_appels_select on msg_appels for select to authenticated
  using (ecole_id = auth_ecole_id()
         and (appelant_id = my_compte_id() or appele_id = my_compte_id()));

-- Annonces : visibles de l'expéditeur et des comptes visés.
drop policy if exists msg_annonces_select on msg_annonces;
create policy msg_annonces_select on msg_annonces for select to authenticated
  using (ecole_id = auth_ecole_id() and est_membre_messagerie()
         and (de_compte_id = my_compte_id()
              or a_tous
              or (a_personnel and auth_role()::text <> 'enseignant')
              or (a_enseignants and auth_role()::text = 'enseignant')
              or my_poste_cle() = any(coalesce(a_postes, '{}'))
              or my_compte_id() = any(coalesce(a_comptes, '{}'))));

-- Publication : le personnel (pas les enseignants), en son nom, avec au
-- moins une cible.
drop policy if exists msg_annonces_insert on msg_annonces;
create policy msg_annonces_insert on msg_annonces for insert to authenticated
  with check (ecole_id = auth_ecole_id() and est_membre_messagerie()
              and auth_role()::text <> 'enseignant'
              and de_compte_id = my_compte_id()
              and (a_tous or a_personnel or a_enseignants
                   or coalesce(array_length(a_postes, 1), 0) > 0
                   or coalesce(array_length(a_comptes, 1), 0) > 0));

-- Retrait : l'expéditeur, ou la direction / l'administration.
drop policy if exists msg_annonces_delete on msg_annonces;
create policy msg_annonces_delete on msg_annonces for delete to authenticated
  using (ecole_id = auth_ecole_id()
         and (de_compte_id = my_compte_id() or auth_role()::text in ('direction', 'admin')));

-- Accusés d'annonce : chacun lit les siens ; écriture par msg_annonce_lire.
drop policy if exists msg_annonces_lus_select on msg_annonces_lus;
create policy msg_annonces_lus_select on msg_annonces_lus for select to authenticated
  using (compte_id = my_compte_id());

-- ── 5. Triggers ─────────────────────────────────────────────────────────────
-- Nouveau message : aperçu de la discussion + l'expéditeur a « lu » jusque-là.
create or replace function msg_apres_message() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  update msg_conversations
     set dernier_message_at = new.created_at,
         dernier_apercu = left(case new.type
           when 'audio' then '🎤 Message vocal'
           when 'appel' then case split_part(coalesce(new.corps, ''), ':', 1)
                               when 'termine' then '📞 Appel'
                               when 'refuse'  then '📞 Appel refusé'
                               when 'occupe'  then '📞 Appel non abouti'
                               when 'echec'   then '📞 Appel interrompu'
                               else '📞 Appel manqué' end
           else coalesce(new.corps, '') end, 140)
   where id = new.conversation_id;
  if new.de_compte_id is not null and new.type in ('texte', 'audio') then
    update msg_membres set dernier_lu_at = greatest(dernier_lu_at, new.created_at)
     where conversation_id = new.conversation_id and compte_id = new.de_compte_id;
  end if;
  return null;
end $$;
drop trigger if exists trg_msg_apres_message on msg_messages;
create trigger trg_msg_apres_message after insert on msg_messages
  for each row execute function msg_apres_message();

-- Annonce : nom et poste de l'expéditeur fixés par la base (pas par le client).
create or replace function msg_avant_annonce() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.de_compte_id is not null then
    select msg_nom_compte(c.id),
           case when c.role::text = 'enseignant' then 'Enseignant'
                else coalesce(p.label, c.label, c.role::text) end
      into new.de_nom, new.de_poste
      from comptes c left join postes p on p.id = c.poste_id
     where c.id = new.de_compte_id;
  end if;
  new.de_nom := coalesce(new.de_nom, '');
  return new;
end $$;
drop trigger if exists trg_msg_avant_annonce on msg_annonces;
create trigger trg_msg_avant_annonce before insert on msg_annonces
  for each row execute function msg_avant_annonce();

-- Message système dans une discussion (créé par les fonctions ci-dessous).
create or replace function msg_systeme(p_conv uuid, p_texte text) returns void
  language sql security definer set search_path = public as $$
  insert into msg_messages (conversation_id, ecole_id, de_compte_id, type, corps)
  select c.id, c.ecole_id, my_compte_id(), 'systeme', left(p_texte, 4000)
  from msg_conversations c where c.id = p_conv;
$$;

-- ── 6. Fonctions (RPC) ──────────────────────────────────────────────────────
-- Annuaire des comptes joignables de l'école (sélecteurs de destinataires).
create or replace function msg_annuaire()
returns table (id uuid, user_id uuid, login text, nom text, poste text, role text, poste_cle text)
  language sql stable security definer set search_path = public as $$
  select c.id, c.user_id, c.login, msg_nom_compte(c.id),
         case when c.role::text = 'enseignant'
              then 'Enseignant' || coalesce(' · ' || nullif(trim(c.matiere), ''), '')
              else coalesce(p.label, c.label, c.role::text) end,
         c.role::text, coalesce(p.cle, c.role::text)
  from comptes c
  left join postes p on p.id = c.poste_id
  where est_membre_messagerie()
    and c.ecole_id = auth_ecole_id()
    and c.role::text not in ('parent', 'superadmin')
    and coalesce(c.statut, 'Actif') = 'Actif'
    and coalesce(p.actif, true)
  order by 4;
$$;

-- Boîte du compte courant : discussions + préférences + non-lus + membres.
create or replace function msg_boite()
returns table (id uuid, type text, titre text, cree_par uuid, created_at timestamptz,
               dernier_message_at timestamptz, dernier_apercu text,
               archive boolean, epingle boolean, sourdine boolean, admin boolean,
               dernier_lu_at timestamptz, non_lus int, membres jsonb)
  language sql stable security definer set search_path = public as $$
  select c.id, c.type, c.titre, c.cree_par, c.created_at, c.dernier_message_at, c.dernier_apercu,
         m.archive, m.epingle, m.sourdine, m.admin, m.dernier_lu_at,
         (select count(*)::int from msg_messages x
           where x.conversation_id = c.id and x.created_at > m.dernier_lu_at
             and x.de_compte_id is distinct from m.compte_id and not x.supprime
             and x.type <> 'systeme'),
         (select coalesce(jsonb_agg(jsonb_build_object(
                   'id', mm.compte_id, 'admin', mm.admin, 'lu', mm.dernier_lu_at,
                   'sourdine', mm.sourdine) order by mm.rejoint_at), '[]'::jsonb)
            from msg_membres mm where mm.conversation_id = c.id)
  from msg_membres m
  join msg_conversations c on c.id = m.conversation_id
  where m.compte_id = my_compte_id()
  order by c.dernier_message_at desc;
$$;

-- Discussion directe avec un compte (créée au besoin, sinon retrouvée).
create or replace function msg_ouvrir_directe(p_compte uuid) returns uuid
  language plpgsql security definer set search_path = public as $$
declare
  moi uuid := my_compte_id();
  ec  uuid := auth_ecole_id();
  cle text;
  conv uuid;
begin
  if not est_membre_messagerie() then
    raise exception 'Messagerie non autorisée.' using errcode = '42501';
  end if;
  if p_compte is null or p_compte = moi then raise exception 'Destinataire invalide.'; end if;
  if not msg_compte_joignable(p_compte) then
    raise exception 'Destinataire introuvable.' using errcode = '42501';
  end if;
  cle := least(moi::text, p_compte::text) || ':' || greatest(moi::text, p_compte::text);
  insert into msg_conversations (ecole_id, type, cle_directe, cree_par)
  values (ec, 'direct', cle, moi)
  on conflict (ecole_id, cle_directe) do nothing
  returning id into conv;
  if conv is null then
    select c.id into conv from msg_conversations c where c.ecole_id = ec and c.cle_directe = cle;
  end if;
  insert into msg_membres (conversation_id, compte_id, ecole_id)
  values (conv, moi, ec), (conv, p_compte, ec)
  on conflict do nothing;
  return conv;
end $$;

-- Groupe nommé : le créateur en est administrateur.
create or replace function msg_creer_groupe(p_titre text, p_membres uuid[]) returns uuid
  language plpgsql security definer set search_path = public as $$
declare
  moi uuid := my_compte_id();
  ec  uuid := auth_ecole_id();
  v_titre text := left(trim(coalesce(p_titre, '')), 80);
  autres uuid[];
  conv uuid;
begin
  if not est_membre_messagerie() then
    raise exception 'Messagerie non autorisée.' using errcode = '42501';
  end if;
  if v_titre = '' then raise exception 'Donnez un nom au groupe.'; end if;
  select coalesce(array_agg(distinct x), '{}') into autres
    from unnest(coalesce(p_membres, '{}')) x where x is distinct from moi;
  if cardinality(autres) = 0 then raise exception 'Ajoutez au moins un membre.'; end if;
  if exists (select 1 from unnest(autres) x where not msg_compte_joignable(x)) then
    raise exception 'Un des membres est introuvable.' using errcode = '42501';
  end if;
  insert into msg_conversations (ecole_id, type, titre, cree_par)
  values (ec, 'groupe', v_titre, moi) returning id into conv;
  insert into msg_membres (conversation_id, compte_id, ecole_id, admin) values (conv, moi, ec, true);
  insert into msg_membres (conversation_id, compte_id, ecole_id)
  select conv, x, ec from unnest(autres) x;
  perform msg_systeme(conv, msg_nom_compte(moi) || ' a créé le groupe « ' || v_titre || ' »');
  return conv;
end $$;

create or replace function msg_ajouter_membres(p_conv uuid, p_membres uuid[]) returns void
  language plpgsql security definer set search_path = public as $$
declare
  ec uuid := auth_ecole_id();
  noms text;
begin
  if not exists (select 1 from msg_conversations where id = p_conv and type = 'groupe')
     or not msg_suis_admin(p_conv) then
    raise exception 'Seul un administrateur du groupe peut ajouter des membres.' using errcode = '42501';
  end if;
  if exists (select 1 from unnest(coalesce(p_membres, '{}')) x where not msg_compte_joignable(x)) then
    raise exception 'Un des membres est introuvable.' using errcode = '42501';
  end if;
  with ajoutes as (
    insert into msg_membres (conversation_id, compte_id, ecole_id)
    select p_conv, x, ec from unnest(p_membres) x
    on conflict do nothing
    returning compte_id)
  select string_agg(msg_nom_compte(compte_id), ', ') into noms from ajoutes;
  if noms is not null then
    perform msg_systeme(p_conv, msg_nom_compte(my_compte_id()) || ' a ajouté ' || noms);
  end if;
end $$;

-- Retirer un membre (administrateur) ou quitter le groupe (soi-même).
create or replace function msg_retirer_membre(p_conv uuid, p_compte uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare
  moi uuid := my_compte_id();
  nom_cible text := msg_nom_compte(p_compte);
begin
  if not exists (select 1 from msg_conversations where id = p_conv and type = 'groupe') then
    raise exception 'On ne quitte pas une discussion directe.';
  end if;
  if p_compte is distinct from moi and not msg_suis_admin(p_conv) then
    raise exception 'Seul un administrateur du groupe peut retirer un membre.' using errcode = '42501';
  end if;
  if not exists (select 1 from msg_membres where conversation_id = p_conv and compte_id = p_compte) then
    raise exception 'Ce compte ne fait pas partie du groupe.';
  end if;
  -- Message système AVANT le retrait : le partant le voit encore passer.
  perform msg_systeme(p_conv, case when p_compte = moi
    then nom_cible || ' a quitté le groupe'
    else msg_nom_compte(moi) || ' a retiré ' || nom_cible end);
  delete from msg_membres where conversation_id = p_conv and compte_id = p_compte;
  if not exists (select 1 from msg_membres where conversation_id = p_conv) then
    delete from msg_conversations where id = p_conv;
  elsif not exists (select 1 from msg_membres where conversation_id = p_conv and admin) then
    -- Plus d'administrateur : le plus ancien membre le devient.
    update msg_membres set admin = true
     where conversation_id = p_conv
       and compte_id = (select compte_id from msg_membres where conversation_id = p_conv
                        order by rejoint_at limit 1);
  end if;
end $$;

create or replace function msg_definir_admin(p_conv uuid, p_compte uuid, p_admin boolean) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not msg_suis_admin(p_conv) then
    raise exception 'Réservé aux administrateurs du groupe.' using errcode = '42501';
  end if;
  update msg_membres set admin = coalesce(p_admin, false)
   where conversation_id = p_conv and compte_id = p_compte;
end $$;

create or replace function msg_renommer_groupe(p_conv uuid, p_titre text) returns void
  language plpgsql security definer set search_path = public as $$
declare
  v_titre text := left(trim(coalesce(p_titre, '')), 80);
begin
  if v_titre = '' then raise exception 'Le nom du groupe est vide.'; end if;
  if not exists (select 1 from msg_conversations where id = p_conv and type = 'groupe')
     or not msg_suis_admin(p_conv) then
    raise exception 'Réservé aux administrateurs du groupe.' using errcode = '42501';
  end if;
  update msg_conversations set titre = v_titre where id = p_conv;
  perform msg_systeme(p_conv, msg_nom_compte(my_compte_id()) || ' a renommé le groupe en « ' || v_titre || ' »');
end $$;

create or replace function msg_marquer_lu(p_conv uuid) returns void
  language sql security definer set search_path = public as $$
  update msg_membres set dernier_lu_at = now()
   where conversation_id = p_conv and compte_id = my_compte_id();
$$;

-- Préférences personnelles (null = inchangé).
create or replace function msg_preferences(p_conv uuid, p_archive boolean, p_epingle boolean, p_sourdine boolean)
returns void
  language sql security definer set search_path = public as $$
  update msg_membres
     set archive  = coalesce(p_archive, archive),
         epingle  = coalesce(p_epingle, epingle),
         sourdine = coalesce(p_sourdine, sourdine)
   where conversation_id = p_conv and compte_id = my_compte_id();
$$;

-- Corriger son message texte (24 h).
create or replace function msg_modifier_message(p_id uuid, p_corps text) returns void
  language plpgsql security definer set search_path = public as $$
declare
  texte text := trim(coalesce(p_corps, ''));
  msg msg_messages;
begin
  if texte = '' then raise exception 'Le message est vide.'; end if;
  select * into msg from msg_messages where id = p_id;
  if msg.id is null or msg.de_compte_id is distinct from my_compte_id()
     or msg.type <> 'texte' or msg.supprime then
    raise exception 'Modification impossible.' using errcode = '42501';
  end if;
  if msg.created_at < now() - interval '24 hours' then
    raise exception 'Un message ne se modifie que dans les 24 heures.';
  end if;
  update msg_messages set corps = left(texte, 4000), modifie_at = now() where id = p_id;
  update msg_conversations set dernier_apercu = left(texte, 140)
   where id = msg.conversation_id and dernier_message_at = msg.created_at;
end $$;

-- Retirer son message : il devient « Message supprimé » pour tous. Renvoie
-- le chemin du vocal éventuel, que le client efface du stockage.
create or replace function msg_supprimer_message(p_id uuid) returns text
  language plpgsql security definer set search_path = public as $$
declare
  msg msg_messages;
begin
  select * into msg from msg_messages where id = p_id;
  if msg.id is null or msg.de_compte_id is distinct from my_compte_id()
     or msg.type not in ('texte', 'audio') then
    raise exception 'Suppression impossible.' using errcode = '42501';
  end if;
  update msg_messages set supprime = true, corps = null, audio_path = null where id = p_id;
  update msg_conversations set dernier_apercu = '🚫 Message supprimé'
   where id = msg.conversation_id and dernier_message_at = msg.created_at;
  return msg.audio_path;
end $$;

-- ── Appels ──
create or replace function msg_appel_lancer(p_conv uuid, p_offre jsonb) returns uuid
  language plpgsql security definer set search_path = public as $$
declare
  moi uuid := my_compte_id();
  autre uuid;
  appel uuid;
begin
  if not exists (select 1 from msg_conversations where id = p_conv and type = 'direct')
     or not exists (select 1 from msg_membres where conversation_id = p_conv and compte_id = moi) then
    raise exception 'Appel impossible depuis cette discussion.' using errcode = '42501';
  end if;
  select compte_id into autre from msg_membres where conversation_id = p_conv and compte_id <> moi limit 1;
  if autre is null or not msg_compte_joignable(autre) then
    raise exception 'Correspondant injoignable.';
  end if;
  -- Un seul appel sortant qui sonne à la fois.
  update msg_appels set statut = 'annule', fin_at = now()
   where appelant_id = moi and statut = 'sonne';
  insert into msg_appels (ecole_id, conversation_id, appelant_id, appele_id, offre)
  values (auth_ecole_id(), p_conv, moi, autre, p_offre)
  returning id into appel;
  return appel;
end $$;

create or replace function msg_appel_repondre(p_id uuid, p_reponse jsonb) returns void
  language plpgsql security definer set search_path = public as $$
begin
  update msg_appels set statut = 'en_cours', reponse = p_reponse, repondu_at = now()
   where id = p_id and appele_id = my_compte_id() and statut = 'sonne';
  if not found then raise exception 'Cet appel n''est plus disponible.'; end if;
end $$;

-- Fin d'appel : une seule transition vers un état final, tracée dans la
-- discussion (message « appel » au nom de l'appelant).
create or replace function msg_appel_terminer(p_id uuid, p_statut text) returns void
  language plpgsql security definer set search_path = public as $$
declare
  moi uuid := my_compte_id();
  a msg_appels;
  v_final text;
  trace text;
begin
  select * into a from msg_appels where id = p_id;
  if a.id is null or moi not in (a.appelant_id, a.appele_id) then
    raise exception 'Appel introuvable.' using errcode = '42501';
  end if;
  if a.statut not in ('sonne', 'en_cours') then return; end if;
  v_final := case
    when a.statut = 'en_cours' then case when p_statut = 'echec' then 'echec' else 'termine' end
    when moi = a.appele_id then case when p_statut = 'occupe' then 'occupe' else 'refuse' end
    else case when p_statut = 'manque' then 'manque' when p_statut = 'echec' then 'echec' else 'annule' end
  end;
  update msg_appels set statut = v_final, fin_at = now()
   where id = p_id and statut in ('sonne', 'en_cours');
  if not found then return; end if;
  trace := case
    when v_final in ('termine', 'echec') and a.repondu_at is not null
      then v_final || ':' || greatest(0, extract(epoch from now() - a.repondu_at)::int)
    when v_final = 'annule' then 'manque'
    else v_final end;
  insert into msg_messages (conversation_id, ecole_id, de_compte_id, type, corps)
  values (a.conversation_id, a.ecole_id, a.appelant_id, 'appel', trace);
  -- Seul un appel MANQUÉ reste « non lu » chez l'appelé.
  if trace <> 'manque' then
    update msg_membres set dernier_lu_at = greatest(dernier_lu_at, now())
     where conversation_id = a.conversation_id and compte_id = a.appele_id;
  end if;
end $$;

-- ── Annonces ──
-- Lecture (et confirmation « J'ai lu et compris ») par un destinataire.
create or replace function msg_annonce_lire(p_id uuid, p_confirmer boolean) returns void
  language plpgsql security definer set search_path = public as $$
declare
  moi uuid := my_compte_id();
begin
  if moi is null or moi not in (select msg_annonce_destinataires(p_id)) then return; end if;
  insert into msg_annonces_lus (annonce_id, compte_id, confirme_at)
  values (p_id, moi, case when p_confirmer then now() end)
  on conflict (annonce_id, compte_id) do update
    set confirme_at = coalesce(msg_annonces_lus.confirme_at, excluded.confirme_at);
end $$;

-- Peut suivre / gérer une annonce : son expéditeur, la direction, l'admin.
create or replace function msg_annonce_gerable(p_id uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from msg_annonces a
                 where a.id = p_id and a.ecole_id = auth_ecole_id()
                   and (a.de_compte_id = my_compte_id()
                        or auth_role()::text in ('direction', 'admin')));
$$;

-- Qui a lu / confirmé une annonce.
create or replace function msg_annonce_suivi(p_id uuid)
returns table (compte_id uuid, user_id uuid, nom text, poste text, lu_at timestamptz, confirme_at timestamptz)
  language plpgsql stable security definer set search_path = public as $$
begin
  if not msg_annonce_gerable(p_id) then
    raise exception 'Suivi réservé à l''expéditeur et à la direction.' using errcode = '42501';
  end if;
  return query
  select c.id, c.user_id, msg_nom_compte(c.id),
         case when c.role::text = 'enseignant' then 'Enseignant'
              else coalesce(p.label, c.label, c.role::text) end,
         l.lu_at, l.confirme_at
  from msg_annonce_destinataires(p_id) d(cid)
  join comptes c on c.id = d.cid
  left join postes p on p.id = c.poste_id
  left join msg_annonces_lus l on l.annonce_id = p_id and l.compte_id = c.id
  order by l.lu_at nulls first, 3;
end $$;

-- Compteurs des annonces gérables (« Lu par 12/30 »).
create or replace function msg_annonces_stats()
returns table (annonce_id uuid, total int, lus int, confirmes int)
  language sql stable security definer set search_path = public as $$
  select a.id,
         (select count(*)::int from msg_annonce_destinataires(a.id)),
         (select count(*)::int from msg_annonces_lus l
           where l.annonce_id = a.id and l.compte_id in (select msg_annonce_destinataires(a.id))),
         (select count(*)::int from msg_annonces_lus l
           where l.annonce_id = a.id and l.confirme_at is not null
             and l.compte_id in (select msg_annonce_destinataires(a.id)))
  from msg_annonces a
  where a.ecole_id = auth_ecole_id()
    and (a.de_compte_id = my_compte_id() or auth_role()::text in ('direction', 'admin'))
    and a.created_at > now() - interval '180 days';
$$;

create or replace function msg_annonce_epingler(p_id uuid, p_epinglee boolean) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not msg_annonce_gerable(p_id) then
    raise exception 'Réservé à l''expéditeur et à la direction.' using errcode = '42501';
  end if;
  update msg_annonces set epinglee = coalesce(p_epinglee, false) where id = p_id;
end $$;

-- ── Droits d'exécution ──
-- Helpers de policies : exécutables par les connectés (la RLS les appelle
-- en leur nom). Fonctions internes : personne. RPC : connectés seulement.
do $$
declare
  f text;
begin
  foreach f in array array[
    'est_membre_messagerie()', 'msg_mes_conversations()',
    'msg_annuaire()', 'msg_boite()', 'msg_ouvrir_directe(uuid)',
    'msg_creer_groupe(text, uuid[])', 'msg_ajouter_membres(uuid, uuid[])',
    'msg_retirer_membre(uuid, uuid)', 'msg_definir_admin(uuid, uuid, boolean)',
    'msg_renommer_groupe(uuid, text)', 'msg_marquer_lu(uuid)',
    'msg_preferences(uuid, boolean, boolean, boolean)',
    'msg_modifier_message(uuid, text)', 'msg_supprimer_message(uuid)',
    'msg_appel_lancer(uuid, jsonb)', 'msg_appel_repondre(uuid, jsonb)',
    'msg_appel_terminer(uuid, text)',
    'msg_annonce_lire(uuid, boolean)', 'msg_annonce_suivi(uuid)',
    'msg_annonces_stats()', 'msg_annonce_epingler(uuid, boolean)']
  loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  foreach f in array array[
    'msg_compte_joignable(uuid)', 'msg_nom_compte(uuid)', 'msg_suis_admin(uuid)',
    'msg_annonce_destinataires(uuid)', 'msg_annonce_gerable(uuid)',
    'msg_systeme(uuid, text)', 'msg_apres_message()', 'msg_avant_annonce()']
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;

-- ── 7. Reprise de l'ancienne messagerie (messages_internes) ─────────────────
-- Ses messages deviennent des annonces (même id, accusés conservés). L'ancien
-- « tout le personnel » excluait les enseignants → a_personnel.
insert into msg_annonces (id, ecole_id, de_compte_id, de_nom, de_poste, titre, corps,
                          priorite, a_personnel, a_postes, a_comptes, created_at)
select m.id, m.ecole_id, m.de_compte_id, m.de_nom, m.de_poste, m.sujet, m.corps,
       case when m.sujet like '🔑%' then 'importante' else 'normale' end,
       m.a_tous, m.a_postes,
       case when m.a_compte_id is null then null else array[m.a_compte_id] end,
       coalesce(m.created_at, now())
from messages_internes m
on conflict (id) do nothing;

insert into msg_annonces_lus (annonce_id, compte_id, lu_at)
select l.message_id, l.compte_id, coalesce(l.lu_at, now())
from messages_internes_lus l
join msg_annonces a on a.id = l.message_id
on conflict do nothing;

-- Ce qu'on écrit ENCORE dans messages_internes (Edge Function password-reset :
-- « mot de passe oublié » vers direction + admin) est recopié en annonce.
create or replace function msg_reprendre_message_interne() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into msg_annonces (id, ecole_id, de_compte_id, de_nom, de_poste, titre, corps,
                            priorite, a_personnel, a_postes, a_comptes, created_at)
  values (new.id, new.ecole_id, new.de_compte_id, new.de_nom, new.de_poste, new.sujet, new.corps,
          case when new.sujet like '🔑%' then 'importante' else 'normale' end,
          new.a_tous, new.a_postes,
          case when new.a_compte_id is null then null else array[new.a_compte_id] end,
          coalesce(new.created_at, now()))
  on conflict (id) do nothing;
  return null;
end $$;
revoke execute on function msg_reprendre_message_interne() from public, anon, authenticated;
drop trigger if exists trg_msg_reprise_interne on messages_internes;
create trigger trg_msg_reprise_interne after insert on messages_internes
  for each row execute function msg_reprendre_message_interne();

-- ── 8. Stockage des messages vocaux (bucket PRIVÉ) ──────────────────────────
-- Arborescence : <ecole_id>/<conversation_id>/<fichier>. Lecture et dépôt
-- réservés aux membres de la discussion ; effacement par l'auteur du dépôt.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('messagerie', 'messagerie', false, 5242880,
        array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/wav'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  execute 'drop policy if exists msg_vocaux_lecture on storage.objects';
  execute 'drop policy if exists msg_vocaux_insert on storage.objects';
  execute 'drop policy if exists msg_vocaux_delete on storage.objects';
  execute $p$
    create policy msg_vocaux_lecture on storage.objects for select to authenticated
      using (bucket_id = 'messagerie'
             and (storage.foldername(name))[1] = auth_ecole_id()::text
             and (storage.foldername(name))[2] in (select x::text from msg_mes_conversations() x))
  $p$;
  execute $p$
    create policy msg_vocaux_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'messagerie'
                  and (storage.foldername(name))[1] = auth_ecole_id()::text
                  and (storage.foldername(name))[2] in (select x::text from msg_mes_conversations() x))
  $p$;
  execute $p$
    create policy msg_vocaux_delete on storage.objects for delete to authenticated
      using (bucket_id = 'messagerie' and owner_id = auth.uid()::text)
  $p$;
end $$;

-- ── 9. Temps réel ───────────────────────────────────────────────────────────
-- Les événements passent par la RLS (chacun ne reçoit que ses discussions,
-- ses appels, ses annonces). REPLICA IDENTITY FULL : voir realtime.sql.
do $$
declare
  t text;
begin
  foreach t in array array['msg_messages', 'msg_membres', 'msg_appels', 'msg_annonces'] loop
    execute format('alter table %I replica identity full', t);
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;

-- ── Contrôles ───────────────────────────────────────────────────────────────
--   select count(*) from msg_annonces;             -- ≥ messages_internes repris
--   select tablename from pg_publication_tables
--    where pubname = 'supabase_realtime' and tablename like 'msg_%';
--   select id, public from storage.buckets where id = 'messagerie';
-- Sondes : node supabase/test-rls-messagerie.mjs
