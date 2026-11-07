// Documents sur lesquels un poste appose son cachet, d'après la matrice
// « Qui signe quoi » de l'école (Comptes & Postes) : la liste suit les
// réglages de l'école au lieu d'une liste figée par poste.
import { DOCUMENTS_SIGNES, signatairesDocument } from "../../reports/signatures.js";

// Sections essayées pour les documents d'élève : le chef de section ne signe
// que ceux de SA section (primaire, préscolaire compris ; collège, lycée
// compris).
const SECTIONS_ESSAI = ["primaire", "college"];

// Libellés des documents que `cle` signe (principal ou visa), dans l'ordre de
// la matrice. Le signataire fictif porte un cachet : c'est lui qui imprime.
export function documentsSignesPar(schoolInfo, cle) {
  if (!cle) return [];
  const moi = { cle, nom: "", cachet: "cachet" };
  return DOCUMENTS_SIGNES
    .filter((doc) => (doc.section ? SECTIONS_ESSAI : [""]).some((section) =>
      signatairesDocument(schoolInfo, doc.id, { section, signataire: moi }).some((s) => s.cachet)))
    .map((doc) => doc.label);
}

// Bloc de l'aperçu : titre et nom tels qu'ils s'imprimeront, sur le premier
// document que ce poste signe. `nomSignature` : nom propre au compte.
export function identiteApercu(schoolInfo, cle, nomSignature = "") {
  const moi = { cle, nom: nomSignature, cachet: "cachet" };
  for (const doc of DOCUMENTS_SIGNES) {
    for (const section of doc.section ? SECTIONS_ESSAI : [""]) {
      const s = signatairesDocument(schoolInfo, doc.id, { section, signataire: moi }).find((x) => x.cachet);
      if (s) return { titre: s.titre, nom: s.nom };
    }
  }
  return null;
}
