import assert from "node:assert/strict";
import test from "node:test";
import { SECTIONS_ECOLE } from "../src/constants.js";
import { resolveCollection } from "../src/backend/collection-map.js";
import { matieresPourAnnee, schoolInfoPourAnnee } from "../src/reglages-annee.js";
import {
  GROUPES_PERIODICITE, anneesAFiger, bilanMigration, choixParDefaut, ciblesPossibles, cleOrpheline,
  detecterPeriodesOrphelines, figerPeriodicite, groupeDeSection, groupesARevoir, periodesParGroupe,
  planifierMigration, proposerRangement, rangementComplet, tranchePeriode,
} from "../src/components/migration-periodes/migration-periodes-utils.js";

const ANNEE = "2025-2026";
const note = (section, periode, annee = ANNEE) => ({ section, periode, annee });

// Convention guinéenne typique : primaire au trimestre, secondaire au semestre.
const ECOLE = { periodicitePrimaire: "trimestre", periodiciteSecondaire: "semestre" };

// ── Périodicité par groupe ──────────────────────────────────────────────────

test("chaque section scolaire appartient à exactement un groupe de périodicité", () => {
  const sections = GROUPES_PERIODICITE.flatMap((g) => g.sections);
  assert.deepEqual([...sections].sort(), [...SECTIONS_ECOLE].sort());
  assert.equal(groupeDeSection("college"), "secondaire");
  assert.equal(groupeDeSection("lycee"), "secondaire");
  assert.equal(groupeDeSection("primaire"), "primaire");
  assert.equal(groupeDeSection("prescolaire"), "prescolaire");
  assert.equal(groupeDeSection("inconnue"), null);
  assert.equal(groupeDeSection(undefined), null);
});

test("les collections d'un groupe visent la table notes, sur les sections du groupe", () => {
  for (const g of GROUPES_PERIODICITE) {
    const resolues = g.collections.map((nom) => resolveCollection(nom));
    assert.ok(resolues.every((r) => r?.table === "notes"), g.groupe);
    assert.deepEqual(resolues.map((r) => r.section).sort(), [...g.sections].sort(), g.groupe);
  }
});

test("periodesParGroupe : un réglage par groupe, maternelle repliée sur le primaire", () => {
  assert.deepEqual(periodesParGroupe(ECOLE), {
    prescolaire: ["T1", "T2", "T3"],
    primaire: ["T1", "T2", "T3"],
    secondaire: ["S1", "S2"],
  });
  // Sans réglage propre, la maternelle suit le PRIMAIRE, jamais le secondaire.
  const inverse = periodesParGroupe({ periodicitePrimaire: "semestre", periodiciteSecondaire: "trimestre" });
  assert.deepEqual(inverse.prescolaire, ["S1", "S2"]);
});

test("periodesParGroupe : le réglage propre de la maternelle prime", () => {
  const p = periodesParGroupe({ ...ECOLE, periodicitePrescolaire: "mensuel" }, ["Oct", "Nov", "Déc"]);
  assert.deepEqual(p.prescolaire, ["Oct", "Nov", "Déc"]);
  assert.deepEqual(p.primaire, ["T1", "T2", "T3"]);
});

// ── Détection ───────────────────────────────────────────────────────────────

// LE cas qui impose de raisonner par section : T1 n'existe plus au secondaire
// (passé au semestre) mais reste la période courante du primaire.
test("T1 orpheline au secondaire, valide au primaire : seul le secondaire est signalé", () => {
  const notes = [
    note("primaire", "T1"), note("primaire", "T2"),
    note("college", "T1"), note("lycee", "T1"), note("college", "S1"),
  ];
  assert.deepEqual(detecterPeriodesOrphelines(notes, periodesParGroupe(ECOLE)), [
    { groupe: "secondaire", periode: "T1", count: 2, annees: [ANNEE] },
  ]);
});

