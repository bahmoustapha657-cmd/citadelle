import assert from "node:assert/strict";
import test from "node:test";
import { formatMoyenneAnnuelle, getMoyenneAnnuelleEleve } from "../src/reports/attestation/attestation-moyenne.js";

const eleve = {
  _id: "el-1", nom: "DIALLO", prenom: "Aïssatou", matricule: "M-042", ien: "224-2026-118477",
  classe: "6ème A", dateNaissance: "14/03/2013", lieuNaissance: "Labé",
  filiation: "Père : Mamadou Diallo / Mère : Kadiatou Barry",
  tuteur: "Mamadou Diallo", statut: "Actif",
};
const matieres = [{ nom: "Français", coefficient: 4 }, { nom: "Maths", coefficient: 2 }];
const periodes = ["Trimestre 1", "Trimestre 2", "Trimestre 3"];

// Type « Moyenne » : moyenne de matière saisie directement, elle prime et
// ignore le découpage en périodes — le calcul attendu reste lisible ici.
const note = (matiere, periode, valeur) => ({
  eleveId: "el-1", matiere, periode, type: "Moyenne", note: valeur,
});

test("la moyenne annuelle pondère les matières par leur coefficient", () => {
  const notes = [
    note("Français", "Trimestre 1", 12), note("Français", "Trimestre 2", 14), note("Français", "Trimestre 3", 16),
    note("Maths", "Trimestre 1", 9), note("Maths", "Trimestre 2", 9), note("Maths", "Trimestre 3", 9),
  ];

  const moyenne = getMoyenneAnnuelleEleve({ eleve, notes, matieres, periodes, niveau: "college" });

  // Français 14 (coef 4), Maths 9 (coef 2) → (14×4 + 9×2) / 6 = 12,333…
  assert.ok(Math.abs(moyenne - (14 * 4 + 9 * 2) / 6) < 1e-9);
  assert.equal(formatMoyenneAnnuelle(moyenne, 20), "12,33/20");
});

test("un élève sans aucune note n'a pas de moyenne — surtout pas 0", () => {
  // getGeneralAverage seul renverrait 0 (matières sans note comptées 0 au
  // numérateur, coefficient gardé au dénominateur) : l'attestation
  // annoncerait « 0,00/20 » à un élève qui n'a pas encore composé.
  const moyenne = getMoyenneAnnuelleEleve({
    eleve, notes: [note("Français", "Trimestre 1", 12)], matieres, periodes, niveau: "college",
  });
  assert.ok(moyenne > 0);

  const sansNote = getMoyenneAnnuelleEleve({
    eleve, notes: [{ ...note("Français", "Trimestre 1", 12), eleveId: "autre-eleve" }],
    matieres, periodes, niveau: "college",
  });
  assert.equal(sansNote, null);
  assert.equal(formatMoyenneAnnuelle(sansNote, 20), "");
});

test("données incomplètes : pas de moyenne plutôt qu'un chiffre faux", () => {
  const base = { eleve, notes: [note("Français", "Trimestre 1", 12)], matieres, periodes, niveau: "college" };
  assert.equal(getMoyenneAnnuelleEleve({ ...base, notes: [] }), null);
  assert.equal(getMoyenneAnnuelleEleve({ ...base, matieres: [] }), null);
  assert.equal(getMoyenneAnnuelleEleve({ ...base, periodes: [] }), null);
  assert.equal(getMoyenneAnnuelleEleve({ ...base, eleve: {} }), null);
  assert.equal(getMoyenneAnnuelleEleve(), null);
});

test("le document imprimé porte l'identité complète, une seule formule, et ni tuteur ni statut", async () => {
  // imprimerAttestation écrit dans une fenêtre : on en simule une.
  let html = "";
  globalThis.window = { open: () => ({ document: { write: (s) => { html += s; }, close: () => {} } }) };
  const { imprimerAttestation } = await import("../src/reports/attestation.js");

  const notes = [
    note("Français", "Trimestre 1", 12), note("Français", "Trimestre 2", 14), note("Français", "Trimestre 3", 16),
    note("Maths", "Trimestre 1", 9), note("Maths", "Trimestre 2", 9), note("Maths", "Trimestre 3", 9),
  ];
  await imprimerAttestation(eleve, "college", "2025-2026", { nom: "La Citadelle", ville: "Conakry" },
    { notes, matieres, periodes, maxNote: 20 });

  // Champs demandés : IEN, lieu de naissance correctement étiqueté, filiation.
  assert.ok(html.includes("224-2026-118477"));
  assert.ok(html.includes("Lieu de naissance"));
  assert.ok(html.includes("Père : Mamadou Diallo"));
  assert.ok(html.includes("12,33/20"));
  assert.ok(html.includes("ATT-LAC-25-M-042"));   // numéro de pièce déterministe
  assert.ok(html.includes("QR attestation"));      // QR de vérification

  // Champs retirés du document.
  assert.ok(!html.includes("Tuteur"));
  assert.ok(!html.includes("Statut"));

  // La formule administrative n'apparaît qu'UNE fois (elle était imprimée en
  // double : une fois avant l'encadré, une fois après avec l'année).
  assert.equal(html.split("Je soussigné(e)").length - 1, 1);
  assert.equal(html.split("est régulièrement inscrit(e)").length - 1, 1);
});

// ── Dates d'arrivée et de départ ──────────────────────────────────────────
const imprimerDansUneFenetre = async (eleveTest) => {
  let html = "";
  globalThis.window = { open: () => ({ document: { write: (s) => { html += s; }, close: () => {} } }) };
  const { imprimerAttestation } = await import("../src/reports/attestation.js");
  await imprimerAttestation(eleveTest, "college", "2025-2026", { nom: "La Citadelle", ville: "Conakry" });
  return html;
};

test("les dates de scolarité s'impriment en JJ/MM/AAAA, pas en ISO", async () => {
  const html = await imprimerDansUneFenetre({
    ...eleve, dateNaissance: "2013-03-14", dateArrivee: "2025-09-12",
  });

  assert.ok(html.includes("Date d'arrivée"));
  assert.ok(html.includes("12/09/2025"));
  assert.ok(html.includes("14/03/2013"));
  assert.ok(!html.includes("2025-09-12"));
  // Pas de date de départ : la rubrique n'apparaît pas du tout.
  assert.ok(!html.includes("Date de départ"));
});

test("élève parti : la formule passe au passé et la date de départ apparaît", async () => {
  const html = await imprimerDansUneFenetre({
    ...eleve, statut: "Transféré", dateArrivee: "2025-09-12", dateDepart: "2026-02-14",
  });

  assert.ok(html.includes("Date de départ"));
  assert.ok(html.includes("14/02/2026"));
  // Certifier qu'un élève parti « est régulièrement inscrit » serait faux.
  assert.ok(html.includes("a été régulièrement inscrit(e)"));
  assert.ok(!html.includes("est régulièrement inscrit(e)"));
});

test("une date déjà au format local traverse le document inchangée", async () => {
  // Imports Excel et saisies anciennes : on ne réinterprète pas ce qui n'est
  // pas de l'ISO, au risque d'inverser jour et mois.
  const html = await imprimerDansUneFenetre({ ...eleve, dateArrivee: "12/09/2025" });
  assert.ok(html.includes("12/09/2025"));
});
