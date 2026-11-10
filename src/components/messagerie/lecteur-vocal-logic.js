// ── Lecture d'un message vocal : pourquoi elle échoue, et que faire ─────────
// « Vocal indisponible » s'affichait pour trois situations très différentes,
// alors que le fichier était bien là :
//  - réseau : le téléchargement n'a pas abouti (réseau faible) → on réessaie
//    seul, puis on propose de réessayer ;
//  - geste : téléchargé, mais le navigateur (Safari surtout) refuse de lancer
//    le son longtemps après le toucher → le vocal est prêt, un toucher suffit ;
//  - format : l'appareil ne sait pas lire ce format (WebM/Opus sur un iPhone
//    ancien) → inutile de réessayer.
// Module sans dépendance, testé sous Node : tests/messagerie-lecteur-vocal.test.js.

export const ESSAIS_TELECHARGEMENT = 3;
const ATTENTE_MS = [800, 2000];

// Télécharge avec quelques reprises espacées ; `attendre` est injectable pour
// les tests.
export async function telechargerAvecReprises(telecharger, {
  essais = ESSAIS_TELECHARGEMENT,
  attendre = (ms) => new Promise((r) => { setTimeout(r, ms); }),
} = {}) {
  let derniere;
  for (let i = 0; i < essais; i++) {
    try { return await telecharger(); } catch (e) { derniere = e; }
    if (i < essais - 1) await attendre(ATTENTE_MS[Math.min(i, ATTENTE_MS.length - 1)]);
  }
  throw derniere || new Error("download failed");
}

// Raison d'un refus de lecture, d'après l'erreur de play() et l'état de
// l'élément audio (error.code 4 = format non pris en charge, 3 = décodage).
export function raisonLecture(erreur, audio) {
  const code = audio?.error?.code;
  if (erreur?.name === "NotSupportedError" || code === 4 || code === 3) return "format";
  if (erreur?.name === "NotAllowedError") return "geste";
  // Lecture interrompue par une pause ou un nouveau chargement : pas une panne.
  if (erreur?.name === "AbortError") return "geste";
  return "inconnue";
}

// Ce que le lecteur affiche et propose pour chaque état.
//   reessayer : un toucher relance (téléchargement ou lecture)
//   cle       : texte sous la barre (null = durée du vocal)
export const ETATS_ERREUR = {
  reseau: { cle: "msg.voice.retry", icone: "↻", reessayer: true },
  geste: { cle: "msg.voice.tapToPlay", icone: "▶", reessayer: true },
  format: { cle: "msg.voice.unsupported", icone: "⚠", reessayer: false },
  inconnue: { cle: "msg.voice.unavailable", icone: "↻", reessayer: true },
};