test("la maternelle est mesurée à SA périodicité", () => {
  const periodes = periodesParGroupe({ ...ECOLE, periodicitePrescolaire: "semestre" });
  const notes = [note("prescolaire", "T1"), note("prescolaire", "S1"), note("primaire", "T1")];
  assert.deepEqual(detecterPeriodesOrphelines(notes, periodes), [
    { groupe: "prescolaire", periode: "T1", count: 1, annees: [ANNEE] },
  ]);
});

// Régression du 2026-08-15 : tant que la maternelle héritait du secondaire,
// ses notes trimestrielles (783 à La Citadelle) passaient pour orphelines.
test("maternelle sans réglage, primaire au trimestre : ses trimestres sont valides", () => {
  const notes = [note("prescolaire", "T1"), note("prescolaire", "T3")];
  assert.deepEqual(detecterPeriodesOrphelines(notes, periodesParGroupe(ECOLE)), []);
});

test("une même période orpheline dans deux groupes donne deux entrées distinctes", () => {
  const periodes = periodesParGroupe({ ...ECOLE, periodicitePrescolaire: "semestre" });
  const notes = [note("prescolaire", "T2"), note("college", "T2"), note("lycee", "T2"), note("primaire", "T2")];
  const orphelines = detecterPeriodesOrphelines(notes, periodes);
  assert.deepEqual(orphelines.map((o) => [o.groupe, o.periode, o.count]), [
    ["prescolaire", "T2", 1],
    ["secondaire", "T2", 2],
  ]);
  assert.notEqual(cleOrpheline(orphelines[0]), cleOrpheline(orphelines[1]));
});

test("toutes les années sont comptées et listées, sans doublon", () => {
  const notes = [
    note("college", "T3", "2025-2026"), note("college", "T3", "2024-2025"),
    note("lycee", "T3", "2025-2026"), { section: "college", periode: "T3" },
  ];
  const [orpheline] = detecterPeriodesOrphelines(notes, periodesParGroupe(ECOLE));
  assert.equal(orpheline.count, 4);
  assert.deepEqual(orpheline.annees, ["2024-2025", "2025-2026"]);
});

test("ordre stable : groupe, puis trimestres, semestres, mois, le reste en dernier", () => {
  const periodes = periodesParGroupe({
    periodicitePrescolaire: "semestre", periodicitePrimaire: "semestre", periodiciteSecondaire: "semestre",
  });
  const notes = [
    note("college", "Zzz"), note("college", "T3"), note("lycee", "T1"), note("primaire", "T2"),
    note("prescolaire", "Oct"), note("prescolaire", "T1"),
  ];
  assert.deepEqual(detecterPeriodesOrphelines(notes, periodes).map(cleOrpheline), [
    "prescolaire/T1", "prescolaire/Oct", "primaire/T2", "secondaire/T1", "secondaire/T3", "secondaire/Zzz",
  ]);
});

test("jamais orpheline : sans période, section inconnue, ou périodicité du groupe inconnue", () => {
  const notes = [
    note("college", ""), note("college", undefined), { periode: "T1" }, note("inconnue", "T1"), null,
  ];
  assert.deepEqual(detecterPeriodesOrphelines(notes, periodesParGroupe(ECOLE)), []);
  // Sans référence, on ne juge pas — et on ne propose surtout pas de supprimer.
  assert.deepEqual(detecterPeriodesOrphelines([note("college", "T1")], { primaire: ["T1"] }), []);
  assert.deepEqual(detecterPeriodesOrphelines([note("college", "T1")], { secondaire: [] }), []);
  assert.deepEqual(detecterPeriodesOrphelines(undefined, periodesParGroupe(ECOLE)), []);
});

// ── Où va une ancienne période ──────────────────────────────────────────────

const MOIS = ["Oct", "Nov", "Déc", "Jan", "Fév", "Mar", "Avr", "Mai", "Jun"];
const TRIMESTRES = ["T1", "T2", "T3"];
const SEMESTRES = ["S1", "S2"];

test("trimestre → semestre : T1 et T3 évidents, T2 à cheval", () => {
  assert.deepEqual(ciblesPossibles("T1", SEMESTRES, MOIS), ["S1"]);
  assert.deepEqual(ciblesPossibles("T3", SEMESTRES, MOIS), ["S2"]);
  assert.deepEqual(ciblesPossibles("T2", SEMESTRES, MOIS), ["S1", "S2"]);
});

