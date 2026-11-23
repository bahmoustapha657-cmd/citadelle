// Bulletins de paie annuels : registre d'émargement rempli à la main.
// L'application n'imprime que les éléments fixes de l'année (identité,
// heures de l'emploi du temps, taux, forfait) ; le reste reste en blanc.
import test from "node:test";
import assert from "node:assert/strict";

import { fichesBulletinsPaie, htmlBulletinsPaie } from "../src/reports/bulletins-paie-annuels.js";

const MOIS = ["Octobre", "Novembre", "Décembre", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin"];
const creneau = (enseignant, classe, jour, heureDebut, heureFin) => ({ enseignant, classe, jour, heureDebut, heureFin });

const ensCollege = [
  { _id: "c1", prenom: "Paul", nom: "ESSAI", matiere: "Mathématiques", statut: "Vacataire", telephone: "620 00 00 01", primeHoraire: 25000 },
  // Taux par classe + taux des autres classes.
  { _id: "c2", prenom: "Marie", nom: "MODELE", matiere: "Anglais", statut: "Titulaire",
    primeHoraire: 20000, primeParClasse: [{ classe: "10ème A", prime: 30000 }, { classe: "", prime: 99 }] },
  // Aucun créneau, aucun taux : tout reste à remplir à la main.
  { _id: "c3", prenom: "Jean", nom: "VIDE" },
];
const ensLycee = [
  // Même personne au collège et au lycée : un seul feuillet, heures cumulées.
  { _id: "l1", prenom: "Paul", nom: "Essai", matiere: "Mathématiques", primeHoraire: 25000 },
];
const emploisCollege = [
  creneau("Paul ESSAI", "7ème A", "Lundi", "08:00", "10:00"),
  creneau("Paul ESSAI", "8ème B", "Mardi", "10:00", "12:00"),
  creneau("Marie MODELE", "10ème A", "Lundi", "08:00", "10:00"),
  creneau("Marie MODELE", "9ème A", "Jeudi", "08:00", "09:00"),
];
const emploisLycee = [creneau("Paul Essai", "11ème SM", "Mercredi", "15:00", "18:00")];
const ensPrimaire = [
  { _id: "p1", prenom: "Awa", nom: "EXEMPLE", classeTitle: "CM2 A", montantForfait: 1500000, statut: "Titulaire" },
  { _id: "m1", prenom: "Kadi", nom: "PETITE", classeTitle: "Grande section", montantForfait: 900000 },
];
const ensPrescolaire = [{ _id: "m1", prenom: "Kadi", nom: "PETITE", classeTitle: "Grande section", montantForfait: 900000 }];

const fiches = fichesBulletinsPaie({
  ensCollege, ensLycee, ensPrimaire, ensPrescolaire, emploisCollege, emploisLycee, primeDefaut: 0,
});
const parNom = (nom) => fiches.find((f) => f.nom === nom);

test("secondaire : heures et classes tirées de l'emploi du temps, collège et lycée cumulés", () => {
  const paul = parNom("ESSAI Paul");
  assert.equal(paul.type, "heures");
  assert.deepEqual(paul.sections, ["college", "lycee"]);
  assert.equal(paul.vhHebdo, 7);
  assert.equal(paul.vhMois, 28);
  assert.deepEqual(paul.classes, ["7ème A", "8ème B", "11ème SM"]);
  assert.equal(paul.taux, 25000);
  assert.equal(paul.montantMois, 7 * 25000 * 4);
  assert.equal(fiches.filter((f) => f.nom.toLowerCase() === "essai paul").length, 1);
});

test("secondaire : taux par classe, moyenne pondérée et brut d'un mois au taux de chaque créneau", () => {
  const marie = parNom("MODELE Marie");
  assert.deepEqual(marie.tauxParClasse, [{ classe: "10ème A", prime: 30000 }]);
  assert.equal(marie.taux, 20000);
  // 2 h à 30 000 + 1 h à 20 000 par semaine.
  assert.equal(marie.montantMois, (2 * 30000 + 1 * 20000) * 4);
  assert.equal(marie.tauxMoyen, Math.round((2 * 30000 + 20000) / 3));
});

test("primaire et maternelle : forfait mensuel, maternelle reconnue, un seul feuillet chacun", () => {
  const awa = parNom("EXEMPLE Awa");
  assert.equal(awa.type, "forfait");
  assert.deepEqual(awa.sections, ["primaire"]);
  assert.equal(awa.classe, "CM2 A");
  assert.equal(awa.salaireMois, 1500000);
  const kadi = fiches.filter((f) => f.nom === "PETITE Kadi");
  assert.equal(kadi.length, 1);
  assert.deepEqual(kadi[0].sections, ["prescolaire"]);
});

test("ordre du registre : secondaire, primaire, maternelle, NOM Prénom par défaut, numéros 1…n", () => {
  assert.deepEqual(fiches.map((f) => f.nom), ["ESSAI Paul", "MODELE Marie", "VIDE Jean", "EXEMPLE Awa", "PETITE Kadi"]);
  assert.deepEqual(fiches.map((f) => f.numero), [1, 2, 3, 4, 5]);
});

test("réglage « Prénom NOM » de l'école : écriture et ordre suivent", () => {
  const prenomDAbord = fichesBulletinsPaie({ ensCollege, ensLycee, emploisCollege, emploisLycee, ordreNoms: "prenom_nom" });
  assert.deepEqual(prenomDAbord.map((f) => f.nom), ["Jean VIDE", "Marie MODELE", "Paul ESSAI"]);
  // Le rapprochement avec l'emploi du temps ne dépend pas de l'écriture.
  assert.equal(prenomDAbord.find((f) => f.nom === "Paul ESSAI").vhHebdo, 7);
});

const schoolInfo = { nom: "École Essai <b>", couleur1: "#123456", pays: "République de Guinée" };
const pagesDe = (html) => (html.match(/<section class="page bp/g) || []).length;

test("document : couverture, sommaire, puis un feuillet A4 paysage par enseignant", () => {
  const html = htmlBulletinsPaie({ fiches, schoolInfo, annee: "2026-2027", mois: MOIS });
  assert.match(html, /size:A4 landscape/);
  assert.equal(pagesDe(html), 1 + 1 + fiches.length);
  assert.match(html, /Registre des bulletins de paie/);
  assert.match(html, /Sommaire/);
  assert.match(html, /Feuillet n° 3 \/ 5/);
  // Rien chargé d'Internet ; nom de l'école échappé.
  assert.doesNotMatch(html, /(src|href)="https?:|url\(https?:|@import/);
  // Cadre en tracés continus : pas de <pattern>, découpé en tuiles (PDF lourd).
  assert.ok(!html.includes("<pattern"));
  assert.match(html, /École Essai &lt;b&gt;/);
  assert.ok(!html.includes("École Essai <b>"));
});

test("feuillet du secondaire : éléments fixes imprimés, une ligne par mois avec son année civile", () => {
  const html = htmlBulletinsPaie({ fiches: [parNom("ESSAI Paul")], schoolInfo, annee: "2026-2027", mois: MOIS, totalFeuillets: 5 });
  assert.equal(pagesDe(html), 1, "un seul feuillet : ni couverture ni sommaire");
  assert.match(html, /Feuillet n° 1 \/ 5/, "un feuillet réimprimé garde sa place dans le registre");
  assert.match(html, /7ème A, 8ème B, 11ème SM/);
  // Heures prévues imprimées sur chacune des 9 lignes de mois.
  assert.equal((html.match(/<span class="pre">28 h<\/span>/g) || []).length, 9);
  assert.match(html, /Octobre<small>2026<\/small>/);
  assert.match(html, /Janvier<small>2027<\/small>/);
  assert.match(html, /Juin<small>2027<\/small>/);
  for (const col of ["Prévues", "5e semaine", "Non faites", "Faites", "Montant brut", "Avance / bon", "Retenue absences", "Rappel / prime", "Net à payer", "Signature de l'enseignant(e)", "Visa du comptable"]) {
    assert.ok(html.includes(col), `colonne ${col}`);
  }
  assert.match(html, /700\s000 GNF/, "brut d'un mois complet");
});

test("feuillet du primaire : salaire du mois imprimé, pas de colonnes d'heures", () => {
  const html = htmlBulletinsPaie({ fiches: [parNom("EXEMPLE Awa")], schoolInfo, annee: "2026-2027", mois: MOIS });
  assert.equal((html.match(/<span class="pre">1\s500\s000 GNF<\/span>/g) || []).length, 9);
  assert.ok(!html.includes("5e semaine"));
  assert.ok(!html.includes("Matière(s)"), "pas de rubrique Matière vide pour un instituteur");
  assert.match(html, /Total prévu sur 9 mois/);
});

test("enseignant sans emploi du temps ni taux : les rubriques restent à remplir, rien d'inventé", () => {
  const html = htmlBulletinsPaie({ fiches: [parNom("VIDE Jean")], schoolInfo, annee: "2026-2027", mois: MOIS });
  assert.ok(!html.includes('class="pre"'));
  assert.ok(!html.includes(" 0 GNF"));
  assert.ok(!html.includes(">0 h<"));
});

test("année plus longue : les lignes se resserrent au lieu de déborder", () => {
  const douze = ["Septembre", ...MOIS, "Juillet", "Août"];
  const html = htmlBulletinsPaie({ fiches: [parNom("ESSAI Paul")], schoolInfo, annee: "2026-2027", mois: douze });
  const rang = Number(html.match(/--rang:([\d.]+)mm/)[1]);
  assert.ok(rang * 12 <= 83.1 && rang >= 6, `ligne de ${rang} mm`);
  assert.match(html, /Septembre<small>2026<\/small>/);
  assert.match(html, /Août<small>2027<\/small>/);
});
