import { useState } from "react";

// Renvoie un draft initial = profile, complété par les champs legacy
// (schoolInfo.ministere/agrement/ire/dpe) là où le profil structuré est
// vide. N'écrase JAMAIS une valeur déjà saisie dans /config/legal.
function mergeLegacyFallback(profile, schoolInfo) {
  if (!schoolInfo) return profile;
  const next = structuredClone(profile);
  if (!next.arreteOuverture?.numero && schoolInfo.agrement) {
    next.arreteOuverture = { ...next.arreteOuverture, numero: schoolInfo.agrement };
  }
  if (!next.etablissement?.ministereTutelle && schoolInfo.ministere) {
    next.etablissement = { ...next.etablissement, ministereTutelle: schoolInfo.ministere };
  }
  if (!next.etablissement?.ire && schoolInfo.ire) {
    next.etablissement = { ...next.etablissement, ire: schoolInfo.ire };
  }
  if (!next.etablissement?.dpe && schoolInfo.dpe) {
    next.etablissement = { ...next.etablissement, dpe: schoolInfo.dpe };
  }
  return next;
}

// Applique une valeur sur un chemin imbriqué ("a.b.c") d'une copie du draft.
function setPath(draft, path, value) {
  const next = structuredClone(draft);
  const segs = path.split(".");
  let cur = next;
  for (let i = 0; i < segs.length - 1; i++) cur = cur[segs[i]];
  cur[segs[segs.length - 1]] = value;
  return next;
}

// Gère le brouillon d'édition légale + setters texte/numérique par chemin.
export function useLegalDraft(profile, schoolInfo) {
  const [draft, setDraft] = useState(() => mergeLegacyFallback(profile, schoolInfo));
  const set = (path) => (e) => setDraft((p) => setPath(p, path, e.target.value));
  const setNum = (path) => (e) => {
    const v = Number(e.target.value);
    setDraft((p) => setPath(p, path, Number.isFinite(v) ? v : 0));
  };
  return { draft, set, setNum };
}
