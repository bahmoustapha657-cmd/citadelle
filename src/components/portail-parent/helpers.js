// Helper partagé par les onglets du portail parent.
// Extrait de PortailParent.jsx au refactor découpage 2026-05-29.

export function normalizeText(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}
