import { getAnnee } from "../../../constants";

// Logique de la grille de saisie. Deux modes :
//  - normal       : période + type figés ; colonnes = matières.
//  - multipériode : matière + type figés ; colonnes = périodes (saisir les
//                   2-3 compositions de l'année d'un coup).
// Clé de modification UNIFIÉE : `${eleveId}|${periode}|${matiere}`.
// eleveId (id Firestore) et periode (T1, S1…) ne contiennent jamais « | » ;
// la matière peut en contenir → on la reconstitue avec le reste.
export function useNotesGrille({
  eleves, notes, matieresForClasse, annee, ajN, toast, maxNote = 20,
  grilleClasse, grillePeriode, grilleType, periodes = [],
  multiPeriode = false, grilleMatiere = "",
  grilleChanges, setGrilleChanges, setGrilleSaving,
}) {
  const classesUniqN = [...new Set(eleves.map(e => e.classe || ""))].filter(Boolean).sort();
  const elevesGrille = (grilleClasse === "all" ? eleves : eleves.filter(e => e.classe === grilleClasse))
    .filter(e => e.statut === "Actif" || !e.statut)
    .sort((a, b) => (a.nom + a.prenom).localeCompare(b.nom + b.prenom));
  const matieresClasse = matieresForClasse(grilleClasse === "all" ? null : grilleClasse).map(m => m.nom);

  // Colonnes selon le mode : matières (normal) ou périodes (multipériode,
  // une fois la matière choisie — sinon rien à saisir).
  const colonnes = multiPeriode ? (grilleMatiere ? periodes : []) : matieresClasse;

  // Recherche d'une note existante pour CET élève (match eleveId, fallback
  // eleveNom complet pour les anciennes notes sans eleveId).
  const getNoteExist = (eleve, mat, periode) => {
    if (!eleve) return undefined;
    const fullName = `${eleve.nom || ""} ${eleve.prenom || ""}`.trim();
    return notes.find(n => {
      if (n.matiere !== mat || n.periode !== periode || n.type !== grilleType) return false;
      if (n.eleveId) return n.eleveId === eleve._id;
      return !!fullName && String(n.eleveNom || "").trim() === fullName;
    });
  };

  // En multipériode, la colonne EST la période et la matière est figée ;
  // sinon la colonne est la matière et la période est grillePeriode.
  const matierePour = (col) => (multiPeriode ? grilleMatiere : col);
  const periodePour = (col) => (multiPeriode ? col : grillePeriode);

  const valeurCellule = (eleve, col) => {
    const mat = matierePour(col);
    const periode = periodePour(col);
    const key = `${eleve._id}|${periode}|${mat}`;
    if (key in grilleChanges) return grilleChanges[key];
    return getNoteExist(eleve, mat, periode)?.note ?? "";
  };

  const cleCellule = (eleve, col) => `${eleve._id}|${periodePour(col)}|${matierePour(col)}`;

  const sauvegarderGrille = async () => {
    if (!Object.keys(grilleChanges).length) { toast("Aucune modification.", "info"); return; }
    setGrilleSaving(true);
    let nb = 0;
    const horsBareme = {};
    for (const [key, val] of Object.entries(grilleChanges)) {
      const [eleveId, periode, ...matParts] = key.split("|");
      const mat = matParts.join("|");
      if (val === "" || isNaN(Number(val))) continue;
      // Barème : aucune note hors 0..maxNote ne doit corrompre les moyennes.
      const valeur = Number(val);
      if (valeur < 0 || valeur > maxNote) { horsBareme[key] = val; continue; }
      const eleve = eleves.find(e => e._id === eleveId);
      if (!eleve || !mat || !periode) continue;
      const exist = getNoteExist(eleve, mat, periode);
      if (exist) { await ajN({ ...exist, note: valeur, annee: exist.annee || annee || getAnnee() }); }
      else { await ajN({ eleveId, eleveNom: `${eleve.nom || ""} ${eleve.prenom || ""}`.trim(), matiere: mat, type: grilleType, periode, note: valeur, annee: annee || getAnnee() }); }
      nb++;
    }
    setGrilleChanges(horsBareme);
    setGrilleSaving(false);
    const nbInvalides = Object.keys(horsBareme).length;
    if (nbInvalides > 0) {
      toast(`${nb} note(s) enregistrée(s) — ${nbInvalides} hors barème (0–${maxNote}) à corriger.`, "warning");
    } else {
      toast(`${nb} note(s) enregistrée(s)`, "success");
    }
  };

  return { classesUniqN, elevesGrille, matieresClasse, colonnes, valeurCellule, cleCellule, sauvegarderGrille };
}
