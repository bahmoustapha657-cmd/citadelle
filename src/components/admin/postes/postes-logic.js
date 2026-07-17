// Logique pure du panneau Comptes & Postes (testable sans React).
import { MODULES, normalizeRoleLogin } from "../../../constants";
import { MODULES_PERMISSIBLES, normalizePermissions } from "../../../../shared/postes-config.js";

// Modules affichables dans la matrice de permissions (ordre + icônes de MODULES).
export const MODULE_OPTIONS = MODULES.filter((m) => MODULES_PERMISSIBLES.includes(m.id));

// Cycle d'un clic sur la matrice : invisible → lecture → écriture → invisible.
export function cyclePermission(permissions = {}, moduleId) {
  const actuel = permissions[moduleId];
  const suivant = actuel === "ecriture" ? undefined : actuel === "lecture" ? "ecriture" : "lecture";
  const prochaines = { ...permissions };
  if (suivant) prochaines[moduleId] = suivant; else delete prochaines[moduleId];
  return normalizePermissions(prochaines);
}

// Clé stable et unique d'un nouveau poste, dérivée du label.
export function genererClePoste(label, postesExistants = []) {
  const base = normalizeRoleLogin(label, "poste");
  const prises = new Set(postesExistants.map((p) => p.cle));
  if (!prises.has(base)) return base;
  for (let i = 2; ; i += 1) {
    const candidate = `${base}-${i}`;
    if (!prises.has(candidate)) return candidate;
  }
}

// Un poste est-il verrouillé (direction : ni désactivation ni édition des droits) ?
export const estPosteVerrouille = (poste) => poste?.cle === "direction";

// Un poste est-il supprimable ? (jamais les postes système ni ceux avec comptes)
export const estPosteSupprimable = (poste) =>
  !!poste && !poste.systeme && (poste.nbComptes ?? 0) === 0;

// Rôle enum du compte créé sous un poste : les postes système gardent leur
// rôle historique (comportements UI + ciblage push), les autres sont `staff`.
export const roleCompteDuPoste = (poste) =>
  (poste?.systeme && poste.cle !== "staff" ? poste.cle : "staff");

// Suggestion de login pour un nouveau compte d'un poste : cle, cle-2, cle-3…
export function suggererLogin(poste, comptesExistants = []) {
  const pris = new Set(comptesExistants.map((c) => c.login));
  if (!pris.has(poste.cle)) return poste.cle;
  for (let i = 2; ; i += 1) {
    const candidate = `${poste.cle}-${i}`;
    if (!pris.has(candidate)) return candidate;
  }
}
