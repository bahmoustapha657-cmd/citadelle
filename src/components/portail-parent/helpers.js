// Helper partagé par les onglets du portail parent.
// Extrait de PortailParent.jsx au refactor découpage 2026-05-29.

export function normalizeText(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// Nature d'un événement du registre des absences : son `type` (« Absence »,
// « Retard », « Avertissement »… — saisi par l'école ou l'enseignant), ou
// l'ancien champ `statut` (« absent », « retard », « present ») de données
// plus anciennes. Les compteurs du portail lisaient `statut` seul et
// restaient à 0 sur les fiches d'aujourd'hui.
const natureIncident = (item = {}) => normalizeText(item.type || item.statut);
export const estAbsence = (item) => ["absence", "absent"].includes(natureIncident(item));
export const estRetard = (item) => natureIncident(item) === "retard";
export const estPresence = (item) => ["present", "presence"].includes(natureIncident(item));
