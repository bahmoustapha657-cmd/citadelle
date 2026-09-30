-- ════════════════════════════════════════════════════════════════════════
--  EduGest — Messagerie v3 : documents partagés + appels de groupe
-- ════════════════════════════════════════════════════════════════════════
-- À exécuter dans Supabase → SQL Editor APRÈS messagerie-v2.sql.
-- Idempotent : ré-exécutable sans effet de bord.
--
--   1. DOCUMENTS dans les discussions : message de type « fichier » (PDF,
--      photos, Word, Excel…), stocké dans le bucket PRIVÉ « messagerie »
--      sous <ecole_id>/<conversation_id>/ — mêmes règles que les vocaux.
--   2. PIÈCES JOINTES des annonces : <ecole_id>/annonces/<annonce_id>/,
--      lisibles par l'expéditeur et les destinataires seulement.
--   3. APPELS DE GROUPE (« réunions ») audio + vidéo via le SFU Cloudflare
--      Realtime. La base tient la liste des réunions et des participants ;
--      la session Cloudflare de chacun est écrite par l'Edge Function
--      `reunion` (service_role), jamais par le navigateur : un participant
--      ne peut ainsi recevoir que les flux des membres de SA réunion.

-- ── 1. Documents dans les discussions ───────────────────────────────────────
alter table msg_messages add column if not exists fichier_path   text;
alter table msg_messages add column if not exists fichier_nom    text;
alter table msg_messages add column if not exists fichier_type   text;
alter table msg_messages add column if not exists fichier_taille int;

alter table msg_messages drop constraint if exists msg_messages_type_check;
alter table msg_messages add constraint msg_messages_type_check
  check (type in ('texte', 'audio', 'fichier', 'systeme', 'appel'));
alter table msg_messages drop constraint if exists msg_messages_fichier_check;
alter table msg_messages add constraint msg_messages_fichier_check
  check (coalesce(char_length(fichier_nom), 0) <= 200
         and coalesce(fichier_taille, 0) between 0 and 10485760);

drop policy if exists msg_messages_insert on msg_messages;
create policy msg_messages_insert on msg_messages for insert to authenticated
  with check (ecole_id = auth_ecole_id()
              and de_compte_id = my_compte_id()
              and type in ('texte', 'audio', 'fichier')
              and not supprime and modifie_at is null
              and conversation_id in (select msg_mes_conversations())
              and (type <> 'texte' or coalesce(char_length(trim(corps)), 0) > 0)
              and (type <> 'audio' or audio_path is not null)
              and (type <> 'fichier' or (fichier_path is not null and fichier_nom is not null))
              and (audio_path is null
                   or audio_path like auth_ecole_id()::text || '/' || conversation_id::text || '/%')
              and (fichier_path is null
                   or fichier_path like auth_ecole_id()::text || '/' || conversation_id::text || '/%'));

-- Aperçu de la boîte : « 📎 nom du fichier » (ou sa légende).
create or replace function msg_apres_message() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  update msg_conversations
     set dernier_message_at = new.created_at,
         dernier_apercu = left(case new.type
           when 'audio' then '🎤 Message vocal'
           when 'fichier' then '📎 ' || coalesce(nullif(trim(new.corps), ''), new.fichier_nom, 'Document')
           when 'appel' then case split_part(coalesce(new.corps, ''), ':', 1)
                               when 'termine' then '📞 Appel'
                               when 'reunion' then '📞 Appel de groupe'
                               when 'refuse'  then '📞 Appel refusé'
                               when 'occupe'  then '📞 Appel non abouti'
                               when 'echec'   then '📞 Appel interrompu'
                               else '📞 Appel manqué' end
           else coalesce(new.corps, '') end, 140)
   where id = new.conversation_id;
  if new.de_compte_id is not null and new.type in ('texte', 'audio', 'fichier') then
    update msg_membres set dernier_lu_at = greatest(dernier_lu_at, new.created_at)
     where conversation_id = new.conversation_id and compte_id = new.de_compte_id;
  end if;
  return null;
end $$;

