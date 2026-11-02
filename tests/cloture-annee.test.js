import assert from "node:assert/strict";
import test from "node:test";
import { MOIS_ANNEE } from "../src/constants.js";
import {
  classePourAnnee,
  elevesDeLAnnee,
  champsCloture,
  horsAnneeCloturee,
  scolaritePourAnnee,
} from "../src/components/admin/cloture-annee-utils.js";

const ANNEE = "2025-2026";

// Eleve de fin d'annee : scolarite encaissee, classe en cours.
const eleveType = () => ({
  classe: "4ème Année A",
  statut: "Actif",
  mens: { Octobre: "Payé", Novembre: "Payé" },
  inscriptionPayee: true,
  fraisPayes: { Tenue: 50000 },
});

test("cloture : archive la classe et remet la scolarite a zero", () => {
  const champs = champsCloture(eleveType(), ANNEE);
  assert.equal(champs.historique[ANNEE].classe, "4ème Année A");
  assert.ok(champs.historique[ANNEE].clotureLe, "l'instantane doit porter clotureLe");
  assert.equal(champs.inscriptionPayee, false);
  assert.deepEqual(champs.fraisPayes, {});
  assert.equal(champs.typeInscription, "Réinscription");
});

test("cloture : ne rejoue rien sur une annee DEJA CLOTUREE", () => {
  const eleve = { ...eleveType(), historique: { [ANNEE]: { classe: "4ème Année A", clotureLe: "2026-07-01T00:00:00.000Z" } } };
  assert.equal(champsCloture(eleve, ANNEE), null,
    "une seconde cloture effacerait les encaissements de l'annee neuve");
});

// LE PIEGE : promouvoir AVANT de cloturer. La promotion fige la classe
// (archiveLe) sans toucher aux compteurs. Si la cloture prenait cet instantane
// pour le sien, elle sauterait l'eleve et l'annee neuve demarrerait avec les
// paiements de l'ancienne.
test("cloture apres une promotion : garde la classe figee ET remet a zero", () => {
  const promu = {
    ...eleveType(),
    classe: "5ème Année A", // la promotion l'a deja deplace
    historique: { [ANNEE]: { classe: "4ème Année A", archiveLe: "2026-06-30T00:00:00.000Z" } },
  };
  const champs = champsCloture(promu, ANNEE);
  assert.ok(champs, "la cloture ne doit PAS sauter l'eleve");
  assert.equal(champs.historique[ANNEE].classe, "4ème Année A",
    "la classe de l'annee reste celle d'AVANT le deplacement");
  assert.ok(champs.historique[ANNEE].clotureLe);
  assert.equal(champs.historique[ANNEE].archiveLe, "2026-06-30T00:00:00.000Z",
    "la trace de la promotion est conservee");
  assert.equal(champs.inscriptionPayee, false, "les compteurs doivent bien repartir a zero");
  assert.deepEqual(champs.fraisPayes, {});
});

test("lecture d'une annee passee : la classe archivee prime", () => {
  const eleve = {
    classe: "5ème Année A",
    historique: { [ANNEE]: { classe: "4ème Année A", clotureLe: "x" } },
  };
  assert.equal(scolaritePourAnnee(eleve, ANNEE, "2026-2027").classe, "4ème Année A");
  // Annee courante : c'est la fiche vivante qui fait foi.
  assert.equal(scolaritePourAnnee(eleve, "2026-2027", "2026-2027").classe, "5ème Année A");
});

// C'est la reponse a « quelle classe, cette annee-la ? ». Elle vient des
// DONNEES, sans dependre d'un etat d'ecran : le mode archive compare l'annee
// consultee a l'annee courante, et les deux se confondent des qu'on revient
// sur une annee close — le mode s'eteignait alors au moment ou il servait.
test("classePourAnnee : l instantane fait autorite sur la fiche du jour", () => {
  const promu = {
    classe: "4ème Année A", // la promotion l'a deja avance
    historique: { [ANNEE]: { classe: "3ème Année A", clotureLe: "x" } },
  };
  assert.equal(classePourAnnee(promu, ANNEE), "3ème Année A");
  // Annee sans instantane : la fiche du jour, faute de mieux.
  assert.equal(classePourAnnee(promu, "2026-2027"), "4ème Année A");
  assert.equal(classePourAnnee(promu, ""), "4ème Année A");
});

test("classePourAnnee : tolere une fiche vide", () => {
  assert.equal(classePourAnnee({}, ANNEE), "");
  assert.equal(classePourAnnee({ historique: { [ANNEE]: {} } }, ANNEE), "");
});

