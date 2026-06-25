// Brouillon local de la grille (étape A hors-ligne). On simule window.localStorage
// (safeLocal() le lit paresseusement à chaque appel, donc le mock suffit).
import test from "node:test";
import assert from "node:assert/strict";

const store = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  },
};

const { draftKey, loadDraft, saveDraft, clearDraft } = await import("../src/components/portail-enseignant/notes-draft.js");

const ctx = { ownerId: "ens1", classe: "CM2", type: "Composition", periode: "T1", matiere: "Maths", multiPeriode: false, multiMatiere: false };

test("draftKey : stable et discriminant selon le mode", () => {
  const k1 = draftKey(ctx);
  assert.equal(k1, draftKey({ ...ctx }));                       // déterministe
  assert.notEqual(k1, draftKey({ ...ctx, periode: "T2" }));     // période compte
  // En « toutes périodes », la période ne discrimine plus (marqueur P*).
  assert.equal(
    draftKey({ ...ctx, multiPeriode: true, periode: "T1" }),
    draftKey({ ...ctx, multiPeriode: true, periode: "T2" }),
  );
});

test("save → load restitue les cellules non vides uniquement", () => {
  const key = draftKey(ctx);
  saveDraft(key, { a: "12", b: "", c: "9", d: null });
  const d = loadDraft(key);
  assert.deepEqual(d.notes, { a: "12", c: "9" });
  assert.ok(typeof d.savedAt === "number");
});

test("save vide supprime le brouillon", () => {
  const key = draftKey({ ...ctx, classe: "CM1" });
  saveDraft(key, { a: "5" });
  assert.ok(loadDraft(key));
  saveDraft(key, { a: "", b: null });
  assert.equal(loadDraft(key), null);
});

test("clearDraft efface", () => {
  const key = draftKey({ ...ctx, classe: "CE2" });
  saveDraft(key, { a: "7" });
  clearDraft(key);
  assert.equal(loadDraft(key), null);
});

test("loadDraft tolère une entrée corrompue", () => {
  const key = draftKey({ ...ctx, classe: "CP" });
  store.set(key, "{pas du json");
  assert.equal(loadDraft(key), null);
});