-- Retrait d'un message : le document part avec (chemin renvoyé au client,
-- qui l'efface du stockage).
create or replace function msg_supprimer_message(p_id uuid) returns text
  language plpgsql security definer set search_path = public as $$
declare
  msg msg_messages;
begin
  select * into msg from msg_messages where id = p_id;
  if msg.id is null or msg.de_compte_id is distinct from my_compte_id()
     or msg.type not in ('texte', 'audio', 'fichier') then
    raise exception 'Suppression impossible.' using errcode = '42501';
  end if;
  update msg_messages
     set supprime = true, corps = null, audio_path = null,
         fichier_path = null, fichier_nom = null, fichier_type = null, fichier_taille = null
   where id = p_id;
  update msg_conversations set dernier_apercu = '🚫 Message supprimé'
   where id = msg.conversation_id and dernier_message_at = msg.created_at;
  return coalesce(msg.audio_path, msg.fichier_path);
end $$;

-- ── 2. Pièces jointes des annonces ──────────────────────────────────────────
-- [{ "path", "nom", "type", "taille" }], 5 au plus.
alter table msg_annonces add column if not exists pieces_jointes jsonb not null default '[]'::jsonb;

-- Annonce lisible par le compte courant (expéditeur ou destinataire).
create or replace function msg_annonce_lisible(p_id uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from msg_annonces a
                 where a.id = p_id and a.ecole_id = auth_ecole_id()
                   and (a.de_compte_id = my_compte_id()
                        or my_compte_id() in (select msg_annonce_destinataires(a.id))));
$$;

-- Variantes « texte » pour les policies du stockage (le segment de chemin
-- n'est pas forcément un uuid valide : jamais de cast qui lève).
create or replace function msg_uuid_ou_null(p text) returns uuid
  language sql immutable as $$
  select case when p ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then p::uuid end;
$$;

create or replace function msg_annonce_objet_lisible(p_segment text) returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce(msg_annonce_lisible(msg_uuid_ou_null(p_segment)), false);
$$;

create or replace function msg_annonce_objet_auteur(p_segment text) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from msg_annonces a
                 where a.id = msg_uuid_ou_null(p_segment)
                   and a.ecole_id = auth_ecole_id()
                   and a.de_compte_id = my_compte_id());
$$;

create or replace function msg_annonce_objet_gerable(p_segment text) returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce(msg_annonce_gerable(msg_uuid_ou_null(p_segment)), false);
$$;

-- L'auteur enregistre les pièces déposées (après publication : le chemin
-- contient l'id de l'annonce).
create or replace function msg_annonce_joindre(p_id uuid, p_pieces jsonb) returns void
  language plpgsql security definer set search_path = public as $$
declare
  prefixe text;
begin
  if not exists (select 1 from msg_annonces
                 where id = p_id and ecole_id = auth_ecole_id() and de_compte_id = my_compte_id()) then
    raise exception 'Seul l''auteur joint des pièces à son annonce.' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_pieces, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_pieces, '[]'::jsonb)) > 5 then
    raise exception '5 pièces jointes au plus.';
  end if;
  prefixe := auth_ecole_id()::text || '/annonces/' || p_id::text || '/';
  if exists (select 1 from jsonb_array_elements(coalesce(p_pieces, '[]'::jsonb)) e
             where coalesce(e->>'path', '') not like prefixe || '%'
                or coalesce(char_length(e->>'nom'), 0) not between 1 and 200) then
    raise exception 'Pièce jointe invalide.';
  end if;
  update msg_annonces set pieces_jointes = coalesce(p_pieces, '[]'::jsonb) where id = p_id;
end $$;

