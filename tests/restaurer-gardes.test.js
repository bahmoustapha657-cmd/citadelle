// Gardes RLS écrasées par un rejeu de teacher-security.sql (2026-09-25).
//
// Défaut d'origine : teacher-security.sql reposait, à chaque passage, ses
// versions d'AMORÇAGE de comptes_guard, notes_write et absences_write — larges
// (is_staff). Rejoué après postes.sql, il rouvrait l'auto-promotion du
// personnel (un surveillant s'est donné le poste direction sur l'École Démo).
// restaurer-gardes.sql remet les versions définitives : il doit en rester la
// copie CONFORME, sinon le rejouer réintroduirait une version périmée — le
// défaut même qu'il répare. Sondes réelles : supabase/test-rls-postes.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = (fichier) => readFileSync(new URL(`../supabase/${fichier}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const GARDE = /create or replace function comptes_guard\(\)[\s\S]*?\nend; \$\$;/;
const NOTES = /create policy notes_write on notes[^;]*;/;
const ABSENCES = /create policy absences_write on absences[^;]*;/;

test("restaurer-gardes.sql : copie conforme des versions définitives", () => {
  const restauration = sql("restaurer-gardes.sql");
  const origines = [
    ["comptes_guard", GARDE, sql("postes.sql")],
    ["notes_write", NOTES, sql("postes.sql")],
    ["absences_write", ABSENCES, sql("discipline-module.sql")],
  ];
  for (const [nom, motif, origine] of origines) {
    const attendue = origine.match(motif)?.[0];
    assert.ok(attendue, `${nom} présent dans son fichier d'origine`);
    assert.equal(restauration.match(motif)?.[0], attendue, `${nom} identique à son fichier d'origine`);
  }
  // La version définitive fige le poste, et ne laisse jamais passer is_staff.
  const garde = restauration.match(GARDE)[0];
  assert.doesNotMatch(garde, /if is_staff\(\) then return new;/);
  assert.match(garde, /new\.poste_id is distinct from old\.poste_id/);
  assert.match(restauration, /create trigger trg_comptes_guard before update on comptes/);
});

test("teacher-security.sql : ses versions d'amorçage ne s'appliquent plus après postes.sql", () => {
  const texte = sql("teacher-security.sql");
  const bloc = texte.match(/do \$\$\nbegin\n {2}if to_regclass\('public\.postes'\) is not null then[\s\S]*?\nend \$\$;/)?.[0];
  assert.ok(bloc, "bloc conditionnel « postes.sql déjà passé » présent");
  assert.match(bloc, /return;/);
  for (const objet of [
    "create policy notes_write on notes",
    "create policy absences_write on absences",
    "create or replace function comptes_guard()",
    "create trigger trg_comptes_guard",
  ]) {
    assert.equal(texte.split(objet).length - 1, 1, `${objet} : une seule définition dans le fichier`);
    assert.ok(bloc.includes(objet), `${objet} : posé uniquement dans le bloc conditionnel`);
  }
});
