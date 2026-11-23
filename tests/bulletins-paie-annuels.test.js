// Bulletins de paie annuels : registre d'émargement rempli à la main.
// L'application n'imprime que les éléments fixes de l'année (identité,
// heures de l'emploi du temps, taux, forfait, salaire du personnel) ; le reste
// reste en blanc. Tous ceux qui ont une ligne sur l'état de salaire y figurent.
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

const personnel = [
  { _id: "a1", prenom: "Fanta", nom: "GARDE", poste: "Gardien de nuit", categorie: "Sécurité", salaireBase: 600000, statut: "Actif" },
  // Sans statut = actif, comme à la génération de l'état de salaire.
  { _id: "a2", prenom: "Ibra", nom: "BUREAU", poste: "Secrétaire", categorie: "Administration", salaireBase: 800000 },
  // Parti : plus de ligne sur l'état de salaire, donc pas de feuillet.
  { _id: "a3", prenom: "Ancien", nom: "AGENT", poste: "Cuisinier", categorie: "Cuisine", salaireBase: 500000, statut: "Inactif" },
];

const fiches = fichesBulletinsPaie({
  ensCollege, ensLycee, ensPrimaire, ensPrescolaire, personnel, emploisCollege, emploisLycee, primeDefaut: 0,
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

test("personnel : un feuillet par agent actif, salaire de base imprimé, les partis exclus", () => {
  const fanta = parNom("GARDE Fanta");
  assert.equal(fanta.type, "personnel");
  assert.deepEqual(fanta.sections, ["personnel"]);
  assert.equal(fanta.poste, "Gardien de nuit");
  assert.equal(fanta.salaireMois, 600000);
  assert.ok(parNom("BUREAU Ibra"), "sans statut = actif");
  assert.equal(parNom("AGENT Ancien"), undefined);
});

test("ordre du registre : secondaire, primaire, maternelle, personnel, NOM Prénom par défaut, numéros 1…n", () => {
  assert.deepEqual(fiches.map((f) => f.nom),
    ["ESSAI Paul", "MODELE Marie", "VIDE Jean", "EXEMPLE Awa", "PETITE Kadi", "BUREAU Ibra", "GARDE Fanta"]);
  assert.deepEqual(fiches.map((f) => f.numero), [1, 2, 3, 4, 5, 6, 7]);
});

test("réglage « Prénom NOM » de l'école : écriture et ordre suivent", () => {
  const prenomDAbord = fichesBulletinsPaie({ ensCollege, ensLycee, emploisCollege, emploisLycee, ordreNoms: "prenom_nom" });
  assert.deepEqual(prenomDAbord.map((f) => f.nom), ["Jean VIDE", "Marie MODELE", "Paul ESSAI"]);
  // Le rapprochement avec l'emploi du temps ne dépend pas de l'écriture.
  assert.equal(prenomDAbord.find((f) => f.nom === "Paul ESSAI").vhHebdo, 7);
});

const schoolInfo = { nom: "École Essai <b>", couleur1: "#123456", pays: "République de Guinée", ire: "IRE de Essai", dpe: "DPE de Modèle" };
const pagesDe = (html) => (html.match(/<section class="page bp/g) || []).length;

test("document : couverture, sommaire, puis un feuillet A4 paysage par personne", () => {
  const html = htmlBulletinsPaie({ fiches, schoolInfo, annee: "2026-2027", mois: MOIS });
  assert.match(html, /size:A4 landscape/);
  assert.equal(pagesDe(html), 1 + 1 + fiches.length);
  assert.match(html, /Registre des bulletins de paie/);
  assert.match(html, /Sommaire/);
  assert.match(html, /Feuillet n° 3 \/ 7/);
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
  assert.match(html, /<div class="folio">Feuillet<b>1<\/b><\/div>/, "numéro bien visible en haut du feuillet");
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

test("feuillet du personnel : poste et salaire imprimés, signature de l'agent, pas d'heures", () => {
  const html = htmlBulletinsPaie({ fiches: [parNom("GARDE Fanta")], schoolInfo, annee: "2026-2027", mois: MOIS });
  assert.ok(html.includes("L'agent(e)"));
  assert.match(html, /Poste occupé<\/span><b>Gardien de nuit<\/b>/);
  assert.match(html, /Catégorie<\/span><b>Sécurité<\/b>/);
  assert.equal((html.match(/<span class="pre">600\s000 GNF<\/span>/g) || []).length, 9);
  assert.ok(html.includes("Signature de l'agent(e)"));
  assert.ok(!html.includes("enseignant(e)"), "aucune mention d'enseignant sur le feuillet d'un agent");
  assert.ok(!html.includes("5e semaine"));
});

test("couverture : en-tête officiel ligne par ligne (pays, devise, ministère, IRE, DPE), personnel compté", () => {
  const html = htmlBulletinsPaie({ fiches, schoolInfo, annee: "2026-2027", mois: MOIS });
  const couv = html.slice(html.indexOf('class="page bp couv"'), html.indexOf('class="page bp somm-page"'));
  assert.match(couv, /<div class="rep">République de Guinée<\/div>\s*<div class="dev">/, "pays et devise chacun sur sa ligne");
  assert.match(couv, /<div class="min">Ministère de l/);
  assert.match(couv, /<div class="tut">IRE de Essai<\/div><div class="tut">DPE de Modèle<\/div>/);
  assert.match(couv, /Personnel enseignant et non enseignant/);
  assert.match(couv, /Personnel : <b>2<\/b>/);
  // Chaque feuillet porte en haut le numéro auquel le sommaire renvoie.
  assert.equal((html.match(/class="folio"/g) || []).length, fiches.length);
  assert.match(html, /<td class="n">7<\/td><td class="nm">GARDE Fanta<\/td><td>Personnel<\/td><td>Gardien de nuit<\/td>/);
});

test("feuillet seul (registre d'une personne) : pas de folio", () => {
  const html = htmlBulletinsPaie({ fiches: [parNom("GARDE Fanta")], schoolInfo, annee: "2026-2027", mois: MOIS });
  assert.ok(!html.includes('class="folio"'));
});
