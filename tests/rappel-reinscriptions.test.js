import assert from "node:assert/strict";
import test from "node:test";

import {
  ID_RAPPEL, jourLocal, marquerRappelVu, rappelNonReinscrits, rappelVuAujourdhui, texteRappel,
} from "../src/rappel-reinscriptions.js";
import { elevePaiementsDepuisLigne, SELECT_PAIEMENTS_ELEVE } from "../src/ecartes-non-reinscrits.js";

const e = (id, extra = {}) => ({ _id: id, classe: "6e A", statut: "Actif", inscriptionPayee: false, mens: {}, ...extra });
const ecole = { anneeScolaire: "2026-2027", moisDebut: "Octobre" };
const tous = [e("a"), e("b"), e("p", { mens: { Octobre: "Payé" } }), e("d", { exoneration: { inscription: 100 } })];

test("rappel : rien avant la date du retrait, le nombre de non réinscrits après", () => {
  assert.equal(rappelNonReinscrits(tous, ecole, { maintenant: new Date(2026, 9, 20) }), null);
  const r = rappelNonReinscrits(tous, ecole, { maintenant: new Date(2026, 10, 5, 8) });
  assert.equal(r.id, ID_RAPPEL);
  assert.equal(r.rappel, true);
  assert.equal(r.nombre, 2);
  assert.equal(r.dateRetrait.getTime(), new Date(2026, 10, 1).getTime());
  // Plus personne à réinscrire : plus de rappel.
  assert.equal(rappelNonReinscrits([tous[2]], ecole, { maintenant: new Date(2026, 10, 5) }), null);
  // Règle coupée : jamais de rappel.
  assert.equal(rappelNonReinscrits(tous, { ...ecole, retraitNonReinscrits: 0 }, { maintenant: new Date(2026, 10, 5) }), null);
  // École sans année officielle : l'année de l'appareil sert de repli.
  assert.equal(rappelNonReinscrits(tous, { moisDebut: "Octobre" }, { annee: "2026-2027", maintenant: new Date(2026, 10, 5) }).nombre, 2);
});

test("texte du rappel : singulier et pluriel", () => {
  assert.deepEqual(texteRappel(1, "le 1er novembre 2026"), {
    titre: "📝 1 élève non réinscrit",
    corps: "Aucun paiement depuis la rentrée : retiré des classes le 1er novembre 2026. Faites-les réinscrire.",
  });
  assert.equal(texteRappel(3, "").corps, "Aucun paiement depuis la rentrée. Faites-les réinscrire.");
});

test("rappel vu : une fois par jour et par école", () => {
  const memoire = new Map();
  const stockage = { getItem: (k) => memoire.get(k) ?? null, setItem: (k, v) => memoire.set(k, v) };
  const lundi = new Date(2026, 10, 2, 9);
  assert.equal(rappelVuAujourdhui("citadelle", lundi, stockage), false);
  marquerRappelVu("citadelle", lundi, stockage);
  assert.equal(rappelVuAujourdhui("citadelle", new Date(2026, 10, 2, 18), stockage), true);
  assert.equal(rappelVuAujourdhui("autre", lundi, stockage), false);
  assert.equal(rappelVuAujourdhui("citadelle", new Date(2026, 10, 3, 7), stockage), false);
  assert.equal(jourLocal(new Date(2026, 0, 5)), "2026-01-05");
});

test("lecture légère : colonnes demandées et fiche reconstituée", () => {
  assert.match(SELECT_PAIEMENTS_ELEVE, /^id,nom,prenom,classe,statut,inscriptionPayee:extra->inscriptionPayee,/);
  assert.match(SELECT_PAIEMENTS_ELEVE, /exoneration:extra->exoneration$/);
  const fiche = elevePaiementsDepuisLigne({ id: "x", nom: "BAH", classe: "6e A", statut: "Actif", mens: { Octobre: "Payé" }, fraisPayes: null });
  assert.deepEqual(fiche, { _id: "x", nom: "BAH", prenom: undefined, classe: "6e A", statut: "Actif", mens: { Octobre: "Payé" } });
});
