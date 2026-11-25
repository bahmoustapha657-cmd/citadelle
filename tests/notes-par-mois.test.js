// Note de cours MOIS PAR MOIS au secondaire (règle de la direction,
// 2026-11-25) et saisie du mois des oraux et des écrits.
//   mois    = (moyenne des oraux du mois + moyenne des écrits du mois) ÷ 2
//   période = moyenne des mois — (M1 + M2 + M3) ÷ 3 au trimestre
//   matière = (cours + 2 × composition) ÷ 3, inchangé.
import test from "node:test";
import assert from "node:assert/strict";

import {
  definirCalendrierNotes, getSecondarySubjectAverage, getSubjectAverage, getSubjectParts, moisDeNote, noteAvecMois,
} from "../src/note-utils.js";
import { estPeriodeMois, moisDePeriode } from "../src/period-utils.js";
import { calcMoisAnnee } from "../src/constants.js";
import {
  champMois, colonnesPeriodes, jetonPeriode, lireJetonPeriode, lireMois, moisAEnregistrer, moisAJour,
  moisImporte, moisParDefaut, moisSaisi, moisValide,
} from "../src/notes-mois.js";
import { construireGrille, collectGridNotes, validateGridNotes } from "../src/components/portail-enseignant/notes-grid.js";
import { draftKey } from "../src/components/portail-enseignant/notes-draft.js";

const OCTOBRE = calcMoisAnnee("Octobre"); // Oct … Jun
const arrondi = (x) => Math.round(x * 10000) / 10000;

// ── Périodes et mois ────────────────────────────────────────────────────────

test("moisDePeriode : 3 mois au trimestre, 5 au semestre (le 5e mois aux deux)", () => {
  assert.deepEqual(moisDePeriode("T1", OCTOBRE), ["Oct", "Nov", "Déc"]);
  assert.deepEqual(moisDePeriode("T2", OCTOBRE), ["Jan", "Fév", "Mar"]);
  assert.deepEqual(moisDePeriode("T3", OCTOBRE), ["Avr", "Mai", "Jun"]);
  assert.deepEqual(moisDePeriode("S1", OCTOBRE), ["Oct", "Nov", "Déc", "Jan", "Fév"]);
  assert.deepEqual(moisDePeriode("S2", OCTOBRE), ["Fév", "Mar", "Avr", "Mai", "Jun"]);
  assert.deepEqual(moisDePeriode("Nov", OCTOBRE), ["Nov"]);
  assert.deepEqual(moisDePeriode("X9", OCTOBRE), []);
  // Rentrée en septembre : tout se décale d'un mois.
  assert.deepEqual(moisDePeriode("T1", calcMoisAnnee("Septembre")), ["Sep", "Oct", "Nov"]);
  assert.equal(estPeriodeMois("Oct"), true);
  assert.equal(estPeriodeMois("T1"), false);
});

test("noteAvecMois : oraux et écrits du secondaire seulement", () => {
  assert.equal(noteAvecMois("Interrogation", "college"), true);
  assert.equal(noteAvecMois("Devoir", "lycee"), true);
  assert.equal(noteAvecMois("Évaluation orale", "secondaire"), true);
  assert.equal(noteAvecMois("Composition", "college"), false);
  assert.equal(noteAvecMois("Moyenne de la matière", "college"), false);
  assert.equal(noteAvecMois("Devoir", "primaire"), false);
  assert.equal(noteAvecMois("Devoir", "prescolaire"), false);
});

// ── Calcul de la note de cours ──────────────────────────────────────────────

