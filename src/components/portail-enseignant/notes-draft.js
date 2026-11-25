// Brouillon LOCAL de la grille de saisie (étape A du mode hors-ligne).
// Les notes tapées sont sauvegardées dans localStorage au fil de la frappe :
// si le réseau coupe, l'onglet se ferme ou l'enregistrement échoue, la saisie
// est restaurée à la réouverture de la grille (même contexte). Le brouillon
// est effacé après un enregistrement complet réussi.

import { jetonPeriode } from "../../notes-mois";

const PREFIX = "lc-grille-brouillon:";

function safeLocal() {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null; // navigation privée / stockage bloqué
  }
}

// Clé stable identifiant un contexte de grille (enseignant + classe + type +
// période + matière + mode). En mode « toutes périodes » / « toutes matières »
// la période / la matière ne discrimine pas (marqueurs P* / M*). Le mois de
// l'évaluation (oraux et écrits du secondaire) suit la période : « T1:Oct ».
export function draftKey({ ownerId, classe, type, periode, mois, matiere, multiPeriode, multiMatiere }) {
  return [
    PREFIX + (ownerId || "?"),
    classe || "",
    type || "",
    multiPeriode ? "P*" : jetonPeriode(periode || "", mois || ""),
    multiMatiere ? "M*" : (matiere || ""),
  ].join("|");
}

// Renvoie { notes, savedAt } ou null.
export function loadDraft(key) {
  const ls = safeLocal();
  if (!ls) return null;
  try {
    const raw = ls.getItem(key);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" && obj.notes ? obj : null;
  } catch {
    return null;
  }
}

// Sauvegarde les cellules non vides. Vide → supprime le brouillon.
export function saveDraft(key, notes) {
  const ls = safeLocal();
  if (!ls) return;
  try {
    const filled = Object.fromEntries(
      Object.entries(notes || {}).filter(([, v]) => v !== "" && v != null),
    );
    if (Object.keys(filled).length === 0) {
      ls.removeItem(key);
      return;
    }
    ls.setItem(key, JSON.stringify({ notes: filled, savedAt: Date.now() }));
  } catch {
    // quota dépassé / mode privé : on ignore silencieusement.
  }
}

export function clearDraft(key) {
  const ls = safeLocal();
  if (!ls) return;
  try {
    ls.removeItem(key);
  } catch {
    // ignore
  }
}
