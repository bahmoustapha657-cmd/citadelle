// ════════════════════════════════════════════════════════════════════════
//  Serveurs ICE des appels — relais à identifiants fixes
// ════════════════════════════════════════════════════════════════════════
// Module SANS dépendance : turn-credentials l'importe, les tests Node le
// chargent tel quel (tests/messagerie-webrtc.test.js).

export type IceServer = { urls: string | string[]; username?: string; credential?: string };

export const STUN_PUBLICS: IceServer[] = [
  { urls: ["stun:stun.cloudflare.com:3478", "stun:stun.l.google.com:19302"] },
];

// Serveurs sans Cloudflare : STUN, plus le relais des secrets TURN_* s'ils sont
// complets. Une adresse qui n'est pas turn: / turns: est écartée : le navigateur
// refuserait toute la liste, et l'appel avec elle.
export function serveursRepli(urls?: string, username?: string, credential?: string) {
  const adresses = String(urls || "").split(",").map((u) => u.trim()).filter((u) => /^turns?:/i.test(u));
  const nom = String(username || "").trim();
  const motDePasse = String(credential || "").trim();
  if (!adresses.length || !nom || !motDePasse) return { iceServers: STUN_PUBLICS, turn: false };
  return {
    iceServers: [...STUN_PUBLICS, { urls: adresses, username: nom, credential: motDePasse }],
    turn: true,
  };
}
