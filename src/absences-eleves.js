// ── Absences / événements de discipline ↔ fiches élèves ────────────────────
// La table Supabase `absences` ne porte que eleve_id (NOT NULL) : ni nom ni
// classe. Le nom et la classe affichés viennent de la fiche élève (jointure
// commune avec les notes : fiche-eleve.js). Les absences Firestore d'avant la
// migration portaient eleveNom/classe, parfois sans eleveId : ces champs
// restent un repli.
import { completerDepuisFiches, nomEleve } from "./fiche-eleve.js";

export { nomEleve };

// Complète nom et classe depuis la fiche, qui fait foi (nom corrigé,
// changement de classe). `eleves` doit inclure les élèves partis, pour que
// leurs absences passées gardent un nom et leur dernière classe.
export const enrichirAbsences = (absences = [], eleves = []) =>
  completerDepuisFiches(absences, eleves, ["eleveNom", "classe"]);

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
