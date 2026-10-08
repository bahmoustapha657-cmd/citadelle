-- ════════════════════════════════════════════════════════════════════════
--  EduGest — Notifications parents (SMS / WhatsApp) : journal + anti-doublon
-- ════════════════════════════════════════════════════════════════════════
-- À exécuter APRÈS schema.sql + rls.sql (idempotent). Ne dépend PAS d'un
-- fournisseur : la table sert de journal, de suivi de coût et de garde
-- anti-doublon (dedup_key unique). L'envoi réel vit dans l'Edge Function
-- `notify` (service_role) — inactif tant qu'aucun secret fournisseur n'est
-- posé (même principe que password-reset).
--
-- Réglages par école : ecoles.extra.notifications (jsonb, pas de colonne) :
--   { "paiement": true, "absence": true, "annonce": true,
--     "heureDebut": 7, "heureFin": 20 }   // heures locales (silence la nuit)
-- Absent = déclencheur désactivé (opt-in explicite par la Direction).

create table if not exists notifications_envois (
  id           uuid primary key default gen_random_uuid(),
  ecole_id     uuid not null references ecoles(id) on delete cascade,
  eleve_id     uuid references eleves(id) on delete set null,  -- null = diffusion (annonce)
  type         text not null,                    -- 'paiement' | 'absence' | 'annonce'
  canal        text,                             -- 'whatsapp' | 'sms' | null (ignoré)
  destinataire text,                             -- numéro E.164 (+224…)
  statut       text not null default 'envoye',   -- 'envoye' | 'echec' | 'ignore'
  erreur       text,
  cout         numeric,                          -- optionnel (si le fournisseur le renvoie)
  dedup_key    text unique,                      -- ex. 'absence:<eleve>:2026-07-24'
  created_at   timestamptz default now()
);

create index if not exists idx_notif_ecole  on notifications_envois (ecole_id, created_at desc);
create index if not exists idx_notif_eleve  on notifications_envois (eleve_id);

-- ── RLS : le personnel LIT le journal de son école ; seules les écritures
-- service_role (Edge Function) insèrent. Aucun rôle authenticated n'écrit.
alter table notifications_envois enable row level security;

drop policy if exists notif_select on notifications_envois;
create policy notif_select on notifications_envois for select to authenticated
  using (ecole_id = auth_ecole_id() and is_staff());
-- (Pas de policy insert/update/delete pour authenticated → seul service_role,
--  qui contourne la RLS, écrit. Empêche toute falsification du journal.)

-- ── PowerSync (hors ligne) : NON répliquée. Le journal se consulte en ligne
-- (module Historique/compta) ; l'envoi est de toute façon une action réseau.
