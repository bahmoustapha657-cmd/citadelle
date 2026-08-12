// Temps réel Supabase : traduction d'un événement Postgres en patch de liste.
// L'enjeu n'est pas cosmétique — un patch faux affiche durablement une donnée
// périmée (le rechargement complet n'a lieu qu'au retour sur l'onglet).
import test from "node:test";
import assert from "node:assert/strict";
import { construirePatch, dansPerimetre } from "../src/backend/realtime-patch.js";

const ANNEE = "2025-2026";
const ligneNote = (extra = {}) => ({
  id: "n1", ecole_id: "ec1", section: "primaire", eleve_id: "e1",
  matiere: "Maths", type: "Composition", periode: "T1", note: 14, annee: ANNEE,
  enseignant_nom: "Diallo", ...extra,
});

test("INSERT dans le périmètre → upsert avec l'item au format applicatif", () => {
  const patch = construirePatch(
    { eventType: "INSERT", new: ligneNote(), old: {} }, "notes", "primaire", ANNEE,
  );
  assert.equal(patch.type, "upsert");
  // Le contrat clé : même forme que ce que renvoie la lecture normale
  // (camelCase + _id), sinon les écrans reçoivent un item bâtard.
  assert.equal(patch.item._id, "n1");
  assert.equal(patch.item.eleveId, "e1");
  assert.equal(patch.item.enseignantNom, "Diallo");
  assert.equal(patch.item.note, 14);
});

test("UPDATE d'une autre section est ignoré", () => {
  const patch = construirePatch(
    { eventType: "UPDATE", new: ligneNote({ section: "college" }), old: ligneNote() },
    "notes", "primaire", ANNEE,
  );
  // Le collège ne doit pas polluer la vue primaire : la ligne quitte le
  // périmètre → on la retire au lieu de l'ajouter.
  assert.deepEqual(patch, { type: "delete", id: "n1" });
});

test("UPDATE d'une autre année est ignoré (vue archive comprise)", () => {
  const patch = construirePatch(
    { eventType: "UPDATE", new: ligneNote({ annee: "2024-2025" }), old: {} },
    "notes", "primaire", ANNEE,
  );
  assert.deepEqual(patch, { type: "delete", id: "n1" });
});

test("UPDATE qui fait ENTRER une ligne dans le périmètre → upsert", () => {
  const patch = construirePatch(
    { eventType: "UPDATE", new: ligneNote(), old: ligneNote({ section: "college" }) },
    "notes", "primaire", ANNEE,
  );
  assert.equal(patch.type, "upsert");
  assert.equal(patch.item._id, "n1");
});

test("DELETE → retrait par id (replica identity full)", () => {
  const patch = construirePatch(
    { eventType: "DELETE", new: {}, old: ligneNote() }, "notes", "primaire", ANNEE,
  );
  assert.deepEqual(patch, { type: "delete", id: "n1" });
});

test("DELETE réduit à la clé primaire → retrait quand même", () => {
  // Sans REPLICA IDENTITY FULL, `old` ne porte que l'id : on ne peut plus
  // vérifier la section, mais retirer un id absent de la liste est inoffensif.
  const patch = construirePatch(
    { eventType: "DELETE", new: {}, old: { id: "n1" } }, "notes", "primaire", ANNEE,
  );
  assert.deepEqual(patch, { type: "delete", id: "n1" });
});

test("payload inexploitable → rechargement complet, jamais de perte silencieuse", () => {
  assert.deepEqual(
    construirePatch({ eventType: "DELETE", new: {}, old: {} }, "notes", "primaire", ANNEE),
    { type: "reload" },
  );
  assert.deepEqual(
    construirePatch({ eventType: "UPDATE", new: {}, old: {} }, "notes", "primaire", ANNEE),
    { type: "reload" },
  );
});

test("table sans section ni année (comptabilité) : tout ce qui arrive est pour nous", () => {
  const patch = construirePatch(
    { eventType: "INSERT", new: { id: "r1", ecole_id: "ec1", annee: ANNEE, date: "2026-01-05", montant: "5000", extra: { libelle: "Scolarité" } }, old: {} },
    "recettes", null, ANNEE,
  );
  assert.equal(patch.type, "upsert");
  assert.equal(patch.item.montant, 5000); // numérique, comme à la lecture
  assert.equal(patch.item.libelle, "Scolarité");
});

test("dansPerimetre : une colonne absente ne disqualifie pas la ligne", () => {
  // Les tables « document » (annonces, historique…) n'ont ni section ni année :
  // exiger ces colonnes ferait taire leur temps réel.
  assert.equal(dansPerimetre({ id: "a1" }, "primaire", ANNEE), true);
  assert.equal(dansPerimetre({ id: "a1", section: "primaire" }, "primaire", null), true);
  assert.equal(dansPerimetre({ id: "a1", section: "lycee" }, "primaire", null), false);
});
