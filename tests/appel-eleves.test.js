// Appel de la classe au portail enseignant : présent par défaut, on n'écrit
// que la différence avec ce qui est déjà signalé pour le jour.
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  compterAppel, etatEleve, heureAppelFait, nbEcritures, noterAppelFait, planAppel, situationDuJour,
} from "../src/components/portail-enseignant/appel-logic.js";

const MOI = "ens-1";
const JOUR = "2026-11-11";
const ELEVES = [
  { _id: "e1", nom: "BAH", prenom: "Aïssatou", classe: "7ème A" },
  { _id: "e2", nom: "CAMARA", prenom: "Ibrahima", classe: "7ème A" },
  { _id: "e3", nom: "DIALLO", prenom: "Mariama", classe: "7ème A" },
];
const inc = (id, eleveId, type, extra = {}) => ({
  _id: id, eleveId, type, date: JOUR, justifie: "Non", motif: "", signaledByEnseignantId: MOI, ...extra,
});
const plan = (incidents, marques) => planAppel({ eleves: ELEVES, incidents, date: JOUR, marques, enseignantId: MOI });

test("classe sans signalement : tout le monde est présent, rien à écrire", () => {
  const situation = situationDuJour([], JOUR, MOI);
  assert.deepEqual(compterAppel(ELEVES, situation, {}), { presents: 3, absents: 0, retards: 0 });
  assert.equal(nbEcritures(plan([], {})), 0);
  // Coché puis recoché présent : toujours rien.
  assert.equal(nbEcritures(plan([], { e1: "present" })), 0);
});

test("un absent et un retard cochés : deux créations, du bon type", () => {
  const p = plan([], { e1: "absent", e3: "retard" });
  assert.deepEqual(p.creations, [
    { eleveId: "e1", eleveNom: "BAH Aïssatou", type: "Absence" },
    { eleveId: "e3", eleveNom: "DIALLO Mariama", type: "Retard" },
  ]);
  assert.deepEqual([p.modifications, p.suppressions], [[], []]);
});

test("appel déjà enregistré : le rouvrir montre les coches et n'écrit rien de plus", () => {
  const incidents = [inc("a1", "e1", "Absence"), inc("a2", "e3", "Retard")];
  const situation = situationDuJour(incidents, JOUR, MOI);
  assert.equal(etatEleve("e1", situation, {}), "absent");
  assert.equal(etatEleve("e2", situation, {}), "present");
  assert.equal(etatEleve("e3", situation, {}), "retard");
  assert.deepEqual(compterAppel(ELEVES, situation, {}), { presents: 1, absents: 1, retards: 1 });
  assert.equal(nbEcritures(plan(incidents, { e1: "absent", e3: "retard" })), 0);
});

test("l'élève arrive finalement : absent → retard garde le signalement, absent → présent le retire", () => {
  const incidents = [inc("a1", "e1", "Absence", { motif: "malade", justifie: "Oui" }), inc("a2", "e2", "Absence")];
  const p = plan(incidents, { e1: "retard", e2: "present" });
  assert.deepEqual(p.creations, []);
  assert.equal(p.modifications.length, 1);
  assert.equal(p.modifications[0].incident._id, "a1");
  assert.equal(p.modifications[0].incident.motif, "malade");
  assert.equal(p.modifications[0].type, "Retard");
  assert.deepEqual(p.suppressions, ["a2"]);
});

test("signalement de la direction ou d'un collègue : visible, jamais défait par l'appel", () => {
  const incidents = [inc("a1", "e1", "Absence", { signaledByEnseignantId: "ens-2", signaledByEnseignantNom: "M. Sow" })];
  const situation = situationDuJour(incidents, JOUR, MOI);
  assert.equal(situation.get("e1").modifiable, false);
  assert.equal(situation.get("e1").auteur, "M. Sow");
  assert.equal(etatEleve("e1", situation, { e1: "present" }), "absent");
  assert.equal(nbEcritures(plan(incidents, { e1: "present" })), 0);
});

test("seuls les signalements du jour comptent — date d'avant la migration comprise", () => {
  const incidents = [
    inc("a1", "e1", "Absence", { date: "2026-11-10" }),
    inc("a2", "e2", "Absence", { date: "11/11/2026" }),
    inc("a3", "e3", "Avertissement"),
  ];
  const situation = situationDuJour(incidents, JOUR, MOI);
  assert.equal(situation.has("e1"), false);
  assert.equal(situation.get("e2").etat, "absent");
  assert.equal(situation.has("e3"), false);
});

test("doublons du même jour : recoché présent, tous retirés ; une absence l'emporte sur un retard", () => {
  const incidents = [inc("a1", "e1", "Retard"), inc("a2", "e1", "Absence")];
  assert.equal(situationDuJour(incidents, JOUR, MOI).get("e1").etat, "absent");
  assert.deepEqual(plan(incidents, { e1: "present" }).suppressions, ["a1", "a2"]);
  const p = plan(incidents, { e1: "retard" });
  assert.equal(p.modifications[0].incident._id, "a1");
  assert.deepEqual(p.suppressions, ["a2"]);
});

test("« Appel fait à » : gardé par enseignant, classe et jour ; les plus anciens s'effacent", () => {
  const boite = new Map();
  const stockage = { getItem: (k) => boite.get(k) ?? null, setItem: (k, v) => boite.set(k, v) };
  assert.equal(heureAppelFait(MOI, "7ème A", JOUR, stockage), "");
  noterAppelFait(MOI, "7ème A", JOUR, "08:12", stockage);
  assert.equal(heureAppelFait(MOI, "7ème A", JOUR, stockage), "08:12");
  assert.equal(heureAppelFait(MOI, "7ème B", JOUR, stockage), "");
  assert.equal(heureAppelFait("ens-2", "7ème A", JOUR, stockage), "");
  for (let i = 0; i < 100; i++) noterAppelFait(MOI, `classe ${i}`, JOUR, "09:00", stockage);
  assert.equal(heureAppelFait(MOI, "7ème A", JOUR, stockage), "");
  assert.equal(heureAppelFait(MOI, "classe 99", JOUR, stockage), "09:00");
  // Stockage illisible ou absent : aucun plantage.
  assert.equal(heureAppelFait(MOI, "7ème A", JOUR, { getItem: () => "{oups" }), "");
  assert.equal(heureAppelFait(MOI, "7ème A", JOUR, null), "");
});