test("trimestre : moyenne des notes de cours mensuelles, puis (cours + 2 × compo) ÷ 3", () => {
  const notes = [
    // Octobre : 2 oraux (10, 14) + 1 écrit (16) → (12 + 16) ÷ 2 = 14
    { type: "Interrogation", note: 10, periode: "T1", mois: "Oct" },
    { type: "Interrogation", note: 14, periode: "T1", mois: "Oct" },
    { type: "Devoir", note: 16, periode: "T1", mois: "Oct" },
    // Novembre : 1 oral (8) + 1 écrit (12) → 10
    { type: "Interrogation", note: 8, periode: "T1", mois: "Nov" },
    { type: "Devoir", note: 12, periode: "T1", mois: "Nov" },
    // Décembre : 1 écrit seul (9) → 9
    { type: "Devoir", note: 9, periode: "T1", mois: "Déc" },
    { type: "Composition", note: 11, periode: "T1" },
  ];
  const parts = getSubjectParts(notes, "", "college");
  assert.equal(arrondi(parts.cours), 11); // (14 + 10 + 9) ÷ 3
  assert.equal(parts.composition, 11);
  assert.equal(arrondi(getSubjectAverage(notes, "", "college")), 11);
  // L'ancien calcul (tous les oraux + tous les écrits) aurait donné
  // ((10+14+8)/3 + (16+12+9)/3) ÷ 2 = 11,5 : la règle mensuelle change bien le résultat.
  assert.notEqual(arrondi(parts.cours), 11.5);
});

test("absence : un mois avec la seule note présente vaut cette note ; un mois sans note ne compte pas", () => {
  const notes = [
    { type: "Devoir", note: 12, periode: "T1", mois: "Oct" },            // oral absent → 12
    { type: "Interrogation", note: 6, periode: "T1", mois: "Nov" },
    { type: "Devoir", note: 10, periode: "T1", mois: "Nov" },            // → 8
    // Décembre : aucune note → ne compte pas (pas de 0).
  ];
  assert.equal(getSecondarySubjectAverage(notes), 10); // (12 + 8) ÷ 2
});

test("un oral et un écrit chaque mois : même résultat que l'ancien calcul", () => {
  const notes = [
    { type: "Interrogation", note: 10, periode: "T1", mois: "Oct" },
    { type: "Devoir", note: 14, periode: "T1", mois: "Oct" },
    { type: "Interrogation", note: 12, periode: "T1", mois: "Nov" },
    { type: "Devoir", note: 8, periode: "T1", mois: "Nov" },
  ];
  assert.equal(getSecondarySubjectAverage(notes), 11); // (12 + 10) ÷ 2 = (11 + 11) ÷ 2
});

test("notes sans mois ni date : un seul groupe, comme avant", () => {
  const notes = [
    { type: "Interrogation", note: 12, periode: "T1" },
    { type: "Devoir", note: 15, periode: "T1" },
    { type: "Composition", note: 9, periode: "T1" },
  ];
  assert.equal(arrondi(getSecondarySubjectAverage(notes)), 10.5);
});

test("anciennes notes : mois tiré de la date de saisie s'il tombe dans la période et l'année", () => {
  definirCalendrierNotes("Octobre");
  const le = (jour) => Date.UTC(2026, jour.m, jour.d, 12);
  const oct = le({ m: 9, d: 14 });
  const nov = le({ m: 10, d: 14 });
  assert.equal(moisDeNote({ type: "Devoir", periode: "T1", annee: "2026-2027", createdAt: oct }), "Oct");
  // Date ISO aussi acceptée.
  assert.equal(moisDeNote({ type: "Devoir", periode: "T1", createdAt: "2026-11-14T12:00:00Z" }), "Nov");
  // Saisie tardive (janvier pour le T1) : sans mois.
  assert.equal(moisDeNote({ type: "Devoir", periode: "T1", createdAt: Date.UTC(2027, 0, 14, 12) }), null);
  // Note restaurée d'une archive (autre année scolaire) : sans mois.
  assert.equal(moisDeNote({ type: "Devoir", periode: "T1", annee: "2025-2026", createdAt: oct }), null);
  // Mois saisi : prime sur la date. Périodicité mensuelle : la période.
  assert.equal(moisDeNote({ type: "Devoir", periode: "T1", mois: "Déc", createdAt: oct }), "Déc");
  assert.equal(moisDeNote({ type: "Devoir", periode: "Nov" }), "Nov");

  // Calcul : octobre (10 oral + 14 écrit = 12) et novembre (écrit 8) → 10.
  const notes = [
    { type: "Interrogation", note: 10, periode: "T1", createdAt: oct },
    { type: "Devoir", note: 14, periode: "T1", createdAt: oct },
    { type: "Devoir", note: 8, periode: "T1", createdAt: nov },
  ];
  assert.equal(getSecondarySubjectAverage(notes), 10);
});

