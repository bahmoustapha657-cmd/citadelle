import assert from "node:assert/strict";
import test from "node:test";

import { absencePrete, dateAbsence, elevesEnAlerte, enrichirAbsences, nomEleve } from "../src/absences-eleves.js";
import { toRow, transformRow } from "../src/backend/collection-map.js";

const ALPHA = { _id: "e1", nom: "DIALLO", prenom: "Aminata", classe: "6ème A" };
const BETA = { _id: "e2", nom: "BAH", prenom: "Ibrahima", classe: "7ème B" };
// Homonyme d'ALPHA dans une autre classe.
const ALPHA_BIS = { _id: "e3", nom: "DIALLO", prenom: "Aminata", classe: "8ème A" };
const PARTI = { _id: "e4", nom: "SOW", prenom: "Mamadou", classe: "9ème A", statut: "Transféré" };

// Ligne telle que la lit le mapping Supabase : ni nom ni classe.
const ligne = (id, eleveId, extra = {}) => transformRow("absences", {
  id, section: "college", eleve_id: eleveId, type: "Absence", date: "2026-10-01",
  justifie: "Non", motif: null, matiere: null, signale_par_id: null, signale_par_nom: null, ...extra,
});

test("le mapping Supabase ne rend ni nom ni classe : c'est la fiche qui les donne", () => {
  const brute = ligne("a1", "e1");
  assert.equal(brute.eleveNom, undefined);
  assert.equal(brute.classe, undefined);
  const [a] = enrichirAbsences([brute], [ALPHA, BETA]);
  assert.equal(a.eleveNom, "DIALLO Aminata");
  assert.equal(a.classe, "6ème A");
  // Le reste de l'absence est intact.
  assert.equal(a._id, "a1");
  assert.equal(a.eleveId, "e1");
  assert.equal(a.type, "Absence");
});

test("les signalements du portail enseignant (signale_par_id) sont joints de même", () => {
  const brute = ligne("a2", "e2", { signale_par_id: "ens-9", signale_par_nom: "M. CAMARA", matiere: "Maths" });
  const [a] = enrichirAbsences([brute], [ALPHA, BETA]);
  assert.equal(a.eleveNom, "BAH Ibrahima");
  assert.equal(a.classe, "7ème B");
  assert.equal(a.signaledByEnseignantId, "ens-9");
  assert.equal(a.signaledByEnseignantNom, "M. CAMARA");
});

test("deux homonymes restent distincts : la jointure se fait par identifiant", () => {
  const [a, b] = enrichirAbsences([ligne("a1", "e1"), ligne("a3", "e3")], [ALPHA, ALPHA_BIS]);
  assert.equal(a.classe, "6ème A");
  assert.equal(b.classe, "8ème A");
});

test("un élève parti garde son nom et sa dernière classe si la liste l'inclut", () => {
  const [a] = enrichirAbsences([ligne("a4", "e4")], [ALPHA, PARTI]);
  assert.equal(a.eleveNom, "SOW Mamadou");
  assert.equal(a.classe, "9ème A");
});

test("la fiche fait foi sur les valeurs portées par l'absence", () => {
  const ancienne = { _id: "a5", eleveId: "e1", eleveNom: "DIALO Aminata", classe: "5ème A", type: "Retard" };
  const [a] = enrichirAbsences([ancienne], [ALPHA]);
  assert.equal(a.eleveNom, "DIALLO Aminata");
  assert.equal(a.classe, "6ème A");
});

test("sans fiche retrouvée, l'absence garde ce qu'elle porte, ou du vide", () => {
  const firestore = { _id: "a6", eleveNom: "KABA Fanta", classe: "10ème", type: "Absence" };
  const inconnue = ligne("a7", "e-supprime");
  const [a, b] = enrichirAbsences([firestore, inconnue], [ALPHA]);
  assert.equal(a.eleveNom, "KABA Fanta");
  assert.equal(a.classe, "10ème");
  assert.equal(b.eleveNom, "");
  assert.equal(b.classe, "");
});

test("enrichirAbsences tolère des listes absentes", () => {
  assert.deepEqual(enrichirAbsences(), []);
  assert.deepEqual(enrichirAbsences(undefined, [ALPHA]), []);
  const [a] = enrichirAbsences([ligne("a1", "e1")]);
  assert.equal(a.eleveNom, "");
});

test("nomEleve : « NOM Prénom », sans espace parasite", () => {
  assert.equal(nomEleve(ALPHA), "DIALLO Aminata");
  assert.equal(nomEleve({ nom: "CONDE" }), "CONDE");
  assert.equal(nomEleve(null), "");
});

