import { comparerClassesParNiveau, getAnnee } from "../../../constants";
import { nomEleve } from "../../../fiche-eleve";
import { nomAffiche, trierElevesAlpha } from "../../../ordre-eleves";
import { moisDeNote } from "../../../note-utils";
import { estPeriodeMois } from "../../../period-utils";
import { champMois, colonnesPeriodes, jetonPeriode, lireJetonPeriode, moisAEnregistrer } from "../../../notes-mois";
import { libellePeriodeNote } from "../../../i18n/libelles";

// Logique de la grille de saisie. Trois modes (un axe figé car élève ×
// matière × période ne tient pas en 2D) :
//   "periode" : période figée  → lignes = élèves,   colonnes = matières
//   "matiere" : matière figée  → lignes = élèves,   colonnes = périodes
//   "eleve"   : élève figé      → lignes = matières, colonnes = périodes (bulletin)
// Chaque cellule est résolue en (eleveId, jeton, matiere), où le jeton est la
// période, suivie du mois pour une forme qui en porte un (« T1:Oct », cf.
// notes-mois.js). Clé de modification UNIFIÉE : `${eleveId}|${jeton}|${matiere}`
// (eleveId et jeton ne contiennent jamais « | » ; la matière est reconstituée).
//
// Mois des oraux et écrits du secondaire : en mode « periode », le mois choisi
// dans la barre (grilleMois) ; dans les deux autres, une colonne par mois de
// chaque période. En périodicité mensuelle, la période est le mois.
export function useNotesGrille({
  eleves, notes, matieresForClasse, annee, ajN, toast, maxNote = 20,
  grilleClasse, grillePeriode, grilleType, periodes = [],
  grilleMode = "periode", grilleMatiere = "", grilleEleve = "",
  grilleMois = "", moisAnnee = [], section = "",
  grilleChanges, setGrilleChanges, setGrilleSaving, triEleves,
}) {
  const classesUniqN = [...new Set(eleves.map(e => e.classe || ""))].filter(Boolean).sort(comparerClassesParNiveau);
  // Ordre et écriture des noms : ceux de l'école (Paramètres → Affichage).
  const elevesGrille = trierElevesAlpha((grilleClasse === "all" ? eleves : eleves.filter(e => e.classe === grilleClasse))
    .filter(e => e.statut === "Actif" || !e.statut), triEleves);

  const eleveById = (id) => eleves.find(e => e._id === id) || null;
  const eleveCourant = grilleMode === "eleve" ? eleveById(grilleEleve) : null;
  // Matières applicables : à la classe filtrée, ou à la classe de l'élève
  // figé en mode "eleve".
  const matieresClasse = matieresForClasse(
    grilleMode === "eleve" ? (eleveCourant?.classe || null) : (grilleClasse === "all" ? null : grilleClasse),
  ).map(m => m.nom);

  // Champ Mois du mode « periode » : demandé pour un oral ou un écrit du
  // secondaire hors périodicité mensuelle ; tant qu'il n'est pas choisi, la
  // grille reste vide.
  const champ = champMois({ type: grilleType, section, periode: grillePeriode, moisAnnee });
  const moisManquant = grilleMode === "periode" && champ.visible && !champ.choix.includes(grilleMois);
  const colonnesDePeriodes = colonnesPeriodes(periodes, { avecMois: champ.avecMois, moisAnnee }).map((c) => c.jeton);

  // Lignes et colonnes selon le mode.
  let lignes = [];
  let colonnes = [];
  if (grilleMode === "eleve") {
    colonnes = eleveCourant ? colonnesDePeriodes : [];
    lignes = eleveCourant ? matieresClasse.map(m => ({ key: m, label: m, sub: "" })) : [];
  } else if (grilleMode === "matiere") {
    colonnes = grilleMatiere ? colonnesDePeriodes : [];
    lignes = elevesGrille.map(e => ({ key: e._id, label: nomAffiche(e, triEleves), sub: e.classe }));
  } else {
    colonnes = moisManquant ? [] : matieresClasse;
    lignes = elevesGrille.map(e => ({ key: e._id, label: nomAffiche(e, triEleves), sub: e.classe }));
  }

  // (ligneKey, colonne) → { eleveId, jeton, matiere } selon le mode.
  const jetonGrille = jetonPeriode(grillePeriode, champ.visible ? grilleMois : "");
  const resoudre = (ligneKey, col) => {
    if (grilleMode === "eleve") return { eleveId: grilleEleve, jeton: col, matiere: ligneKey };
    if (grilleMode === "matiere") return { eleveId: ligneKey, jeton: col, matiere: grilleMatiere };
    return { eleveId: ligneKey, jeton: jetonGrille, matiere: col };
  };

  // Mois d'une cellule : celui du jeton, la période elle-même au mois, rien
  // pour une forme sans mois (composition…).
  const moisCellule = ({ periode, mois }) => {
    if (!champ.avecMois) return "";
    return mois || (estPeriodeMois(periode) ? periode : "");
  };

  // Recherche d'une note existante (match eleveId, fallback eleveNom complet).
  // Une note sans mois enregistré se range au mois de sa date de saisie
  // (moisDeNote), comme dans le calcul de la note de cours.
  const getNoteExist = (eleveId, mat, jeton) => {
    const { periode, mois } = lireJetonPeriode(jeton);
    const moisCible = moisCellule({ periode, mois });
    const eleve = eleveById(eleveId);
    const fullName = eleve ? nomEleve(eleve) : "";
    return notes.find(n => {
      if (n.matiere !== mat || n.periode !== periode || n.type !== grilleType) return false;
      if (moisCible && moisDeNote(n, moisAnnee) !== moisCible) return false;
      if (n.eleveId) return n.eleveId === eleveId;
      return !!fullName && String(n.eleveNom || "").trim() === fullName;
    });
  };

  const cleCellule = (ligneKey, col) => {
    const { eleveId, jeton, matiere } = resoudre(ligneKey, col);
    return `${eleveId}|${jeton}|${matiere}`;
  };

  const valeurCellule = (ligneKey, col) => {
    const { eleveId, jeton, matiere } = resoudre(ligneKey, col);
    const key = `${eleveId}|${jeton}|${matiere}`;
    if (key in grilleChanges) return grilleChanges[key];
    return getNoteExist(eleveId, matiere, jeton)?.note ?? "";
  };

  // En-tête d'une colonne : la matière, ou la période (et son mois).
  const libelleColonne = (col) => {
    if (grilleMode === "periode") return col;
    const { periode, mois } = lireJetonPeriode(col);
    return libellePeriodeNote(periode, mois);
  };

  const sauvegarderGrille = async () => {
    if (!Object.keys(grilleChanges).length) { toast("Aucune modification.", "info"); return; }
    setGrilleSaving(true);
    let nb = 0;
    const horsBareme = {};
    const ecritures = [];
    for (const [key, val] of Object.entries(grilleChanges)) {
      const [eleveId, jeton, ...matParts] = key.split("|");
      const mat = matParts.join("|");
      const { periode, mois: moisJeton } = lireJetonPeriode(jeton);
      if (val === "" || isNaN(Number(val))) continue;
      const valeur = Number(val);
      if (valeur < 0 || valeur > maxNote) { horsBareme[key] = val; continue; }
      const eleve = eleveById(eleveId);
      if (!eleve || !mat || !periode) continue;
      const exist = getNoteExist(eleveId, mat, jeton);
      // Mois de la cellule : il complète aussi une ancienne note sans mois.
      const mois = moisAEnregistrer({ type: grilleType, section, periode, mois: moisJeton });
      // IMPORTANT : ne PAS « await » chaque écriture. Avec la persistance
      // hors ligne, addDoc/updateDoc s'appliquent au cache local tout de
      // suite mais leur promesse n'est tenue qu'après confirmation serveur —
      // l'attendre bloquerait toute la sauvegarde hors ligne. On déclenche
      // l'écriture (mise en file locale) et on poursuit l'UI immédiatement.
      ecritures.push(
        exist
          ? ajN({ ...exist, mois: exist.mois || mois, note: valeur, annee: exist.annee || annee || getAnnee() })
          : ajN({ eleveId, eleveNom: nomEleve(eleve), matiere: mat, type: grilleType, periode, mois, note: valeur, annee: annee || getAnnee() }),
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

  return {
    classesUniqN, elevesGrille, matieresClasse, lignes, colonnes, valeurCellule, cleCellule, libelleColonne,
    champMoisGrille: grilleMode === "periode" ? champ : null, sauvegarderGrille,
  };
}
