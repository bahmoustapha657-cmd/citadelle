import assert from "node:assert/strict";
import test from "node:test";

import {
  aUneExoneration, estExonereTotal, montantApresExoneration, normaliserExoneration,
  resumeExoneration, tauxExoneration,
} from "../src/exoneration-utils.js";
import {
  countUnpaidMonths, estBloquePourImpaye, getConsecutiveUnpaidMonths, getEleveMensualiteSnapshot,
  getEleveSolde, getElevesCritiques, getMensualiteOverview, isEleveCritique,
} from "../src/mensualite-utils.js";
import { computeBlocage } from "../src/components/portail-parent/portail-parent-derive.js";
import { CHAMPS_SCOLARITE, champsCloture, etatVierge } from "../src/components/admin/cloture-annee-utils.js";

const tarifs = [{ classe: "6e A", montant: 200000, inscription: 50000, autre: 15000 }];
const moisAnnee = ["Octobre", "Novembre", "Décembre"];

const eleve = (exoneration, paiements = {}) => ({
  classe: "6e A", mens: { Octobre: "Impayé", Novembre: "Impayé", Décembre: "Impayé" },
  inscriptionPayee: false, autrePayee: false, ...paiements, exoneration,
});
const exoTotale = { annee: "2026-2027", mensualites: 100, inscription: 100, fraisAnnexes: 100, motif: "orphelin" };
const exoMoitie = { annee: "2026-2027", mensualites: 50, inscription: 0, fraisAnnexes: 0, motif: "personnel" };

// ── Le modèle ─────────────────────────────────────────────────────────────
test("une exonération à 0 % partout n'est pas une exonération", () => {
  assert.equal(normaliserExoneration({ mensualites: 0, inscription: 0, fraisAnnexes: 0 }), null);
  assert.equal(normaliserExoneration(null), null);
  assert.equal(aUneExoneration(eleve(null)), false);
  assert.equal(aUneExoneration(eleve(exoMoitie)), true);
});

test("les taux sont bornés entre 0 et 100, et le motif est conservé", () => {
  const exo = normaliserExoneration({ mensualites: 250, inscription: -5, fraisAnnexes: 33.4, motif: "boursier", precision: " bourse d'État " });
  assert.equal(exo.mensualites, 100);
  assert.equal(exo.inscription, 0);
  assert.equal(exo.fraisAnnexes, 33);
  assert.equal(exo.motif, "boursier");
  assert.equal(exo.precision, "bourse d'État");
});

test("taux et montants suivent le poste concerné", () => {
  const e = eleve(exoMoitie);
  assert.equal(tauxExoneration(e, "mensualites"), 0.5);
  assert.equal(tauxExoneration(e, "inscription"), 0);
  assert.equal(montantApresExoneration(200000, e, "mensualites"), 100000);
  assert.equal(montantApresExoneration(50000, e, "inscription"), 50000);
  assert.equal(estExonereTotal(e, "mensualites"), false);
  assert.equal(estExonereTotal(eleve(exoTotale), "mensualites"), true);
  assert.equal(resumeExoneration(e), "Mensualités 50 %");
});

// ── Dispense totale : plus aucun impayé à reprocher ───────────────────────
test("dispense totale : aucun mois impayé, aucun solde, hors des alertes", () => {
  const e = eleve(exoTotale);
  const snap = getEleveMensualiteSnapshot(e, moisAnnee, tarifs);

  assert.equal(snap.nbImpayes, 0);
  assert.equal(snap.nbExoneres, 3);
  assert.equal(snap.soldeMensualites, 0);
  assert.equal(snap.soldeInscription, 0);
  assert.equal(snap.soldeAutre, 0);
  assert.equal(getEleveSolde(e, moisAnnee, tarifs), 0);

  // Ni relance, ni blocage des bulletins : il n'a rien à devoir.
  assert.equal(countUnpaidMonths(e, moisAnnee), 0);
  assert.equal(getConsecutiveUnpaidMonths(e, moisAnnee), 0);
  assert.equal(isEleveCritique(e, moisAnnee), false);
  assert.deepEqual(getElevesCritiques([e], moisAnnee), []);
});

test("le manque à gagner est ce que l'école renonce à percevoir", () => {
  const snap = getEleveMensualiteSnapshot(eleve(exoTotale), moisAnnee, tarifs);
  // 3 mois × 200 000 + inscription 50 000 + autres frais 15 000.
  assert.equal(snap.montantExonere, 3 * 200000 + 50000 + 15000);
});

