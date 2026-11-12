// Appel par cours au secondaire : plusieurs professeurs dans la même journée,
// un élève présent à un cours et absent à un autre ; registre en heures.
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  cleSeance, jourDeLaSemaine, recouvrement, seanceParDefaut, seancesDuJour, sectionParCours,
} from "../src/components/portail-enseignant/seances.js";
import { autresCoursDuJour, planAppel, situationDuJour } from "../src/components/portail-enseignant/appel-logic.js";
import {
  formaterQuantite, registreDuMois, registreMensuelHeures,
} from "../src/components/portail-enseignant/registre-mensuel.js";
import { registreAppelHTML } from "../src/reports/registre-appel.js";

// Lundi 2 novembre 2026 : Maths 8 h–10 h, Français 10 h–12 h, Anglais 15 h–16 h.
const LUNDI = "2026-11-02";
const EDT = [
  { classe: "10ème A", jour: "Lundi", heureDebut: "10:00", heureFin: "12:00", matiere: "Français", enseignant: "Awa Sylla" },
  { classe: "10ème A", jour: "Lundi", heureDebut: "8:00", heureFin: "10:00", matiere: "Maths", enseignant: "Ibrahima Barry" },
  { classe: "10ème A", jour: "Lundi", heureDebut: "08:00", heureFin: "10:00", matiere: "Maths", enseignant: "Ibrahima Barry" }, // doublon
  { classe: "10ème A", jour: "Lundi", heureDebut: "15:00", heureFin: "16:00", matiere: "Anglais", enseignant: "Kadiatou Bah" },
  { classe: "10ème B", jour: "Lundi", heureDebut: "08:00", heureFin: "10:00", matiere: "SVT" },
  { classe: "10ème A", jour: "Mardi", heureDebut: "08:00", heureFin: "12:00", matiere: "Physique" },
];
const MATHS = { heureDebut: "08:00", heureFin: "10:00", matiere: "Maths" };
const FRANCAIS = { heureDebut: "10:00", heureFin: "12:00", matiere: "Français" };
const ELEVES = [
  { _id: "e1", nom: "BAH", prenom: "Aïssatou", classe: "10ème A" },
  { _id: "e2", nom: "CAMARA", prenom: "Ibrahima", classe: "10ème A" },
];
const abs = (eleveId, cours, extra = {}) => ({
  _id: `${eleveId}-${cours?.heureDebut || "jour"}`, eleveId, date: LUNDI, type: "Absence", justifie: "Non",
  ...(cours ? { heureDebut: cours.heureDebut, heureFin: cours.heureFin, matiere: cours.matiere } : {}), ...extra,
});

test("cours du jour : emploi du temps de la classe, dans l'ordre, sans doublon ; cours proposé d'office", () => {
  assert.equal(jourDeLaSemaine(LUNDI), "Lundi");
  assert.equal(jourDeLaSemaine("2026-11-08"), ""); // dimanche
  const cours = seancesDuJour(EDT, "10ème A", LUNDI);
  assert.deepEqual(cours.map(cleSeance), ["08:00-10:00", "10:00-12:00", "15:00-16:00"]);
  assert.equal(seanceParDefaut(cours, "10:35").matiere, "Français"); // en cours
  assert.equal(seanceParDefaut(cours, "12:30").matiere, "Français"); // dernier commencé
  assert.equal(seanceParDefaut(cours, "07:00").matiere, "Maths");
  assert.equal(recouvrement(MATHS, { heureDebut: "09:00", heureFin: "11:00" }), 60);
  assert.equal(sectionParCours("lycee"), true);
  assert.equal(sectionParCours("primaire"), false);
});

