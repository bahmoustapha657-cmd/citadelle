import assert from "node:assert/strict";
import test from "node:test";
import { getFifthWeekDays, hasFifthWeekApplied, monthHasFifthWeek } from "../src/salary-utils.js";
import { genererSalairesPourMois } from "../src/components/comptabilite/salary-actions/salary-generation.js";
import { fichesCinquiemeSemaine } from "../src/components/comptabilite/salary-actions/cinquieme-semaine.js";
import { recalculerFicheSecondaire } from "../src/components/comptabilite/presences/presences-secondaire.js";

// La 5ème semaine dépend de l'année en cours (getFifthWeekDays) : un cours de
// 2 h chaque jour de la semaine en tombe toujours sur au moins un jour.
const MOIS = "Octobre";
const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const prof = { _id: "e1", prenom: "Mamadou", nom: "Bah", primeHoraire: 10000 };
const nouveau = { _id: "e2", prenom: "Fanta", nom: "Camara", primeHoraire: 10000 };
const creneaux = (nom) => JOURS.map((jour) => ({ jour, heureDebut: "08:00", heureFin: "10:00", classe: "7A", enseignant: nom }));
const emploisCollege = [...creneaux("Mamadou Bah"), ...creneaux("Fanta Camara")];
const heures5eme = getFifthWeekDays(MOIS).length * 2;

// Génère les salaires du mois dans une « base » en mémoire.
async function generer(salaires, ensCollege, opts = {}) {
  const base = [...salaires];
  await genererSalairesPourMois(MOIS, {
    salaires: base, ensCollege, ensLycee: [], ensPrimaire: [], personnel: [],
    emploisCollege, emploisLycee: [], engCollege: [], engLycee: [], primeDefaut: 0, annee: "2026-2027",
    ajS: async (r) => { const _id = `s${base.length + 1}`; base.push({ ...r, _id }); return { id: _id }; },
    modS: async (r) => { base.splice(base.findIndex((s) => s._id === r._id), 1, r); },
    supS: async () => {},
    ...opts,
  });
  return base;
}

test("5ème semaine : plus ajoutée d'office à la génération", async () => {
  assert.ok(heures5eme > 0);
  const [fiche] = await generer([], [prof]);
  assert.equal(fiche.cinqSem, 0);
  assert.equal(fiche.montantBrut, 12 * 4 * 10000);
  assert.equal(hasFifthWeekApplied(fiche), false);
  assert.equal(monthHasFifthWeek([fiche], MOIS), false);
});

test("5ème semaine : le bouton l'applique puis la retire, bons et retenues conservés", async () => {
  const [fiche] = await generer([], [prof]);
  const avant = { ...fiche, bon: 30000, revision: 5000, retenueAbsences: 7000, detailAbsences: "abs. 08/10" };
  const secondaire = { ensCollege: [prof], emploisCollege, engCollege: [] };

  const { majs: [avec] } = fichesCinquiemeSemaine({ salairesSec: [avant], appliquer: true, secondaire });
  assert.equal(avec.cinqSem, heures5eme);
  assert.equal(avec.montantBrut, (12 * 4 + heures5eme) * 10000);
  assert.equal(avec.bon, 30000);
  assert.equal(avec.revision, 5000);
  assert.equal(avec.retenueAbsences, 7000);
  assert.equal(avec.detailAbsences, "abs. 08/10");
  assert.equal(hasFifthWeekApplied(avec), true);
  // Déjà appliquée : rien à refaire.
  assert.equal(fichesCinquiemeSemaine({ salairesSec: [avec], appliquer: true, secondaire }).majs.length, 0);

  const { majs: [sans] } = fichesCinquiemeSemaine({ salairesSec: [avec], appliquer: false, secondaire });
  assert.equal(sans.cinqSem, 0);
  assert.equal(sans.montantBrut, 12 * 4 * 10000);
  assert.equal(sans.retenueAbsences, 7000);
});

test("5ème semaine : une fiche saisie à la main pour un inconnu n'est pas touchée", () => {
  const manuelle = { _id: "m1", nom: "Inconnu", section: "Secondaire", mois: MOIS, vhPrevu: 8, cinqSem: 2 };
  const r = fichesCinquiemeSemaine({ salairesSec: [manuelle], appliquer: true, secondaire: { ensCollege: [prof], emploisCollege } });
  assert.deepEqual(r, { majs: [], ignorees: 1 });
});

test("5ème semaine : le choix du mois est gardé par 🔄 Actualiser, un nouvel enseignant le suit", async () => {
  const [fiche] = await generer([], [prof]);
  const { majs: [avec] } = fichesCinquiemeSemaine({ salairesSec: [fiche], appliquer: true, secondaire: { ensCollege: [prof], emploisCollege } });
  const base = await generer([avec], [prof, nouveau], { resync: true });
  assert.deepEqual(base.map((s) => [s.nom, s.cinqSem]), [["Mamadou Bah", heures5eme], ["Fanta Camara", heures5eme]]);
  // Les fiches d'avant ce choix avaient la 5ème semaine : elles la gardent.
  assert.equal(hasFifthWeekApplied({ paramSnapshot: { primeDefaut: 0, jours5eme: ["Jeudi"] } }), true);
});

test("5ème semaine : « Appliquer les absences » garde le choix de la fiche", async () => {
  const [fiche] = await generer([], [prof]);
  const ctx = { ensCollege: [prof], emploisCollege, engCollege: [], anneeScolaire: "2026-2027" };
  assert.equal(recalculerFicheSecondaire(fiche, ctx).fiche.cinqSem, 0);
  const { majs: [avec] } = fichesCinquiemeSemaine({ salairesSec: [fiche], appliquer: true, secondaire: ctx });
  assert.equal(recalculerFicheSecondaire(avec, ctx).fiche.cinqSem, heures5eme);
});
