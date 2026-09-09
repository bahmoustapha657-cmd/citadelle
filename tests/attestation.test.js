import assert from "node:assert/strict";
import test from "node:test";
import {
  anneePrecedente, formatMoyenneAnnuelle, getMoyenneAnnuelleEleve, getMoyenneAttestation,
} from "../src/reports/attestation/attestation-moyenne.js";
import { signataireIdentite, signataireSection } from "../src/reports/print-helpers.js";
import { anneeScolaireDeDate } from "../src/constants.js";

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
const imprimerDansUneFenetre = async (eleveTest, anneeTest = "2025-2026") => {
  let html = "";
  globalThis.window = { open: () => ({ document: { write: (s) => { html += s; }, close: () => {} } }) };
  const { imprimerAttestation } = await import("../src/reports/attestation.js");
  await imprimerAttestation(eleveTest, "college", anneeTest, { nom: "La Citadelle", ville: "Conakry" });
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

// ── Repli sur l'année écoulée ─────────────────────────────────────────────
const notesAnnee = (valeurFr, valeurMaths) => [
  note("Français", "Trimestre 1", valeurFr), note("Français", "Trimestre 2", valeurFr),
  note("Français", "Trimestre 3", valeurFr), note("Maths", "Trimestre 1", valeurMaths),
  note("Maths", "Trimestre 2", valeurMaths), note("Maths", "Trimestre 3", valeurMaths),
];
const contexteMoyenne = { eleve, matieres, periodes, niveau: "college", annee: "2026-2027" };

test("anneePrecedente recule d'une année scolaire, et refuse ce qu'elle ne comprend pas", () => {
  assert.equal(anneePrecedente("2026-2027"), "2025-2026");
  assert.equal(anneePrecedente("2025-2026"), "2024-2025");
  assert.equal(anneePrecedente(""), "");
  assert.equal(anneePrecedente("2026"), "");
  assert.equal(anneePrecedente(undefined), "");
});

test("rentrée sans notes : la moyenne de l'année écoulée est imprimée, datée de SON année", () => {
  const resultat = getMoyenneAttestation({
    ...contexteMoyenne, notes: [], notesPrecedentes: notesAnnee(15, 15),
  });

  assert.equal(formatMoyenneAnnuelle(resultat.moyenne, 20), "15,00/20");
  // Le document doit annoncer 2025-2026, pas l'année en cours : sinon le
  // lecteur croit à une moyenne déjà acquise cette année.
  assert.equal(resultat.annee, "2025-2026");
});

test("dès que l'année en cours porte des notes, elle prime sur l'année écoulée", () => {
  const resultat = getMoyenneAttestation({
    ...contexteMoyenne, notes: notesAnnee(11, 11), notesPrecedentes: notesAnnee(18, 18),
  });

  assert.equal(formatMoyenneAnnuelle(resultat.moyenne, 20), "11,00/20");
  assert.equal(resultat.annee, "2026-2027");
});

test("aucune note nulle part : ni moyenne ni année, la rubrique disparaît", () => {
  const resultat = getMoyenneAttestation({ ...contexteMoyenne, notes: [], notesPrecedentes: [] });

  assert.equal(resultat.moyenne, null);
  assert.equal(resultat.annee, "");
  assert.equal(formatMoyenneAnnuelle(resultat.moyenne, 20), "");
});

// ── Signataire : nom + vrai poste ─────────────────────────────────────────
const ecoleAvecPostes = {
  nom: "La Citadelle",
  responsables: { college: "Djiba Oury Diallo", direction: "Mamadou Lamarana Diallo" },
  roleSettings: { college: { label: "La Principale" }, direction: { label: "Le Proviseur" } },
};

test("le signataire d'une section porte son nom et le libellé que l'école a donné au poste", () => {
  const s = signataireIdentite(ecoleAvecPostes, "college", "Direction");

  assert.equal(s.nom, "Djiba Oury Diallo");
  assert.equal(s.titre, "La Principale");
  // Le bloc de signature en bas de page dit la même chose que la formule.
  assert.ok(signataireSection(ecoleAvecPostes, "college", "Direction").includes("Djiba Oury Diallo"));
  assert.ok(signataireSection(ecoleAvecPostes, "college", "Direction").includes("La Principale"));
});

test("section sans responsable : repli sur la direction, avec SON libellé", () => {
  const s = signataireIdentite(ecoleAvecPostes, "primaire", "Direction");

  assert.equal(s.nom, "Mamadou Lamarana Diallo");
  assert.equal(s.titre, "Le Proviseur");
});

test("aucun responsable désigné : titre générique et pas de nom inventé", () => {
  const s = signataireIdentite({ nom: "École X" }, "college", "Direction");

  assert.equal(s.nom, "");
  assert.equal(s.titre, "Direction");
});

// ── Ce que la formule certifie exactement ─────────────────────────────────
// L'année scolaire est celle de l'ÉCRAN d'où l'on imprime : elle ne dit rien
// de la scolarité d'un élève déjà parti.
const ANNEE_ECRAN = "2026-2027";

test("élève parti : la formule certifie la PÉRIODE, pas l'année scolaire en cours", async () => {
  // Arrivé en septembre 2025, parti en février 2026 : il n'a jamais été
  // inscrit en 2026-2027.
  const html = await imprimerDansUneFenetre(
    { ...eleve, statut: "Transféré", dateArrivee: "2025-09-12", dateDepart: "2026-02-14" },
    ANNEE_ECRAN,
  );

  assert.ok(html.includes("du <strong>12/09/2025</strong> au <strong>14/02/2026</strong>"));
  assert.ok(!html.includes("<strong>2026-2027</strong>"));
});

test("départ sans date d'arrivée : la formule s'arrête à la date connue", async () => {
  const html = await imprimerDansUneFenetre(
    { ...eleve, statut: "Exclu", dateDepart: "2026-02-14" }, ANNEE_ECRAN,
  );

  assert.ok(html.includes("jusqu'au <strong>14/02/2026</strong>"));
  assert.ok(!html.includes("<strong>2026-2027</strong>"));
});

test("statut de sortie sans aucune date : passé, et repli sur l'année scolaire", async () => {
  // La date de départ est facultative : un « Transféré » sans date reste un
  // élève parti, on ne peut pas le certifier inscrit aujourd'hui.
  const html = await imprimerDansUneFenetre({ ...eleve, statut: "Transféré" }, ANNEE_ECRAN);

  assert.ok(html.includes("a été régulièrement inscrit(e)"));
  assert.ok(html.includes("<strong>2026-2027</strong>"));
});

test("élève présent : rien ne change, l'année scolaire fait foi", async () => {
  const html = await imprimerDansUneFenetre({ ...eleve, dateArrivee: "2025-09-12" }, ANNEE_ECRAN);

  assert.ok(html.includes("est régulièrement inscrit(e)"));
  assert.ok(html.includes("<strong>2026-2027</strong>"));
  // La date d'arrivée reste dans l'encadré, sans contaminer la formule.
  assert.ok(html.includes("Date d'arrivée"));
});

// ── Année certifiée : numéro de pièce et QR ───────────────────────────────
test("anneeScolaireDeDate : septembre ouvre l'année, et les deux formats de date passent", () => {
  assert.equal(anneeScolaireDeDate("2026-02-14"), "2025-2026");  // février : année qui s'achève
  assert.equal(anneeScolaireDeDate("2025-09-12"), "2025-2026");  // septembre : année qui s'ouvre
  assert.equal(anneeScolaireDeDate("2025-08-31"), "2024-2025");  // août : encore l'année d'avant
  assert.equal(anneeScolaireDeDate("14/02/2026"), "2025-2026");  // import Excel
  assert.equal(anneeScolaireDeDate("hier"), "");
  assert.equal(anneeScolaireDeDate(""), "");
});

test("élève parti : le numéro de pièce porte l'année du DÉPART, pas celle de l'écran", async () => {
  const html = await imprimerDansUneFenetre(
    { ...eleve, statut: "Transféré", dateArrivee: "2025-09-12", dateDepart: "2026-02-14" },
    ANNEE_ECRAN,
  );

  // Départ en février 2026 → année scolaire 2025-2026 → millésime « 25 ».
  assert.ok(html.includes("ATT-LAC-25-M-042"));
  assert.ok(!html.includes("ATT-LAC-26-"));
});

test("élève présent : le numéro suit l'année en cours", async () => {
  const html = await imprimerDansUneFenetre({ ...eleve, dateArrivee: "2023-09-12" }, ANNEE_ECRAN);
  assert.ok(html.includes("ATT-LAC-26-M-042"));
});

test("élève présent avec date d'arrivée : la formule porte son ancienneté", async () => {
  const html = await imprimerDansUneFenetre({ ...eleve, dateArrivee: "2023-09-12" }, ANNEE_ECRAN);

  assert.ok(html.includes("depuis le <strong>12/09/2023</strong>"));
  assert.ok(html.includes("<strong>2026-2027</strong>"));
  assert.ok(html.includes("est régulièrement inscrit(e)"));
});

test("élève présent sans date d'arrivée : formule inchangée, aucune ancienneté inventée", async () => {
  const html = await imprimerDansUneFenetre({ ...eleve }, ANNEE_ECRAN);

  assert.ok(!html.includes("depuis le"));
  assert.ok(html.includes("est régulièrement inscrit(e)"));
  assert.ok(html.includes("<strong>2026-2027</strong>"));
});
