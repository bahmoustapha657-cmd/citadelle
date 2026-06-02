// Formate un timestamp de brouillon en date/heure FR lisible.
export function formatHistoryDate(timestamp) {
  if (!timestamp) {
    return "Date inconnue";
  }

  try {
    return new Date(timestamp).toLocaleString("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return "Date inconnue";
  }
}
