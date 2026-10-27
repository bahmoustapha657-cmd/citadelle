// Helpers purs du module École : tri des élèves selon la préférence de l'école,
// filtrage des matières par classe, effectif réel, moyenne et années dispo.
import { estSorti } from "../../constants.js";
import { getTeacherMonthlyForfait } from "../../teacher-utils";

// Ligne sous le nom, sur la carte d'un enseignant (onglet Enseignants).
// Le forfait est une donnée de PAIE : seuls les comptes qui lisent la
// Comptabilité le voient. Un chef de section (Direction primaire, Bureau
// collège…) voit à la place la classe dont l'enseignant est titulaire.
export function ligneCarteEnseignant(e = {}, { isPrimarySection = false, voitSalaires = false } = {}) {
  if (!isPrimarySection) return e.matiere || "";
  if (voitSalaires) return `Forfait ${Number(getTeacherMonthlyForfait(e) || 0).toLocaleString("fr-FR")} GNF`;
  return e.classeTitle ? `Titulaire · ${e.classeTitle}` : (e.matiere || "");
}

// Tri alphabétique des élèves selon la préférence `triEleves` de l'école.
export function sortAlphaEcole(arr, tri = "prenom_nom") {
  const withClasse = tri === "classe_prenom" || tri === "classe_nom";
  const cle = (x) => withClasse
    ? (tri === "classe_nom" ? `${x.classe || ""} ${x.nom} ${x.prenom}` : `${x.classe || ""} ${x.prenom} ${x.nom}`)
    : (tri === "nom_prenom" ? `${x.nom} ${x.prenom}` : `${x.prenom} ${x.nom}`);
  return [...arr].sort((a, b) => cle(a).localeCompare(cle(b), "fr", { sensitivity: "base" }));
}

// Matières applicables à une classe : si la matière a des classes assignées on
// filtre, sinon elle s'applique à toutes les classes.
export function matieresForClasse(matieres, classe) {
  if (!classe || classe === "all") return matieres;
  return matieres.filter((m) => !m.classes || !m.classes.length || m.classes.includes(classe));
}

// Effectif réel d'une classe = élèves dont le champ classe correspond (hors départs).
// Le filtre visait un statut « Départ » qui n'existe pas : tous les élèves
// partis — transférés, exclus, abandons — restaient comptés dans leur classe.
export function effectifReel(eleves, nomClasse) {
  return eleves.filter((e) => e.classe === nomClasse && !estSorti(e)).length;
}

// Moyenne générale des notes (ou "—" si aucune note).
export function computeMoyenne(notes) {
  return notes.length ? (notes.reduce((s, n) => s + Number(n.note), 0) / notes.length).toFixed(1) : "—";
}

// 7 dernières années scolaires à partir de l'année courante.
export function computeAnneesDispo(anneeCourante) {
  const anneeBase = Number(String(anneeCourante).split("-")[0]) || new Date().getFullYear();
  return Array.from({ length: 7 }, (_, i) => `${anneeBase - i}-${anneeBase - i + 1}`);
}
