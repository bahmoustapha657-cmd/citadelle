import assert from "node:assert/strict";
import test from "node:test";
import {
  anneeCivileDuMois, calculerRetenue, decompteAgent, faitExistant, joursOuvrables, moisDeDate,
  recapMois, reglagesPresences, REGLAGES_DEFAUT,
} from "../src/components/comptabilite/presences/presences-utils.js";
import { retenuesDuMois } from "../src/components/comptabilite/presences/appliquer-absences.js";
import { getForfaitNet, summarizeSalaryTotals, mergeSalaryWithManualFields } from "../src/salary-utils.js";
import { toRow, transformRow } from "../src/backend/collection-map.js";

const ANNEE = "2026-2027";
const fait = (date, type, statut, extra = {}) => ({ _id: `${date}-${type}-${extra.agentNom || "A"}`, agentNom: "Aïssatou Barry", section: "Personnel", date, type, statut, ...extra });

test("mois de paie et année civile d'une date de l'année scolaire", () => {
  assert.equal(moisDeDate("2026-10-14"), "Octobre");
  assert.equal(moisDeDate("2027-01-05"), "Janvier");
  assert.equal(moisDeDate("2026-09-01"), "Septembre");
  assert.equal(moisDeDate(""), "");
  assert.equal(anneeCivileDuMois("Décembre", ANNEE), 2026);
  assert.equal(anneeCivileDuMois("Janvier", ANNEE), 2027);
  assert.equal(anneeCivileDuMois("Brumaire", ANNEE), null);
});

test("jours ouvrables : lundi → vendredi par défaut, samedi si l'école le travaille", () => {
  // Octobre 2026 commence un jeudi : 22 jours du lundi au vendredi, 5 samedis.
  assert.equal(joursOuvrables("Octobre", ANNEE), 22);
  assert.equal(joursOuvrables("Octobre", ANNEE, [1, 2, 3, 4, 5, 6]), 27);
  assert.equal(joursOuvrables("Février", ANNEE), 20);
  assert.equal(joursOuvrables("Octobre", ""), 0);
});

test("réglages : valeurs par défaut et bornes", () => {
  assert.deepEqual(reglagesPresences({}), REGLAGES_DEFAUT);
  assert.deepEqual(reglagesPresences({ reglagesPresences: { joursTravail: [6, 1, 1, 9], retardsParDemiJournee: 2 } }),
    { joursTravail: [1, 6], retardsParDemiJournee: 2 });
  assert.deepEqual(reglagesPresences({ reglagesPresences: { joursTravail: [], retardsParDemiJournee: 0 } }), REGLAGES_DEFAUT);
});

test("décompte : seuls les faits injustifiés comptent, les retards par paquets", () => {
  const d = decompteAgent([
    fait("2026-10-05", "absence", "injustifiee"),
    fait("2026-10-06", "absence", "injustifiee", { duree: "demi" }),
    fait("2026-10-07", "absence", "justifiee"),
    fait("2026-10-08", "absence", "en_attente"),
    fait("2026-10-09", "permission", "autorise"),
    ...["12", "13", "14", "15"].map((j) => fait(`2026-10-${j}`, "retard", "injustifiee")),
  ]);
  assert.equal(d.joursAbsence, 1.5);
  assert.equal(d.retards, 4);
  assert.equal(d.joursRetards, 0.5); // 3 retards = ½ j ; le 4e ne suffit pas pour une autre
  assert.equal(d.joursRetenus, 2);
  assert.equal(d.enAttente, 1);
});

test("retenue au forfait : salaire ÷ jours ouvrables × jours, détail lisible", () => {
  const fiche = { nom: "Aissatou BARRY", section: "Personnel", mois: "Octobre", montantForfait: 1100000 };
  const presences = [
    fait("2026-10-05", "absence", "injustifiee"),
    fait("2026-10-19", "absence", "injustifiee"),
    ...["12", "13", "14"].map((j) => fait(`2026-10-${j}`, "retard", "injustifiee")),
    fait("2026-11-03", "absence", "injustifiee"), // autre mois
    fait("2026-10-06", "absence", "injustifiee", { section: "Secondaire" }), // autre fiche
  ];
  const r = calculerRetenue(fiche, presences, { anneeScolaire: ANNEE });
  assert.equal(r.ouvrables, 22);
  assert.equal(r.joursRetenus, 2.5);
  assert.equal(r.montant, 125000);
  assert.match(r.detail, /2 j abs\. \(05\/10, 19\/10\) \+ 3 retards = 0,5 j/);
  assert.equal(calculerRetenue({ ...fiche, section: "Secondaire" }, presences, { anneeScolaire: ANNEE }), null);
});