// ── Dispense partielle : il doit encore la moitié ─────────────────────────
test("réduction de moitié : le solde est allégé, l'élève reste un débiteur", () => {
  const e = eleve(exoMoitie);
  const snap = getEleveMensualiteSnapshot(e, moisAnnee, tarifs);

  assert.equal(snap.soldeMensualites, 3 * 100000);
  assert.equal(snap.nbImpayes, 3, "il doit toujours sa part");
  assert.equal(snap.nbExoneres, 0);
  assert.equal(snap.montantExonere, 3 * 100000);
  // L'inscription n'est pas couverte par cette dispense.
  assert.equal(snap.soldeInscription, 50000);
  assert.equal(isEleveCritique(e, moisAnnee), true);
});

test("ce qui est déjà encaissé n'est jamais rétroactivement remisé", () => {
  const e = eleve(exoTotale, {
    mens: { Octobre: "Payé", Novembre: "Impayé", Décembre: "Impayé" },
    mensMontants: { Octobre: 200000 }, inscriptionPayee: true,
  });
  const snap = getEleveMensualiteSnapshot(e, moisAnnee, tarifs);

  assert.equal(snap.montantMensualitesPercu, 200000);
  assert.equal(snap.montantInscriptionPercu, 50000);
  // Seul le reste à devoir est effacé.
  assert.equal(snap.montantExonere, 2 * 200000 + 15000);
});

// ── Vue d'ensemble : ce que la direction doit voir ────────────────────────
test("la vue d'ensemble compte les dispensés et le manque à gagner", () => {
  const overview = getMensualiteOverview(
    [eleve(null), eleve(exoTotale), eleve(exoMoitie)], moisAnnee, tarifs,
  );

  assert.equal(overview.totalElevesExoneres, 2);
  assert.equal(overview.totalExonere, (3 * 200000 + 50000 + 15000) + (3 * 100000));
  // Les impayés ne comptent plus le dispensé total : 3 mois (normal) + 3 (moitié).
  assert.equal(overview.totalImpayes, 6);
  // Le dû attendu n'inclut plus ce dont l'école a dispensé.
  assert.equal(overview.totalDu, 3 * 200000 + 3 * 100000);
});

test("sans exonération, les calculs sont inchangés", () => {
  const snap = getEleveMensualiteSnapshot(eleve(null), moisAnnee, tarifs);
  assert.equal(snap.nbImpayes, 3);
  assert.equal(snap.nbExoneres, 0);
  assert.equal(snap.montantExonere, 0);
  assert.equal(snap.soldeMensualites, 600000);
  assert.equal(snap.soldeInscription, 50000);
  assert.equal(snap.soldeAutre, 15000);
});

// ── Bulletins retenus pour impayé ─────────────────────────────────────────
test("les bulletins d'un élève dispensé ne sont jamais retenus pour impayé", () => {
  const ecoleQuiBloque = { blocageParentImpaye: true };

  assert.equal(estBloquePourImpaye(ecoleQuiBloque, eleve(null), moisAnnee), true);
  assert.equal(estBloquePourImpaye(ecoleQuiBloque, eleve(exoTotale), moisAnnee), false);
  // Dispense partielle : il doit encore sa part, le blocage s'applique.
  assert.equal(estBloquePourImpaye(ecoleQuiBloque, eleve(exoMoitie), moisAnnee), true);
  // École qui n'a pas activé le blocage : personne n'est retenu.
  assert.equal(estBloquePourImpaye({}, eleve(null), moisAnnee), false);
});

test("le portail parent n'annonce aucun impayé à la famille d'un dispensé", () => {
  const ecoleQuiBloque = { blocageParentImpaye: true };

  const dispense = computeBlocage(ecoleQuiBloque, eleve(exoTotale), moisAnnee);
  assert.deepEqual(dispense.moisImpayes, []);
  assert.equal(dispense.accesBloqueParPaiement, false);

  const ordinaire = computeBlocage(ecoleQuiBloque, eleve(null), moisAnnee);
  assert.equal(ordinaire.moisImpayes.length, 3);
  assert.equal(ordinaire.accesBloqueParPaiement, true);
});

// ── Une dispense vaut une année ───────────────────────────────────────────
test("la clôture archive la dispense et repart d'une fiche sans dispense", () => {
  assert.ok(CHAMPS_SCOLARITE.includes("exoneration"));
  assert.equal(etatVierge(moisAnnee).exoneration, null);

  const champs = champsCloture(eleve(exoTotale), "2026-2027", { moisAnnee });
  assert.deepEqual(champs.historique["2026-2027"].exoneration, exoTotale);
  assert.equal(champs.exoneration, null, "la nouvelle année repart sans dispense");
});
