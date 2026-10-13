import assert from "node:assert/strict";
import test from "node:test";
import {
  dateMoisScolaire, moisPaieRecent, nbMoisEntames,
} from "../src/components/tableau-de-bord/tableau-de-bord-derive.js";
import { calcMoisSalaire } from "../src/constants.js";

const moisSalaire = calcMoisSalaire("Octobre"); // Octobre → Juin
const le = (a, m, j) => new Date(a, m - 1, j);

test("un mois scolaire tombe dans la bonne année civile", () => {
  assert.deepEqual(dateMoisScolaire("Septembre", "2026-2027"), le(2026, 9, 1));
  assert.deepEqual(dateMoisScolaire("Décembre", "2026-2027"), le(2026, 12, 1));
  assert.deepEqual(dateMoisScolaire("Janvier", "2026-2027"), le(2027, 1, 1));
  assert.deepEqual(dateMoisScolaire("Août", "2026-2027"), le(2027, 8, 1));
  assert.equal(dateMoisScolaire("Brumaire", "2026-2027"), null);
  assert.equal(dateMoisScolaire("Octobre", "2026"), null);
});

test("mois de paie : le plus récent mois commencé qui a des fiches, jamais juin en octobre", () => {
  const salaires = [{ mois: "Octobre" }, { mois: "Octobre" }];
  // L'ancienne tuile prenait le dernier mois de la liste : juin.
  assert.equal(moisSalaire[moisSalaire.length - 1], "Juin");
  assert.equal(moisPaieRecent(salaires, moisSalaire, "2026-2027", le(2026, 10, 13)), "Octobre");
  // Fiches de novembre générées d'avance : novembre n'a pas commencé le 13/10.
  assert.equal(moisPaieRecent([...salaires, { mois: "Novembre" }], moisSalaire, "2026-2027", le(2026, 10, 13)), "Octobre");
  // Début décembre, paie de décembre pas encore faite : on garde la dernière faite.
  assert.equal(moisPaieRecent([{ mois: "Novembre" }], moisSalaire, "2026-2027", le(2026, 12, 2)), "Novembre");
  // Aucune fiche : le mois en cours.
  assert.equal(moisPaieRecent([], moisSalaire, "2026-2027", le(2027, 2, 10)), "Février");
  // Année passée : sa dernière paie.
  assert.equal(moisPaieRecent([{ mois: "Mai" }, { mois: "Juin" }], moisSalaire, "2025-2026", le(2026, 10, 13)), "Juin");
  // Année pas encore commencée : le premier mois.
  assert.equal(moisPaieRecent([], moisSalaire, "2027-2028", le(2026, 10, 13)), "Octobre");
});

test("mois entamés : diviseur de la moyenne mensuelle, entre 1 et 9", () => {
  assert.equal(nbMoisEntames(moisSalaire, "2026-2027", le(2026, 10, 13)), 1);
  assert.equal(nbMoisEntames(moisSalaire, "2026-2027", le(2027, 1, 5)), 4); // oct → janv
  assert.equal(nbMoisEntames(moisSalaire, "2026-2027", le(2026, 9, 20)), 1); // avant la rentrée
  assert.equal(nbMoisEntames(moisSalaire, "2025-2026", le(2026, 10, 13)), 9); // année finie
  assert.equal(nbMoisEntames([], "2026-2027", le(2026, 10, 13)), 1);
});