test("la retenue ne dépasse jamais le salaire", () => {
  const fiche = { nom: "Aïssatou Barry", section: "Personnel", mois: "Février", montantForfait: 200000 };
  const presences = Array.from({ length: 25 }, (_, i) => fait(`2027-02-${String(i + 1).padStart(2, "0")}`, "absence", "injustifiee"));
  assert.equal(calculerRetenue(fiche, presences, { anneeScolaire: ANNEE }).montant, 200000);
});

test("le net des fiches et les totaux déduisent la retenue, la régénération la garde", () => {
  const fiche = { section: "Primaire", montantForfait: 1000000, bon: 100000, revision: 20000, retenueAbsences: 45000 };
  assert.equal(getForfaitNet(fiche), 875000);
  const t = summarizeSalaryTotals([fiche]);
  assert.equal(t.retenue, 45000);
  assert.equal(t.net, 875000);
  const fusion = mergeSalaryWithManualFields({ ...fiche, detailAbsences: "1 j" }, { section: "Primaire", montantForfait: 1200000 });
  assert.equal(fusion.retenueAbsences, 45000);
  assert.equal(fusion.detailAbsences, "1 j");
});

test("appliquer les absences : seules les fiches au forfait qui changent", () => {
  const salairesMois = [
    { _id: "s1", nom: "Aïssatou Barry", section: "Personnel", mois: "Octobre", montantForfait: 1100000 },
    { _id: "s2", nom: "Ibrahima Sow", section: "Primaire", mois: "Octobre", montantForfait: 880000, retenueAbsences: 40000, detailAbsences: "ancien" },
    { _id: "s3", nom: "Mamadou Bah", section: "Secondaire", mois: "Octobre", montantBrut: 900000 },
  ];
  const presences = [
    fait("2026-10-05", "absence", "injustifiee"),
    fait("2026-10-07", "absence", "en_attente"),
    // Absence de Sow justifiée depuis : sa retenue retombe à zéro.
    fait("2026-10-05", "absence", "justifiee", { agentNom: "Ibrahima Sow", section: "Primaire" }),
    fait("2026-10-05", "absence", "injustifiee", { agentNom: "Mamadou Bah", section: "Secondaire" }),
  ];
  const { majs, enAttente } = retenuesDuMois({ salairesMois, presences, anneeScolaire: ANNEE, schoolInfo: {} });
  assert.equal(enAttente, 1);
  assert.deepEqual(majs.map((s) => [s._id, s.retenueAbsences]), [["s1", 50000], ["s2", 0]]);
  assert.equal(majs[1].detailAbsences, "");
});

test("récapitulatif du mois et doublons de la feuille du jour", () => {
  const presences = [fait("2026-10-05", "absence", "injustifiee"), fait("2026-10-06", "retard", "en_attente")];
  const salairesMois = [{ nom: "Aïssatou Barry", section: "Personnel", mois: "Octobre", montantForfait: 1100000, retenueAbsences: 0 }];
  const [ligne] = recapMois({ presences, salairesMois, mois: "Octobre", anneeScolaire: ANNEE });
  assert.equal(ligne.joursAbsence, 1);
  assert.equal(ligne.enAttente, 1);
  assert.equal(ligne.retenue, 50000);
  assert.equal(ligne.appliquee, 0);
  assert.ok(faitExistant(presences, { nom: "AÏSSATOU BARRY", section: "Personnel", date: "2026-10-05", type: "absence" }));
  assert.equal(faitExistant(presences, { nom: "Aïssatou Barry", section: "Personnel", date: "2026-10-05", type: "retard" }), null);
});

test("table presences : date et année en colonnes, le reste dans extra", () => {
  const item = fait("2026-10-05", "absence", "injustifiee", { annee: ANNEE, duree: "demi", motif: "x" });
  const { row } = toRow("presences", item);
  assert.equal(row.date, "2026-10-05");
  assert.equal(row.annee, ANNEE);
  assert.deepEqual(row.extra, { agentNom: "Aïssatou Barry", section: "Personnel", type: "absence", statut: "injustifiee", duree: "demi", motif: "x" });
  const relu = transformRow("presences", { id: "p1", ...row });
  assert.equal(relu.agentNom, "Aïssatou Barry");
  assert.equal(relu.date, "2026-10-05");
});

