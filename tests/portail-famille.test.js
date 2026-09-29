// Portail parent — vue « famille » (étape 4) : un parent de plusieurs enfants,
// dans des classes et des sections différentes, voit sur l'Aperçu chaque
// enfant et le total à payer pour toute la famille.
import test from "node:test";
import assert from "node:assert/strict";
import { getEleveMensualiteSnapshot } from "../src/mensualite-utils.js";
import { resteAPayerEleve, resumeFamille } from "../src/components/portail-parent/portail-parent-derive.js";
import { estAbsence, estPresence, estRetard } from "../src/components/portail-parent/helpers.js";

const MOIS = ["Octobre", "Novembre", "Décembre", "Janvier"];
const ANNEE = "2026-2027";
const TARIFS = [
  { classe: "CP1", montant: 100000, inscription: 50000 },
  { classe: "10ème Année A", montant: 150000, inscription: 60000, fraisDivers: { cantine: 30000 } },
];
const awa = { _id: "awa", prenom: "Awa", nom: "Diallo", classe: "CP1", section: "primaire",
  mens: { Octobre: "Payé", Novembre: "Payé" }, inscriptionPayee: true };
const moussa = { _id: "moussa", prenom: "Moussa", nom: "Diallo", classe: "10ème Année A", section: "college",
  mens: { Octobre: "Payé" }, mensAcomptes: { Novembre: 50000 }, inscriptionAcompte: 20000 };
// Parti avant la rentrée : rien à payer pour l'année.
const fanta = { _id: "fanta", prenom: "Fanta", nom: "Diallo", classe: "CP1", statut: "Transféré", dateDepart: "2026-06-30", mens: {} };

// Registre des absences tel que l'école et les enseignants le remplissent
// (`type`), plus une fiche à l'ancienne (`statut`).
const ABSENCES = [
  { eleveId: "awa", type: "Absence", justifie: "Non" }, { eleveId: "awa", type: "Retard" },
  { eleveId: "moussa", type: "Absence" }, { eleveId: "moussa", statut: "absent" },
  { eleveId: "moussa", type: "Avertissement" }, { eleveId: "autre", type: "Absence" },
];
const MESSAGES = [
  { eleveId: "awa", expediteur: "ecole", lu: false }, { eleveId: "awa", expediteur: "parent", lu: false },
  { eleveId: "moussa", expediteur: "ecole", lu: true },
];
const famille = (schoolInfo = {}) => resumeFamille({
  eleves: [awa, moussa, fanta], absences: ABSENCES, messages: MESSAGES, tarifs: TARIFS, moisAnnee: MOIS, annee: ANNEE, schoolInfo,
});

// Le « Reste à payer » de l'onglet Paiements (PaiementsTab.jsx).
const resteOngletPaiements = (eleve) => {
  const s = getEleveMensualiteSnapshot(eleve, MOIS, TARIFS, ANNEE);
  return s.soldeMensualites + s.soldeInscription + s.soldeAutre;
};

test("chaque enfant : le même reste à payer que son onglet Paiements", () => {
  const f = famille();
  assert.deepEqual(f.enfants.map((e) => e.id), ["awa", "moussa", "fanta"]);
  for (const [eleve, ligne] of [[awa, f.enfants[0]], [moussa, f.enfants[1]], [fanta, f.enfants[2]]]) {
    assert.equal(ligne.resteAPayer, resteOngletPaiements(eleve), eleve.prenom);
  }
  // Awa : Décembre et Janvier à 100 000, inscription réglée.
  assert.equal(f.enfants[0].resteAPayer, 200000);
  // Moussa : Novembre (150 000 − 50 000 d'acompte), Décembre, Janvier, reste
  // d'inscription (60 000 − 20 000) et cantine (30 000).
  assert.equal(f.enfants[1].resteAPayer, 100000 + 2 * 150000 + 40000 + 30000);
  assert.equal(f.enfants[2].resteAPayer, 0, "parti avant l'année");
});

test("total à payer pour la famille, enfants à jour", () => {
  const f = famille();
  assert.equal(f.totalAPayer, 200000 + 470000);
  assert.equal(f.aJour, 1);
});

test("registre des absences : le type saisi aujourd'hui, l'ancien statut aussi", () => {
  assert.equal(estAbsence({ type: "Absence" }), true);
  assert.equal(estAbsence({ statut: "Absent" }), true, "ancienne forme");
  assert.equal(estAbsence({ type: "Retard" }), false);
  assert.equal(estAbsence({ type: "Avertissement" }), false);
  assert.equal(estAbsence({ type: "Absence", statut: "Justifiée" }), true, "le type prime sur un statut de justification");
  assert.equal(estAbsence({}), false);
  assert.equal(estRetard({ type: "Retard" }), true);
  assert.equal(estRetard({ statut: "retard" }), true);
  assert.equal(estPresence({ statut: "Présent" }), true);
  assert.equal(estPresence({ type: "Absence" }), false);
});

test("absences (hors retards et avertissements), messages de l'école non lus, enfant parti", () => {
  const f = famille();
  assert.deepEqual(f.enfants.map((e) => [e.nom, e.classe, e.absences, e.nonLus, e.parti]), [
    ["Awa Diallo", "CP1", 1, 1, false],
    ["Moussa Diallo", "10ème Année A", 2, 0, false],
    ["Fanta Diallo", "CP1", 0, 0, true],
  ]);
});

test("accès bloqué pour impayés : signalé par enfant, seulement si l'école bloque", () => {
  assert.deepEqual(famille().enfants.map((e) => e.bloque), [false, false, false]);
  assert.deepEqual(famille({ blocageParentImpaye: true }).enfants.map((e) => e.bloque), [true, true, false]);
});

test("mois de l'année inconnus : ceux de la fiche, comme l'onglet Paiements", () => {
  const e = { _id: "x", classe: "CP1", mens: { Octobre: "Payé", Novembre: "Impayé" }, inscriptionPayee: true };
  assert.equal(resteAPayerEleve(e, [], TARIFS, ANNEE), 100000);
  assert.equal(resumeFamille({ eleves: [], absences: [], messages: [], tarifs: TARIFS, moisAnnee: MOIS, annee: ANNEE }).totalAPayer, 0);
});
