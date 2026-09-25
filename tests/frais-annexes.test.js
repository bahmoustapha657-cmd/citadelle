import assert from "node:assert/strict";
import test from "node:test";
import {
  CATALOGUE_FRAIS_ANNEXES,
  getFraisAnnexeDate,
  getFraisAnnexeLabel,
  getTarifFraisAnnexes,
  getTarifFraisDivers,
  isFraisAnnexePaye,
} from "../src/constants.js";
import { buildTarifData, normalizeFraisDivers } from "../src/components/comptabilite/compta-tarifs.js";
import { champsBasculeFrais } from "../src/components/comptabilite/frais-bascule.js";
import { collecterMouvements } from "../src/components/comptabilite/caisse/caisse-utils.js";
import { ecritureAnnulation, ecritureEncaissement } from "../src/components/comptabilite/paiements-journal.js";
import { getEleveMensualiteSnapshot, getEleveSolde, getFraisAnnexesEleve } from "../src/mensualite-utils.js";
import { getRecuTotals } from "../src/reports.js";

test("catalogue : autre + frais usuels (uniforme, cantine, transport, examens…)", () => {
  const ids = CATALOGUE_FRAIS_ANNEXES.map((f) => f.id);
  for (const attendu of ["autre", "uniforme", "fournitures", "cantine", "transport", "examens", "assurance"]) {
    assert.ok(ids.includes(attendu), `catalogue doit contenir ${attendu}`);
  }
  assert.equal(getFraisAnnexeLabel("cantine"), "Cantine");
  assert.equal(getFraisAnnexeLabel("inconnu"), "inconnu");
});

test("getTarifFraisDivers : montants > 0 du catalogue seulement, jamais « autre » ni la révision", () => {
  const tarif = {
    fraisDivers: { uniforme: 50000, cantine: 0, autre: 99999, revision: 88888, bidon: 1000 },
    autre: 15000, revision: 200000,
  };
  assert.deepEqual(getTarifFraisDivers(tarif), { uniforme: 50000 });
  // « autre » et la révision rejoignent la carte complète via leur colonne.
  assert.deepEqual(getTarifFraisAnnexes(tarif), { uniforme: 50000, autre: 15000, revision: 200000 });
  assert.deepEqual(getTarifFraisDivers({}), {});
  assert.deepEqual(normalizeFraisDivers({ revision: 5000, uniforme: 1 }), { uniforme: 1 });
});

test("isFraisAnnexePaye / date : legacy « autre » + carte fraisPayes", () => {
  const eleve = { autrePayee: true, autreDate: "01/10/2025", fraisPayes: { uniforme: "02/10/2025" } };
  assert.equal(isFraisAnnexePaye(eleve, "autre"), true);
  assert.equal(isFraisAnnexePaye(eleve, "uniforme"), true);
  assert.equal(isFraisAnnexePaye(eleve, "cantine"), false);
  assert.equal(getFraisAnnexeDate(eleve, "autre"), "01/10/2025");
  assert.equal(getFraisAnnexeDate(eleve, "uniforme"), "02/10/2025");
  assert.equal(isFraisAnnexePaye({}, "autre"), false);
  // Désormais « autre » s'encaisse dans la carte, comme tous les frais.
  const nouveau = { fraisPayes: { autre: "03/10/2026" } };
  assert.equal(isFraisAnnexePaye(nouveau, "autre"), true);
  assert.equal(getFraisAnnexeDate(nouveau, "autre"), "03/10/2026");
});

test("buildTarifData : fraisDivers normalisés (0 conservé = désactivation), null = intact", () => {
  const data = buildTarifData(100000, { fraisDivers: { uniforme: "50000", cantine: "", transport: 0, bidon: 42 } });
  assert.deepEqual(data.fraisDivers, { uniforme: 50000, transport: 0 });
  assert.equal(buildTarifData(100000, {}).fraisDivers, undefined);
  assert.deepEqual(normalizeFraisDivers({ autre: 5000 }), {});
});

test("snapshot & solde : les frais du catalogue comptent en perçu et en dû", () => {
  const tarifs = [{ classe: "7ème Année A", montant: 100000, autre: 10000, fraisDivers: { uniforme: 50000, cantine: 30000 } }];
  const eleve = {
    classe: "7ème Année A",
    mens: { Oct: "Payé" },
    autrePayee: true,
    fraisPayes: { uniforme: "02/10/2025" }, // cantine impayée
  };
  const snap = getEleveMensualiteSnapshot(eleve, ["Oct", "Nov"], tarifs);
  assert.equal(snap.montantAutrePercu, 10000 + 50000); // autre + uniforme
  assert.equal(snap.soldeAutre, 30000);                // cantine restante
  // Solde total = 1 mois impayé + inscription (0) + cantine.
  assert.equal(getEleveSolde(eleve, ["Oct", "Nov"], tarifs), 100000 + 30000);
});

