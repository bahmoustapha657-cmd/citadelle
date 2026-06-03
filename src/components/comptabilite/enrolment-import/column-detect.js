// Détection automatique de la ligne d'en-tête et des colonnes d'un fichier
// d'import élèves (Excel/CSV). Logique pure, sans dépendance XLSX ni DOM.

// Normalise une chaîne : minuscules, sans accents, alphanumérique espacé.
export const norm = (s) =>
  String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, " ").trim();

const HDR_KW = ["nom", "prenom", "eleve", "classe", "sexe", "date", "lieu", "pere", "mere", "telephone", "matricule", "naissance", "contact", "n°", "numero"];

// Score d'une ligne candidate à être l'en-tête (nb de mots-clés reconnus).
const scoreHdr = (row) => row.reduce((s, c) => {
  const hn = norm(String(c || ""));
  return s + (HDR_KW.some(k => hn === k || hn.startsWith(k + ' ') || hn.endsWith(' ' + k) || (' ' + hn + ' ').includes(' ' + k + ' ')) ? 1 : 0);
}, 0);

// Égalité souple mot à mot (préfixes de 3+ caractères acceptés).
const wordMatch = (hn, v) => {
  if (hn === v) return true;
  const hnW = hn.split(/\s+/), vW = v.split(/\s+/);
  return vW.every(vw => hnW.some(hw => {
    if (hw === vw) return true;
    if (hw.length >= 3 && vw.length >= 3 && (hw.startsWith(vw) || vw.startsWith(hw))) return true;
    return false;
  }));
};

const CHAMP_LABELS = { num: "N°(ignoré)", matricule: "Matricule→IEN", eleveComplet: "Élève", nom: "Nom", prenom: "Prénom", classe: "Classe", sexe: "Sexe", date: "Date naissance", lieuNaiss: "Lieu naissance", pere: "Père", mere: "Mère", filiation: "Père et Mère (combiné)", tuteur: "Tuteur", contact: "Téléphone", domicile: "Domicile", typeInsc: "Type inscription", ien: "IEN" };

// Détecte la ligne d'en-tête (parmi les 5 premières) et mappe chaque champ
// connu vers son index de colonne. Renvoie { headers, headerRowIdx, cols, champLabels }.
export function detectColumns(allRows) {
  let headerRowIdx = 0, bestScore = scoreHdr(allRows[0]);
  for (let ri = 1; ri < Math.min(5, allRows.length - 1); ri++) {
    const sc = scoreHdr(allRows[ri]);
    if (sc > bestScore) { bestScore = sc; headerRowIdx = ri; }
  }

  const headers = allRows[headerRowIdx].map(h => String(h || ""));

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

  return { headers, headerRowIdx, cols, champLabels: CHAMP_LABELS };
}