test("appel du cours de Français : l'absence de Maths ne bloque rien et reste affichée", () => {
  const incidents = [abs("e1", MATHS, { signaledByEnseignantId: "prof-maths", signaledByEnseignantNom: "Ibrahima Barry" })];
  const situation = situationDuJour(incidents, LUNDI, "prof-fr", FRANCAIS);
  assert.equal(situation.has("e1"), false); // présente en Français par défaut
  const autres = autresCoursDuJour(incidents, LUNDI, FRANCAIS);
  assert.deepEqual(autres.get("e1"), [{ etat: "absent", quand: "08:00–10:00", matiere: "Maths", auteur: "Ibrahima Barry" }]);
  // Le prof de Français marque e2 absente : une création, rien d'autre.
  const plan = planAppel({ eleves: ELEVES, incidents, date: LUNDI, marques: { e2: "absent", e1: "present" }, enseignantId: "prof-fr", seance: FRANCAIS });
  assert.deepEqual(plan.creations.map((c) => c.eleveId), ["e2"]);
  assert.equal(plan.suppressions.length, 0); // l'absence de Maths n'est pas défaite
  // Sans cours (primaire) : la journée, comme avant.
  assert.equal(situationDuJour(incidents, LUNDI, "prof-fr").get("e1").etat, "absent");
});

test("registre en heures : cours manqués, absence de la journée, justifiée, retard", () => {
  const incidents = [
    abs("e1", MATHS), // 2 h non justifiées
    abs("e1", FRANCAIS, { justifie: "Oui" }), // 2 h justifiées
    abs("e2", null, { date: "2026-11-03" }), // mardi, toute la journée : 4 h de Physique
    { eleveId: "e2", date: LUNDI, type: "Retard", heureDebut: "15:00", heureFin: "16:00" },
    abs("e2", { heureDebut: "13:00", heureFin: "14:00" }), // pas de cours à cette heure
  ];
  const r = registreMensuelHeures({
    eleves: ELEVES, incidents, mois: "2026-11", joursOuvrables: ["Lundi", "Mardi"],
    aujourdhui: new Date(2026, 10, 4, 12), creneaux: EDT.filter((c) => c.classe === "10ème A"),
  });
  assert.equal(r.unite, "heures");
  assert.deepEqual(r.jours.map((j) => [j.date, j.minutes]), [["2026-11-02", 300], ["2026-11-03", 240]]);
  const [bah, camara] = r.lignes;
  assert.deepEqual(bah.marques[LUNDI], { nj: 120, j: 120, r: 0 });
  assert.deepEqual([bah.absNJ, bah.absJ, bah.presences], [120, 120, 300]);
  assert.deepEqual(camara.marques[LUNDI], { nj: 0, j: 0, r: 1 });
  assert.equal(camara.absNJ, 240);
  assert.equal(r.horsJours, 1);
  assert.equal(r.totaux.possibles, 2 * 540);
  assert.equal(r.totaux.effectives, 1080 - 480);
  assert.equal(r.totaux.taux, 55.6);
  assert.equal(formaterQuantite(r.totaux.possibles, "heures", "fr"), "18 h");
  assert.equal(formaterQuantite(90, "heures", "fr"), "1,5 h");
});

test("registre du mois : en heures avec un emploi du temps, par journée sinon", () => {
  const base = { eleves: ELEVES, incidents: [], mois: "2026-11", joursOuvrables: ["Lundi"], aujourdhui: new Date(2026, 10, 4) };
  assert.equal(registreDuMois({ ...base, parCours: true, creneaux: EDT }).unite, "heures");
  const sansEdt = registreDuMois({ ...base, parCours: true, creneaux: [] });
  assert.equal(sansEdt.unite, "jours");
  assert.equal(sansEdt.sansEmploiDuTemps, true);
  assert.equal(registreDuMois({ ...base, parCours: false, creneaux: EDT }).unite, "jours");
});

test("feuille en heures : cases en heures, totaux et arrêté en heures", () => {
  const r = registreMensuelHeures({
    eleves: ELEVES, incidents: [abs("e1", MATHS)], mois: "2026-11", joursOuvrables: ["Lundi"],
    aujourdhui: new Date(2026, 11, 2), creneaux: EDT.filter((c) => c.classe === "10ème A"),
  });
  const html = registreAppelHTML({ registre: r, classe: "10ème A" });
  assert.match(html, /<td class="j" style="color:#b91c1c">2<\/td>/);
  assert.match(html, /Heures suivies/);
  assert.match(html, /A \(h\)/);
  assert.match(html, /au 30 novembre 2026 : 50 h de cours possibles et 48 h suivies, soit un taux de fréquentation de 96,0 %/);
  assert.match(html, /Heures de cours par élève/);
});
