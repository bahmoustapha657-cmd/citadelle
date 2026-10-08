// ── Lignes rattachées à un élève ↔ sa fiche ────────────────────────────────
// Les tables Supabase `notes` et `absences` ne portent que eleve_id (NOT
// NULL) : ni nom ni classe, que le mapping (collection-map.js) ne lit ni
// n'écrit. Ce qu'on affiche de l'élève vient donc de sa fiche, retrouvée par
// eleveId dans la liste déjà chargée. Les lignes Firestore d'avant la
// migration portaient ces champs, parfois sans eleveId : ils restent un repli.

export const nomEleve = (eleve) => `${eleve?.nom || ""} ${eleve?.prenom || ""}`.trim();

// Valeur lue sur la fiche : eleveNom est le nom complet, les autres champs
// (classe…) sont repris tels quels.
const depuisFiche = (eleve, champ) => (champ === "eleveNom" ? nomEleve(eleve) : eleve[champ] || "");

// Complète les `champs` de chaque ligne depuis sa fiche. La fiche fait foi
// (nom corrigé, changement de classe) ; la valeur portée par la ligne ne sert
// qu'à défaut de fiche. `eleves` doit inclure les élèves partis, pour que
// leurs lignes passées gardent un nom.
export function completerDepuisFiches(lignes = [], eleves = [], champs = ["eleveNom"]) {
  const parId = new Map(eleves.map((e) => [e._id, e]));
  return lignes.map((l) => {
    const eleve = l.eleveId ? parId.get(l.eleveId) : null;
    const complete = { ...l };
    for (const champ of champs) complete[champ] = eleve ? depuisFiche(eleve, champ) : l[champ] || "";
    return complete;
  });
}
