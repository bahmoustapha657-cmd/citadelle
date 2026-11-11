// Registre d'appel du mois (portail enseignant) : grille élèves × jours de
// classe, totaux, et feuille imprimable.
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  debutDeMois, joursDeClasse, lignesAuSuivi, moisDeLAnnee, moisPrecedent, registreMensuel,
} from "../src/components/portail-enseignant/registre-mensuel.js";
import { registreAppelHTML } from "../src/reports/registre-appel.js";

const LUN_SAM = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const LUN_VEN = LUN_SAM.slice(0, 5);
const FIN_NOV = new Date(2026, 10, 30, 12);
const ELEVES = [
  { _id: "e2", nom: "CAMARA", prenom: "Ibrahima", classe: "7ème A" },
  { _id: "e1", nom: "BAH", prenom: "Aïssatou", classe: "7ème A" },
  { _id: "e3", nom: "DIALLO", prenom: "<Mariama>", classe: "7ème A" },
];
const inc = (eleveId, date, type, justifie = "Non") => ({ eleveId, date, type, justifie });

test("jours de classe : jours ouvrés de l'école, jamais le dimanche, pas au-delà d'aujourd'hui", () => {
  const nov = joursDeClasse("2026-11", LUN_SAM, FIN_NOV);
  assert.equal(nov.length, 25); // 30 jours − 5 dimanches
  assert.ok(nov.every((j) => j.semaine !== 0));
  assert.equal(joursDeClasse("2026-11", LUN_VEN, FIN_NOV).length, 21); // samedis retirés
  assert.equal(joursDeClasse("2026-11", LUN_SAM, new Date(2026, 10, 11, 12)).at(-1).date, "2026-11-11");
  assert.deepEqual(joursDeClasse("", LUN_SAM, FIN_NOV), []);
});

test("mois de l'année scolaire : de septembre au mois en cours ; mois écoulé proposé en début de mois", () => {
  assert.deepEqual(moisDeLAnnee("2026-2027", new Date(2026, 10, 11)), ["2026-09", "2026-10", "2026-11"]);
  assert.equal(moisDeLAnnee("2026-2027", new Date(2027, 6, 15)).length, 11); // jusqu'à juillet
  assert.equal(moisDeLAnnee("", new Date(2026, 10, 11)).length, 12);
  assert.equal(moisPrecedent(new Date(2027, 0, 3)), "2026-12");
  assert.equal(debutDeMois(new Date(2026, 11, 3)), true);
  assert.equal(debutDeMois(new Date(2026, 11, 20)), false);
});

test("registre : A / J / R par jour, une seule marque par jour, l'absence l'emporte", () => {
  const incidents = [
    inc("e1", "2026-11-03", "Absence"),
    inc("e1", "2026-11-03", "Absence"), // doublon (enseignant + direction)
    inc("e1", "2026-11-04", "Retard"),
    inc("e1", "2026-11-04", "Absence", "Oui"), // même jour : l'absence gagne
    inc("e2", "05/11/2026", "Retard"), // date d'avant la migration
    inc("e2", "2026-10-30", "Absence"), // autre mois
    inc("e3", "2026-11-06", "Avertissement"), // pas une présence
    inc("autre", "2026-11-06", "Absence"), // élève d'une autre classe
  ];
  const r = registreMensuel({ eleves: ELEVES, incidents, mois: "2026-11", joursOuvrables: LUN_SAM, aujourdhui: FIN_NOV });
  assert.deepEqual(r.lignes.map((l) => l.eleve._id), ["e1", "e2", "e3"]); // ordre alphabétique
  const [bah, camara, diallo] = r.lignes;
  assert.deepEqual(bah.marques, { "2026-11-03": "A", "2026-11-04": "J" });
  assert.deepEqual([bah.absNJ, bah.absJ, bah.retards, bah.total], [1, 1, 0, 2]);
  assert.deepEqual(camara.marques, { "2026-11-05": "R" });
  assert.equal(diallo.total, 0);
  assert.deepEqual(r.parJour["2026-11-03"], { absents: 1, retards: 0 });
  assert.deepEqual(r.totaux, { absNJ: 1, absJ: 1, retards: 1, elevesConcernes: 2 });
  assert.deepEqual(lignesAuSuivi(r).map((l) => l.eleve._id), ["e1", "e2"]);
});

test("un signalement tombé un jour sans classe compte quand même, et le jour s'ajoute à la grille", () => {
  const r = registreMensuel({
    eleves: ELEVES, incidents: [inc("e1", "2026-11-07", "Absence")], // samedi
    mois: "2026-11", joursOuvrables: LUN_VEN, aujourdhui: FIN_NOV,
  });
  assert.equal(r.jours.length, 22);
  assert.ok(r.jours.some((j) => j.date === "2026-11-07"));
  assert.equal(r.totaux.absNJ, 1);
});

test("feuille imprimée : toute la classe, une colonne par jour de classe, noms échappés", () => {
  const r = registreMensuel({
    eleves: ELEVES, incidents: [inc("e1", "2026-11-03", "Absence"), inc("e2", "2026-11-05", "Retard")],
    mois: "2026-11", joursOuvrables: LUN_SAM, aujourdhui: FIN_NOV,
  });
  const html = registreAppelHTML({ registre: r, classe: "7ème A", schoolInfo: { nom: "École test" }, annee: "2026-2027", nomEns: "M. Sow" });
  assert.match(html, /size:A4 landscape/);
  assert.equal((html.match(/<th class="j">/g) || []).length, 25);
  assert.equal((html.match(/<td class="nom">/g) || []).length, 3);
  assert.match(html, /&lt;Mariama&gt;/);
  assert.doesNotMatch(html, /<Mariama>/);
  assert.match(html, /7ème A/);
  assert.match(html, /M\. Sow/);
});
