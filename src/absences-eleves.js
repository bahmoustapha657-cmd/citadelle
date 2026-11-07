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

// Date d'absence → « AAAA-MM-JJ ». Le champ date et le portail enseignant
// écrivent ce format ; les absences Firestore d'avant la migration portaient
// parfois « JJ/MM/AAAA » (today()).
const dateIso = (date) => {
  const brut = String(date || "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(brut)) return brut.slice(0, 10);
  const fr = brut.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return fr ? `${fr[3]}-${fr[2].padStart(2, "0")}-${fr[1].padStart(2, "0")}` : "";
};

// Assiduité d'un élève sur l'année scolaire « 2026-2027 » (du 1er août au 31
// juillet) : absences justifiées, non justifiées, retards. Le bulletin
// l'imprime en cumul depuis la rentrée : les périodes n'ont pas de dates.
export function assiduiteEleve(absences = [], eleveId, annee = "") {
  const [debut, fin] = String(annee).split("-").map(Number);
  const borne = Number.isFinite(debut) && Number.isFinite(fin) && fin === debut + 1
    ? [`${debut}-08-01`, `${fin}-07-31`] : null;
  const total = { absJ: 0, absNJ: 0, retards: 0 };
  for (const a of absences) {
    if (!eleveId || a.eleveId !== eleveId) continue;
    if (borne) {
      const jour = dateIso(a.date);
      if (!jour || jour < borne[0] || jour > borne[1]) continue;
    }
    if (a.type === "Retard") total.retards += 1;
    else if (a.type === "Absence") {
      if (a.justifie === "Oui") total.absJ += 1;
      else total.absNJ += 1;
    }
  }
  return total;
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