test("semestre → trimestre : chaque semestre est à cheval sur le 2e trimestre", () => {
  assert.deepEqual(ciblesPossibles("S1", TRIMESTRES, MOIS), ["T1", "T2"]);
  assert.deepEqual(ciblesPossibles("S2", TRIMESTRES, MOIS), ["T2", "T3"]);
});

test("mois → trimestre ou semestre : chaque mois dans le sien, le 5e mois à cheval", () => {
  assert.deepEqual(ciblesPossibles("Oct", TRIMESTRES, MOIS), ["T1"]);
  assert.deepEqual(ciblesPossibles("Jan", TRIMESTRES, MOIS), ["T2"]);
  assert.deepEqual(ciblesPossibles("Jun", TRIMESTRES, MOIS), ["T3"]);
  assert.deepEqual(ciblesPossibles("Jan", SEMESTRES, MOIS), ["S1"]);
  assert.deepEqual(ciblesPossibles("Mar", SEMESTRES, MOIS), ["S2"]);
  assert.deepEqual(ciblesPossibles("Fév", SEMESTRES, MOIS), ["S1", "S2"]);
});

test("trimestre → mois : les trois mois du trimestre", () => {
  assert.deepEqual(ciblesPossibles("T2", MOIS, MOIS), ["Jan", "Fév", "Mar"]);
});

test("le mois de rentrée décale les mois, pas les trimestres", () => {
  const depuisSeptembre = ["Sep", "Oct", "Nov", "Déc", "Jan", "Fév", "Mar", "Avr", "Mai"];
  assert.deepEqual(ciblesPossibles("Déc", TRIMESTRES, depuisSeptembre), ["T2"]);
  assert.deepEqual(ciblesPossibles("Déc", TRIMESTRES, MOIS), ["T1"]);
});

test("période inconnue ou mois hors de l'année : toutes les périodes sont possibles", () => {
  assert.deepEqual(ciblesPossibles("Zzz", SEMESTRES, MOIS), ["S1", "S2"]);
  assert.deepEqual(ciblesPossibles("Jul", TRIMESTRES, MOIS), TRIMESTRES);
  assert.equal(tranchePeriode("T4", MOIS), null);
  assert.deepEqual(ciblesPossibles("T1", undefined, MOIS), []);
});

test("propositions : évidentes rangées d'office, à cheval laissées sans réponse", () => {
  const orphelines = [
    { groupe: "secondaire", periode: "T1", count: 5, annees: [ANNEE] },
    { groupe: "secondaire", periode: "T2", count: 4, annees: [ANNEE] },
    { groupe: "secondaire", periode: "T3", count: 3, annees: [ANNEE] },
  ];
  const propositions = proposerRangement(orphelines, periodesParGroupe(ECOLE, MOIS), MOIS);
  assert.deepEqual(propositions.map((p) => [p.periode, p.options, p.evidente]), [
    ["T1", ["S1"], true], ["T2", ["S1", "S2"], false], ["T3", ["S2"], true],
  ]);
  // Jamais tout dans la 1re période : T2 attend la réponse de la direction.
  const choix = choixParDefaut(propositions);
  assert.deepEqual(choix, { "secondaire/T1": "S1", "secondaire/T3": "S2" });
  assert.equal(rangementComplet(propositions, choix), false);
  assert.equal(rangementComplet(propositions, { ...choix, "secondaire/T2": "S2" }), true);
  // Une réponse hors des options proposées ne compte pas.
  assert.equal(rangementComplet(propositions, { ...choix, "secondaire/T2": "T1" }), false);
});

// ── Quand ranger, et quelles années figer ───────────────────────────────────

