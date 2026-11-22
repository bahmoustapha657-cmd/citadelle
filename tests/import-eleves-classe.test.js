// Import d'élèves : une ligne sans classe est bloquée, plus jamais importée.
// Le modèle Excel n'a pas de colonne Classe : la classe à affecter se choisit
// dans la modale, avant ou après le fichier.
import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { parseEnrolmentFile } from "../src/components/comptabilite/enrolment-import.js";

const ENTETE_MODELE = ["N°", "Matricule", "Élève", "Sexe", "Père", "Mère"];
const LIGNE_MODELE = [1, "", "BAH Aminata", "F", "Mamadou Bah", "Fatoumata Diallo"];

function classeur(lignes) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(lignes), "Élèves");
  return XLSX.write(wb, { bookType: "xlsx", type: "array" });
}

const lire = (ab, classeDefautImport = "") =>
  parseEnrolmentFile(ab, { classeDefautImport, ordreNomImport: "auto", tousElevesScolarite: [] });

test("sans colonne Classe ni classe à affecter : la ligne est bloquée", async () => {
  const { preview } = await lire(classeur([ENTETE_MODELE, LIGNE_MODELE]));
  assert.equal(preview.valides.length, 0);
  assert.match(preview.lignes[0].erreurs.join(), /Classe manquante/);
});

test("une cellule Classe vide bloque sa seule ligne", async () => {
  const { preview } = await lire(classeur([
    [...ENTETE_MODELE, "Classe"],
    [...LIGNE_MODELE, "7ème Année"],
    [2, "", "DIALLO Sékou", "M", "Alpha Diallo", "Hawa Sow", "  "],
  ]));
  assert.deepEqual(preview.valides.map((l) => l.nom), ["BAH"]);
  assert.match(preview.lignes[1].erreurs.join(), /Classe manquante/);
});

test("la classe à affecter, choisie après le fichier, débloque les lignes", async () => {
  const ab = classeur([ENTETE_MODELE, LIGNE_MODELE]);
  assert.equal((await lire(ab)).preview.valides.length, 0);
  // Même fichier relu : c'est ce que fait la modale au changement de classe.
  const { preview } = await lire(ab, "7ème Année");
  assert.deepEqual(preview.valides.map((l) => l.classe), ["7ème Année"]);
});

test("une classe inconnue reste un simple avertissement : elle sera créée", async () => {
  const { preview } = await lire(classeur([[...ENTETE_MODELE, "Classe"], [...LIGNE_MODELE, "Classe Spéciale"]]));
  assert.equal(preview.valides.length, 1);
  assert.match(preview.lignes[0].avertissements.join(), /non reconnue/);
});

// Liste exportée par EduGest puis réimportée : « Code élève » (le numéro
// qu'EduGest donne) n'est pas le nom de l'élève, et « Matricule » (celui de
// DGECS) va dans le champ `ien`.
test("export réimporté : le code élève est ignoré, le matricule va dans ien", async () => {
  const { preview } = await lire(classeur([
    ["Code élève", "Matricule", "Élève", "Classe", "Sexe", "Père", "Mère"],
    ["C-25-001", "MA25032033", "BAH Aminata", "7ème Année", "F", "Mamadou Bah", "Fatoumata Diallo"],
  ]));
  const [ligne] = preview.lignes;
  assert.equal(`${ligne.nom} ${ligne.prenom}`, "BAH Aminata");
  assert.equal(ligne.ien, "MA25032033");
});

test("modèle anglais : la colonne Student number donne le matricule", async () => {
  const { preview } = await lire(classeur([
    ["No.", "Student number", "Student", "Sex", "Father", "Mother"],
    [1, "MA25032033", "BAH Aminata", "F", "Mamadou Bah", "Fatoumata Diallo"],
  ]), "7ème Année");
  assert.equal(preview.lignes[0].ien, "MA25032033");
});
