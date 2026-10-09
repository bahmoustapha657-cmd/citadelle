// Lecture des fichiers importés (élèves, notes) : Excel, ancien Excel, CSV.
// Les fichiers sont fabriqués avec la même bibliothèque, comme les produirait
// Excel (dates = numéro de série + format), puis relus par le code de l'app.
import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { decoderTexte, lireTableur } from "../src/lecture-tableur.js";
import { parseEnrolmentFile } from "../src/components/comptabilite/enrolment-import.js";

// 15/03/2012 = numéro de série 40983. Excel FR enregistre une date tapée au
// format interne « m/d/yy » (affiché jj/mm/aaaa selon la langue du poste).
const SERIE_15_MARS_2012 = 40983;

function classeur(lignes, formats = {}, bookType = "xlsx") {
  const ws = XLSX.utils.aoa_to_sheet(lignes);
  for (const [adresse, z] of Object.entries(formats)) ws[adresse].z = z;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Élèves");
  return XLSX.write(wb, { bookType, type: "array" });
}

const octets = (texte) => new TextEncoder().encode(texte).buffer;

const LIGNES_ELEVES = [
  ["N°", "Élève", "Sexe", "Date de naissance", "Classe", "Téléphone"],
  [1, "BAH Aminata", "F", SERIE_15_MARS_2012, "7ème Année", "622000001"],
  [2, "DIALLO Sékou", "M", SERIE_15_MARS_2012, "7ème Année", "628000002"],
];

for (const bookType of ["xlsx", "biff8"]) {
  test(`${bookType} : une cellule date sort en ISO, quel que soit son format`, async () => {
    const buf = classeur(LIGNES_ELEVES, { D2: "m/d/yy", D3: "dd/mm/yyyy" }, bookType);
    const lignes = await lireTableur(buf, { texte: true });
    assert.equal(lignes[1][3], "2012-03-15"); // avant : « 3/15/12 », gardé tel quel
    assert.equal(lignes[2][3], "2012-03-15");
    assert.equal(lignes[2][1], "DIALLO Sékou");
    assert.equal(lignes[1][0], "1"); // mode texte : tout en chaînes
  });
}

test("CSV UTF-8 sans BOM : accents intacts (avant : « SÃ©kou »)", async () => {
  const lignes = await lireTableur(octets("Élève;Classe\nDIALLO Sékou;7ème Année\n"), { texte: true });
  assert.deepEqual(lignes, [["Élève", "Classe"], ["DIALLO Sékou", "7ème Année"]]);
});

test("CSV UTF-8 avec BOM : pas de caractère parasite dans le 1er en-tête", async () => {
  const buf = new Uint8Array([0xef, 0xbb, 0xbf, ...new Uint8Array(octets("Élève;Classe\nBAH;7ème\n"))]).buffer;
  const lignes = await lireTableur(buf, { texte: true });
  assert.equal(lignes[0][0], "Élève");
});

test("CSV Windows-1252 (Excel FR, séparateur point-virgule) : accents intacts", async () => {
  // « Sékou;7ème » en Windows-1252 : é = 0xE9, è = 0xE8.
  const buf = new Uint8Array([0x53, 0xe9, 0x6b, 0x6f, 0x75, 0x3b, 0x37, 0xe8, 0x6d, 0x65]).buffer;
  assert.deepEqual(await lireTableur(buf, { texte: true }), [["Sékou", "7ème"]]);
});

test("CSV : la date tapée est gardée telle quelle (jj/mm/aaaa, jamais relue à l'américaine)", async () => {
  const lignes = await lireTableur(octets("Nom;Date\nBAH;03/04/2012\nSOW;2012-04-03\n"), { texte: true });
  assert.equal(lignes[1][1], "03/04/2012");
  assert.equal(lignes[2][1], "2012-04-03");
});

test("mode brut (import de notes) : les nombres restent des nombres", async () => {
  const buf = classeur([["Élève", "Matière", "Type", "Période", "Note"], ["BAH Aminata", "Maths", "Devoir", "T1", 12.5]]);
  const [, ligne] = await lireTableur(buf);
  assert.deepEqual(ligne, ["BAH Aminata", "Maths", "Devoir", "T1", 12.5]);
});

test("decoderTexte : UTF-16 (export « texte Unicode » d'Excel)", () => {
  const utf16 = new Uint8Array([0xff, 0xfe, 0xc9, 0x00, 0x6c, 0x00]); // « Él »
  assert.equal(decoderTexte(utf16), "Él");
});

test("import élèves de bout en bout : date de naissance Excel enregistrée en ISO", async () => {
  const buf = classeur(LIGNES_ELEVES, { D2: "m/d/yy", D3: "m/d/yy" });
  const { preview, error } = await parseEnrolmentFile(buf, {
    classeDefautImport: "", ordreNomImport: "auto", tousElevesScolarite: [],
  });
  assert.equal(error, undefined);
  assert.deepEqual(preview.lignes.map((l) => [l.nom, l.prenom, l.dateNaissance]), [
    ["BAH", "Aminata", "2012-03-15"],
    ["DIALLO", "Sékou", "2012-03-15"],
  ]);
});

test("import élèves CSV : 03/04/2012 = 3 avril 2012", async () => {
  const { preview } = await parseEnrolmentFile(octets("Élève;Date de naissance\nBAH Aminata;03/04/2012\n"), {
    classeDefautImport: "7ème Année", ordreNomImport: "auto", tousElevesScolarite: [],
  });
  assert.equal(preview.lignes[0].dateNaissance, "2012-04-03");
});
