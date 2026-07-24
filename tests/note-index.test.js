import { test } from "node:test";
import assert from "node:assert/strict";
import { indexerNotesParEleve, notesDeLEleve } from "../src/note-index.js";

const NOTES = [
  { eleveId: "a", periode: "T1", matiere: "Maths", note: 12 },
  { eleveId: "b", periode: "T1", matiere: "Maths", note: 15 },
  { eleveId: "a", periode: "T1", matiere: "Français", note: 9 },
  { eleveId: "a", periode: "T2", matiere: "Maths", note: 14 },
  { eleveId: "c", periode: "T2", matiere: "Maths", note: 8 },
];

test("regroupe les notes par élève", () => {
  const index = indexerNotesParEleve(NOTES);
  assert.equal(notesDeLEleve(index, "a").length, 3);
  assert.equal(notesDeLEleve(index, "b").length, 1);
  assert.equal(notesDeLEleve(index, "c").length, 1);
});

test("filtre par période quand elle est fournie", () => {
  const index = indexerNotesParEleve(NOTES, "T1");
  assert.equal(notesDeLEleve(index, "a").length, 2);
  assert.equal(notesDeLEleve(index, "c").length, 0); // c n'a que du T2
});

test("élève sans note → tableau vide stable (pas de réallocation)", () => {
  const index = indexerNotesParEleve(NOTES, "T1");
  const v1 = notesDeLEleve(index, "inconnu");
  const v2 = notesDeLEleve(index, "autre");
  assert.deepEqual(v1, []);
  assert.equal(v1, v2, "doit renvoyer la même référence gelée");
  assert.throws(() => v1.push({}), "le vide partagé doit être immuable");
});

test("résultat STRICTEMENT identique au filter qu'il remplace", () => {
  // Le contrat qui compte : mêmes notes, dans le même ordre, qu'avant.
  for (const periode of ["T1", "T2", null]) {
    const index = indexerNotesParEleve(NOTES, periode);
    for (const eleveId of ["a", "b", "c", "inconnu"]) {
      const attendu = NOTES.filter(
        (n) => n.eleveId === eleveId && (periode == null || n.periode === periode),
      );
      assert.deepEqual(notesDeLEleve(index, eleveId), attendu, `${eleveId}/${periode}`);
    }
  }
});

test("entrées vides ou absentes ne cassent pas", () => {
  assert.equal(indexerNotesParEleve().size, 0);
  assert.equal(indexerNotesParEleve([]).size, 0);
  assert.deepEqual(notesDeLEleve(indexerNotesParEleve([]), "x"), []);
});