test("getRecuTotals : les frais divers payés font des lignes et gonflent le total", () => {
  const eleve = {
    mens: { Octobre: "Payé" },
    inscriptionPayee: false,
    autrePayee: false,
    fraisPayes: { uniforme: "02/10/2025" },
  };
  const totals = getRecuTotals(eleve, 100000, ["Octobre"], {
    inscription: 30000, autre: 10000,
    divers: { uniforme: 50000, cantine: 30000 },
  });
  assert.deepEqual(totals.fraisDiversPayes, [{ id: "uniforme", label: "Tenue / Uniforme", montant: 50000 }]);
  assert.equal(totals.totalGeneral, 100000 + 50000); // cantine impayée exclue
});

// ── Révision annuelle (v3) ────────────────────────────────────────────────
// Cas réel de La Citadelle, 10ème Année : mensualité 110 000, révision
// 200 000. La révision était ajoutée à CHAQUE mois (310 000 × 9).
test("révision : due UNE fois dans l'année, jamais ajoutée aux mois", () => {
  const moisAnnee = ["Oct", "Nov", "Déc", "Jan", "Fév", "Mar", "Avr", "Mai", "Juin"];
  const tarifs = [{ classe: "10ème Année A", montant: 110000, revision: 200000 }];
  const eleve = { classe: "10ème Année A", mens: {} };

  const snap = getEleveMensualiteSnapshot(eleve, moisAnnee, tarifs);
  assert.equal(snap.soldeMensualites, 9 * 110000);
  assert.equal(snap.soldeAutre, 200000);
  assert.equal(getEleveSolde(eleve, moisAnnee, tarifs), 990000 + 200000);

  // Réglée : elle passe au perçu des frais, au montant encaissé.
  const regle = { ...eleve, fraisPayes: { revision: "05/10/2026" }, fraisMontants: { revision: 200000 } };
  const snapRegle = getEleveMensualiteSnapshot(regle, moisAnnee, tarifs);
  assert.equal(snapRegle.montantAutrePercu, 200000);
  assert.equal(snapRegle.soldeAutre, 0);
});

// ── Montants figés au paiement (v3) ───────────────────────────────────────
test("un tarif modifié après paiement ne réécrit ni le perçu ni le reçu", () => {
  const tarifs = [{ classe: "6e A", montant: 100000, inscription: 50000, fraisDivers: { uniforme: 60000 } }];
  const eleve = {
    classe: "6e A",
    inscriptionPayee: true, inscriptionMontant: 45000,
    fraisPayes: { uniforme: "02/10/2026" }, fraisMontants: { uniforme: 50000 },
  };
  const snap = getEleveMensualiteSnapshot(eleve, [], tarifs);
  assert.equal(snap.montantInscriptionPercu, 45000);
  assert.equal(snap.montantAutrePercu, 50000);

  const totals = getRecuTotals(eleve, 100000, [], { inscription: 50000, divers: { uniforme: 60000 } });
  assert.equal(totals.fraisIns, 45000);
  assert.deepEqual(totals.fraisDiversPayes, [{ id: "uniforme", label: "Tenue / Uniforme", montant: 50000 }]);
  assert.equal(totals.totalGeneral, 95000);
});

test("un frais payé reste compté quand la classe ne le facture plus", () => {
  // Uniforme remis à 0 (ou élève changé de classe) après l'encaissement.
  const tarif = { classe: "6e A", montant: 100000, fraisDivers: { cantine: 30000 } };
  const eleve = { classe: "6e A", fraisPayes: { uniforme: "02/10/2026" }, fraisMontants: { uniforme: 50000 } };

  const lignes = getFraisAnnexesEleve(eleve, tarif);
  assert.deepEqual(lignes.map((l) => [l.id, l.du, l.paye, l.montant]), [
    ["uniforme", 0, true, 50000],   // toujours là, au montant encaissé
    ["cantine", 30000, false, 30000],
  ]);
  const snap = getEleveMensualiteSnapshot(eleve, [], [tarif]);
  assert.equal(snap.montantAutrePercu, 50000);
  assert.equal(snap.soldeAutre, 30000);
});

