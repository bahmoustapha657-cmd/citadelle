// File de synchronisation des notes (étape B hors-ligne). Quand l'enregistrement
// de la grille échoue faute de réseau, le lot de notes (déjà validé côté client)
// est empilé ici (localStorage). Il est rejoué automatiquement au retour de la
// connexion (événement « online ») ou au montage du portail.
//
// La file est scellée par enseignant (ownerId) pour éviter toute fuite entre
// comptes sur un appareil partagé.

const PREFIX = "lc-grille-file:";

function safeLocal() {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

function keyFor(ownerId) {
  return PREFIX + (ownerId || "?");
}

export function getQueue(ownerId) {
  const ls = safeLocal();
  if (!ls) return [];
  try {
    const raw = ls.getItem(keyFor(ownerId));
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function setQueue(ownerId, arr) {
  const ls = safeLocal();
  if (!ls) return;
  try {
    if (!arr.length) ls.removeItem(keyFor(ownerId));
    else ls.setItem(keyFor(ownerId), JSON.stringify(arr));
  } catch {
    // quota / mode privé : on ignore
  }
}

// Nombre de NOTES en attente (somme des lots).
export function queueCount(ownerId) {
  return getQueue(ownerId).reduce((s, it) => s + (it.count || (it.notes ? it.notes.length : 0)), 0);
}

// Empile un lot de notes ; renvoie le nouveau total de notes en attente.
export function enqueue(ownerId, notes) {
  const arr = getQueue(ownerId);
  arr.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    notes,
    count: notes.length,
    createdAt: Date.now(),
  });
  setQueue(ownerId, arr);
  return queueCount(ownerId);
}

function removeItem(ownerId, id) {
  setQueue(ownerId, getQueue(ownerId).filter((it) => it.id !== id));
}

// Rejoue la file. `saveFn(notes)` doit renvoyer { ok } (cf. saveNotesApi).
//  - succès    → lot retiré ;
//  - rejet serveur (ok=false) → lot retiré + compté en échec (évite un blocage
//    infini ; ne survient en principe pas car le lot a déjà été validé) ;
//  - erreur réseau (saveFn lève) → on s'arrête, la file est rejouée plus tard.
export async function processQueue(ownerId, saveFn) {
  let saved = 0;
  let failed = 0;
  for (const it of getQueue(ownerId)) {
    let result;
    try {
      result = await saveFn(it.notes);
    } catch {
      break; // toujours hors-ligne : on réessaiera
    }
    if (result && result.ok) {
      saved += it.count || it.notes.length;
      removeItem(ownerId, it.id);
    } else {
      failed += it.count || it.notes.length;
      removeItem(ownerId, it.id);
    }
  }
  return { saved, failed, remaining: queueCount(ownerId) };
}
