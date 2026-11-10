// ── Compte rendu technique d'un appel ───────────────────────────────────────
// Un appel décroché mais muet ne laissait aucun indice. Chaque appareil note
// donc par où la voix est passée (direct, relais TURN, relais de secours) et
// si du son est réellement parti et arrivé, puis le dépose en base à la fin
// (msg_appels_traces). Ni adresse réseau ni contenu de la conversation.
// Module sans dépendance, testé sous Node : tests/messagerie-trace-appel.test.js.

const ETAPES_MAX = 40;

export function nouvelleTrace({ sens, ua = "", maintenant = Date.now() } = {}) {
  return { v: 1, sens, ua: String(ua).slice(0, 160), t0: maintenant, etapes: [] };
}

// Étape horodatée en secondes depuis le début (« connected », « bascule »…).
export function noter(trace, nom, maintenant = Date.now()) {
  if (!trace || trace.etapes.length >= ETAPES_MAX) return;
  trace.etapes.push([String(nom).slice(0, 40), Math.round((maintenant - trace.t0) / 100) / 10]);
}

const arrondi = (n) => (typeof n === "number" && Number.isFinite(n) ? Math.round(n * 1000) / 1000 : undefined);

// Résumé de RTCPeerConnection.getStats() (liste des rapports) : la paire de
// candidats retenue et le son compté dans chaque sens.
export function resumerStats(rapports) {
  const liste = [...(rapports || [])];
  const parId = new Map(liste.map((r) => [r.id, r]));
  const transport = liste.find((r) => r.type === "transport" && r.selectedCandidatePairId);
  const paire = parId.get(transport?.selectedCandidatePairId)
    || liste.find((r) => r.type === "candidate-pair" && (r.selected || (r.nominated && r.state === "succeeded")));
  const local = parId.get(paire?.localCandidateId);
  const distant = parId.get(paire?.remoteCandidateId);
  const audio = (type) => liste.find((r) => r.type === type && (r.kind || r.mediaType) === "audio");
  const recu = audio("inbound-rtp");
  const envoye = audio("outbound-rtp");
  const micro = audio("media-source");
  return {
    paire: paire ? {
      local: local?.candidateType, distant: distant?.candidateType,
      protocole: local?.protocol, relais: local?.relayProtocol, rtt: arrondi(paire.currentRoundTripTime),
    } : null,
    recu: recu ? {
      octets: recu.bytesReceived, paquets: recu.packetsReceived, perdus: recu.packetsLost,
      energie: arrondi(recu.totalAudioEnergy),
    } : null,
    envoye: envoye ? { octets: envoye.bytesSent, paquets: envoye.packetsSent } : null,
    micro: micro ? { energie: arrondi(micro.totalAudioEnergy) } : null,
  };
}

// Par où la voix est passée, et si l'on a entendu quelque chose : ce que l'on
// lit en premier pour comprendre un appel muet.
export function conclure(trace) {
  const secours = trace.secours;
  const w = trace.webrtc;
  const relais = [w?.paire?.local, w?.paire?.distant].includes("relay");
  const chemin = secours ? "secours" : !w?.paire ? "aucun" : relais ? "relais" : "direct";
  const sonRecu = secours ? secours.joues > 0 : (w?.recu?.octets || 0) > 0 && (w?.recu?.energie ?? 1) > 0;
  const sonEnvoye = secours ? secours.envoyes > 0 : (w?.envoye?.octets || 0) > 0;
  return { chemin, sonRecu, sonEnvoye };
}

// Ce qui part en base : sans l'heure de départ, avec la conclusion.
export function compteRendu(trace, maintenant = Date.now()) {
  const { t0, ...reste } = trace;
  return { ...reste, duree: Math.round((maintenant - t0) / 1000), ...conclure(trace) };
}
