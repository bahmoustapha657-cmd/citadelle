// Barème du portail enseignant : la grille ET la saisie unitaire valident
// les notes avec validateGridNotes, bornée par getBaremeForSection(section).
import { test } from "node:test";
import assert from "node:assert/strict";

import { getBaremeForSection } from "../src/constants.js";
import { validateGridNotes } from "../src/components/portail-enseignant/notes-grid.js";

const notes = (...valeurs) => valeurs.map((note) => ({ eleveId: "e1", periode: "T1", note }));

test("primaire : une note au-delà de 10 est refusée, le message donne le barème", () => {
  const maxNote = getBaremeForSection("primaire");
  assert.equal(validateGridNotes(notes(0, 7.5, 10), maxNote), null);
  for (const hors of [10.5, 15, -1]) {
    assert.equal(
      validateGridNotes(notes(hors), maxNote),
      "Note invalide détectée (doit être un nombre entre 0 et 10).",
      String(hors),
    );
  }
});

test("secondaire : les notes vont jusqu'à 20, pas au-delà", () => {
  for (const section of ["college", "lycee"]) {
    const maxNote = getBaremeForSection(section);
    assert.equal(validateGridNotes(notes(15, 20), maxNote), null, section);
    assert.match(validateGridNotes(notes(25), maxNote), /entre 0 et 20/, section);
  }
});

test("saisie unitaire : une valeur non numérique est refusée", () => {
  // enregistrerNote valide [{ note: Number(formNote.note) }].
  assert.match(validateGridNotes([{ note: Number("abc") }], 10), /Note invalide/);
  assert.match(validateGridNotes([{ note: Number(undefined) }], 20), /Note invalide/);
});

test("sans barème fourni, la validation reste sur 20 (rétrocompat)", () => {
  assert.equal(validateGridNotes(notes(18)), null);
  assert.match(validateGridNotes(notes(21)), /entre 0 et 20/);
});

test("liste vide : rien à enregistrer", () => {
  assert.equal(validateGridNotes([], 10), "Aucune note nouvelle ou modifiée à enregistrer.");
});
