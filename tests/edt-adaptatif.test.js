import { test } from "node:test";
import assert from "node:assert/strict";
import {
  enMinutes, enHeure, genTranchesAdaptatives, planifierJour,
} from "../src/components/ecole/edt/edt-utils.js";
import { buildCreneauData } from "../src/components/ecole/edt/cellule-data.js";

test("conversions heure ↔ minutes", () => {
  assert.equal(enMinutes("08:15"), 495);
  assert.equal(enMinutes("00:00"), 0);
  assert.equal(enMinutes(""), null);
  assert.equal(enHeure(495), "08:15");
  assert.equal(enHeure(0), "00:00");
});

test("sans créneau : la grille reste au pas régulier", () => {
  const t = genTranchesAdaptatives(60, "08:00", "11:00", []);
  assert.deepEqual(t, ["08:00", "09:00", "10:00", "11:00"]);
});

test("les horaires réellement saisis créent leurs propres lignes", () => {
  // Une journée de maternelle : 15 min, 30 min, 45 min puis 1 h.
  const creneaux = [
    { heureDebut: "08:00", heureFin: "08:15" }, // accueil 15 min
    { heureDebut: "08:15", heureFin: "08:45" }, // regroupement 30 min
    { heureDebut: "08:45", heureFin: "09:30" }, // atelier 45 min
    { heureDebut: "09:30", heureFin: "10:30" }, // sieste 1 h
  ];
  // La grille s'arrête au dernier créneau (10:30) : pas de ligne vide jusqu'à 11:00.
  const t = genTranchesAdaptatives(60, "08:00", "11:00", creneaux);
  assert.deepEqual(t, ["08:00", "08:15", "08:45", "09:00", "09:30", "10:00", "10:30"]);
  // …sauf si l'on demande explicitement la plage complète.
  const complet = genTranchesAdaptatives(60, "08:00", "11:00", creneaux, false);
  assert.equal(complet[complet.length - 1], "11:00");
});

test("la grille se resserre sur la journée réelle (pas de lignes vides)", () => {
  // Plage large réglée par l'école, mais une seule activité en fin de matinée.
  const t = genTranchesAdaptatives(60, "08:00", "14:00", [
    { heureDebut: "10:00", heureFin: "11:00" },
  ]);
  assert.deepEqual(t, ["10:00", "11:00"], "ni les 2 h avant ni les 3 h après ne doivent apparaître");
});

test("un créneau hors plage élargit la grille au lieu d'être perdu", () => {
  const t = genTranchesAdaptatives(60, "09:00", "10:00", [
    { heureDebut: "07:30", heureFin: "08:00" },
  ]);
  assert.equal(t[0], "07:30", "la grille doit descendre jusqu'au créneau");
});

test("chaque créneau couvre exactement ses lignes (rowSpan)", () => {
  const creneaux = [
    { _id: "a", heureDebut: "08:00", heureFin: "08:15" },
    { _id: "b", heureDebut: "08:15", heureFin: "08:45" },
    { _id: "c", heureDebut: "09:30", heureFin: "10:30" },
  ];
  const tranches = genTranchesAdaptatives(60, "08:00", "11:00", creneaux);
  const { debuts, occupees } = planifierJour(creneaux, tranches);

  // 08:00 → 08:15 : une seule ligne
  assert.equal(debuts.get(0).creneau._id, "a");
  assert.equal(debuts.get(0).span, 1);
  // 08:15 → 08:45 : une seule ligne aussi (bornes 08:15 et 08:45 existent)
  assert.equal(debuts.get(1).creneau._id, "b");
  assert.equal(debuts.get(1).span, 1);
  // 09:30 → 10:30 traverse la borne 10:00 : deux lignes
  const iC = tranches.indexOf("09:30");
  assert.equal(debuts.get(iC).creneau._id, "c");
  assert.equal(debuts.get(iC).span, 2);
  // La ligne 10:00, couverte par « c », ne doit pas rendre de cellule.
  assert.ok(occupees.has(tranches.indexOf("10:00")));
});

test("un créneau désaligné reste visible (il n'est plus perdu)", () => {
  // C'était le bug : 08:20 ne tombait sur aucune tranche de 60 min.
  const creneaux = [{ _id: "x", heureDebut: "08:20", heureFin: "08:50" }];
  const tranches = genTranchesAdaptatives(60, "08:00", "10:00", creneaux);
  const { debuts } = planifierJour(creneaux, tranches);
  const trouve = [...debuts.values()].some((d) => d.creneau._id === "x");
  assert.ok(trouve, "le créneau désaligné doit apparaître");
});

test("les créneaux ne se chevauchent pas dans le rendu", () => {
  const creneaux = [
    { _id: "a", heureDebut: "08:00", heureFin: "09:00" },
    { _id: "b", heureDebut: "09:00", heureFin: "10:00" },
  ];
  const tranches = genTranchesAdaptatives(30, "08:00", "10:00", creneaux);
  const { debuts, occupees } = planifierJour(creneaux, tranches);
  for (const i of debuts.keys()) {
    assert.ok(!occupees.has(i), `la ligne ${i} ne peut pas être à la fois début et couverte`);
  }
});

test("entrées vides ou incohérentes ne cassent pas le calcul", () => {
  const tranches = genTranchesAdaptatives(60, "08:00", "10:00", [{}, { heureDebut: "" }]);
  assert.deepEqual(tranches, ["08:00", "09:00", "10:00"]);
  const { debuts } = planifierJour([{ heureDebut: null }], tranches);
  assert.equal(debuts.size, 0);
});

// ── Récréation : ni matière imposée, ni enseignant ──────────────────────────
const CELLULE = { jour: "Lundi", heureDebut: "10:00", heureFin: "10:15" };

test("récréation : libellé par défaut si laissé vide", () => {
  const d = buildCreneauData({ type: "recreation" }, "Petite Section A", CELLULE);
  assert.equal(d.matiere, "Récréation");
  assert.equal(d.type, "recreation");
});

test("récréation : libellé libre conservé", () => {
  const d = buildCreneauData({ type: "recreation", matiere: "Pause déjeuner" }, "PS A", CELLULE);
  assert.equal(d.matiere, "Pause déjeuner");
});

test("récréation : aucun enseignant ni salle n'est conservé", () => {
  // Cas réel : l'utilisateur saisit un cours puis bascule en récréation.
  const d = buildCreneauData(
    { type: "recreation", enseignant: "Fally BAH", salle: "B12", matiere: "  " },
    "PS A", CELLULE,
  );
  assert.equal(d.enseignant, "", "un enseignant résiduel fausserait la détection de conflit");
  assert.equal(d.salle, "");
  assert.equal(d.matiere, "Récréation");
});

test("un cours garde bien sa matière, son enseignant et sa salle", () => {
  const d = buildCreneauData(
    { type: "cours", matiere: "Lecture", enseignant: "Fally BAH", salle: "A1" },
    "PS A", CELLULE,
  );
  assert.equal(d.matiere, "Lecture");
  assert.equal(d.enseignant, "Fally BAH");
  assert.equal(d.salle, "A1");
});