test("notes sans mois d'une période : elles comptent ensemble comme un seul mois", () => {
  const notes = [
    { type: "Devoir", note: 16, periode: "T1", mois: "Oct" },  // Octobre → 16
    { type: "Interrogation", note: 6, periode: "T1" },         // sans mois → (6 + 10) ÷ 2 = 8
    { type: "Devoir", note: 10, periode: "T1" },
  ];
  assert.equal(getSecondarySubjectAverage(notes), 12);
});

test("semestre : le 5e mois saisi au S1 ou au S2 compte dans le semestre choisi", () => {
  const s1 = [
    { type: "Devoir", note: 10, periode: "S1", mois: "Oct" },
    { type: "Devoir", note: 14, periode: "S1", mois: "Fév" },
  ];
  assert.equal(getSecondarySubjectAverage(s1), 12);
  assert.equal(champMois({ type: "Devoir", section: "college", periode: "S2", moisAnnee: OCTOBRE }).choix[0], "Fév");
});

test("primaire : moyenne simple, le mois n'y change rien", () => {
  const notes = [
    { type: "Devoir", note: 8, periode: "T1", mois: "Oct" },
    { type: "Devoir", note: 6, periode: "T1", mois: "Oct" },
    { type: "Interrogation", note: 4, periode: "T1", mois: "Nov" },
  ];
  assert.equal(getSubjectAverage(notes, "", "primaire"), 6);
});

// ── Saisie du mois ──────────────────────────────────────────────────────────

test("champMois / moisAEnregistrer : demandé hors périodicité mensuelle, jamais pour la composition", () => {
  assert.deepEqual(champMois({ type: "Devoir", section: "college", periode: "T2", moisAnnee: OCTOBRE }),
    { avecMois: true, visible: true, choix: ["Jan", "Fév", "Mar"] });
  assert.deepEqual(champMois({ type: "Devoir", section: "college", periode: "Nov", moisAnnee: OCTOBRE }),
    { avecMois: true, visible: false, choix: ["Nov"] });
  assert.deepEqual(champMois({ type: "Composition", section: "college", periode: "T1", moisAnnee: OCTOBRE }),
    { avecMois: false, visible: false, choix: [] });
  assert.equal(champMois({ type: "Devoir", section: "primaire", periode: "T1", moisAnnee: OCTOBRE }).visible, false);

  assert.equal(moisAEnregistrer({ type: "Devoir", section: "college", periode: "T1", mois: "Oct" }), "Oct");
  assert.equal(moisAEnregistrer({ type: "Devoir", section: "college", periode: "Nov", mois: "" }), "Nov");
  assert.equal(moisAEnregistrer({ type: "Composition", section: "college", periode: "T1", mois: "Oct" }), null);
  assert.equal(moisAEnregistrer({ type: "Devoir", section: "primaire", periode: "T1", mois: "Oct" }), null);
});

test("mois par défaut : le mois en cours s'il appartient à la période", () => {
  const le14Nov = new Date(2026, 10, 14);
  assert.equal(moisParDefaut(["Oct", "Nov", "Déc"], le14Nov), "Nov");
  assert.equal(moisParDefaut(["Jan", "Fév", "Mar"], le14Nov), "");
  assert.equal(moisAJour("Oct", ["Oct", "Nov", "Déc"], le14Nov), "Oct");
  assert.equal(moisAJour("Jan", ["Oct", "Nov", "Déc"], le14Nov), "Nov");
  const devoirT1 = { type: "Devoir", section: "college", periode: "T1", moisAnnee: OCTOBRE, maintenant: le14Nov };
  assert.equal(moisSaisi({ ...devoirT1, mois: "" }), "Nov");
  assert.equal(moisSaisi({ ...devoirT1, mois: "Déc" }), "Déc");
  assert.equal(moisSaisi({ ...devoirT1, periode: "T2", mois: "" }), "");
  assert.equal(moisSaisi({ ...devoirT1, type: "Composition", mois: "Oct" }), "");
  assert.equal(moisValide({ ...devoirT1, mois: "Oct" }), true);
  assert.equal(moisValide({ ...devoirT1, mois: "" }), false);
  assert.equal(moisValide({ ...devoirT1, mois: "Jan" }), false);
  assert.equal(moisValide({ ...devoirT1, type: "Composition", mois: "" }), true);
});

