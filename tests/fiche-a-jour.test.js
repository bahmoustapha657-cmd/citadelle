import assert from "node:assert/strict";
import test from "node:test";
import {
  clePosteFrais, clePosteMois, conflitFiche, messageConflit, paiementsIgnores,
} from "../src/components/comptabilite/fiche-a-jour.js";
import { getFraisAnnexeLabel } from "../src/constants.js";

const MOIS = ["Oct", "Nov", "Déc", "Jan", "Fév", "Mar", "Avr", "Mai", "Jun"];
const fiche = (payes = [], extra = {}) => ({
  mens: Object.fromEntries(MOIS.map((m) => [m, payes.includes(m) ? "Payé" : "Impayé"])),
  mensAcomptes: {},
  ...extra,
});

test("cas réel : versement calculé sur la fiche d'avant quatre cases cochées", () => {
  // Fenêtre ouverte sur une fiche vierge ; entre-temps Oct–Jan ont été cochés.
  const affichee = fiche();
  const relue = fiche(["Oct", "Nov", "Déc", "Jan"]);
  assert.deepEqual(paiementsIgnores(affichee, relue), ["Oct", "Nov", "Déc", "Jan"]);
  assert.deepEqual(conflitFiche(affichee, [relue]), ["Oct", "Nov", "Déc", "Jan"]);
});

test("fiche à jour : aucun conflit", () => {
  const f = fiche(["Oct", "Jun"], { inscriptionPayee: true });
  assert.deepEqual(paiementsIgnores(f, structuredClone(f)), []);
  assert.equal(conflitFiche(f, [structuredClone(f), structuredClone(f)]), null);
  assert.equal(conflitFiche(f, []), null);
});

test("notre propre écriture pas encore remontée au serveur n'est pas un conflit", () => {
  const affichee = fiche(["Oct", "Nov"], { mensAcomptes: { Déc: 40000 } });
  const serveur = fiche(["Oct"]);
  assert.equal(conflitFiche(affichee, [affichee, serveur]), null);
});

test("acompte plus élevé, inscription ou frais soldés ailleurs : conflit", () => {
  const affichee = fiche([], { mensAcomptes: { Oct: 40000 } });
  assert.deepEqual(paiementsIgnores(affichee, fiche([], { mensAcomptes: { Oct: 90000 } })), ["Oct"]);
  assert.deepEqual(paiementsIgnores(fiche(), fiche([], { inscriptionPayee: true })), ["Inscription"]);
  assert.deepEqual(paiementsIgnores(fiche(), fiche([], { inscriptionAcompte: 20000 })), ["Inscription"]);
  assert.deepEqual(paiementsIgnores(fiche(), fiche([], { fraisPayes: { cantine: "05/10/2026" } })), [getFraisAnnexeLabel("cantine")]);
});

test("retrait d'un poste déjà retiré ailleurs : conflit, sur ce poste seulement", () => {
  const affichee = fiche(["Oct", "Nov"], { inscriptionPayee: true });
  const relue = fiche(["Nov"], { inscriptionPayee: true });
  assert.deepEqual(paiementsIgnores(affichee, relue, { retrait: clePosteMois("Oct") }), ["Oct"]);
  // Hors retrait, une fiche relue « en retard » n'arrête rien.
  assert.deepEqual(paiementsIgnores(affichee, relue), []);
  const sansInscription = fiche(["Oct", "Nov"]);
  assert.deepEqual(paiementsIgnores(affichee, sansInscription, { retrait: clePosteFrais("inscription") }), ["Inscription"]);
});

test("message : nomme l'élève et les postes", () => {
  const m = messageConflit("BALDE IBRAHIMA", ["Oct", "Nov"]);
  assert.match(m, /BALDE IBRAHIMA/);
  assert.match(m, /Oct, Nov/);
  assert.match(m, /Rien n'a été encaissé/);
});