// ── Bascule d'un frais sur la fiche ───────────────────────────────────────
test("encaisser un frais fige son montant ; le retirer contre-passe ce montant-là", () => {
  const eleve = { fraisPayes: { cantine: "01/10/2026" }, fraisMontants: { cantine: 30000 } };

  const enc = champsBasculeFrais({ eleve, poste: "revision", montant: 200000, date: "05/10/2026" });
  assert.deepEqual(enc.champs, {
    fraisPayes: { cantine: "01/10/2026", revision: "05/10/2026" },
    fraisMontants: { cantine: 30000, revision: 200000 },
    fraisAcomptes: {},
  });
  assert.equal(enc.montantJournal, 200000);

  // Tarif passé à 40 000 depuis : on annule les 30 000 réellement encaissés.
  const ret = champsBasculeFrais({ eleve, poste: "cantine", valeurActuelle: true, montant: 40000 });
  assert.deepEqual(ret.champs, { fraisPayes: {}, fraisMontants: {}, fraisAcomptes: {} });
  assert.equal(ret.montantJournal, 30000);
});

test("bascule d'un frais entamé : le clic solde le reste, le total est figé", () => {
  const eleve = { fraisAcomptes: { cantine: 100000 } };
  const enc = champsBasculeFrais({ eleve, poste: "cantine", montant: 300000, date: "05/11/2026" });
  assert.deepEqual(enc.champs, {
    fraisPayes: { cantine: "05/11/2026" }, fraisMontants: { cantine: 300000 }, fraisAcomptes: {},
  });
  assert.equal(enc.montantJournal, 200000); // l'acompte a déjà sa ligne au journal
  assert.equal(enc.acompte, 100000);
});

test("bascule : « autre » s'écrit dans la carte, l'ancien drapeau s'éteint au retrait", () => {
  const enc = champsBasculeFrais({ eleve: {}, poste: "autre", montant: 15000, date: "05/10/2026" });
  assert.deepEqual(enc.champs, { fraisPayes: { autre: "05/10/2026" }, fraisMontants: { autre: 15000 }, fraisAcomptes: {} });

  const legacy = { autrePayee: true, autreDate: "01/10/2025" };
  const ret = champsBasculeFrais({ eleve: legacy, poste: "autre", valeurActuelle: true, montant: 15000 });
  assert.equal(ret.champs.autrePayee, false);
  assert.equal(ret.champs.autreDate, null);
  assert.equal(isFraisAnnexePaye({ ...legacy, ...ret.champs }, "autre"), false);
});

test("bascule de l'inscription : montant figé, retrait au montant encaissé", () => {
  const enc = champsBasculeFrais({ eleve: {}, poste: "inscription", montant: 45000, date: "05/10/2026" });
  assert.deepEqual(enc.champs, {
    inscriptionPayee: true, inscriptionDate: "05/10/2026", inscriptionMontant: 45000, inscriptionAcompte: null,
  });

  const ret = champsBasculeFrais({ eleve: enc.champs, poste: "inscription", valeurActuelle: true, montant: 50000 });
  assert.deepEqual(ret.champs, {
    inscriptionPayee: false, inscriptionDate: null, inscriptionMontant: null, inscriptionAcompte: null,
  });
  assert.equal(ret.montantJournal, 45000);
});

// ── Caisse : « Autre frais » compté une seule fois ────────────────────────
test("caisse : « Autre frais » payé n'apparaît qu'une fois (journal + fiche)", () => {
  const annee = "2026-2027";
  const aujourdhui = new Date().toLocaleDateString("fr-FR");
  const tarifs = [{ classe: "7ème Année A", montant: 100000, autre: 15000 }];
  const eleve = { _id: "e1", nom: "BAH", prenom: "Awa", classe: "7ème Année A", mens: {} };
  const ligne = (mois, statut = "encaisse") => ({
    ...(statut === "annule" ? ecritureAnnulation : ecritureEncaissement)({
      annee, eleve, type: "frais", mois, libelle: "Autre frais", montant: 15000,
    }),
    _id: `j-${mois}-${statut}`,
  });
  const frais = (paiements, fiche) => collecterMouvements({ eleves: [{ ...eleve, ...fiche }], moisAnnee: [], tarifsClasses: tarifs, paiements, annee })
    .filter((m) => m.source === "frais");

  // Nouvelle écriture (clé "autre") et fiche à jour.
  assert.equal(frais([ligne("autre")], { fraisPayes: { autre: aujourdhui } }).length, 1);
  // Écriture d'avant le correctif (clé "autrePayee") et ancien drapeau.
  const avant = frais([ligne("autrePayee")], { autrePayee: true, autreDate: aujourdhui });
  assert.equal(avant.length, 1);
  assert.equal(avant[0].montant, 15000);
});
