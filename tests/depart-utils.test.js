import assert from "node:assert/strict";
import test from "node:test";

import { MOIS_ANNEE, estSorti } from "../src/constants.js";
import {
  derniereAnneeFrequentee, elevesPourPeriode, lireDate, moisExigibles, normaliserDepart, partiAvantAnnee,
} from "../src/depart-utils.js";
import {
  concerneParAnnee, countUnpaidMonths, estBloquePourImpaye, getConsecutiveUnpaidMonths,
  getEleveMensualiteSnapshot, getEleveSolde, getMensualiteOverview,
} from "../src/mensualite-utils.js";

// Octobre → Juin, comme calcMoisAnnee("Octobre").
const MOIS = MOIS_ANNEE;
const ANNEE = "2026-2027";
const impayes = () => Object.fromEntries(MOIS.map((m) => [m, "Impayé"]));
const tarifs = [{ classe: "5ème Année A", montant: 100000, inscription: 50000, reinscription: 30000, autre: 10000 }];

test("estSorti : le statut fait foi dès qu'il est renseigné", () => {
  assert.equal(estSorti({ statut: "Transféré" }), true);
  assert.equal(estSorti({ statut: "Abandonné", dateDepart: "2027-02-14" }), true);
  // Repassé Actif avec une date restée sur la fiche : il est présent.
  assert.equal(estSorti({ statut: "Actif", dateDepart: "2026-09-18" }), false);
  assert.equal(estSorti({ statut: "Inactif", dateDepart: "2026-09-18" }), false);
  // Fiche sans statut : la date seule suffit.
  assert.equal(estSorti({ dateDepart: "2026-09-18" }), true);
  assert.equal(estSorti({}), false);
});

test("lireDate lit l'ISO des champs date et le JJ/MM/AAAA des imports, rien d'autre", () => {
  assert.equal(lireDate("2027-02-14").getTime(), new Date(2027, 1, 14).getTime());
  assert.equal(lireDate("14/02/2027").getTime(), new Date(2027, 1, 14).getTime());
  assert.equal(lireDate("31/02/2027"), null);
  assert.equal(lireDate("février"), null);
  assert.equal(lireDate(""), null);
  assert.equal(lireDate(null), null);
});

test("moisExigibles : présent → tous les mois", () => {
  assert.deepEqual(moisExigibles({ statut: "Actif" }, MOIS, ANNEE), MOIS);
  assert.deepEqual(moisExigibles({ statut: "Inactif" }, MOIS, ANNEE), MOIS);
});

test("moisExigibles : parti en cours d'année → les mois entamés, celui du départ compris", () => {
  const parti = { statut: "Abandonné", dateDepart: "2027-02-14" };
  assert.deepEqual(moisExigibles(parti, MOIS, ANNEE), ["Oct", "Nov", "Déc", "Jan", "Fév"]);
  // Parti le 1er : le mois a commencé ce jour-là, il est dû.
  assert.deepEqual(moisExigibles({ statut: "Exclu", dateDepart: "2026-12-01" }, MOIS, ANNEE), ["Oct", "Nov", "Déc"]);
  // Noms longs acceptés aussi.
  assert.deepEqual(moisExigibles(parti, ["Octobre", "Mars"], ANNEE), ["Octobre"]);
});

test("moisExigibles : parti avant la rentrée ou une année plus tôt → rien ; après l'année → tout", () => {
  assert.deepEqual(moisExigibles({ statut: "Transféré", dateDepart: "2026-09-15" }, MOIS, ANNEE), []);
  assert.deepEqual(moisExigibles({ statut: "Transféré", dateDepart: "2026-03-10" }, MOIS, ANNEE), []);
  assert.deepEqual(moisExigibles({ statut: "Transféré", dateDepart: "2027-07-10" }, MOIS, ANNEE), MOIS);
});

test("moisExigibles : sans date lisible ni année connue, on ne retire rien", () => {
  assert.deepEqual(moisExigibles({ statut: "Transféré" }, MOIS, ANNEE), MOIS);
  assert.deepEqual(moisExigibles({ statut: "Transféré", dateDepart: "bientôt" }, MOIS, ANNEE), MOIS);
  assert.deepEqual(moisExigibles({ statut: "Transféré", dateDepart: "2027-02-14" }, MOIS, ""), MOIS);
});

test("partiAvantAnnee et derniereAnneeFrequentee", () => {
  const vacances = { statut: "Transféré", dateDepart: "2026-09-15" };
  assert.equal(partiAvantAnnee(vacances, MOIS, ANNEE), true);
  assert.equal(partiAvantAnnee({ statut: "Transféré", dateDepart: "2026-10-05" }, MOIS, ANNEE), false);
  assert.equal(partiAvantAnnee({ statut: "Transféré" }, MOIS, ANNEE), false);
  assert.equal(partiAvantAnnee({ statut: "Actif" }, MOIS, ANNEE), false);

  // Le 15 septembre 2026 appartient à 2026-2027 par convention, mais l'élève
  // n'en a vu aucun mois : sa dernière année est 2025-2026.
  assert.equal(derniereAnneeFrequentee(vacances, MOIS), "2025-2026");
  assert.equal(derniereAnneeFrequentee({ statut: "Abandonné", dateDepart: "2027-02-14" }, MOIS), "2026-2027");
  assert.equal(derniereAnneeFrequentee({ statut: "Diplômé", dateDepart: "2027-06-30" }, MOIS), "2026-2027");
  assert.equal(derniereAnneeFrequentee({ statut: "Transféré" }, MOIS), "");
  assert.equal(derniereAnneeFrequentee({ statut: "Actif", dateDepart: "2027-02-14" }, MOIS), "");
});