-- ── 3. Stockage : documents + pièces jointes ────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('messagerie', 'messagerie', false, 10485760, array[
  'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/wav',
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'text/plain', 'text/csv'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  execute 'drop policy if exists msg_annonces_pj_lecture on storage.objects';
  execute 'drop policy if exists msg_annonces_pj_insert on storage.objects';
  execute 'drop policy if exists msg_annonces_pj_delete on storage.objects';
  execute $p$
    create policy msg_annonces_pj_lecture on storage.objects for select to authenticated
      using (bucket_id = 'messagerie'
             and (storage.foldername(name))[1] = auth_ecole_id()::text
             and (storage.foldername(name))[2] = 'annonces'
             and msg_annonce_objet_lisible((storage.foldername(name))[3]))
  $p$;
  execute $p$
    create policy msg_annonces_pj_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'messagerie'
                  and (storage.foldername(name))[1] = auth_ecole_id()::text
                  and (storage.foldername(name))[2] = 'annonces'
                  and msg_annonce_objet_auteur((storage.foldername(name))[3]))
  $p$;
  -- Retrait par l'auteur OU la direction (qui peut supprimer l'annonce).
  execute $p$
    create policy msg_annonces_pj_delete on storage.objects for delete to authenticated
      using (bucket_id = 'messagerie'
             and (storage.foldername(name))[2] = 'annonces'
             and msg_annonce_objet_gerable((storage.foldername(name))[3]))
  $p$;
end $$;

-- ── 4. Appels de groupe (réunions) ──────────────────────────────────────────
create table if not exists msg_reunions (
  id              uuid primary key default gen_random_uuid(),
  ecole_id        uuid not null references ecoles(id) on delete cascade,
  conversation_id uuid not null references msg_conversations(id) on delete cascade,
  lance_par       uuid references comptes(id) on delete set null,
  statut          text not null default 'en_cours' check (statut in ('en_cours', 'termine')),
  created_at      timestamptz not null default now(),
  fin_at          timestamptz
);
-- Une seule réunion en cours par discussion.
create unique index if not exists idx_msg_reunion_active
  on msg_reunions (conversation_id) where statut = 'en_cours';

create table if not exists msg_reunion_participants (
  reunion_id uuid not null references msg_reunions(id) on delete cascade,
  compte_id  uuid not null references comptes(id) on delete cascade,
  ecole_id   uuid not null references ecoles(id) on delete cascade,
  session_id text,                                -- session Cloudflare (Edge Function)
  pistes     jsonb not null default '[]'::jsonb,  -- [{ trackName, kind }] publiées (Edge)
  micro      boolean not null default true,
  camera     boolean not null default false,
  rejoint_at timestamptz not null default now(),
  vu_at      timestamptz not null default now(),  -- signe de vie (toutes les 20 s)
  quitte_at  timestamptz,
  primary key (reunion_id, compte_id)
);

-- Participant présent : pas parti, signe de vie récent.
create or replace function msg_reunion_presents(p_reunion uuid) returns setof uuid
  language sql stable security definer set search_path = public as $$
  select compte_id from msg_reunion_participants
  where reunion_id = p_reunion and quitte_at is null and vu_at > now() - interval '60 seconds';
$$;

alter table msg_reunions enable row level security;
alter table msg_reunion_participants enable row level security;

-- Visibles des membres de la discussion (qui voient qu'un appel est en
-- cours et qui y est) ; écritures par RPC / Edge Function uniquement.
drop policy if exists msg_reunions_select on msg_reunions;
create policy msg_reunions_select on msg_reunions for select to authenticated
  using (conversation_id in (select msg_mes_conversations()));

drop policy if exists msg_reunion_participants_select on msg_reunion_participants;
create policy msg_reunion_participants_select on msg_reunion_participants for select to authenticated
  using (reunion_id in (select r.id from msg_reunions r
                        where r.conversation_id in (select msg_mes_conversations())));

