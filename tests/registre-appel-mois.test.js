// Registre d'appel du mois : grille élèves × jours de classe, arrêté du mois
// (présences possibles, effectives, taux), congés du calendrier, feuille.
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  debutDeMois, dernierJour, estArrete, joursDeClasse, joursDeConge, lignesAuSuivi, moisDeLAnnee,
  moisPrecedent, registreMensuel, taux,
} from "../src/components/portail-enseignant/registre-mensuel.js";
import {
  chefDeSection, registreAppelHTML, registresAppelHTML, titreChefSection, titreTitulaire,
} from "../src/reports/registre-appel.js";
import { ficheTitulaire } from "../src/components/ecole/edt/edt-titulaire.js";

const LUN_SAM = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const LUN_VEN = LUN_SAM.slice(0, 5);
const DEBUT_DEC = new Date(2026, 11, 2, 12); // novembre est fini
const ELEVES = [
  { _id: "e2", nom: "CAMARA", prenom: "Ibrahima", classe: "7ème A" },
  { _id: "e1", nom: "BAH", prenom: "Aïssatou", classe: "7ème A" },
  { _id: "e3", nom: "DIALLO", prenom: "<Mariama>", classe: "7ème A" },
];
const inc = (eleveId, date, type, justifie = "Non") => ({ eleveId, date, type, justifie });
const reg = (incidents, extra = {}) => registreMensuel({
  eleves: ELEVES, incidents, mois: "2026-11", joursOuvrables: LUN_SAM, aujourdhui: DEBUT_DEC, ...extra,
});

test("jours de classe : jours ouvrés, jamais le dimanche, pas au-delà d'aujourd'hui, jours retirés ôtés", () => {
  assert.equal(joursDeClasse("2026-11", LUN_SAM, DEBUT_DEC).length, 25); // 30 − 5 dimanches
  assert.equal(joursDeClasse("2026-11", LUN_VEN, DEBUT_DEC).length, 21);
  assert.equal(joursDeClasse("2026-11", LUN_SAM, new Date(2026, 10, 11, 12)).at(-1).date, "2026-11-11");
  assert.equal(joursDeClasse("2026-11", LUN_SAM, DEBUT_DEC, new Set(["2026-11-02", "2026-11-03"])).length, 23);
  assert.deepEqual(joursDeClasse("", LUN_SAM, DEBUT_DEC), []);
});

test("mois de l'année scolaire, mois écoulé, arrêté à la fin du mois", () => {
  assert.deepEqual(moisDeLAnnee("2026-2027", new Date(2026, 10, 11)), ["2026-09", "2026-10", "2026-11"]);
  assert.equal(moisDeLAnnee("2026-2027", new Date(2027, 6, 15)).length, 11);
  assert.equal(moisPrecedent(new Date(2027, 0, 3)), "2026-12");
  assert.equal(debutDeMois(new Date(2026, 11, 3)), true);
  assert.equal(dernierJour("2026-11"), "2026-11-30");
  assert.equal(dernierJour("2027-02"), "2027-02-28");
  assert.equal(estArrete("2026-11", new Date(2026, 10, 30, 12)), false); // dernier jour : pas encore
  assert.equal(estArrete("2026-11", DEBUT_DEC), true);
});

