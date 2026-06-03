// Helpers purs du module École : tri des élèves selon la préférence de l'école,
// filtrage des matières par classe, effectif réel, moyenne et années dispo.

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
export function effectifReel(eleves, nomClasse) {
  return eleves.filter((e) => e.classe === nomClasse && e.statut !== "Départ").length;
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
