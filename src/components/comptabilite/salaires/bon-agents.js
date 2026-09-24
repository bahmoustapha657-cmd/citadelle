// Agents proposés dans la fenêtre « Nouveau bon », par section de paie.
// Source : les fiches ACTUELLES (enseignants, personnel), avec les règles de
// la génération de paie (salary-generation.js) : nom « prénom nom », personnel
// « Actif » seulement. Le bon porte ainsi exactement le nom de la fiche de paie
// que la génération créera, et « Appliquer les bons » le retrouve (nom
// normalisé + mois + section).
//
// La liste venait auparavant des fiches de paie DÉJÀ générées pour le mois :
// elle restait vide tant que la paie du mois n'était pas faite — or un bon est
// une avance consentie en cours de mois, avant la paie —, donc toute l'année
// scolaire à la rentrée.
import { buildTeacherFullName, normalizeSalaryName } from "../../../salary-utils";

export const SECTIONS_BON = ["Secondaire", "Primaire", "Personnel"];

// Sections proposées dans les fenêtres « salaire » et « bon » : les groupes de
// paie affichés par SalairesTab (une école sans collège ni lycée n'a pas de
// Secondaire), Personnel toujours. La section de la fiche ouverte reste
// proposée même si son groupe est fermé — sinon le sélecteur mentirait.
export function sectionsPaieProposees(groupesPaie = {}, sectionCourante = "") {
  return SECTIONS_BON.filter((section) => section === "Personnel"
    || section === sectionCourante
    || groupesPaie[section === "Secondaire" ? "secondaire" : "primaire"] !== false);
}

function agentsDeLaSection(section, { ensCollege = [], ensLycee = [], ensPrimaire = [], personnel = [] } = {}) {
  if (section === "Secondaire") return [...ensCollege, ...ensLycee];
  if (section === "Primaire") return ensPrimaire;
  if (section === "Personnel") return personnel.filter((p) => (p.statut || "Actif") === "Actif");
  return [];
}

// Noms proposés pour une section, sans doublon (un agent présent au collège et
// au lycée n'apparaît qu'une fois), triés. `nomActuel` : nom du bon en cours de
// modification, gardé même si l'agent n'est plus en fiche — sinon le sélecteur
// l'afficherait vide alors que le bon le porte toujours.
export function agentsPourBon(section, listes, nomActuel = "") {
  const noms = new Map();
  for (const agent of agentsDeLaSection(section, listes)) {
    const nom = buildTeacherFullName(agent);
    const cle = normalizeSalaryName(nom);
    if (cle && !noms.has(cle)) noms.set(cle, nom);
  }
  const actuel = String(nomActuel || "").trim();
  if (actuel && !noms.has(normalizeSalaryName(actuel))) noms.set(normalizeSalaryName(actuel), actuel);
  return [...noms.values()].sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
}

// Section d'un bon qui n'en porte pas (bons repris de l'ancienne base) : celle
// des fiches où figure l'agent, si elle est unique ; null sinon (inconnu, ou
// agent présent dans deux sections — prof et administratif).
export function sectionDuBon(nom, listes) {
  const cle = normalizeSalaryName(nom);
  if (!cle) return null;
  const sections = SECTIONS_BON.filter((section) => agentsDeLaSection(section, listes)
    .some((agent) => normalizeSalaryName(buildTeacherFullName(agent)) === cle));
  return sections.length === 1 ? sections[0] : null;
}