-- Clôture d'une réunion (dernier parti) : trace dans la discussion.
create or replace function msg_reunion_clore(p_reunion uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare
  r msg_reunions;
  nb int;
begin
  update msg_reunions set statut = 'termine', fin_at = now()
   where id = p_reunion and statut = 'en_cours'
   returning * into r;
  if r.id is null then return; end if;
  update msg_reunion_participants set quitte_at = coalesce(quitte_at, now()) where reunion_id = p_reunion;
  select count(*) into nb from msg_reunion_participants where reunion_id = p_reunion;
  insert into msg_messages (conversation_id, ecole_id, de_compte_id, type, corps)
  values (r.conversation_id, r.ecole_id, r.lance_par, 'appel',
          'reunion:' || greatest(0, extract(epoch from now() - r.created_at)::int) || ':' || nb);
  -- Trace informative : ne compte pas comme non lue.
  update msg_membres m set dernier_lu_at = greatest(m.dernier_lu_at, now())
   where m.conversation_id = r.conversation_id
     and m.compte_id in (select compte_id from msg_reunion_participants where reunion_id = p_reunion);
end $$;

-- Lancer (ou retrouver) l'appel de groupe d'une discussion.
create or replace function msg_reunion_demarrer(p_conv uuid) returns uuid
  language plpgsql security definer set search_path = public as $$
declare
  moi uuid := my_compte_id();
  existante uuid;
  nouvelle uuid;
begin
  if not est_membre_messagerie()
     or not exists (select 1 from msg_membres where conversation_id = p_conv and compte_id = moi) then
    raise exception 'Appel impossible depuis cette discussion.' using errcode = '42501';
  end if;
  select id into existante from msg_reunions where conversation_id = p_conv and statut = 'en_cours';
  if existante is not null then
    if exists (select 1 from msg_reunion_presents(existante)) then return existante; end if;
    perform msg_reunion_clore(existante);  -- restes d'un appel abandonné
  end if;
  begin
    insert into msg_reunions (ecole_id, conversation_id, lance_par)
    values (auth_ecole_id(), p_conv, moi) returning id into nouvelle;
  exception when unique_violation then
    -- Lancé au même instant par un autre membre : on le rejoint.
    select id into nouvelle from msg_reunions where conversation_id = p_conv and statut = 'en_cours';
    return nouvelle;
  end;
  perform msg_systeme(p_conv, msg_nom_compte(moi) || ' a lancé un appel de groupe');
  return nouvelle;
end $$;

-- Micro / caméra + signe de vie (null = inchangé).
create or replace function msg_reunion_etat(p_reunion uuid, p_micro boolean, p_camera boolean) returns void
  language sql security definer set search_path = public as $$
  update msg_reunion_participants
     set micro = coalesce(p_micro, micro), camera = coalesce(p_camera, camera), vu_at = now()
   where reunion_id = p_reunion and compte_id = my_compte_id() and quitte_at is null;
$$;

create or replace function msg_reunion_quitter(p_reunion uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  update msg_reunion_participants set quitte_at = now()
   where reunion_id = p_reunion and compte_id = my_compte_id() and quitte_at is null;
  if not exists (select 1 from msg_reunion_presents(p_reunion)) then
    perform msg_reunion_clore(p_reunion);
  end if;
end $$;

-- Réunions vivantes des discussions du compte, avec leurs présents (calculé
-- côté serveur : l'horloge des téléphones n'est pas fiable).
create or replace function msg_reunions_actives()
returns table (id uuid, conversation_id uuid, lance_par uuid, created_at timestamptz, presents uuid[])
  language sql stable security definer set search_path = public as $$
  select r.id, r.conversation_id, r.lance_par, r.created_at,
         array(select msg_reunion_presents(r.id))
  from msg_reunions r
  where r.statut = 'en_cours'
    and r.conversation_id in (select msg_mes_conversations())
    and exists (select 1 from msg_reunion_presents(r.id));
$$;

-- ── 5. Droits d'exécution ───────────────────────────────────────────────────
do $$
declare
  f text;
begin
  foreach f in array array[
    'msg_supprimer_message(uuid)', 'msg_annonce_joindre(uuid, jsonb)',
    'msg_annonce_objet_lisible(text)', 'msg_annonce_objet_auteur(text)', 'msg_annonce_objet_gerable(text)',
    'msg_reunion_demarrer(uuid)', 'msg_reunion_etat(uuid, boolean, boolean)', 'msg_reunion_quitter(uuid)',
    'msg_reunions_actives()']
  loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  foreach f in array array[
    'msg_annonce_lisible(uuid)', 'msg_reunion_presents(uuid)', 'msg_reunion_clore(uuid)',
    'msg_apres_message()']
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;

-- ── 6. Temps réel ───────────────────────────────────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array['msg_reunions', 'msg_reunion_participants'] loop
    execute format('alter table %I replica identity full', t);
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;

-- Sondes : node supabase/test-rls-messagerie.mjs
