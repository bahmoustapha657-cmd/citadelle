-- ════════════════════════════════════════════════════════════════════════
--  EduGest — Matières rattachées : le professeur d'une discipline note les
--  épreuves qui en relèvent (Français → Dictée et Questions, Rédaction)
-- ════════════════════════════════════════════════════════════════════════
-- À exécuter dans Supabase → SQL Editor. Idempotent ; ordre indifférent
-- (ne redéfinit QUE teacher_can_write_note, aucune policy).
--
-- Une matière porte désormais une NATURE (extra.nature) : enseignée et
-- évaluée, enseignée seulement (Vocabulaire, Français au collège : emploi du
-- temps, jamais notée) ou évaluée seulement (Dictée et Questions, Rédaction :
-- fiches de notes et bulletins). Et un RATTACHEMENT facultatif
-- (extra.rattachement) : la discipline enseignée dont elle relève.
--
-- Au secondaire, la RLS n'acceptait une note que dans LA matière du profil
-- enseignant : le professeur de Français ne pouvait pas noter « Dictée et
-- Questions ». Il le peut maintenant pour toute matière de sa section
-- rattachée à la sienne. Seul le personnel qui écrit la section modifie les
-- matières (policy matieres_write) : un enseignant ne peut pas se rattacher
-- une matière lui-même. Maternelle et primaire inchangés (titulaire, pas de
-- filtre matière).
--
-- Définition identique à teacher-security.sql et prescolaire-3-enseignants.sql
-- (tests/portail-prescolaire.test.js) : rejouer l'un ou l'autre ne la fait
-- donc pas régresser. Inclut la dispense de la maternelle : appliquer ce
-- fichier vaut aussi pour la fonction de prescolaire-3-enseignants.sql.

create or replace function teacher_can_write_note(
    p_eleve uuid, p_matiere text, p_section section_scolaire) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from comptes c
    join enseignant_classes ec on ec.compte_id = c.id
    join eleves e on e.ecole_id = ec.ecole_id
                 and e.section = ec.section and e.classe = ec.classe
    where c.user_id = auth.uid()
      and e.id = p_eleve
      and e.section = p_section
      and (ec.section::text in ('primaire', 'prescolaire')
           or (coalesce(btrim(c.matiere), '') <> ''
               and (lower(btrim(p_matiere)) = lower(btrim(c.matiere))
                    or exists (
                      select 1 from matieres m
                      where m.ecole_id = e.ecole_id
                        and m.section = e.section
                        and lower(btrim(m.nom)) = lower(btrim(p_matiere))
                        and lower(btrim(coalesce(m.extra->>'rattachement', '')))
                            = lower(btrim(c.matiere))))))
  );
$$;
grant execute on function teacher_can_write_note(uuid, text, section_scolaire) to authenticated;

-- ── Contrôle ────────────────────────────────────────────────────────────────
-- Attendu : true, true (rattachement pris en compte, maternelle dispensée).
select pg_get_functiondef('teacher_can_write_note(uuid, text, section_scolaire)'::regprocedure)
         like '%rattachement%' as rattachement_actif,
       pg_get_functiondef('teacher_can_write_note(uuid, text, section_scolaire)'::regprocedure)
         like '%''prescolaire''%' as maternelle_dispensee;
