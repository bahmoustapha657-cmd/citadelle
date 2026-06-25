// Helper de charge utile QR des documents imprimés.
import test from "node:test";
import assert from "node:assert/strict";
import { qrPayload } from "../src/reports/qr.js";

test("qrPayload : champs clé:valeur séparés par |", () => {
  assert.equal(
    qrPayload({ EduGest: "Bulletin", Eleve: "Diallo A", Moy: "16/20" }),
    "EduGest:Bulletin|Eleve:Diallo A|Moy:16/20",
  );
});

test("qrPayload : ignore les champs vides / null / undefined", () => {
  assert.equal(
    qrPayload({ A: "1", B: "", C: null, D: undefined, E: "  ", F: "2" }),
    "A:1|F:2",
  );
});

test("qrPayload : neutralise les séparateurs internes (| et retour ligne)", () => {
  assert.equal(qrPayload({ X: "a|b\nc" }), "X:a b c");
});

test("qrPayload : objet vide → chaîne vide", () => {
  assert.equal(qrPayload({}), "");
});