test("groupes à revoir : ceux dont la liste de périodes change", () => {
  const avant = periodesParGroupe({ periodicitePrimaire: "trimestre", periodiciteSecondaire: "trimestre" }, MOIS);
  assert.deepEqual(groupesARevoir(avant, periodesParGroupe(ECOLE, MOIS)), ["secondaire"]);
  assert.deepEqual(groupesARevoir(avant, avant), []);
  // Le préscolaire suit le primaire : passer le primaire au semestre touche les deux.
  const primaireSemestre = periodesParGroupe({ periodicitePrimaire: "semestre", periodiciteSecondaire: "trimestre" }, MOIS);
  assert.deepEqual(groupesARevoir(avant, primaireSemestre), ["prescolaire", "primaire"]);
  // Au mois, un autre mois de rentrée change les codes de mois.
  const mensuel = { periodicitePrimaire: "mensuel", periodiciteSecondaire: "trimestre" };
  const septembre = ["Sep", ...MOIS.slice(0, 8)];
  assert.deepEqual(groupesARevoir(periodesParGroupe(mensuel, MOIS), periodesParGroupe(mensuel, septembre)), ["prescolaire", "primaire"]);
});

test("années à figer : antérieures, sans réglages figés, sans doublon", () => {
  const figees = { "2023-2024": { ecole: { periodiciteSecondaire: "trimestre" } } };
  assert.deepEqual(
    anneesAFiger(["2024-2025", "2023-2024", "2026-2027", "2024-2025", "2025-2026", "", undefined], "2026-2027", figees),
    ["2024-2025", "2025-2026"],
  );
  assert.deepEqual(anneesAFiger(["2025-2026"], "", {}), []);
  assert.deepEqual(anneesAFiger(undefined, "2026-2027"), []);
});

test("figer : la périodicité effective d'avant, sans toucher aux années déjà figées", () => {
  const maintenant = new Date("2026-11-25T10:00:00Z");
  const existante = { figesLe: "2025-07-01T00:00:00.000Z", ecole: { periodiciteSecondaire: "semestre" }, matieres: {} };
  const avant = {
    periodicite: "trimestre", periodicitePrimaire: "trimestre", periodiciteSecondaire: "trimestre",
    reglagesAnnees: { "2023-2024": existante },
  };
  const suite = figerPeriodicite(avant, ["2023-2024", "2025-2026"], maintenant);
  assert.equal(suite["2023-2024"], existante);
  assert.deepEqual(suite["2025-2026"], {
    figesLe: "2026-11-25T10:00:00.000Z",
    // Maternelle sans réglage propre : celui du primaire, écrit en clair.
    ecole: { periodicite: "trimestre", periodicitePrescolaire: "trimestre", periodicitePrimaire: "trimestre", periodiciteSecondaire: "trimestre" },
  });
  // L'année passée se relit bien avec SA périodicité, matières du jour.
  const vue = schoolInfoPourAnnee({ anneeScolaire: "2026-2027", periodiciteSecondaire: "semestre", reglagesAnnees: suite }, "2025-2026");
  assert.deepEqual(periodesParGroupe(vue, MOIS).secondaire, TRIMESTRES);
  assert.deepEqual(matieresPourAnnee([{ nom: "Maths" }], vue, "2025-2026", "college"), [{ nom: "Maths" }]);
  assert.equal(figerPeriodicite(avant, []), undefined);
});

// ── Plan d'écriture ─────────────────────────────────────────────────────────

test("plan : une écriture par (groupe, période), sur les seules collections du groupe, pour l'année seulement", () => {
  const orphelines = [
    { groupe: "secondaire", periode: "T1", count: 5, annees: [ANNEE] },
    { groupe: "secondaire", periode: "T3", count: 2, annees: [ANNEE] },
    { groupe: "prescolaire", periode: "S2", count: 4, annees: [ANNEE] },
  ];
  const mapping = { "secondaire/T1": "S1", "secondaire/T3": "S2", "prescolaire/S2": "T3" };
  assert.deepEqual(planifierMigration(orphelines, mapping, periodesParGroupe(ECOLE), ANNEE), [
    { groupe: "secondaire", periode: "T1", cible: "S1", collections: ["notesCollege", "notesLycee"], annee: ANNEE, attendu: 5 },
    { groupe: "secondaire", periode: "T3", cible: "S2", collections: ["notesCollege", "notesLycee"], annee: ANNEE, attendu: 2 },
    { groupe: "prescolaire", periode: "S2", cible: "T3", collections: ["notesPrescolaire"], annee: ANNEE, attendu: 4 },
  ]);
});

