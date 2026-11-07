-- 20261027173102_paie_enseignants_hors_fiche.sql
-- Pourquoi : PHASE 2 de la sortie de la paie des enseignants (phase 1 :
-- 20261027171600_paie_enseignants.sql). La paie est déjà dans la table
-- `paie_enseignants`, réservée à la Comptabilité, et le front la lit là. Il
-- reste à l'EFFACER de `enseignants.extra`, que tout compte de l'école lit :
-- c'est ce qui ferme l'accès des chefs de section (API, miroir hors ligne).
-- Désormais la paie enregistrée sur une fiche y est retirée à l'écriture et
-- rangée dans la table (si c'est la Comptabilité qui l'écrit).
--
-- PRÉREQUIS (sinon la Comptabilité verrait des forfaits à 0) :
--  - phase 1 en production, front compris, depuis assez longtemps pour que
--    les postes aient rechargé l'application ;
--  - règles PowerSync de la phase 1 redéployées (bucket compta_data avec
--    paie_enseignants) ;
--  - `node supabase/verifier-paie-enseignants.mjs` relu et validé.
--
-- Règles (docs/migrations-sql.md) :
--  - appliquée UNE fois, dans l'ordre, par la CI au déploiement — jamais à
--    la main dans l'éditeur SQL ;
--  - compatible avec le front encore en ligne (ajouter avant de retirer) ;
--  - ne jamais modifier une migration déjà fusionnée : en écrire une autre.

-- ── 1. Filet : aucune paie ne doit disparaître ─────────────────────────────
-- Une fiche porteuse de paie sans ligne dans la table (ne devrait pas
-- exister après la phase 1) : sa paie y est recopiée avant l'effacement.
-- Une ligne existante n'est PAS écrasée : la table est la référence (seule
-- la Comptabilité y écrit), la fiche a pu être réenregistrée par un autre.
insert into public.paie_enseignants (id, ecole_id, extra)
select id, ecole_id, public.paie_enseignant_extraire(extra)
  from public.enseignants
 where extra ?| array['montantForfait', 'salaireBase', 'forfait', 'primeHoraire', 'primeParClasse']
on conflict (id) do nothing;

-- ── 2. Fin de la recopie ───────────────────────────────────────────────────
drop trigger if exists trg_paie_enseignant_recopier on public.enseignants;
drop function if exists public.paie_enseignant_recopier();

-- ── 3. Effacement de la paie des fiches ────────────────────────────────────
update public.enseignants
   set extra = extra - array['montantForfait', 'salaireBase', 'forfait', 'primeHoraire', 'primeParClasse']
 where extra ?| array['montantForfait', 'salaireBase', 'forfait', 'primeHoraire', 'primeParClasse'];

-- ── 4. Déplacement à l'écriture ────────────────────────────────────────────
-- La paie écrite sur une fiche (écrans de la Comptabilité, écriture hors
-- ligne envoyée plus tard) n'y reste jamais : retirée avant enregistrement,
-- rangée dans la table si l'auteur écrit la Comptabilité (ou le serveur),
-- ignorée sinon. À la création d'une fiche, la ligne de paie est écrite
-- avant la fiche : la clé étrangère différée l'accepte.
create or replace function public.paie_enseignant_deplacer() returns trigger
    language plpgsql security definer
    set search_path to 'public'
    as $$
declare
  v_paie jsonb;
begin
  v_paie := paie_enseignant_extraire(new.extra);
  if v_paie = '{}'::jsonb then return new; end if;
  new.extra := new.extra - array['montantForfait', 'salaireBase', 'forfait', 'primeHoraire', 'primeParClasse'];
  if coalesce(auth.role(), 'service_role') = 'authenticated' and not has_module_write('compta') then
    return new;
  end if;
  insert into paie_enseignants (id, ecole_id, extra) values (new.id, new.ecole_id, v_paie)
  on conflict (id) do update set extra = paie_enseignants.extra || excluded.extra;
  return new;
end $$;

revoke all on function public.paie_enseignant_deplacer() from public, anon, authenticated;
grant execute on function public.paie_enseignant_deplacer() to service_role;

create trigger trg_paie_enseignant_deplacer before insert or update of extra on public.enseignants
  for each row execute function public.paie_enseignant_deplacer();