test("elevesPourPeriode : présents + partis notés sur la période", () => {
  const eleves = [
    { _id: "present", statut: "Actif" },
    { _id: "parti-note", statut: "Abandonné", dateDepart: "2027-02-14" },
    { _id: "parti-sans-note", statut: "Transféré", dateDepart: "2026-09-15" },
  ];
  const notes = [
    { eleveId: "parti-note", periode: "T1" },
    { eleveId: "present", periode: "T2" },
  ];
  assert.deepEqual(elevesPourPeriode(eleves, notes, "T1").map((e) => e._id), ["present", "parti-note"]);
  assert.deepEqual(elevesPourPeriode(eleves, notes, "T3").map((e) => e._id), ["present"]);
  // Bilan annuel : toute note de l'année compte.
  assert.deepEqual(elevesPourPeriode(eleves, notes, null).map((e) => e._id), ["present", "parti-note"]);
});

test("normaliserDepart : date obligatoire pour une sortie, champs vidés au retour", () => {
  assert.match(normaliserDepart({ statut: "Abandonné" }).erreur, /date de départ/);

  const transfert = normaliserDepart({ statut: "Transféré", dateDepart: "2027-02-14", destinationDepart: "GS Horizon" });
  assert.equal(transfert.erreur, null);
  assert.equal(transfert.fiche.destinationDepart, "GS Horizon");

  // L'école d'accueil ne vaut que pour un transfert.
  const exclu = normaliserDepart({ statut: "Exclu", dateDepart: "2027-02-14", destinationDepart: "GS Horizon" });
  assert.equal(exclu.fiche.destinationDepart, null);

  // Retour à Actif : tout ce qui décrit le départ est effacé (null, pour que
  // la fusion de la mise à jour écrase l'ancienne valeur).
  const retour = normaliserDepart({ statut: "Actif", dateDepart: "2026-09-18", motifDepart: "Déménagement" });
  assert.equal(retour.erreur, null);
  assert.equal(retour.fiche.dateDepart, null);
  assert.equal(retour.fiche.motifDepart, null);
  assert.equal("destinationDepart" in retour.fiche, false);
  // Rien à vider : la fiche ne gagne aucune clé.
  assert.deepEqual(normaliserDepart({ statut: "Actif", nom: "Bah" }).fiche, { statut: "Actif", nom: "Bah" });
});

test("mensualités d'un élève parti en cours d'année : seuls les mois entamés sont dus", () => {
  const parti = {
    classe: "5ème Année A", statut: "Abandonné", dateDepart: "2027-02-14",
    typeInscription: "Première inscription", inscriptionPayee: true, autrePayee: true,
    mens: { ...impayes(), Oct: "Payé", Nov: "Payé" },
  };
  // Déc, Jan, Fév restent dus ; Mar → Jun ne le sont pas.
  assert.equal(countUnpaidMonths(parti, MOIS, ANNEE), 3);
  assert.equal(getConsecutiveUnpaidMonths(parti, MOIS, ANNEE), 3);
  assert.equal(getEleveSolde(parti, MOIS, tarifs, ANNEE), 300000);
  const snap = getEleveMensualiteSnapshot(parti, MOIS, tarifs, ANNEE);
  assert.equal(snap.nbPayes, 2);
  assert.equal(snap.nbImpayes, 3);
  assert.equal(snap.montantMensualitesPercu, 200000);
  // Même élève encore présent : les 7 mois restants sont dus.
  assert.equal(countUnpaidMonths({ ...parti, statut: "Actif" }, MOIS, ANNEE), 7);
  assert.equal(estBloquePourImpaye({ blocageParentImpaye: true }, parti, MOIS, ANNEE), true);
});

test("cas réel : transféré le 15/09/2026, avant la rentrée 2026-2027 — il ne doit rien pour cette année", () => {
  const transfere = {
    classe: "5ème Année A", statut: "Transféré", dateDepart: "2026-09-15",
    typeInscription: "Réinscription", inscriptionPayee: false, mens: impayes(),
  };
  assert.equal(countUnpaidMonths(transfere, MOIS, ANNEE), 0);
  assert.equal(getEleveSolde(transfere, MOIS, tarifs, ANNEE), 0);
  assert.equal(estBloquePourImpaye({ blocageParentImpaye: true }, transfere, MOIS, ANNEE), false);
  assert.equal(concerneParAnnee(transfere, MOIS, ANNEE), false);
  // L'année précédente, qu'il a faite, tout reste dû.
  assert.equal(getEleveSolde(transfere, MOIS, tarifs, "2025-2026"), 9 * 100000 + 30000 + 10000);
  // Un encaissement sur la fiche le garde dans la grille, pour rester annulable.
  assert.equal(concerneParAnnee({ ...transfere, inscriptionPayee: true }, MOIS, ANNEE), true);
});

test("la synthèse additionne le dû réel : un parti ne gonfle plus les impayés", () => {
  const present = { classe: "5ème Année A", statut: "Actif", inscriptionPayee: true, autrePayee: true, mens: impayes() };
  const parti = { ...present, statut: "Transféré", dateDepart: "2026-09-15" };
  const overview = getMensualiteOverview([present, parti], MOIS, tarifs, ANNEE);
  assert.equal(overview.totalImpayes, 9);
  assert.equal(overview.totalDu, 9 * 100000);
});