test("plan : jamais sans année — les années passées ne se réécrivent pas", () => {
  const orphelines = [{ groupe: "secondaire", periode: "T1", count: 1, annees: [] }];
  assert.throws(() => planifierMigration(orphelines, { "secondaire/T1": "S1" }, periodesParGroupe(ECOLE)), /annee/);
});

test("plan : une destination étrangère au groupe est refusée", () => {
  // S1 est valide au secondaire, pas au primaire resté au trimestre : l'y
  // écrire fabriquerait de nouvelles orphelines.
  const orphelines = [{ groupe: "primaire", periode: "Oct", count: 1, annees: [] }];
  assert.throws(
    () => planifierMigration(orphelines, { "primaire/Oct": "S1" }, periodesParGroupe(ECOLE), ANNEE),
    /périodicité de Primaire a changé/,
  );
});

test("plan : une période redevenue valide depuis l'analyse n'est plus rangée", () => {
  // Analyse faite au semestre ; le secondaire est repassé au trimestre,
  // fenêtre ouverte : T1 est de nouveau la période courante.
  const orphelines = [{ groupe: "secondaire", periode: "T1", count: 9, annees: [] }];
  const retour = periodesParGroupe({ periodicitePrimaire: "trimestre", periodiciteSecondaire: "trimestre" });
  assert.throws(() => planifierMigration(orphelines, { "secondaire/T1": "T2" }, retour, ANNEE), /a changé/);
});

test("plan : sans destination choisie, aucune écriture ; clé sans orpheline ignorée", () => {
  const orphelines = [{ groupe: "secondaire", periode: "T1", count: 1, annees: [] }];
  const periodes = periodesParGroupe(ECOLE);
  assert.deepEqual(planifierMigration(orphelines, {}, periodes, ANNEE), []);
  assert.deepEqual(planifierMigration(orphelines, { "secondaire/T1": "", "primaire/T1": "T2" }, periodes, ANNEE), []);
});

// ── Bilan ───────────────────────────────────────────────────────────────────

const ok = (value) => ({ status: "fulfilled", value });
const ko = (message) => ({ status: "rejected", reason: new Error(message) });

test("bilan : comptes réels, lignes ignorées par la RLS signalées", () => {
  const operations = [
    { groupe: "secondaire", periode: "T1", cible: "S1", attendu: 5 },
    { groupe: "secondaire", periode: "T3", cible: "S2", attendu: 2 },
  ];
  // T1 : collège 3 + lycée 2 = les 5 attendues. T3 : 1 seule rangée sur 2.
  assert.deepEqual(bilanMigration(operations, [[ok(3), ok(2)], [ok(1), ok(0)]]), {
    totalMaj: 6, nonTraitees: 1, erreurs: [],
  });
});

test("bilan : une écriture en échec n'efface pas celles qui ont abouti", () => {
  const operations = [{ groupe: "secondaire", periode: "T2", cible: "S1", attendu: 6 }];
  const bilan = bilanMigration(operations, [[ok(4), ko("réseau indisponible")]]);
  assert.equal(bilan.totalMaj, 4);
  assert.deepEqual(bilan.erreurs, ["T2 (secondaire) : réseau indisponible"]);
  // L'écart vient de l'échec, déjà signalé : pas de double compte.
  assert.equal(bilan.nonTraitees, 0);
});

test("bilan : des notes apparues depuis l'analyse ne créent pas d'écart négatif", () => {
  const operations = [{ groupe: "primaire", periode: "S1", cible: "T1", attendu: 2 }];
  assert.deepEqual(bilanMigration(operations, [[ok(3)]]), { totalMaj: 3, nonTraitees: 0, erreurs: [] });
});
