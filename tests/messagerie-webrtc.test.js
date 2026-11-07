import assert from "node:assert/strict";
import test from "node:test";

import { attendreCollecteIce, delaiCollecteIce, relaisPrevu } from "../src/components/messagerie/audio/webrtc.js";
import { STUN_PUBLICS, serveursRepli } from "../supabase/functions/_shared/relais-turn.ts";

const STUN = [{ urls: ["stun:stun.cloudflare.com:3478"] }];
const TURN = [{ urls: ["stun:stun.cloudflare.com:3478", "turn:turn.cloudflare.com:3478?transport=udp"], username: "u", credential: "c" }];

// Connexion réduite à ce que lit la collecte : état + événements.
function fausseConnexion(iceServers = STUN) {
  const cible = new EventTarget();
  cible.iceGatheringState = "gathering";
  cible.getConfiguration = () => ({ iceServers });
  cible.emettreCandidat = (candidate) => cible.dispatchEvent(Object.assign(new Event("icecandidate"), { candidate: candidate && { candidate } }));
  cible.terminerCollecte = () => {
    cible.iceGatheringState = "complete";
    cible.dispatchEvent(new Event("icegatheringstatechange"));
  };
  return cible;
}

const CANDIDAT = (type) => `candidate:1 1 udp 2122260223 203.0.113.7 54321 typ ${type} generation 0`;

// « reste en attente » : la promesse n'est pas résolue après quelques tours.
async function enAttente(promesse) {
  let finie = false;
  promesse.then(() => { finie = true; });
  await new Promise((r) => { setTimeout(r, 15); });
  return !finie;
}

test("relais : reconnu dans les serveurs ICE, en liste ou en texte", () => {
  assert.equal(relaisPrevu(STUN), false);
  assert.equal(relaisPrevu(TURN), true);
  assert.equal(relaisPrevu([{ urls: "turns:turn.cloudflare.com:5349?transport=tcp" }]), true);
  assert.equal(relaisPrevu([]), false);
  assert.equal(relaisPrevu(undefined), false);
});

test("relais fixe (sans Cloudflare) : ajouté au STUN, et vu comme un relais", () => {
  const { iceServers, turn } = serveursRepli(" turn:h:3478?transport=udp , turn:h:3478?transport=tcp ", "u", "p");
  assert.equal(turn, true);
  assert.deepEqual(iceServers[1], { urls: ["turn:h:3478?transport=udp", "turn:h:3478?transport=tcp"], username: "u", credential: "p" });
  assert.equal(relaisPrevu(iceServers), true);
});

test("relais fixe : incomplet ou mal saisi → STUN seul, jamais de liste cassée", () => {
  const stunSeul = { iceServers: STUN_PUBLICS, turn: false };
  assert.deepEqual(serveursRepli(undefined, undefined, undefined), stunSeul);
  assert.deepEqual(serveursRepli("turn:h:3478", "u", ""), stunSeul);
  assert.deepEqual(serveursRepli("turn:h:3478", "", "p"), stunSeul);
  assert.deepEqual(serveursRepli("h:3478,https://h", "u", "p"), stunSeul);
  assert.deepEqual(serveursRepli("h:3478,turns:h:443", "u", "p").iceServers[1].urls, ["turns:h:443"]);
});

test("collecte : plus de patience quand un relais est attendu", () => {
  assert.equal(delaiCollecteIce(STUN), 4000);
  assert.equal(delaiCollecteIce(TURN), 8000);
  assert.equal(delaiCollecteIce(undefined), 4000);
});

test("collecte : une fois finie, rien à attendre", async () => {
  const pc = fausseConnexion();
  pc.iceGatheringState = "complete";
  await attendreCollecteIce(pc);
});

test("collecte : part dès que le relais a répondu, sans attendre les autres", async () => {
  const pc = fausseConnexion(TURN);
  const attente = attendreCollecteIce(pc, 60000);
  pc.emettreCandidat(CANDIDAT("host"));
  pc.emettreCandidat(CANDIDAT("srflx"));
  assert.equal(await enAttente(attente), true);
  pc.emettreCandidat(CANDIDAT("relay"));
  await attente;
});

test("collecte : fin normale, ou délai dépassé avec les candidats trouvés", async () => {
  const pc = fausseConnexion();
  const attente = attendreCollecteIce(pc, 60000);
  pc.emettreCandidat(null);
  assert.equal(await enAttente(attente), true);
  pc.terminerCollecte();
  await attente;

  await attendreCollecteIce(fausseConnexion(), 5);
});