test("lireMois : code, nom, numéro ou abréviation non ambiguë", () => {
  assert.equal(lireMois("Oct"), "Oct");
  assert.equal(lireMois("octobre"), "Oct");
  assert.equal(lireMois("FEVRIER"), "Fév");
  assert.equal(lireMois("Fév."), "Fév");
  assert.equal(lireMois("10"), "Oct");
  assert.equal(lireMois(1), "Jan");
  assert.equal(lireMois("sept"), "Sep");
  assert.equal(lireMois("janv"), "Jan");
  assert.equal(lireMois("ju"), "");   // juin ou juillet ?
  assert.equal(lireMois("13"), "");
  assert.equal(lireMois(""), "");
  assert.equal(lireMois(undefined), "");
});

test("moisImporte : mois exigé et dans la période pour les oraux et les écrits", () => {
  const base = { section: "college", moisAnnee: OCTOBRE };
  assert.deepEqual(moisImporte({ ...base, type: "Devoir", periode: "T1", valeur: "Novembre" }), { mois: "Nov", erreur: "" });
  assert.deepEqual(moisImporte({ ...base, type: "Devoir", periode: "T1", valeur: "" }), { mois: null, erreur: "manquant" });
  assert.deepEqual(moisImporte({ ...base, type: "Devoir", periode: "T1", valeur: "Mars" }), { mois: "Mar", erreur: "horsPeriode" });
  assert.deepEqual(moisImporte({ ...base, type: "Composition", periode: "T1", valeur: "" }), { mois: null, erreur: "" });
  assert.deepEqual(moisImporte({ ...base, type: "Devoir", periode: "Nov", valeur: "" }), { mois: "Nov", erreur: "" });
  assert.deepEqual(moisImporte({ ...base, section: "primaire", type: "Devoir", periode: "T1", valeur: "" }), { mois: null, erreur: "" });
});

test("colonnes de périodes : une par mois pour une forme à mois (jeton « T1:Oct »)", () => {
  assert.equal(jetonPeriode("T1", "Oct"), "T1:Oct");
  assert.equal(jetonPeriode("T1", ""), "T1");
  assert.deepEqual(lireJetonPeriode("T1:Oct"), { periode: "T1", mois: "Oct" });
  assert.deepEqual(lireJetonPeriode("T1"), { periode: "T1", mois: "" });
  assert.deepEqual(colonnesPeriodes(["T1", "T2"], { avecMois: false, moisAnnee: OCTOBRE }).map((c) => c.jeton), ["T1", "T2"]);
  assert.deepEqual(colonnesPeriodes(["T1"], { avecMois: true, moisAnnee: OCTOBRE }).map((c) => c.jeton),
    ["T1:Oct", "T1:Nov", "T1:Déc"]);
  // Périodicité mensuelle : la période est déjà le mois.
  assert.deepEqual(colonnesPeriodes(["Oct", "Nov"], { avecMois: true, moisAnnee: OCTOBRE }).map((c) => c.jeton), ["Oct", "Nov"]);
});

// ── Grille du portail enseignant ────────────────────────────────────────────

const utilisateur = { section: "secondaire" };
const eleves = [{ _id: "e1", nom: "Eleve", prenom: "Un", classe: "7ème" }, { _id: "e2", nom: "Eleve", prenom: "Deux", classe: "7ème" }];
const mesNotes = [
  { _id: "n1", eleveId: "e1", periode: "T1", type: "Devoir", mois: "Oct", note: 12 },
  { _id: "n2", eleveId: "e1", periode: "T1", type: "Devoir", mois: "Nov", note: 15 },
];

