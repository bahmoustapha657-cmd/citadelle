import assert from "node:assert/strict";
import test from "node:test";
import {
  anneePrecedente, formatMoyenneAnnuelle, getMoyenneAnnuelleEleve, getResultatsAttestation,
} from "../src/reports/attestation/attestation-moyenne.js";
import { identiteHTML, signatairesDocument } from "../src/reports/signatures.js";
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
  assert.ok(html.includes("<b>12,33</b><em>/20</em>"));
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

// ── Résultats : moyenne de chaque période + moyenne annuelle ──────────────
const moyennes = (resultats) => resultats.periodes.map((p) => formatMoyenneAnnuelle(p.moy, 20) || "—");

test("dernière classe connue : les résultats de SON année, même si l'année en cours a des notes", () => {
  const resultats = getResultatsAttestation({
    ...contexteMoyenne, derniere: { classe: "5ème A", annee: "2025-2026" },
    notes: notesAnnee(11, 11), notesPrecedentes: notesAnnee(15, 12),
  });
  assert.equal(resultats.annee, "2025-2026");
  assert.equal(resultats.classe, "5ème A");
  assert.deepEqual(resultats.periodes.map((p) => p.periode), periodes);
  assert.deepEqual(moyennes(resultats), ["14,00/20", "14,00/20", "14,00/20"]);
  assert.equal(formatMoyenneAnnuelle(resultats.annuelle, 20), "14,00/20");
});

test("année achevée : la moyenne annuelle suit la règle du bulletin, même avec une période vide", () => {
  const sansT1 = notesAnnee(15, 12).filter((n) => n.periode !== "Trimestre 1");
  const resultats = getResultatsAttestation({
    ...contexteMoyenne, derniere: { classe: "5ème A", annee: "2025-2026" }, notes: [], notesPrecedentes: sansT1,
  });
  assert.deepEqual(moyennes(resultats), ["—", "14,00/20", "14,00/20"]);
  assert.ok(resultats.annuelle != null);
});

test("année en cours entamée : les périodes notées, sans moyenne annuelle au rabais", () => {
  const t1 = notesAnnee(11, 11).filter((n) => n.periode === "Trimestre 1");
  const resultats = getResultatsAttestation({ ...contexteMoyenne, notes: t1, notesPrecedentes: [] });
  assert.equal(resultats.annee, "2026-2027");
  assert.deepEqual(moyennes(resultats), ["11,00/20", "—", "—"]);
  assert.equal(resultats.annuelle, null);
  // Toutes les périodes notées : la moyenne annuelle revient.
  const complete = getResultatsAttestation({ ...contexteMoyenne, notes: notesAnnee(11, 11), notesPrecedentes: notesAnnee(18, 18) });
  assert.equal(complete.annee, "2026-2027");
  assert.equal(formatMoyenneAnnuelle(complete.annuelle, 20), "11,00/20");
});

test("rentrée sans notes ni classe archivée : l'année écoulée, datée de SON année", () => {
  const resultats = getResultatsAttestation({ ...contexteMoyenne, notes: [], notesPrecedentes: notesAnnee(15, 15) });
  assert.equal(resultats.annee, "2025-2026");
  assert.equal(formatMoyenneAnnuelle(resultats.annuelle, 20), "15,00/20");
});

test("les matières sont celles de la classe de l'année imprimée", () => {
  const demandees = [];
  const matieresForClasse = (classe) => { demandees.push(classe); return classe === "5ème A" ? [matieres[0]] : matieres; };
  const resultats = getResultatsAttestation({
    ...contexteMoyenne, matieresForClasse, derniere: { classe: "5ème A", annee: "2025-2026" },
    notes: [], notesPrecedentes: notesAnnee(15, 9),
  });
  assert.deepEqual(demandees, ["5ème A"]);
  // Français seul : 15, les Maths de la 6ème n'entrent pas dans le calcul.
  assert.equal(formatMoyenneAnnuelle(resultats.annuelle, 20), "15,00/20");
});

