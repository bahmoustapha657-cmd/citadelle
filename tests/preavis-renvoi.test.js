import assert from "node:assert/strict";
import test from "node:test";

import { dateLimiteFr, dateLimiteParDefaut, preavisRenvoiHTML } from "../src/reports/preavis-renvoi.js";
import { signatairesDocument } from "../src/reports/signatures.js";

const ecole = { nom: "École Test", ville: "Conakry", monnaie: "GNF" };
const retard = (nom, extra = {}) => ({
  eleve: { _id: nom, nom, prenom: "Awa", classe: "6e A", tuteur: "M. Bah", contactTuteur: "622 00 00 00", ...extra },
  mois: ["Octobre", "Juin"],
  montant: 200000,
});
const compter = (html, motif) => (html.match(motif) || []).length;

test("dateLimiteFr : AAAA-MM-JJ → JJ/MM/AAAA", () => {
  assert.equal(dateLimiteFr("2026-10-22"), "22/10/2026");
  assert.equal(dateLimiteFr("22/10/2026"), "22/10/2026");
});

test("dateLimiteParDefaut : dans 7 jours, changement de mois compris", () => {
  assert.equal(dateLimiteParDefaut(new Date(2026, 9, 28)), "2026-11-04");
});

test("préavis A4 : mois, reste dû, date limite, signatures et talon", () => {
  const html = preavisRenvoiHTML([retard("DIALLO", { sexe: "F" })], { schoolInfo: ecole, annee: "2026-2027", dateLimite: "2026-10-22" });
  assert.match(html, /PRÉAVIS DE RENVOI/);
  assert.match(html, /DIALLO Awa/);
  assert.match(html, /Octobre, Juin/);
  // Séparateur de milliers de fr-FR (espace fine insécable) : n'importe lequel.
  assert.match(html, /200\D?000 GNF/);
  assert.match(html, /avant le <strong>22\/10\/2026<\/strong>/);
  assert.match(html, /<strong>renvoyée<\/strong>/);
  assert.match(html, /Le Comptable/);
  assert.match(html, /Le Directeur/);
  assert.match(html, /TALON — PRÉAVIS DE RENVOI/);
});

test("préavis A4 : 3 par page par défaut, 2 ou 4 au choix, dernière page complétée", () => {
  const cinq = ["A", "B", "C", "D", "E"].map((n) => retard(n));
  const options = { schoolInfo: ecole, dateLimite: "2026-10-22" };
  const parDefaut = preavisRenvoiHTML(cinq, options);
  assert.equal(compter(parDefaut, /<div class="page">/g), 2);
  assert.equal(compter(parDefaut, /<div class="recu vide">/g), 1);
  const quatre = preavisRenvoiHTML(cinq, { ...options, parPage: 4 });
  assert.equal(compter(quatre, /<div class="page">/g), 2);
  assert.match(quatre, /grid-template-columns:1fr 1fr/);
  assert.equal(compter(quatre, /<div class="recu vide">/g), 3);
  const deux = preavisRenvoiHTML(cinq, { ...options, parPage: 2 });
  assert.equal(compter(deux, /<div class="page">/g), 3);
  // Valeur inconnue : retour au défaut.
  assert.equal(compter(preavisRenvoiHTML(cinq, { ...options, parPage: 7 }), /<div class="page">/g), 2);
});

test("préavis ticket : un par élève, talon compris, saisie échappée", () => {
  const html = preavisRenvoiHTML([retard("<b>X</b>"), retard("SOW", { sexe: "M" })], { schoolInfo: ecole, dateLimite: "2026-10-22", format: "58" });
  assert.equal(compter(html, /<div class="t-preavis">/g), 2);
  assert.equal(compter(html, /Talon à rapporter signé/g), 2);
  assert.match(html, /&lt;b&gt;X&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<b>X<\/b>/);
  assert.match(html, /<strong>renvoyé<\/strong>/);
  assert.match(html, /size:58mm auto/);
});

test("matrice des signatures : le préavis est signé par le comptable, visé par la direction", () => {
  const [principal, visa] = signatairesDocument({}, "preavis", { section: "college", signataire: null });
  assert.equal(principal.cle, "comptable");
  assert.equal(visa.cle, "direction");
});
