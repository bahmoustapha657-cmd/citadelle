// ── Absences / événements de discipline ↔ fiches élèves ────────────────────
// La table Supabase `absences` ne porte que eleve_id (NOT NULL) : ni nom ni
// classe, que le mapping (collection-map.js) ne lit ni n'écrit. Le nom et la
// classe affichés viennent donc de la fiche élève, retrouvée par eleveId dans
// la liste déjà chargée. Les absences Firestore d'avant la migration portaient
// eleveNom/classe, parfois sans eleveId : ces champs restent un repli.

export const nomEleve = (eleve) => `${eleve?.nom || ""} ${eleve?.prenom || ""}`.trim();

// Complète nom et classe depuis la fiche. La fiche fait foi (nom corrigé,
// changement de classe) ; les valeurs portées par l'absence ne servent qu'à
// défaut de fiche. `eleves` doit inclure les élèves partis, pour que leurs
// absences passées gardent un nom et leur dernière classe.
export function enrichirAbsences(absences = [], eleves = []) {
  const parId = new Map(eleves.map((e) => [e._id, e]));
  return absences.map((a) => {
    const eleve = a.eleveId ? parId.get(a.eleveId) : null;
    return {
      ...a,
      eleveNom: eleve ? nomEleve(eleve) : a.eleveNom || "",
      classe: eleve ? eleve.classe || "" : a.classe || "",
    };
  });
}

// Élèves ayant au moins `seuil` absences non justifiées, du plus au moins
// absent. Le compte se fait par identifiant (deux homonymes ne se confondent
// pas) ; au nom complet seulement pour une absence qui n'en porte pas.
export function elevesEnAlerte(eleves = [], absences = [], seuil = 3) {
  const parId = new Map();
  const parNom = new Map();
  for (const a of absences) {
    if (a.type !== "Absence" || a.justifie !== "Non") continue;
    if (a.eleveId) parId.set(a.eleveId, (parId.get(a.eleveId) || 0) + 1);
    else if (a.eleveNom) parNom.set(a.eleveNom, (parNom.get(a.eleveNom) || 0) + 1);
  }
  return eleves
    .map((e) => ({ ...e, nbAbs: (parId.get(e._id) || 0) + (parNom.get(nomEleve(e)) || 0) }))
    .filter((e) => e.nbAbs >= seuil)
    .sort((a, b) => b.nbAbs - a.nbAbs);
}

// Une absence sans élève est refusée par la base (eleve_id NOT NULL) : en
// ligne l'insertion échoue, et sous PowerSync le refus arrive à l'envoi, où
// le connecteur jette l'écriture — la ligne disparaît à la synchro suivante.
export const absencePrete = (form) => Boolean(form?.eleveId);

// Date de l'absence, AAAA-MM-JJ comme le champ date et le portail enseignant.
// Le défaut était today() (« 07/10/2026 ») : le rapport mensuel, qui passe la
// date à new Date(), la lisait à l'américaine et la rangeait en juillet.
export function dateAbsence(form, maintenant = new Date()) {
  if (form?.date) return form.date;
  const deux = (n) => String(n).padStart(2, "0");
  return `${maintenant.getFullYear()}-${deux(maintenant.getMonth() + 1)}-${deux(maintenant.getDate())}`;
}
