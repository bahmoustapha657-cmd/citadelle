import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { ligneCarteEnseignant } from "../src/components/ecole/ecole-logic.js";
import { getSessionPermissions, hasRead } from "../shared/postes-config.js";

// Les chefs de section (Direction primaire, Bureau collège…) ne doivent pas
// voir le salaire des enseignants. L'onglet Enseignants du module École
// affichait le forfait mensuel sur chaque carte du primaire, à quiconque
// ouvrait le module. Le forfait est désormais réservé à qui lit la
// Comptabilité ; les autres voient la classe dont l'enseignant est titulaire.

const RACINE = join(fileURLToPath(import.meta.url), "..", "..");
const titulaire = { prenom: "Aïssatou", nom: "Diallo", classeTitle: "CM1", montantForfait: 1500000, matiere: "" };

test("chef de section : la carte montre la classe, jamais le forfait", () => {
  const ligne = ligneCarteEnseignant(titulaire, { isPrimarySection: true, voitSalaires: false });
  assert.equal(ligne, "Titulaire · CM1");
  assert.doesNotMatch(ligne, /forfait|GNF|500/i);
});

test("chef de section : sans classe de titulaire, la matière (ou rien) — toujours pas de montant", () => {
  assert.equal(ligneCarteEnseignant({ ...titulaire, classeTitle: "" }, { isPrimarySection: true }), "");
  assert.equal(
    ligneCarteEnseignant({ ...titulaire, classeTitle: "", matiere: "Anglais" }, { isPrimarySection: true }),
    "Anglais",
  );
  // Ancien champ de base salariale : même règle.
  const ligne = ligneCarteEnseignant({ salaireBase: 900000 }, { isPrimarySection: true });
  assert.doesNotMatch(ligne, /GNF|900/);
});

test("qui lit la Comptabilité garde le forfait sur la carte", () => {
  const ligne = ligneCarteEnseignant(titulaire, { isPrimarySection: true, voitSalaires: true });
  assert.match(ligne, /^Forfait 1.500.000 GNF$/);
});

test("secondaire et maternelle : la matière, comme avant", () => {
  const prof = { matiere: "Mathématiques", montantForfait: 800000 };
  assert.equal(ligneCarteEnseignant(prof, { isPrimarySection: false, voitSalaires: true }), "Mathématiques");
  assert.equal(ligneCarteEnseignant(prof, { isPrimarySection: false, voitSalaires: false }), "Mathématiques");
});

test("les chefs de section ne lisent pas la Comptabilité ; la direction et le comptable si", () => {
  for (const role of ["primaire", "college", "surveillant"]) {
    assert.equal(hasRead(getSessionPermissions({ role }), "compta"), false, role);
  }
  for (const role of ["direction", "comptable"]) {
    assert.equal(hasRead(getSessionPermissions({ role }), "compta"), true, role);
  }
  // Poste personnalisé : la carte du poste fait foi, dans les deux sens.
  const principal = { role: "staff", permissions: { secondaire: "ecriture", calendrier: "lecture" } };
  assert.equal(hasRead(getSessionPermissions(principal), "compta"), false);
  const intendant = { role: "staff", permissions: { primaire: "lecture", compta: "lecture" } };
  assert.equal(hasRead(getSessionPermissions(intendant), "compta"), true);
});

test("garde-fou : l'onglet Enseignants ne calcule plus le forfait lui-même", () => {
  const liste = readFileSync(join(RACINE, "src/components/ecole/ens-tab/EnsListe.jsx"), "utf8");
  assert.doesNotMatch(liste, /getTeacherMonthlyForfait|montantForfait|salaireBase/);
  assert.match(liste, /ligneCarteEnseignant\(e, \{ isPrimarySection, voitSalaires \}\)/);
  const hook = readFileSync(join(RACINE, "src/components/ecole/use-ecole.js"), "utf8");
  assert.match(hook, /const voitSalaires = hasRead\(permissions, "compta"\);/);
});
