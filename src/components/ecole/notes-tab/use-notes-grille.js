import { getAnnee } from "../../../constants";

// Logique de la grille de saisie. Trois modes (un axe figé car élève ×
// matière × période ne tient pas en 2D) :
//   "periode" : période figée  → lignes = élèves,   colonnes = matières
//   "matiere" : matière figée  → lignes = élèves,   colonnes = périodes
//   "eleve"   : élève figé      → lignes = matières, colonnes = périodes (bulletin)
// Chaque cellule est résolue en (eleveId, periode, matiere). Clé de
// modification UNIFIÉE : `${eleveId}|${periode}|${matiere}` (eleveId et
// periode ne contiennent jamais « | » ; la matière est reconstituée).
export function useNotesGrille({
  eleves, notes, matieresForClasse, annee, ajN, toast, maxNote = 20,
  grilleClasse, grillePeriode, grilleType, periodes = [],
  grilleMode = "periode", grilleMatiere = "", grilleEleve = "",
  grilleChanges, setGrilleChanges, setGrilleSaving,
}) {
  const classesUniqN = [...new Set(eleves.map(e => e.classe || ""))].filter(Boolean).sort();
  const elevesGrille = (grilleClasse === "all" ? eleves : eleves.filter(e => e.classe === grilleClasse))
    .filter(e => e.statut === "Actif" || !e.statut)
    .sort((a, b) => (a.nom + a.prenom).localeCompare(b.nom + b.prenom));

  const eleveById = (id) => eleves.find(e => e._id === id) || null;
  const eleveCourant = grilleMode === "eleve" ? eleveById(grilleEleve) : null;
  // Matières applicables : à la classe filtrée, ou à la classe de l'élève
  // figé en mode "eleve".
  const matieresClasse = matieresForClasse(
    grilleMode === "eleve" ? (eleveCourant?.classe || null) : (grilleClasse === "all" ? null : grilleClasse),
  ).map(m => m.nom);

  // Lignes et colonnes selon le mode.
  const nomEleve = (e) => `${e.nom} ${e.prenom}`.trim();
  let lignes = [];
  let colonnes = [];
  if (grilleMode === "eleve") {
    colonnes = eleveCourant ? periodes : [];
    lignes = eleveCourant ? matieresClasse.map(m => ({ key: m, label: m, sub: "" })) : [];
  } else if (grilleMode === "matiere") {
    colonnes = grilleMatiere ? periodes : [];
    lignes = elevesGrille.map(e => ({ key: e._id, label: nomEleve(e), sub: e.classe }));
  } else {
    colonnes = matieresClasse;
    lignes = elevesGrille.map(e => ({ key: e._id, label: nomEleve(e), sub: e.classe }));
  }

  // (ligneKey, colonne) → { eleveId, periode, matiere } selon le mode.
  const resoudre = (ligneKey, col) => {
    if (grilleMode === "eleve") return { eleveId: grilleEleve, periode: col, matiere: ligneKey };
    if (grilleMode === "matiere") return { eleveId: ligneKey, periode: col, matiere: grilleMatiere };
    return { eleveId: ligneKey, periode: grillePeriode, matiere: col };
  };

  // Recherche d'une note existante (match eleveId, fallback eleveNom complet).
  const getNoteExist = (eleveId, mat, periode) => {
    const eleve = eleveById(eleveId);
    const fullName = eleve ? nomEleve(eleve) : "";
    return notes.find(n => {
      if (n.matiere !== mat || n.periode !== periode || n.type !== grilleType) return false;
      if (n.eleveId) return n.eleveId === eleveId;
      return !!fullName && String(n.eleveNom || "").trim() === fullName;
    });
  };

  const cleCellule = (ligneKey, col) => {
    const { eleveId, periode, matiere } = resoudre(ligneKey, col);
    return `${eleveId}|${periode}|${matiere}`;
  };

  const valeurCellule = (ligneKey, col) => {
    const { eleveId, periode, matiere } = resoudre(ligneKey, col);
    const key = `${eleveId}|${periode}|${matiere}`;
    if (key in grilleChanges) return grilleChanges[key];
    return getNoteExist(eleveId, matiere, periode)?.note ?? "";
  };

  const sauvegarderGrille = async () => {
    if (!Object.keys(grilleChanges).length) { toast("Aucune modification.", "info"); return; }
    setGrilleSaving(true);
    let nb = 0;
    const horsBareme = {};
    const ecritures = [];
    for (const [key, val] of Object.entries(grilleChanges)) {
      const [eleveId, periode, ...matParts] = key.split("|");
      const mat = matParts.join("|");
      if (val === "" || isNaN(Number(val))) continue;
      const valeur = Number(val);
      if (valeur < 0 || valeur > maxNote) { horsBareme[key] = val; continue; }
      const eleve = eleveById(eleveId);
      if (!eleve || !mat || !periode) continue;
      const exist = getNoteExist(eleveId, mat, periode);
      // IMPORTANT : ne PAS « await » chaque écriture. Avec la persistance
      // hors ligne, addDoc/updateDoc s'appliquent au cache local tout de
      // suite mais leur promesse n'est tenue qu'après confirmation serveur —
      // l'attendre bloquerait toute la sauvegarde hors ligne. On déclenche
      // l'écriture (mise en file locale) et on poursuit l'UI immédiatement.
      ecritures.push(
        exist
          ? ajN({ ...exist, note: valeur, annee: exist.annee || annee || getAnnee() })
          : ajN({ eleveId, eleveNom: nomEleve(eleve), matiere: mat, type: grilleType, periode, note: valeur, annee: annee || getAnnee() }),
      );
      nb++;
    }
    // Remontée d'erreur en arrière-plan (ex. permission refusée en ligne).
    // Hors ligne, ces promesses restent en attente sans erreur — normal.
    Promise.allSettled(ecritures).then((res) => {
      const echecs = res.filter(r => r.status === "rejected").length;
      if (echecs > 0) toast(`${echecs} note(s) non enregistrée(s) — vérifiez vos droits ou réessayez.`, "error");
    });

    setGrilleChanges(horsBareme);
    setGrilleSaving(false);
    const nbInvalides = Object.keys(horsBareme).length;
    const horsLigne = typeof navigator !== "undefined" && navigator.onLine === false;
    const suffixeOffline = horsLigne ? " (hors ligne — synchronisé au retour en ligne)" : "";
    if (nbInvalides > 0) {
      toast(`${nb} note(s) enregistrée(s)${suffixeOffline} — ${nbInvalides} hors barème (0–${maxNote}) à corriger.`, "warning");
    } else {
      toast(`${nb} note(s) enregistrée(s)${suffixeOffline}`, "success");
    }
  };

  return { classesUniqN, elevesGrille, matieresClasse, lignes, colonnes, valeurCellule, cleCellule, sauvegarderGrille };
}
