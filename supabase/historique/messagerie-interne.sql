-- ════════════════════════════════════════════════════════════════════════
--  EduGest — Messagerie interne du personnel (comptes & postes)
-- ════════════════════════════════════════════════════════════════════════
-- À exécuter dans Supabase → SQL Editor APRÈS postes.sql. Idempotent.
--
-- Un message part d'un compte du personnel et vise :
--   • un compte précis (a_compte_id),
--   • et/ou un ou plusieurs postes entiers (a_postes[] — clés de postes),
--   • ou tout le personnel de l'école (a_tous).
-- Confidentialité (RLS) : seuls l'expéditeur et les destinataires voient le
-- message. Les accusés de lecture vivent dans messages_internes_lus (une
-- ligne par lecteur — même modèle que superadmin_message_lectures).
-- Enseignants et parents sont HORS périmètre (leurs canaux existent déjà).

-- ── Clé de poste du compte courant (ciblage) ────────────────────────────────
-- Postes système et comptes legacy partagent les mêmes clés ('comptable'…) ;
-- un compte sans poste retombe sur son rôle enum.
create or replace function my_poste_cle() returns text
  language sql stable security definer set search_path = public as $$
  select coalesce(p.cle, c.role::text)
  from comptes c
  left join postes p on p.id = c.poste_id
  where c.user_id = auth.uid()
  limit 1;
$$;
grant execute on function my_poste_cle() to authenticated;

-- ── Tables ──────────────────────────────────────────────────────────────────
create table if not exists messages_internes (
  id           uuid primary key default gen_random_uuid(),
  ecole_id     uuid not null references ecoles(id) on delete cascade,
  de_compte_id uuid not null references comptes(id) on delete cascade,
  de_nom       text not null,            -- dénormalisé pour l'affichage
  de_poste     text,                     -- libellé du poste de l'expéditeur
  a_compte_id  uuid references comptes(id) on delete cascade,
  a_postes     text[],                   -- clés de postes ciblés
  a_tous       boolean not null default false,
  sujet        text,
  corps        text not null,
  created_at   timestamptz default now()
);
create index if not exists idx_msg_int_ecole on messages_internes (ecole_id, created_at desc);
create index if not exists idx_msg_int_dest on messages_internes (a_compte_id);

create table if not exists messages_internes_lus (
  message_id uuid not null references messages_internes(id) on delete cascade,
  compte_id  uuid not null references comptes(id) on delete cascade,
  lu_at      timestamptz default now(),
  primary key (message_id, compte_id)
);

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table messages_internes enable row level security;
alter table messages_internes_lus enable row level security;

-- Un message est visible par : son expéditeur, le compte visé, les membres
-- des postes visés, ou tout le personnel si a_tous.
drop policy if exists msg_int_select on messages_internes;
create policy msg_int_select on messages_internes for select to authenticated
  using (ecole_id = auth_ecole_id() and is_staff()
         and (de_compte_id = my_compte_id()
              or a_tous
              or a_compte_id = my_compte_id()
              or my_poste_cle() = any(coalesce(a_postes, '{}'))));

-- Envoi : tout membre du personnel, en son propre nom uniquement.
drop policy if exists msg_int_insert on messages_internes;
create policy msg_int_insert on messages_internes for insert to authenticated
  with check (ecole_id = auth_ecole_id() and is_staff()
              and de_compte_id = my_compte_id()
              and (a_tous or a_compte_id is not null
                   or coalesce(array_length(a_postes, 1), 0) > 0));

-- L'expéditeur peut retirer son message. (Pas d'update : un message envoyé
-- ne se réécrit pas.)
drop policy if exists msg_int_delete on messages_internes;
create policy msg_int_delete on messages_internes for delete to authenticated
  using (ecole_id = auth_ecole_id() and de_compte_id = my_compte_id());

-- Accusés de lecture : chacun gère les siens.
drop policy if exists msg_int_lus_select on messages_internes_lus;
create policy msg_int_lus_select on messages_internes_lus for select to authenticated
  using (compte_id = my_compte_id());
drop policy if exists msg_int_lus_insert on messages_internes_lus;
create policy msg_int_lus_insert on messages_internes_lus for insert to authenticated
  with check (compte_id = my_compte_id());

-- ── Bypass superadmin (support) ─────────────────────────────────────────────
drop policy if exists msg_int_superadmin on messages_internes;
create policy msg_int_superadmin on messages_internes for all to authenticated
  using (is_superadmin()) with check (is_superadmin());
drop policy if exists msg_int_lus_superadmin on messages_internes_lus;
create policy msg_int_lus_superadmin on messages_internes_lus for all to authenticated
  using (is_superadmin()) with check (is_superadmin());