test("alertes : 3 absences non justifiées comptées par identifiant", () => {
  const absences = [
    ligne("a1", "e1"), ligne("a2", "e1"), ligne("a3", "e1"),
    // Justifiée, ou retard : hors compte.
    ligne("a4", "e1", { justifie: "Oui" }), ligne("a5", "e2", { type: "Retard" }),
    ligne("a6", "e2"), ligne("a7", "e2"),
  ];
  const alerte = elevesEnAlerte([ALPHA, BETA, ALPHA_BIS], absences);
  assert.deepEqual(alerte.map((e) => [e._id, e.nbAbs]), [["e1", 3]]);
});

test("alertes : avant le correctif, les absences rechargées n'en levaient aucune", () => {
  // Sans nom sur les lignes Supabase, l'ancien comptage par nom donnait 0.
  const absences = [ligne("a1", "e2"), ligne("a2", "e2"), ligne("a3", "e2"), ligne("a4", "e2")];
  const parNom = absences.filter((a) => a.eleveNom === nomEleve(BETA)).length;
  assert.equal(parNom, 0);
  assert.deepEqual(elevesEnAlerte([BETA], absences).map((e) => e.nbAbs), [4]);
});

test("alertes : l'homonyme n'hérite pas des absences de l'autre", () => {
  const absences = [ligne("a1", "e1"), ligne("a2", "e1"), ligne("a3", "e1")];
  const enrichies = enrichirAbsences(absences, [ALPHA, ALPHA_BIS]);
  assert.deepEqual(elevesEnAlerte([ALPHA, ALPHA_BIS], enrichies).map((e) => e._id), ["e1"]);
});

test("alertes : une absence sans identifiant (Firestore) compte encore au nom", () => {
  const anciennes = [1, 2, 3].map((i) => ({ _id: `f${i}`, eleveNom: "BAH Ibrahima", type: "Absence", justifie: "Non" }));
  const alerte = elevesEnAlerte([ALPHA, BETA], [...anciennes, ligne("a1", "e2")]);
  assert.deepEqual(alerte.map((e) => [e._id, e.nbAbs]), [["e2", 4]]);
});

test("alertes : triées du plus au moins absent, seuil réglable", () => {
  const absences = [
    ligne("a1", "e1"), ligne("a2", "e2"), ligne("a3", "e2"),
  ];
  assert.deepEqual(elevesEnAlerte([ALPHA, BETA], absences, 1).map((e) => e._id), ["e2", "e1"]);
  assert.deepEqual(elevesEnAlerte([ALPHA, BETA], absences), []);
});

test("une absence sans élève sélectionné ne s'enregistre pas", () => {
  // Formulaire tel qu'ouvert par « + Enregistrer » : type et classe, pas d'élève.
  assert.equal(absencePrete({ type: "Absence", justifie: "Non", classe: "6ème A" }), false);
  // Ancien formulaire : un nom, mais pas d'identifiant → refusé par la base.
  assert.equal(absencePrete({ eleveNom: "DIALLO Aminata", classe: "6ème A" }), false);
  assert.equal(absencePrete({ eleveId: "" }), false);
  assert.equal(absencePrete(null), false);
  assert.equal(absencePrete({ eleveId: "e1", type: "Retard" }), true);
});

test("date par défaut : le jour local en AAAA-MM-JJ, jamais « JJ/MM/AAAA »", () => {
  // 23 h 30 le 7 octobre (heure locale) : reste le 7, au format du champ date.
  assert.equal(dateAbsence({}, new Date(2026, 9, 7, 23, 30)), "2026-10-07");
  assert.equal(dateAbsence(null, new Date(2027, 0, 3)), "2027-01-03");
  // Une date choisie dans le formulaire est gardée telle quelle.
  assert.equal(dateAbsence({ date: "2026-09-30" }, new Date(2026, 9, 7)), "2026-09-30");
  // Le rapport mensuel la range dans le bon mois (l'ancien défaut tombait en juillet).
  const mois = (d) => new Date(d).toLocaleDateString("fr-FR", { month: "long" });
  assert.equal(mois(dateAbsence({}, new Date(2026, 9, 7))), "octobre");
  assert.equal(mois("07/10/2026"), "juillet");
});

test("le formulaire de la modale donne une ligne avec eleve_id, sans nom ni classe", () => {
  const form = { type: "Absence", justifie: "Non", classe: "6ème A", eleveId: "e1", eleveNom: "DIALLO Aminata", date: "2026-10-07" };
  const { row } = toRow("absences", form);
  assert.equal(row.eleve_id, "e1");
  assert.ok(!("eleve_nom" in row) && !("classe" in row) && !("eleveNom" in row));
  // Ancien formulaire (nom seul) : pas d'eleve_id, la base l'aurait refusé.
  assert.equal(toRow("absences", { type: "Absence", eleveNom: "DIALLO Aminata" }).row.eleve_id, undefined);
});
