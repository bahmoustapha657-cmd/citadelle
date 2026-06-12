// Conversion des lignes brutes d'un fichier d'import en candidats élèves,
// avec validation (erreurs / avertissements) et détection des doublons.
import { getToutesClassesConnues } from "../../../constants";
import { findEnrollmentDuplicate, getEnrollmentDuplicateMessage } from "../../../enrollment-utils";

// Normalise une date vers le format ISO yyyy-mm-dd quand c'est possible.
const parseDate = (val) => {
  if (!val) return "";
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m1 = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (m1) return `${m1[3]}-${m1[2].padStart(2, "0")}-${m1[1].padStart(2, "0")}`;
  const m2 = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (m2) return `${m2[3]}-${m2[1].padStart(2, "0")}-${m2[2].padStart(2, "0")}`;
  return s;
};

// Sépare nom/prénom d'un libellé complet selon l'ordre choisi (auto/nom_prenom).
const splitNomPrenom = (complet, ordreNomImport) => {
  const parts = complet.trim().split(/\s+/);
  const premier = parts[0] || "";
  const premierEstMaj = premier.length > 1 && premier === premier.toUpperCase() && /[A-Z]/.test(premier);
  const nomEnPremier = ordreNomImport === "nom_prenom" || (ordreNomImport === "auto" && premierEstMaj);
  return nomEnPremier
    ? { nom: parts[0] || "", prenom: parts.slice(1).join(" ") || "" }
    : { nom: parts[parts.length - 1] || "", prenom: parts.slice(0, -1).join(" ") || "" };
};

// Construit la liste des lignes (candidats + erreurs/avertissements).
export function parseEnrolmentRows({ allRows, headerRowIdx, cols, classeDefautImport, ordreNomImport, tousElevesScolarite }) {
  const get = (row, idx) => idx >= 0 ? String(row[idx] || "").trim() : "";
  // Tous systèmes confondus (guinéen + francophone) : l'import reconnaît
  // les classes des deux nomenclatures.
  const classesConnues = getToutesClassesConnues().map(c => c.toLowerCase());
  const classesEcole = [...new Set(tousElevesScolarite.map(e => e.classe || "").filter(Boolean))].map(c => c.toLowerCase());

  const rows = allRows.slice(headerRowIdx + 1).filter(r => r.some(c => String(c || "").trim()));
  const lignes = [];
  const candidatsImport = [];
  for (const [i, r] of rows.entries()) {
    let nom = get(r, cols.nom);
    let prenom = get(r, cols.prenom);
    if ((!nom || !prenom) && cols.eleveComplet >= 0) {
      const complet = get(r, cols.eleveComplet);
      if (complet) {
        const sep = splitNomPrenom(complet, ordreNomImport);
        if (!nom) nom = sep.nom;
        if (!prenom) prenom = sep.prenom;
      }
    }
    const classe = get(r, cols.classe) || classeDefautImport;
    const sexeRaw = get(r, cols.sexe).toUpperCase();
    const sexe = sexeRaw === "F" || sexeRaw.startsWith("F") ? "F" : "M";
    const dateNaissance = parseDate(get(r, cols.date));
    const lieuNaissance = get(r, cols.lieuNaiss);
    const pereVal = get(r, cols.pere);
    const mereVal = get(r, cols.mere);
    const filiation = pereVal || mereVal
      ? [pereVal ? "Pere: " + pereVal : "", mereVal ? "Mere: " + mereVal : ""].filter(Boolean).join(" / ")
      : get(r, cols.filiation);
    const tuteur = get(r, cols.tuteur) || pereVal || mereVal;
    const contactTuteur = get(r, cols.contact);
    const domicile = get(r, cols.domicile);
    const ti = get(r, cols.typeInsc);
    const typeInscription = ti || "Premiere inscription";
    const matriculeFichier = get(r, cols.matricule);
    const ien = get(r, cols.ien) || (cols.ien < 0 ? matriculeFichier : "");
    const ligneCandidate = { nom, prenom, classe, sexe, dateNaissance, lieuNaissance, ien, tuteur, contactTuteur, filiation, domicile, typeInscription };
    const erreurs = [];
    const avertissements = [];
    if (!nom) erreurs.push("Nom manquant");
    if (!prenom) erreurs.push("Prenom manquant");
    if (!classe) avertissements.push("Classe non definie - selectionner une classe par defaut");
    else if (!classesEcole.includes(classe.toLowerCase()) && !classesConnues.includes(classe.toLowerCase())) {
      avertissements.push(`Classe "${classe}" non reconnue`);
    }
    if (!erreurs.length) {
      const doublonExistant = findEnrollmentDuplicate(ligneCandidate, tousElevesScolarite);
      if (doublonExistant) {
        erreurs.push(getEnrollmentDuplicateMessage(doublonExistant, ligneCandidate, { scope: "deja dans l'ecole" }));
      } else {
        const doublonImport = findEnrollmentDuplicate(ligneCandidate, candidatsImport);
        if (doublonImport) {
          erreurs.push(getEnrollmentDuplicateMessage(doublonImport, ligneCandidate, { scope: "deja dans ce fichier" }));
        } else {
          candidatsImport.push(ligneCandidate);
        }
      }
    }
    lignes.push({
      ...ligneCandidate,
      erreurs,
      avertissements,
      ligne: i + 2,
    });
  }

  return lignes;
}
