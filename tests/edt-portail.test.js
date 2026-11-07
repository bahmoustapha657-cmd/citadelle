import test from "node:test";
import assert from "node:assert/strict";
import {
  normaliserCreneau, joursAffiches, jourCourant, creneauxDuJour, palettePour,
  libellesCreneau, heuresSemaine, COULEUR_RECREATION,
} from "../src/edt-portail.js";
import { emploisDeLEleve } from "../src/components/portail-parent/portail-parent-derive.js";

test("ancien champ `heure` : début et fin retrouvés", () => {
  const c = normaliserCreneau({ jour: "Lundi", heure: "08:00 - 10:00" });
  assert.equal(c.heureDebut, "08:00");
  assert.equal(c.heureFin, "10:00");
  // Un créneau déjà découpé n'est pas touché.
  const d = { heureDebut: "09:00", heureFin: "10:00", heure: "x" };
  assert.equal(normaliserCreneau(d), d);
});

test("colonnes : jours ouvrés + tout jour où il y a cours, dans l'ordre", () => {
  const jours = joursAffiches([{ jour: "Samedi" }], ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"]);
  assert.deepEqual(jours, ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"]);
});

test("jour courant : null le dimanche", () => {
  assert.equal(jourCourant(new Date(2026, 9, 18)), null); // dimanche
  assert.equal(jourCourant(new Date(2026, 9, 19)), "Lundi");
});

test("créneaux d'un jour triés par heure", () => {
  const l = creneauxDuJour([
    { jour: "Lundi", heureDebut: "10:00" }, { jour: "Mardi", heureDebut: "07:00" }, { jour: "Lundi", heureDebut: "08:00" },
  ], "Lundi");
  assert.deepEqual(l.map((c) => c.heureDebut), ["08:00", "10:00"]);
});

test("couleurs stables par clé, récréation à part", () => {
  const emplois = [{ classe: "6e A" }, { classe: "5e B" }, { classe: "6e A" }];
  const couleur = palettePour(emplois, "classe");
  assert.equal(couleur(emplois[0]), couleur(emplois[2]));
  assert.notEqual(couleur(emplois[0]), couleur(emplois[1]));
  assert.equal(couleur({ type: "recreation" }), COULEUR_RECREATION);
});

test("libellés : classe d'abord pour l'enseignant, matière pour le parent", () => {
  const c = { classe: "6e A", matiere: "Maths", enseignant: "Bah Ali (Maths)" };
  assert.deepEqual(libellesCreneau(c, "enseignant"), { titre: "6e A", detail: "Maths" });
  assert.deepEqual(libellesCreneau(c, "parent"), { titre: "Maths", detail: "Bah Ali" });
});

test("volume horaire hors récréations", () => {
  assert.equal(heuresSemaine([
    { heureDebut: "08:00", heureFin: "10:00" },
    { heureDebut: "10:00", heureFin: "10:30", type: "recreation" },
    { heureDebut: "10:30", heureFin: "11:15" },
  ]), "2 h 45");
});

test("parent : créneaux de la classe ET de la section de l'enfant", () => {
  const emplois = [
    { classe: "1ère Année", section: "primaire", matiere: "Calcul" },
    { classe: "1ère Année", section: "lycee", matiere: "Physique" },
    { classe: "2e Année", section: "primaire", matiere: "Lecture" },
  ];
  assert.deepEqual(emploisDeLEleve(emplois, { classe: "1ère Année", section: "primaire" }).map((c) => c.matiere), ["Calcul"]);
  // Section inconnue : toute la classe.
  assert.equal(emploisDeLEleve(emplois, { classe: "1ère Année" }).length, 2);
  assert.deepEqual(emploisDeLEleve(emplois, {}), []);
});