// ── Secondaire (payé à l'heure) ──────────────────────────────────────────
import {
  calculerRetenueSecondaire, enseignementsPourPaie, recalculerFicheSecondaire,
} from "../src/components/comptabilite/presences/presences-secondaire.js";

const prof = { _id: "e1", prenom: "Mamadou", nom: "Bah", primeHoraire: 10000 };
const emplois = [
  { jour: "Lundi", heureDebut: "08:00", heureFin: "10:00", classe: "7A", enseignant: "Mamadou Bah" },
  { jour: "Mardi", heureDebut: "10:00", heureFin: "12:00", classe: "7A", enseignant: "Mamadou Bah" },
  { jour: "Jeudi", heureDebut: "08:00", heureFin: "11:00", classe: "8B", enseignant: "Mamadou Bah" },
];
const cours = (date, heure, classe) => ({ date, heure, classe, enseignantNom: "Mamadou Bah", statut: "Absent" });
const enseignements = [
  cours("2026-10-05", "08:00", "7A"), // lundi, injustifié
  cours("2026-10-06", "10:00", "7A"), // mardi, justifié au registre
  cours("2026-11-02", "08:00", "7A"), // autre mois
  cours("2025-10-06", "08:00", "7A"), // octobre de l'an dernier
];
const sec = (date, type, statut, extra = {}) => fait(date, type, statut, { agentNom: "Mamadou Bah", section: "Secondaire", ...extra });
const presencesSec = [
  sec("2026-10-06", "absence", "justifiee"),
  sec("2026-10-05", "absence", "injustifiee"), // déjà saisi en heures : pas de double retenue
  sec("2026-10-08", "absence", "injustifiee"), // jeudi, aucune heure saisie → 3 h
  ...["12", "13", "14"].map((j) => sec(`2026-10-${j}`, "retard", "injustifiee")),
];

test("secondaire : seules les heures « Absent » du mois comptent, hors jours justifiés", () => {
  const gardes = enseignementsPourPaie(enseignements, { mois: "Octobre", anneeScolaire: ANNEE, presences: presencesSec });
  assert.deepEqual(gardes.map((e) => e.date), ["2026-10-05"]);
});

test("secondaire : retenue des absences sans heures saisies et des retards", () => {
  const r = calculerRetenueSecondaire({
    salaire: { nom: "Mamadou Bah", section: "Secondaire", mois: "Octobre" },
    teacher: prof, creneaux: emplois,
    enseignementsMois: enseignements.filter((e) => e.date.startsWith("2026-10")),
    presences: presencesSec,
  });
  // Jeudi 08/10 : 3 h × 10 000 ; 3 retards = ½ journée moyenne (70 000 / 3 jours de cours ÷ 2).
  assert.equal(r.montant, 30000 + Math.round(70000 / 3 / 2));
  assert.match(r.detail, /abs\. 08\/10 \(3 h\) \+ 3 retards = 0,5 j/);
});

test("secondaire : la fiche est recalculée, bons et révision conservés", () => {
  const fiche = { _id: "s9", nom: "Mamadou Bah", section: "Secondaire", mois: "Octobre", bon: 50000, revision: 5000, nonExecute: 8, montantBrut: 1 };
  const r = recalculerFicheSecondaire(fiche, {
    ensCollege: [prof], emploisCollege: emplois, engCollege: enseignements,
    presences: presencesSec, anneeScolaire: ANNEE,
  });
  assert.equal(r.fiche.nonExecute, 2); // seul le lundi 05/10 (2 h)
  assert.equal(r.fiche.bon, 50000);
  assert.equal(r.fiche.revision, 5000);
  assert.equal(r.fiche.retenueAbsences, 41667);
  const { majs } = retenuesDuMois({
    salairesMois: [fiche], presences: presencesSec, anneeScolaire: ANNEE, schoolInfo: {},
    secondaire: { ensCollege: [prof], emploisCollege: emplois, engCollege: enseignements },
  });
  assert.equal(majs.length, 1);
  assert.equal(recalculerFicheSecondaire({ ...fiche, nom: "Inconnu" }, { ensCollege: [prof] }), null);
});
