import assert from "node:assert/strict";
import test from "node:test";

import { enrichirNotes, notePrete, optionsEleves } from "../src/notes-eleves.js";
import { completerDepuisFiches, nomEleve } from "../src/fiche-eleve.js";
import { enrichirAbsences } from "../src/absences-eleves.js";
import { toRow, transformRow } from "../src/backend/collection-map.js";

const ALPHA = { _id: "e1", nom: "DIALLO", prenom: "Aminata", classe: "6ème A", matricule: "M-001" };
const BETA = { _id: "e2", nom: "BAH", prenom: "Ibrahima", classe: "7ème B" };
// Homonyme d'ALPHA dans une autre classe.
const ALPHA_BIS = { _id: "e3", nom: "DIALLO", prenom: "Aminata", classe: "8ème A", matricule: "M-003" };
// Homonyme d'ALPHA dans la MÊME classe.
const ALPHA_TER = { _id: "e5", nom: "DIALLO", prenom: "Aminata", classe: "6ème A", matricule: "M-005" };
const PARTI = { _id: "e4", nom: "SOW", prenom: "Mamadou", classe: "9ème A", statut: "Transféré" };

// Ligne telle que la lit le mapping Supabase : pas de nom.
const ligne = (id, eleveId, extra = {}) => transformRow("notes", {
  id, section: "college", eleve_id: eleveId, matiere: "Maths", type: "Devoir",
  periode: "T1", note: "14", annee: "2026-2027", enseignant_id: null, enseignant_nom: null,
  created_at: "2026-10-01T08:00:00Z", updated_at: null, ...extra,
});

test("le mapping Supabase ne rend pas le nom : c'est la fiche qui le donne", () => {
  const brute = ligne("n1", "e1");
  assert.equal(brute.eleveNom, undefined);
  const [n] = enrichirNotes([brute], [ALPHA, BETA]);
  assert.equal(n.eleveNom, "DIALLO Aminata");
  // Le reste de la note est intact.
  assert.equal(n._id, "n1");
  assert.equal(n.eleveId, "e1");
  assert.equal(n.note, 14);
  assert.equal(n.matiere, "Maths");
});

test("le nom ne part jamais en base : ni colonne, ni jsonb pour les notes", () => {
  // Aucune colonne ajoutée, donc rien à déclarer dans le schéma PowerSync.
  const { row, extraKeys } = toRow("notes", {
    eleveId: "e1", eleveNom: "DIALLO Aminata", matiere: "Maths", type: "Devoir",
    periode: "T1", note: 14, annee: "2026-2027",
  });
  assert.equal(row.eleve_id, "e1");
  assert.ok(!("eleve_nom" in row) && !("eleveNom" in row) && !("extra" in row));
  assert.ok(!extraKeys.includes("eleveNom"));
});

test("deux homonymes restent distincts : la jointure se fait par identifiant", () => {
  const notes = enrichirNotes([ligne("n1", "e1"), ligne("n3", "e3")], [ALPHA, ALPHA_BIS]);
  assert.deepEqual(notes.map((n) => [n._id, n.eleveId, n.eleveNom]), [
    ["n1", "e1", "DIALLO Aminata"],
    ["n3", "e3", "DIALLO Aminata"],
  ]);
});

test("un élève parti garde son nom si la liste l'inclut", () => {
  const [n] = enrichirNotes([ligne("n4", "e4")], [ALPHA, PARTI]);
  assert.equal(n.eleveNom, "SOW Mamadou");
});

test("la fiche fait foi sur le nom porté par la note", () => {
  const ancienne = { _id: "n5", eleveId: "e1", eleveNom: "DIALO Aminata", matiere: "Maths", note: 12 };
  const [n] = enrichirNotes([ancienne], [ALPHA]);
  assert.equal(n.eleveNom, "DIALLO Aminata");
});

test("sans fiche retrouvée, la note garde ce qu'elle porte, ou du vide", () => {
  const firestore = { _id: "n6", eleveNom: "KABA Fanta", matiere: "Maths", note: 9 };
  const inconnue = ligne("n7", "e-autre-section");
  const [a, b] = enrichirNotes([firestore, inconnue], [ALPHA]);
  assert.equal(a.eleveNom, "KABA Fanta");
  assert.equal(b.eleveNom, "");
});

test("enrichirNotes tolère des listes absentes et ne modifie pas les notes reçues", () => {
  assert.deepEqual(enrichirNotes(), []);
  assert.deepEqual(enrichirNotes(undefined, [ALPHA]), []);
  const brute = ligne("n1", "e1");
  const [n] = enrichirNotes([brute]);
  assert.equal(n.eleveNom, "");
  enrichirNotes([brute], [ALPHA]);
  assert.equal(brute.eleveNom, undefined);
});