test("congés du calendrier : du début à la fin, section concernée ou « Tous » seulement", () => {
  const evenements = [
    { type: "conge", niveau: "Tous", date: "2026-11-02", dateFin: "2026-11-04" },
    { type: "conge", niveau: "Primaire", date: "2026-11-09" }, // autre section
    { type: "conge", niveau: "Collège", date: "2026-11-10" }, // un seul jour
    { type: "exam", niveau: "Tous", date: "2026-11-12" }, // pas un congé
    { type: "conge", niveau: "Tous", date: "", dateFin: "2026-11-20" }, // sans début
  ];
  assert.deepEqual([...joursDeConge(evenements, "Collège")].sort(), ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-10"]);
  assert.equal(joursDeConge(evenements, "Primaire").has("2026-11-09"), true);
});

test("registre : A / J / R par jour, une seule marque par jour, l'absence l'emporte", () => {
  const r = reg([
    inc("e1", "2026-11-03", "Absence"),
    inc("e1", "2026-11-03", "Absence"), // doublon (enseignant + direction)
    inc("e1", "2026-11-04", "Retard"),
    inc("e1", "2026-11-04", "Absence", "Oui"), // même jour : l'absence gagne
    inc("e2", "05/11/2026", "Retard"), // date d'avant la migration
    inc("e2", "2026-10-30", "Absence"), // autre mois
    inc("e3", "2026-11-06", "Avertissement"), // pas une présence
    inc("autre", "2026-11-06", "Absence"), // élève d'une autre classe
  ]);
  assert.deepEqual(r.lignes.map((l) => l.eleve._id), ["e1", "e2", "e3"]);
  const [bah, camara, diallo] = r.lignes;
  assert.deepEqual(bah.marques, { "2026-11-03": "A", "2026-11-04": "J" });
  assert.deepEqual([bah.absNJ, bah.absJ, bah.retards, bah.presences], [1, 1, 0, 23]);
  assert.equal(camara.presences, 25); // un retard compte présent
  assert.equal(diallo.total, 0);
  assert.deepEqual(r.parJour["2026-11-03"], { possibles: 3, absents: 1, presents: 2, retards: 0 });
  assert.deepEqual(lignesAuSuivi(r).map((l) => l.eleve._id), ["e1", "e2"]);
});

test("arrêté : présences possibles = élèves × jours ; effectives = possibles − absences ; taux en %", () => {
  const r = reg([inc("e1", "2026-11-03", "Absence"), inc("e2", "2026-11-03", "Absence", "Oui"), inc("e3", "2026-11-05", "Retard")]);
  assert.equal(r.totaux.possibles, 75); // 3 × 25
  assert.equal(r.totaux.effectives, 73);
  assert.equal(r.totaux.taux, 97.3);
  assert.equal(r.arrete, true);
  assert.equal(taux(0, 0), 0);
  assert.equal(taux(1, 3), 33.3);
});

test("congés et jours retirés : hors des présences possibles ; un signalement ces jours-là n'est pas compté", () => {
  const conges = joursDeConge([{ type: "conge", niveau: "Tous", date: "2026-11-02", dateFin: "2026-11-07" }], "Collège");
  const r = reg([inc("e1", "2026-11-03", "Absence"), inc("e1", "2026-11-10", "Absence")], { conges, exclus: ["2026-11-09"] });
  assert.equal(r.jours.length, 18); // 25 − 6 jours de congé − 1 jour retiré
  assert.equal(r.totaux.possibles, 54);
  assert.equal(r.totaux.effectives, 53);
  assert.equal(r.horsJours, 1);
  assert.equal(r.congesRetires, 6);
  assert.ok(!r.jours.some((j) => j.date === "2026-11-03"));
});

test("feuille imprimée : grille, présents / absents par jour, arrêté, signatures, noms échappés", () => {
  const r = reg([inc("e1", "2026-11-03", "Absence"), inc("e2", "2026-11-05", "Retard")]);
  const html = registreAppelHTML({ registre: r, classe: "7ème A", schoolInfo: { nom: "École test" }, annee: "2026-2027" });
  assert.match(html, /size:A4 landscape/);
  assert.equal((html.match(/<th class="j">/g) || []).length, 25);
  assert.equal((html.match(/<td class="nom">/g) || []).length, 3);
  assert.match(html, /&lt;Mariama&gt;/);
  assert.doesNotMatch(html, /<Mariama>/);
  assert.match(html, /Arrêté le présent registre au 30 novembre 2026 : 75 présences possibles et 74 présences effectives/);
  assert.match(html, /98,7 %/);
  assert.match(html, /Le chef de section/);
  assert.match(html, /window\.print/);
});

test("page de garde d'abord ; totaux par jour, bilan et signatures seulement après le dernier élève", () => {
  const r = reg([inc("e1", "2026-11-03", "Absence")]);
  const html = registreAppelHTML({ registre: r, classe: "7ème A", schoolInfo: { nom: "École test" }, annee: "2026-2027" });
  const garde = html.indexOf('<section class="page couverture">');
  const grille = html.indexOf('<section class="page">');
  assert.ok(garde > -1 && garde < grille);
  assert.match(html.slice(garde, grille), /7ème A[\s\S]*2026-2027/);
  // Pas de <tfoot> : il se répéterait au bas de chaque page du registre.
  assert.doesNotMatch(html, /<tfoot>/);
  const dernierNom = html.lastIndexOf('<td class="nom">');
  const totaux = html.indexOf('<tr class="total">');
  assert.ok(totaux > dernierNom);
  assert.ok(html.indexOf('<div class="fin">') > totaux);
  assert.ok(html.indexOf("Le chef de section") > html.indexOf('<div class="fin">'));
});

test("deux signatures : le titulaire et le chef de section sous son vrai titre", () => {
  assert.equal(titreChefSection({}, "primaire"), "Le Directeur");
  assert.equal(titreChefSection({}, "prescolaire"), "Le Directeur");
  assert.equal(titreChefSection({}, "college"), "Le Principal");
  assert.equal(titreChefSection({}, "lycee"), "Le Censeur");
  // Poste renommé par l'école : son nom fait foi… sauf au lycée, qui partage
  // le poste du collège mais pas son titre.
  const renomme = { libellesPostes: { college: "Directeur des études", primaire: "Direction Primaire" } };
  assert.equal(titreChefSection(renomme, "college"), "Directeur des études");
  assert.equal(titreChefSection(renomme, "lycee"), "Le Censeur");
  assert.equal(titreTitulaire("primaire", "M"), "Le maître titulaire");
  assert.equal(titreTitulaire("primaire", "Mme"), "La maîtresse titulaire");
  assert.equal(titreTitulaire("primaire"), "Le maître (la maîtresse) titulaire"); // civilité inconnue
  assert.equal(titreTitulaire("lycee", "M"), "Le professeur principal");
  assert.equal(titreTitulaire("college", "Mme"), "La professeure principale");

  const html = registreAppelHTML({ registre: reg([]), classe: "11ème A", titreChef: "Le Censeur", titulaire: "Le professeur principal" });
  const pied = html.slice(html.indexOf('<div class="pied">'));
  assert.match(pied, /Le professeur principal[\s\S]*Le Censeur/);
  assert.doesNotMatch(pied, /La Direction/);
  assert.equal((pied.match(/<strong>/g) || []).length, 2);
});

test("noms sous les titres : titulaire de la fiche, chef = compte qui imprime ou responsable du poste", () => {
  const ens = [{ nom: "Diallo", prenom: "Fatoumata", civilite: "Mme", classeTitle: "CM2 A" }];
  assert.deepEqual(ficheTitulaire("CM2 A", ens, []), { nom: "Fatoumata Diallo", civilite: "Mme" });
  assert.deepEqual(ficheTitulaire("CM1 B", ens, [{ nom: "CM1 B", enseignant: "Alpha Bah" }]), { nom: "Alpha Bah", civilite: "" });

  const ecole = { responsables: { primaire: "Mamadou Sow", college: "Ibrahima Barry" } };
  assert.equal(chefDeSection(ecole, "primaire", null).nom, "Mamadou Sow");
  assert.equal(chefDeSection(ecole, "college", null).nom, "Ibrahima Barry");
  assert.equal(chefDeSection(ecole, "lycee", null).nom, ""); // pas le responsable du collège
  const moi = { cle: "college", nom: "Aïssatou Camara", cachet: "https://x/cachet.png" };
  assert.equal(chefDeSection(ecole, "lycee", moi).nom, "Aïssatou Camara");
  assert.equal(chefDeSection(ecole, "college", moi).cachet, "https://x/cachet.png");
  assert.equal(chefDeSection(ecole, "primaire", moi).cachet, ""); // pas son poste

  const html = registreAppelHTML({
    registre: reg([]), classe: "CM2 A", titulaire: titreTitulaire("primaire", "Mme"), nomTitulaire: "Fatoumata <Diallo>",
    titreChef: "Le Directeur", chef: { nom: "Mamadou Sow" },
  });
  const pied = html.slice(html.indexOf('<div class="pied">'));
  assert.match(pied, /La maîtresse titulaire[\s\S]*Fatoumata &lt;Diallo&gt;[\s\S]*Le Directeur[\s\S]*Mamadou Sow/);
});

test("plusieurs classes : une page chacune ; l'aperçu n'imprime pas et le dit", () => {
  const r = reg([]);
  const deux = registresAppelHTML([{ registre: r, classe: "7ème A" }, { registre: r, classe: "7ème B" }], { schoolInfo: {} });
  assert.equal((deux.match(/<section class="page">/g) || []).length, 2);
  assert.equal((deux.match(/<section class="page couverture">/g) || []).length, 2);
  const apercu = registresAppelHTML([{ registre: r, classe: "7ème A" }], { schoolInfo: {}, apercu: true });
  assert.doesNotMatch(apercu, /window\.print/);
  assert.match(apercu, /APERÇU/);
  assert.match(apercu, /chef de section/);
});