test("rien à montrer : pas d'encadré", () => {
  assert.equal(getResultatsAttestation({ ...contexteMoyenne, notes: [], notesPrecedentes: [] }), null);
  // Année de la dernière classe non chargée (ni l'écran ni la précédente).
  assert.equal(getResultatsAttestation({
    ...contexteMoyenne, derniere: { classe: "4ème A", annee: "2023-2024" }, notes: notesAnnee(11, 11), notesPrecedentes: notesAnnee(15, 15),
  }), null);
  assert.equal(getResultatsAttestation({ ...contexteMoyenne, periodes: [], notes: notesAnnee(11, 11) }), null);
  assert.equal(getResultatsAttestation(), null);
});

test("le document : 9ème (2025-2026) pour un promu parti, ses trimestres et sa moyenne annuelle en gros", async () => {
  let html = "";
  globalThis.window = { open: () => ({ document: { write: (s) => { html += s; }, close: () => {} } }) };
  const { imprimerAttestation } = await import("../src/reports/attestation.js");
  const parti = {
    ...eleve, classe: "10ème A", statut: "Transféré", dateDepart: "2026-11-10",
    historique: { "2025-2026": { classe: "9ème A", clotureLe: "2026-07-02" } },
  };
  const trimestres = ["T1", "T2", "T3"];
  const notesT = (valeur) => trimestres.flatMap((p) => [note("Français", p, valeur), note("Maths", p, valeur)]);
  await imprimerAttestation(parti, "college", "2026-2027", { nom: "La Citadelle", ville: "Conakry" },
    { notes: notesT(8).filter((n) => n.periode === "T1"), notesPrecedentes: notesT(13), matieres, periodes: trimestres, maxNote: 20 });

  assert.ok(html.includes("9ème A (2025-2026)"));
  assert.ok(!html.includes("10ème A"));
  assert.ok(html.includes("Résultats de l'année scolaire 2025-2026"));
  for (const libelle of ["1er trimestre", "2ème trimestre", "3ème trimestre"]) assert.ok(html.includes(libelle), libelle);
  assert.ok(html.includes("<b>13,00</b><em>/20</em>"));
  // La moyenne annuelle, en gros, dans le médaillon.
  assert.match(html, /res-med">[\s\S]*?Moyenne annuelle<\/small><b>13,00<\/b>/);
  // La 10ème entamée (8/20 au 1er trimestre) n'apparaît nulle part.
  assert.ok(!html.includes("8,00"));
});

test("modèle en semestres : deux cases, 1er et 2ème semestre", async () => {
  let html = "";
  globalThis.window = { open: () => ({ document: { write: (s) => { html += s; }, close: () => {} } }) };
  const { imprimerAttestation } = await import("../src/reports/attestation.js");
  const semestres = ["S1", "S2"];
  const notesS = semestres.flatMap((p) => [note("Français", p, 12), note("Maths", p, 12)]);
  await imprimerAttestation(eleve, "lycee", "2025-2026", { nom: "La Citadelle" },
    { notes: notesS, matieres, periodes: semestres, maxNote: 20 });
  assert.ok(html.includes("1er semestre") && html.includes("2ème semestre"));
  assert.ok(!html.includes("trimestre"));
  // Deux semestres sur la bande, puis le médaillon de la moyenne annuelle.
  assert.ok(html.includes("grid-template-columns:repeat(2,1fr)"));
  assert.match(html, /res-med">[\s\S]*?Moyenne annuelle<\/small><b>12,00<\/b>/);
});

// ── Deux modèles : Diplôme (défaut) et Sobre ──────────────────────────────
const imprimerModele = async (modele) => {
  let html = "";
  globalThis.window = { open: () => ({ document: { write: (s) => { html += s; }, close: () => {} } }) };
  const { imprimerAttestation } = await import("../src/reports/attestation.js");
  const trimestres = ["T1", "T2", "T3"];
  const notesT = trimestres.flatMap((p) => [note("Français", p, 14), note("Maths", p, 11)]);
  await imprimerAttestation(eleve, "college", "2025-2026", { nom: "La Citadelle", ville: "Conakry" },
    { notes: notesT, matieres, periodes: trimestres, maxNote: 20, ...(modele ? { modele } : {}) });
  return html;
};

test("modèle Diplôme par défaut : cadre guilloché, laurier, médaillon, ajustement à la page", async () => {
  const html = await imprimerModele();
  assert.ok(html.includes('class="page att"'));
  assert.ok(html.includes('class="cadre"'));      // cadre guilloché
  assert.ok(html.includes('class="laurier"'));    // emblème dans son laurier
  assert.ok(html.includes('class="medaillon"'));  // moyenne annuelle
  assert.ok(html.includes(".page.att .ajustable")); // jamais de seconde feuille
  assert.ok(html.includes("<b>13,00</b><em>/20</em>"));
  // Inconnu : on retombe sur le modèle par défaut.
  assert.ok((await imprimerModele("inconnu")).includes('class="page att"'));
});

test("modèle Sobre : la mise en page d'origine, avec les mêmes résultats", async () => {
  const html = await imprimerModele("sobre");
  assert.ok(html.includes('class="feuille"'));
  assert.ok(!html.includes('class="page att"'));
  assert.ok(html.includes("1er trimestre") && html.includes("3ème trimestre"));
  assert.ok(html.includes("13,00<small>/20</small>"));
  assert.ok(html.includes("grid-template-columns:repeat(3,1fr) 1.45fr"));
  assert.equal(html.split("Je soussigné(e)").length - 1, 1);
});

// ── Signataire : nom + vrai poste ─────────────────────────────────────────
const ecoleAvecPostes = {
  nom: "La Citadelle",
  responsables: { college: "Djiba Oury Diallo", direction: "Mamadou Lamarana Diallo" },
  roleSettings: { college: { label: "La Principale" }, direction: { label: "Le Proviseur" } },
};

const signataireAttestation = (schoolInfo, section) =>
  signatairesDocument(schoolInfo, "attestation", { section })[0];

test("le signataire d'une section porte son nom et le libellé que l'école a donné au poste", () => {
  const s = signataireAttestation(ecoleAvecPostes, "college");

  assert.equal(s.nom, "Djiba Oury Diallo");
  assert.equal(s.titre, "La Principale");
  // Le bloc de signature en bas de page dit la même chose que la formule.
  assert.ok(identiteHTML(s).includes("Djiba Oury Diallo"));
  assert.ok(identiteHTML(s).includes("La Principale"));
});

test("section sans responsable : la section signe, sans nom emprunté au DG", () => {
  // Autrefois le DG prenait la place — nom ET titre (« Le Proviseur ») — du chef
  // d'une section sans responsable : l'attestation certifiait sous sa signature.
  const s = signataireAttestation(ecoleAvecPostes, "primaire");

  assert.equal(s.cle, "primaire");
  assert.equal(s.nom, "");
  assert.equal(s.titre, "Direction");
});

test("aucun responsable désigné : titre générique et pas de nom inventé", () => {
  const s = signataireAttestation({ nom: "École X" }, "college");

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

// ── Couleurs de l'école ───────────────────────────────────────────────────
const imprimerAvecEcole = async (schoolInfoTest) => {
  let html = "";
  globalThis.window = { open: () => ({ document: { write: (s) => { html += s; }, close: () => {} } }) };
  const { imprimerAttestation } = await import("../src/reports/attestation.js");
  await imprimerAttestation(eleve, "college", "2025-2026", schoolInfoTest);
  return html;
};

test("le document prend les couleurs de l'école, comme les bulletins", async () => {
  const html = await imprimerAvecEcole({
    nom: "La Citadelle", ville: "Conakry", couleur1: "#7B1E3A", couleur2: "#C9A227",
  });

  assert.ok(html.includes("#7B1E3A"));
  assert.ok(html.includes("#C9A227"));
  // Filet et lavis de l'encadré dérivent de la couleur principale.
  assert.ok(html.includes("#7B1E3A33"));
  assert.ok(html.includes("#7B1E3A0a"));
  // Le corps du document ne porte plus la charte EduGest. Seul l'en-tête
  // officiel (enteteDoc, partagé avec les bulletins, les fiches de
  // compositions et l'emploi du temps) garde son bleu marine figé : le
  // changer déborderait sur ces documents-là.
  const styles = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
  assert.ok(!styles.includes("#0A1628"));
  assert.ok(!styles.includes("#00C48C"));
});

test("école sans couleurs définies : rendu d'origine inchangé", async () => {
  const html = await imprimerAvecEcole({ nom: "La Citadelle", ville: "Conakry" });

  assert.ok(html.includes("#0A1628"));
  assert.ok(html.includes("#00C48C"));
});
