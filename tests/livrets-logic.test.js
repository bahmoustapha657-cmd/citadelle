import assert from "node:assert/strict";
import test from "node:test";
import {
  anneesApresSaisie, anneesApresSignature, buildAnneePreRemplie,
} from "../src/components/livrets-tab/livrets-logic.js";

// Ces fonctions construisent la liste `annees` envoyée par useLivretsTab via
// modifierChamp(id, { annees }). Le choix du mutateur, lui, vit dans le hook
// React : il n'est pas couvert ici (pas de banc de test React dans le dépôt).

const entree = (anneeScolaire, champs = {}) => ({
  anneeScolaire, classe: "6e A", decision: "Admis",
  notes: [{ matiere: "Maths", coef: 4, annuelle: 12.5 }],
  signe: false, dateSigne: null, ...champs,
});

test("anneesApresSaisie : une nouvelle année s'ajoute en fin de livret", () => {
  const avant = [entree("2024-2025")];
  const apres = anneesApresSaisie(avant, entree("2025-2026"));
  assert.deepEqual(apres.map((a) => a.anneeScolaire), ["2024-2025", "2025-2026"]);
  assert.equal(avant.length, 1, "la liste du livret affiché n'est pas modifiée en place");
});

test("anneesApresSaisie : première année d'un livret vide ou sans champ annees", () => {
  assert.deepEqual(anneesApresSaisie([], entree("2025-2026")), [entree("2025-2026")]);
  assert.deepEqual(anneesApresSaisie(undefined, entree("2025-2026")), [entree("2025-2026")]);
});

test("anneesApresSaisie : l'édition remplace l'entrée visée, index 0 compris", () => {
  const avant = [entree("2024-2025"), entree("2025-2026")];
  const apres = anneesApresSaisie(avant, { ...avant[0], rang: "3", _idx: 0 });
  assert.equal(apres.length, 2);
  assert.equal(apres[0].rang, "3");
  assert.equal(apres[0].anneeScolaire, "2024-2025");
  assert.equal(apres[1], avant[1]);
  assert.equal(avant[0].rang, undefined, "l'entrée d'origine n'est pas modifiée en place");
});

test("anneesApresSaisie : le marqueur d'édition _idx n'est jamais persisté", () => {
  const apres = anneesApresSaisie([entree("2024-2025")], { ...entree("2024-2025"), _idx: 0 });
  assert.equal(Object.hasOwn(apres[0], "_idx"), false);
  const ajout = anneesApresSaisie([], entree("2025-2026"));
  assert.equal(Object.hasOwn(ajout[0], "_idx"), false);
});

test("anneesApresSignature : signe et date l'entrée visée, sans toucher aux autres", () => {
  const avant = [entree("2024-2025"), entree("2025-2026")];
  const apres = anneesApresSignature(avant, 1, "2026-09-23");
  assert.deepEqual(apres[1], { ...avant[1], signe: true, dateSigne: "2026-09-23" });
  assert.equal(apres[0], avant[0]);
  assert.equal(avant[1].signe, false, "la liste du livret affiché n'est pas modifiée en place");
});

// Pré-remplissage : un élève resté dans la même section d'une année sur l'autre
// (7ème en 2024-2025, 8ème en 2025-2026) a un T1, un T2… CHAQUE année.
const eleve = { _id: "e1", classe: "8ème A" };
const devoir = (annee, periode, matiere, note) => ({
  eleveId: "e1", matiere, type: "Devoir", periode, note, annee,
});
const contexte = (notes, champs = {}) => ({
  notes,
  matieres: [{ nom: "Maths", coefficient: 4 }, { nom: "Français", coefficient: 3 }],
  periodes: ["T1", "T2", "T3"],
  section: "college", maxNote: 20, eleves: [eleve], annee: "2025-2026",
  ...champs,
});

test("buildAnneePreRemplie : seules les notes de l'année préparée sont moyennées", () => {
  const notes = [
    devoir("2024-2025", "T1", "Maths", 6), devoir("2024-2025", "T2", "Maths", 8),
    devoir("2024-2025", "T3", "Maths", 10), devoir("2024-2025", "T1", "Français", 5),
    devoir("2025-2026", "T1", "Maths", 14), devoir("2025-2026", "T2", "Maths", 16),
    devoir("2025-2026", "T1", "Français", 12),
  ];
  const preparee = buildAnneePreRemplie(eleve, contexte(notes));
  assert.equal(preparee.anneeScolaire, "2025-2026");
  assert.deepEqual(preparee.notes, [
    // T3 reste vide : l'année d'avant en avait un, pas celle-ci.
    { matiere: "Maths", coef: 4, maxNote: 20, T1: 14, T2: 16, T3: null, annuelle: 10 },
    { matiere: "Français", coef: 3, maxNote: 20, T1: 12, T2: null, T3: null, annuelle: 4 },
  ]);
});

test("buildAnneePreRemplie : une note sans année n'est jamais reprise, comme dans le module École", () => {
  const sansAnnee = { eleveId: "e1", matiere: "Maths", type: "Devoir", periode: "T1", note: 2 };
  const notes = [
    sansAnnee, { ...sansAnnee, note: 4, annee: null }, { ...sansAnnee, note: 6, annee: "" },
    devoir("2025-2026", "T1", "Maths", 14),
  ];
  assert.equal(buildAnneePreRemplie(eleve, contexte(notes)).notes[0].T1, 14);
  const seulementSansAnnee = buildAnneePreRemplie(eleve, contexte([sansAnnee]));
  assert.deepEqual(seulementSansAnnee.notes[0], {
    matiere: "Maths", coef: 4, maxNote: 20, T1: null, T2: null, T3: null, annuelle: null,
  });
});

test("buildAnneePreRemplie : sans année fournie, l'entrée ET le filtre suivent getAnnee()", () => {
  const precedent = globalThis.localStorage;
  globalThis.localStorage = { getItem: (cle) => (cle === "LC_annee" ? "2024-2025" : null) };
  try {
    const notes = [devoir("2024-2025", "T1", "Maths", 6), devoir("2025-2026", "T1", "Maths", 14)];
    const preparee = buildAnneePreRemplie(eleve, contexte(notes, { annee: undefined }));
    assert.equal(preparee.anneeScolaire, "2024-2025");
    assert.equal(preparee.notes[0].T1, 6);
  } finally {
    globalThis.localStorage = precedent;
  }
});

test("buildAnneePreRemplie : le filtre d'année ne touche ni au rang, ni à l'effectif, ni aux autres champs", () => {
  const eleves = [eleve, { _id: "e2", classe: "8ème A" }, { _id: "e3", classe: "7ème B" }];
  const notes = [devoir("2024-2025", "T1", "Maths", 6), devoir("2025-2026", "T1", "Maths", 14)];
  const { notes: _lignes, ...champs } = buildAnneePreRemplie(eleve, contexte(notes, { eleves }));
  assert.deepEqual(champs, {
    anneeScolaire: "2025-2026", classe: "8ème A", enseignantPrincipal: "",
    absences: { justifiees: 0, nonJustifiees: 0 },
    rang: "", effectifClasse: 2,
    appreciation: "", decision: "Admis", signe: false, dateSigne: null,
  });
});
