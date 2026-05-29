// Détection automatique des colonnes + construction de l'aperçu d'import élèves.
// Extrait de EnrolmentTab.jsx au refactor découpage 2026-05-29.

import { CLASSES_PRIMAIRE, CLASSES_COLLEGE, CLASSES_LYCEE } from "../../constants";
import { findEnrollmentDuplicate, getEnrollmentDuplicateMessage } from "../../enrollment-utils";

const loadXLSX = () => import("xlsx");

// Lit un fichier Excel/CSV et renvoie soit { error } soit { preview }.
// preview = { lignes, valides, mapping, nbAvert }.
export async function parseEnrolmentFile(arrayBuffer, { classeDefautImport, ordreNomImport, tousElevesScolarite }) {
  const XLSX = await loadXLSX();
  const wb = XLSX.read(arrayBuffer, { cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
  if (allRows.length < 2) return { error: "Fichier vide ou sans données" };

  const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, " ").trim();

  const HDR_KW = ["nom", "prenom", "eleve", "classe", "sexe", "date", "lieu", "pere", "mere", "telephone", "matricule", "naissance", "contact", "n°", "numero"];
  const scoreHdr = row => row.reduce((s, c) => {
    const hn = norm(String(c || ""));
    return s + (HDR_KW.some(k => hn === k || hn.startsWith(k + ' ') || hn.endsWith(' ' + k) || (' ' + hn + ' ').includes(' ' + k + ' ')) ? 1 : 0);
  }, 0);
  let headerRowIdx = 0, bestScore = scoreHdr(allRows[0]);
  for (let ri = 1; ri < Math.min(5, allRows.length - 1); ri++) {
    const sc = scoreHdr(allRows[ri]);
    if (sc > bestScore) { bestScore = sc; headerRowIdx = ri; }
  }

  const headers = allRows[headerRowIdx].map(h => String(h || ""));

  const wordMatch = (hn, v) => {
    if (hn === v) return true;
    const hnW = hn.split(/\s+/), vW = v.split(/\s+/);
    return vW.every(vw => hnW.some(hw => {
      if (hw === vw) return true;
      if (hw.length >= 3 && vw.length >= 3 && (hw.startsWith(vw) || vw.startsWith(hw))) return true;
      return false;
    }));
  };
  const findCol = (variants) => {
    for (const v of variants) {
      const idx = headers.findIndex(h => {
        const hn = norm(h);
        return hn && wordMatch(hn, v);
      });
      if (idx >= 0) return idx;
    }
    return -1;
  };
  const cols = {
    num: findCol(["n", "no", "num", "numero"]),
    matricule: findCol(["matricule", "mat", "numero eleve", "id eleve"]),
    eleveComplet: findCol(["eleve", "noms et prenoms", "nom et prenom", "nom complet", "prenom et nom", "nomcomplet", "nom prenom", "full name"]),
    nom: findCol(["nom eleve", "nom de l eleve", "nom famille", "last name", "surname", "noms", "nom"]),
    prenom: findCol(["prenom eleve", "prenom de l eleve", "prenoms", "first name", "given name", "forename", "prenom"]),
    classe: findCol(["classe", "class", "niveau", "section", "group"]),
    sexe: findCol(["sexe", "genre", "sex", "gender", "masculin", "feminin"]),
    date: findCol(["date naissance", "date de naissance", "date naiss", "ne le", "dob", "birth"]),
    lieuNaiss: findCol(["lieu naissance", "lieu de naissance", "lieu naiss", "ville naissance", "birthplace", "born in", "ne a"]),
    pere: findCol(["pere", "father", "papa", "nom pere"]),
    mere: findCol(["mere", "mother", "maman", "nom mere"]),
    filiation: findCol(["pere et mere", "filiation", "parents", "famille"]),
    tuteur: findCol(["tuteur", "responsable", "gardien", "tuteur legal"]),
    contact: findCol(["telephone", "tel", "phone", "mobile", "gsm", "numero telephone", "contact"]),
    domicile: findCol(["domicile", "adresse", "quartier", "residence", "localite"]),
    typeInsc: findCol(["type inscription", "type inscript", "reinscription", "premiere inscription"]),
    ien: findCol(["ien", "identifiant national", "id national", "matricule national", "identifiant"]),
  };
  if (cols.nom >= 0 && cols.nom === cols.prenom) {
    if (cols.eleveComplet < 0) cols.eleveComplet = cols.nom;
    cols.nom = -1; cols.prenom = -1;
  }

  const parseDate = val => {
    if (!val) return "";
    const s = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const m1 = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
    if (m1) return `${m1[3]}-${m1[2].padStart(2, "0")}-${m1[1].padStart(2, "0")}`;
    const m2 = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (m2) return `${m2[3]}-${m2[1].padStart(2, "0")}-${m2[2].padStart(2, "0")}`;
    return s;
  };

  const get = (row, idx) => idx >= 0 ? String(row[idx] || "").trim() : "";
  const classesConnues = [...CLASSES_COLLEGE, ...CLASSES_PRIMAIRE, ...CLASSES_LYCEE].map(c => c.toLowerCase());
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
        const parts = complet.trim().split(/\s+/);
        const premier = parts[0] || "";
        const premierEstMaj = premier.length > 1 && premier === premier.toUpperCase() && /[A-Z]/.test(premier);
        const nomEnPremier = ordreNomImport === "nom_prenom"
          || (ordreNomImport === "auto" && premierEstMaj);
        if (nomEnPremier) {
          if (!nom) nom = parts[0] || "";
          if (!prenom) prenom = parts.slice(1).join(" ") || "";
        } else {
          if (!nom) nom = parts[parts.length - 1] || "";
          if (!prenom) prenom = parts.slice(0, -1).join(" ") || "";
        }
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

  const champLabels = { num: "N°(ignoré)", matricule: "Matricule→IEN", eleveComplet: "Élève", nom: "Nom", prenom: "Prénom", classe: "Classe", sexe: "Sexe", date: "Date naissance", lieuNaiss: "Lieu naissance", pere: "Père", mere: "Mère", filiation: "Père et Mère (combiné)", tuteur: "Tuteur", contact: "Téléphone", domicile: "Domicile", typeInsc: "Type inscription", ien: "IEN" };
  const mapping = Object.entries(cols).map(([k, idx]) => ({ champ: champLabels[k], colonne: idx >= 0 ? headers[idx] : null, idx }));

  return {
    preview: {
      lignes,
      valides: lignes.filter(l => !l.erreurs.length),
      mapping,
      nbAvert: lignes.filter(l => !l.erreurs.length && l.avertissements?.length).length,
    },
  };
}

// Génère le classeur Excel modèle (gabarit de saisie). `t` = fonction i18n.
export async function buildEnrolmentTemplate(t) {
  const XLSX = await loadXLSX();
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    [t("reports.excel.template.n"), t("reports.excel.template.matricule"), t("reports.excel.template.student"), t("reports.excel.template.sex"), t("reports.excel.template.dateOfBirth"), t("reports.excel.template.birthPlace"), t("reports.excel.template.father"), t("reports.excel.template.mother"), t("reports.excel.template.phone")],
    [1, "", "BAH Aminata", "F", "2012-03-15", "Conakry", "Mamadou Bah", "Fatoumata Diallo", "622000001"],
    [2, "", "DIALLO Ibrahima Sékou", "M", "2013-07-22", "Kindia", "Boubacar Diallo", "Mariama Bah", "628000002"],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, t("reports.excel.template.sheetStudents"));
  return wb;
}