test("grille, période figée : préremplit et collecte le mois choisi", () => {
  const grille = construireGrille({
    classe: "7ème", type: "Devoir", periode: "T1", mois: "Nov", moisAnnee: OCTOBRE,
    eleves, mesNotes, schoolInfo: {}, utilisateur,
  });
  assert.equal(grille.e1, "15"); // la note de novembre, pas celle d'octobre
  assert.equal(grille.e2, "");

  const { aSauver } = collectGridNotes({
    gridForm: { type: "Devoir", periode: "T1", mois: "Nov", notes: { ...grille, e1: "16", e2: "9" }, initiales: grille },
    mesNotes, schoolInfo: {}, utilisateur, moisAnnee: OCTOBRE,
  });
  const parEleve = Object.fromEntries(aSauver.map((x) => [x.eleveId, x]));
  assert.equal(parEleve.e1.noteId, "n2");
  assert.equal(parEleve.e1.mois, "Nov");
  assert.equal(parEleve.e2.noteId, "");
  assert.equal(parEleve.e2.mois, "Nov");
  assert.equal(validateGridNotes(aSauver, 20), null);
});

test("grille, période figée sans mois choisi : rien ne se préremplit, l'enregistrement est refusé", () => {
  const grille = construireGrille({
    classe: "7ème", type: "Devoir", periode: "T1", mois: "", moisAnnee: OCTOBRE,
    eleves, mesNotes, schoolInfo: {}, utilisateur,
  });
  assert.equal(grille.e1, "");
  const { aSauver } = collectGridNotes({
    gridForm: { type: "Devoir", periode: "T1", mois: "", notes: { e1: "11" } },
    mesNotes, schoolInfo: {}, utilisateur, moisAnnee: OCTOBRE,
  });
  assert.equal(aSauver[0].moisManquant, true);
  assert.equal(aSauver[0].noteId, "");
  assert.match(validateGridNotes(aSauver, 20), /mois/i);
});

test("grille, toutes les périodes : une colonne par mois, mois tiré du jeton", () => {
  const grille = construireGrille({
    classe: "7ème", type: "Devoir", periodes: ["T1", "T2"], multiPeriode: true, moisAnnee: OCTOBRE,
    eleves, mesNotes, schoolInfo: {}, utilisateur,
  });
  assert.equal(grille["e1|T1:Oct"], "12");
  assert.equal(grille["e1|T1:Nov"], "15");
  assert.equal(grille["e1|T2:Jan"], "");
  assert.equal(Object.keys(grille).filter((k) => k.startsWith("e1|")).length, 6);

  const { aSauver } = collectGridNotes({
    gridForm: { type: "Devoir", multiPeriode: true, notes: { "e1|T1:Oct": "13", "e2|T2:Fév": "10" } },
    mesNotes, schoolInfo: {}, utilisateur, moisAnnee: OCTOBRE,
  });
  const parCle = Object.fromEntries(aSauver.map((x) => [`${x.eleveId}|${x.periode}|${x.mois}`, x]));
  assert.equal(parCle["e1|T1|Oct"].noteId, "n1");
  assert.equal(parCle["e2|T2|Fév"].noteId, "");
  assert.equal(validateGridNotes(aSauver, 20), null);
});

test("grille, composition : ni mois ni colonne par mois (inchangé)", () => {
  const grille = construireGrille({
    classe: "7ème", type: "Composition", periodes: ["T1", "T2"], multiPeriode: true, moisAnnee: OCTOBRE,
    eleves, mesNotes: [], schoolInfo: {}, utilisateur,
  });
  assert.deepEqual(Object.keys(grille).sort(), ["e1|T1", "e1|T2", "e2|T1", "e2|T2"]);
  const { aSauver } = collectGridNotes({
    gridForm: { type: "Composition", periode: "T1", notes: { e1: "14" } },
    mesNotes: [], schoolInfo: {}, utilisateur, moisAnnee: OCTOBRE,
  });
  assert.equal(aSauver[0].mois, null);
  assert.equal(aSauver[0].moisManquant, false);
});

test("brouillon de grille : le mois distingue les brouillons, clé d'avant inchangée sans mois", () => {
  const ctx = { ownerId: "p1", classe: "7ème", type: "Devoir", periode: "T1", matiere: "Maths" };
  assert.notEqual(draftKey({ ...ctx, mois: "Oct" }), draftKey({ ...ctx, mois: "Nov" }));
  assert.equal(draftKey({ ...ctx, mois: "" }), draftKey(ctx));
  assert.equal(draftKey({ ...ctx, mois: "Oct", multiPeriode: true }), draftKey({ ...ctx, multiPeriode: true }));
});
