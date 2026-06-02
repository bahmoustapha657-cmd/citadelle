// Persistance locale des messages SuperAdmin lus (par utilisateur).
const cleStockage = (uid) => `LC_messagesLus_${uid}`;

export function lireLusLocal(uid) {
  if (!uid) return {};
  try {
    return JSON.parse(localStorage.getItem(cleStockage(uid)) || "{}");
  } catch {
    return {};
  }
}

export function ecrireLusLocal(uid, lus) {
  if (!uid) return;
  try {
    localStorage.setItem(cleStockage(uid), JSON.stringify(lus));
  } catch {
    // Quota localStorage dépassé : on ignore.
  }
}