test("nomEleve : « NOM Prénom », sans espace parasite ni « undefined »", () => {
  assert.equal(nomEleve(ALPHA), "DIALLO Aminata");
  assert.equal(nomEleve({ nom: "CONDE" }), "CONDE");
  assert.equal(nomEleve(null), "");
});

test("sélecteur d'élève : la valeur est l'identifiant, plus le nom", () => {
  const options = optionsEleves([ALPHA, ALPHA_BIS, BETA]);
  assert.deepEqual(options.map((o) => o.value), ["e1", "e3", "e2"]);
  // Choisi par son nom, l'homonyme retombait sur le premier de la liste.
  const parNom = [ALPHA, ALPHA_BIS].find((e) => `${e.nom} ${e.prenom}` === "DIALLO Aminata");
  assert.equal(parNom._id, "e1");
  // Choisi par identifiant, chacun garde le sien.
  const choisi = [ALPHA, ALPHA_BIS].find((e) => e._id === options[1].value);
  assert.equal(choisi._id, "e3");
});

test("sélecteur d'élève : la classe départage les homonymes à l'écran", () => {
  const [a, b, c] = optionsEleves([ALPHA, ALPHA_BIS, BETA]);
  assert.equal(a.label, "DIALLO Aminata — 6ème A");
  assert.equal(b.label, "DIALLO Aminata — 8ème A");
  // Sans homonyme : pas de matricule.
  assert.equal(c.label, "BAH Ibrahima — 7ème B");
});

test("sélecteur d'élève : même nom et même classe → le matricule s'ajoute", () => {
  const options = optionsEleves([ALPHA, ALPHA_TER, ALPHA_BIS]);
  assert.deepEqual(options.map((o) => o.label), [
    "DIALLO Aminata — 6ème A (M-001)",
    "DIALLO Aminata — 6ème A (M-005)",
    "DIALLO Aminata — 8ème A",
  ]);
  // Libellés tous distincts.
  assert.equal(new Set(options.map((o) => o.label)).size, 3);
});

test("sélecteur d'élève : élève sans classe, liste absente, fiche sans identifiant", () => {
  assert.deepEqual(optionsEleves([{ _id: "e9", nom: "CAMARA", prenom: "Sekou" }]),
    [{ value: "e9", label: "CAMARA Sekou" }]);
  assert.deepEqual(optionsEleves(), []);
  assert.deepEqual(optionsEleves([{ nom: "SANS ID" }, BETA]).map((o) => o.value), ["e2"]);
});

test("une note sans élève ou sans matière ne s'enregistre pas", () => {
  // Formulaire tel qu'ouvert par « + Ajouter » : période et type seulement.
  assert.equal(notePrete({ periode: "T1", type: "Devoir" }), false);
  // Ancien formulaire : un nom, mais pas d'identifiant → refusé par la base.
  assert.equal(notePrete({ eleveNom: "DIALLO Aminata", matiere: "Maths" }), false);
  assert.equal(notePrete({ eleveId: "", matiere: "Maths" }), false);
  assert.equal(notePrete({ eleveId: "e1", matiere: "" }), false);
  assert.equal(notePrete(null), false);
  assert.equal(notePrete({ eleveId: "e1", matiere: "Maths", note: "12" }), true);
});

test("notes et absences : une seule jointure, le même nom pour le même élève", () => {
  const absence = { _id: "a1", eleveId: "e1", type: "Absence" };
  const [n] = enrichirNotes([ligne("n1", "e1")], [ALPHA]);
  const [a] = enrichirAbsences([absence], [ALPHA]);
  assert.equal(n.eleveNom, a.eleveNom);
  // La note ne reçoit que le nom ; l'absence, le nom et la classe.
  assert.ok(!("classe" in n));
  assert.equal(a.classe, "6ème A");
});

test("completerDepuisFiches ne touche que les champs demandés", () => {
  const ligneAncienne = { _id: "x1", eleveId: "e1", eleveNom: "DIALO Aminata", classe: "5ème A", motif: "Malade" };
  const [seuleClasse] = completerDepuisFiches([ligneAncienne], [ALPHA], ["classe"]);
  assert.equal(seuleClasse.classe, "6ème A");
  assert.equal(seuleClasse.eleveNom, "DIALO Aminata");
  assert.equal(seuleClasse.motif, "Malade");
  const [parDefaut] = completerDepuisFiches([ligneAncienne], [ALPHA]);
  assert.equal(parDefaut.eleveNom, "DIALLO Aminata");
  assert.equal(parDefaut.classe, "5ème A");
});
