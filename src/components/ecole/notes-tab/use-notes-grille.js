import { getAnnee } from "../../../constants";

// Logique de la grille de saisie : élèves/matières affichés selon les filtres,
// résolution de la note existante par élève, valeur de cellule (édition locale
// prioritaire) et enregistrement groupé du lot de modifications.
export function useNotesGrille({
  eleves, notes, matieresForClasse, annee, ajN, toast,
  grilleClasse, grillePeriode, grilleType,
  grilleChanges, setGrilleChanges, setGrilleSaving,
}) {
  const classesUniqN = [...new Set(eleves.map(e => e.classe || ""))].filter(Boolean).sort();
  const elevesGrille = (grilleClasse === "all" ? eleves : eleves.filter(e => e.classe === grilleClasse))
    .filter(e => e.statut === "Actif" || !e.statut)
    .sort((a, b) => (a.nom + a.prenom).localeCompare(b.nom + b.prenom));
  const matieresCols = matieresForClasse(grilleClasse === "all" ? null : grilleClasse).map(m => m.nom);

  // Recherche d'une note existante pour CET élève (et pas un autre).
  // Match par eleveId en priorité ; fallback strict sur eleveNom complet
  // (legacy : anciennes notes sans eleveId).
  const getNoteExist = (eleve, mat) => {
    if (!eleve) return undefined;
    const fullName = `${eleve.nom || ""} ${eleve.prenom || ""}`.trim();
    return notes.find(n => {
      if (n.matiere !== mat || n.periode !== grillePeriode || n.type !== grilleType) return false;
      if (n.eleveId) return n.eleveId === eleve._id;
      return !!fullName && String(n.eleveNom || "").trim() === fullName;
    });
  };

  const valeurCellule = (eleve, mat) => {
    const key = `${eleve._id}|${mat}`;
    if (key in grilleChanges) return grilleChanges[key];
    return getNoteExist(eleve, mat)?.note ?? "";
  };

  const sauvegarderGrille = async () => {
    if (!Object.keys(grilleChanges).length) { toast("Aucune modification.", "info"); return; }
    setGrilleSaving(true);
    let nb = 0;
    for (const [key, val] of Object.entries(grilleChanges)) {
      const [eleveId, ...matParts] = key.split("|");
      const mat = matParts.join("|");
      if (val === "" || isNaN(Number(val))) continue;
      const eleve = eleves.find(e => e._id === eleveId);
      if (!eleve) continue;
      const exist = getNoteExist(eleve, mat);
      if (exist) { await ajN({ ...exist, note: Number(val), annee: exist.annee || annee || getAnnee() }); }
      else { await ajN({ eleveId, eleveNom: `${eleve.nom || ""} ${eleve.prenom || ""}`.trim(), matiere: mat, type: grilleType, periode: grillePeriode, note: Number(val), annee: annee || getAnnee() }); }
      nb++;
    }
    setGrilleChanges({});
    setGrilleSaving(false);
    toast(`${nb} note(s) enregistrée(s)`, "success");
  };

  return { classesUniqN, elevesGrille, matieresCols, valeurCellule, sauvegarderGrille };
}
