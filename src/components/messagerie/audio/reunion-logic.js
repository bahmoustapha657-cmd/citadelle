// ── Appels de groupe : logique pure (testée dans tests/messagerie-reunion.test.js) ──

// Au-delà, les caméras des autres ne sont pas reçues (tuiles avec initiales) :
// 6 vidéos 360p ≈ 2 Mbit/s, la limite raisonnable sur réseau mobile.
export const MAX_VIDEOS = 6;

const cle = (compteId, sessionId, trackName) => `${compteId}:${sessionId}:${trackName}`;

// Pistes à recevoir : le son de chacun, l'image des caméras allumées (dans la
// limite de MAX_VIDEOS, par ordre d'arrivée). `tirees` : clés déjà reçues —
// une session renouvelée (participant revenu) produit une nouvelle clé.
export function pistesATirer(participants, moi, tirees, maxVideos = MAX_VIDEOS) {
  const demandes = [];
  let videos = [...tirees].filter((k) => k.endsWith(":video")).length;
  const ordonnes = [...participants].sort((a, b) => Date.parse(a.rejoint_at) - Date.parse(b.rejoint_at));
  for (const p of ordonnes) {
    if (p.compte_id === moi || !p.session_id) continue;
    for (const piste of p.pistes || []) {
      const c = cle(p.compte_id, p.session_id, piste.trackName);
      if (tirees.has(c)) continue;
      if (piste.trackName === "video") {
        if (!p.camera || videos >= maxVideos) continue;
        videos += 1;
      } else if (piste.trackName !== "audio") {
        continue;
      }
      demandes.push({ compteId: p.compte_id, sessionId: p.session_id, trackName: piste.trackName, cle: c });
    }
  }
  return demandes;
}

// Tuiles à afficher : moi d'abord, puis par ordre d'arrivée.
export function ordreTuiles(participants, moi) {
  return [...participants].sort((a, b) => (a.compte_id === moi ? -1 : b.compte_id === moi ? 1 : 0)
    || Date.parse(a.rejoint_at) - Date.parse(b.rejoint_at));
}
