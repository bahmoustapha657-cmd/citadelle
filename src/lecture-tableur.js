// Lecture d'un fichier Excel (.xlsx, .xls) ou CSV importé par l'école :
// renvoie les lignes de la 1re feuille (tableau de tableaux).
//
// Deux pièges corrigés ici, communs à tous les imports :
//  • Dates Excel : une date tapée dans Excel est enregistrée au format
//    interne « m/d/yy » ; la lire en texte donnait « 3/15/12 », que l'import
//    gardait tel quel comme date de naissance. En mode texte, toute cellule
//    date d'un fichier Excel sort en ISO (aaaa-mm-jj), calculée sur le
//    numéro de série (aucun décalage de fuseau horaire possible).
//  • CSV : un fichier UTF-8 SANS BOM (LibreOffice, Google Sheets) était lu
//    comme du Latin-1 → « SÃ©kou » au lieu de « Sékou », élèves introuvables.
//    Le texte est décodé ici : UTF-8 strict, sinon Windows-1252 (CSV
//    « séparateur point-virgule » d'Excel FR).

const chargerXLSX = () => import("xlsx");

const SIGNATURES_BINAIRES = [
  [0x50, 0x4b, 0x03, 0x04], // zip : .xlsx, .xlsb, .ods
  [0xd0, 0xcf, 0x11, 0xe0], // OLE : .xls
];

function estBinaire(octets) {
  return SIGNATURES_BINAIRES.some((sig) => sig.every((b, i) => octets[i] === b));
}

// Décode un fichier texte (CSV, TXT) selon son BOM, sinon UTF-8 strict,
// sinon Windows-1252.
export function decoderTexte(octets) {
  if (octets[0] === 0xff && octets[1] === 0xfe) return new TextDecoder("utf-16le").decode(octets);
  if (octets[0] === 0xfe && octets[1] === 0xff) return new TextDecoder("utf-16be").decode(octets);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(octets);
  } catch {
    return new TextDecoder("windows-1252").decode(octets);
  }
}

// texte = true : toutes les valeurs en chaînes, dates en ISO (import élèves).
// texte = false : valeurs brutes (nombres conservés : import de notes).
export async function lireTableur(arrayBuffer, { texte = false } = {}) {
  const XLSX = await chargerXLSX();
  const octets = new Uint8Array(arrayBuffer);
  const binaire = estBinaire(octets);
  const wb = binaire
    ? XLSX.read(octets, { type: "array", cellNF: true })
    : XLSX.read(decoderTexte(octets), { type: "string", cellNF: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  // CSV : le texte tapé est gardé tel quel. SheetJS lit « 03/04/2012 » à
  // l'américaine (4 mars) ; l'import, lui, comprend jj/mm/aaaa (3 avril).
  if (texte && binaire) {
    for (const [adresse, cellule] of Object.entries(ws)) {
      if (adresse[0] === "!" || cellule.t !== "n" || !cellule.z) continue;
      if (XLSX.SSF.is_date(cellule.z)) cellule.w = XLSX.SSF.format("yyyy-mm-dd", cellule.v);
    }
  }
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: !texte });
}