// Un élève parti avant la rentrée de l'année clôturée n'a rien à y archiver :
// sans cette règle, chaque clôture lui ajoutait une année vide à l'historique
// et neuf mois « Impayé » de plus.
test("cloture : laisse tel quel l'élève parti avant l'année, archive celui parti pendant", () => {
  const avantLaRentree = { ...eleveType(), statut: "Transféré", dateDepart: "2025-09-15",
    mens: { Oct: "Impayé" }, inscriptionPayee: false, fraisPayes: {} };
  assert.equal(horsAnneeCloturee(avantLaRentree, ANNEE), true);
  // Même départ, mais une inscription encaissée : elle doit rejoindre l'archive.
  assert.equal(horsAnneeCloturee({ ...avantLaRentree, inscriptionPayee: true }, ANNEE), false);
  // Parti en cours d'année : archivé comme les autres.
  assert.equal(horsAnneeCloturee({ ...avantLaRentree, dateDepart: "2026-02-14" }, ANNEE), false);
  // Parti les années précédentes : rien non plus.
  assert.equal(horsAnneeCloturee({ ...avantLaRentree, dateDepart: "2024-03-01" }, ANNEE), true);
  // Présent, ou parti sans date connue : archivé.
  assert.equal(horsAnneeCloturee(eleveType(), ANNEE), false);
  assert.equal(horsAnneeCloturee({ ...avantLaRentree, dateDepart: "" }, ANNEE), false);
});

// Archive d'une année : chaque élève dans la section et la classe qu'il avait
// CETTE année-là, avec le statut qu'il avait alors.
test("elevesDeLAnnee : section, classe et statut de l'année consultée", () => {
  const snap = (classe) => ({ historique: { [ANNEE]: { classe, clotureLe: "x" } } });
  const eleves = [
    // Grande Section en 2025-2026, au primaire aujourd'hui.
    { _id: "gs", section: "primaire", classe: "1ère Année A", statut: "Actif", ...snap("Grande Section A") },
    // 6ème Année (primaire) en 2025-2026, au collège aujourd'hui.
    { _id: "six", section: "college", classe: "7ème Année A", statut: "Actif", ...snap("6ème Année A") },
    // Parti en novembre 2026 : élève normal en 2025-2026.
    { _id: "parti-apres", section: "primaire", classe: "3ème Année A", statut: "Transféré", dateDepart: "2026-11-15", motifDepart: "Déménagement", ...snap("2ème Année A") },
    // Parti en mars 2026 : parti PENDANT l'année consultée.
    { _id: "parti-pendant", section: "primaire", classe: "2ème Année A", statut: "Abandonné", dateDepart: "2026-03-10", ...snap("2ème Année A") },
    // Inscrit en 2026-2027 : absent de l'archive 2025-2026.
    { _id: "nouveau", section: "primaire", classe: "2ème Année A", statut: "Actif" },
  ];
  const primaire = elevesDeLAnnee(eleves, ANNEE, "primaire", { moisAnnee: MOIS_ANNEE });
  assert.deepEqual(primaire.map((e) => e._id), ["six", "parti-apres", "parti-pendant"]);
  const six = primaire.find((e) => e._id === "six");
  assert.equal(six.classe, "6ème Année A");
  assert.equal(six.section, "primaire");
  const apres = primaire.find((e) => e._id === "parti-apres");
  assert.equal(apres.statut, "Actif", "parti l'année suivante : élève comme les autres");
  assert.equal(apres.dateDepart, null);
  assert.equal(apres.motifDepart, null);
  assert.equal(primaire.find((e) => e._id === "parti-pendant").statut, "Abandonné");
  const prescolaire = elevesDeLAnnee(eleves, ANNEE, "prescolaire", { moisAnnee: MOIS_ANNEE });
  assert.deepEqual(prescolaire.map((e) => [e._id, e.classe]), [["gs", "Grande Section A"]]);
  // La fiche n'est jamais modifiée.
  assert.equal(eleves[0].classe, "1ère Année A");
  assert.equal(eleves[2].statut, "Transféré");
});

test("elevesDeLAnnee : les classes de la section priment sur le nom", () => {
  const e = { _id: "x", section: "college", classe: "7ème Année A", historique: { [ANNEE]: { classe: "Classe Soleil" } } };
  assert.deepEqual(elevesDeLAnnee([e], ANNEE, "primaire", { classesSection: ["Classe Soleil"] }).map((x) => x._id), ["x"]);
  assert.deepEqual(elevesDeLAnnee([e], ANNEE, "college", { classesSection: [] }).map((x) => x._id), ["x"],
    "nom inconnu : le motif le range au collège, faute de mieux");
});

test("elevesDeLAnnee : année jamais archivée = sections et classes du jour", () => {
  const eleves = [
    { _id: "a", section: "primaire", classe: "2ème Année A" },
    { _id: "b", section: "college", classe: "7ème Année A" },
  ];
  assert.deepEqual(elevesDeLAnnee(eleves, "2024-2025", "primaire").map((e) => [e._id, e.classe]), [["a", "2ème Année A"]]);
});
