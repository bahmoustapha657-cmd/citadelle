// Compte rendu technique d'un appel : par où la voix est passée, et si du son
// est réellement parti et arrivé (appel décroché mais muet du 4 novembre 2026).
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

import {
  compteRendu, conclure, noter, nouvelleTrace, resumerStats,
} from "../src/components/messagerie/audio/trace-appel.js";

// Rapports getStats() d'un appel passé par le relais TURN, façon Chrome.
const statsRelais = ({ octetsRecus = 48000, energie = 0.42 } = {}) => [
  { id: "T1", type: "transport", selectedCandidatePairId: "P1" },
  { id: "P0", type: "candidate-pair", localCandidateId: "L0", remoteCandidateId: "R0", state: "failed" },
  { id: "P1", type: "candidate-pair", localCandidateId: "L1", remoteCandidateId: "R1", state: "succeeded", nominated: true, currentRoundTripTime: 0.2314 },
  { id: "L0", type: "local-candidate", candidateType: "host", protocol: "udp" },
  { id: "L1", type: "local-candidate", candidateType: "relay", protocol: "udp", relayProtocol: "udp", address: "203.0.113.7" },
  { id: "R0", type: "remote-candidate", candidateType: "host" },
  { id: "R1", type: "remote-candidate", candidateType: "srflx", address: "198.51.100.9" },
  { id: "I1", type: "inbound-rtp", kind: "audio", bytesReceived: octetsRecus, packetsReceived: 600, packetsLost: 3, totalAudioEnergy: energie },
  { id: "I2", type: "inbound-rtp", kind: "video", bytesReceived: 1 },
  { id: "O1", type: "outbound-rtp", kind: "audio", bytesSent: 51000, packetsSent: 640 },
  { id: "M1", type: "media-source", kind: "audio", totalAudioEnergy: 0.31 },
];

test("stats : la paire retenue et le son compté dans chaque sens, sans adresse", () => {
  const r = resumerStats(statsRelais());
  assert.deepEqual(r.paire, { local: "relay", distant: "srflx", protocole: "udp", relais: "udp", rtt: 0.231 });
  assert.deepEqual(r.recu, { octets: 48000, paquets: 600, perdus: 3, energie: 0.42 });
  assert.deepEqual(r.envoye, { octets: 51000, paquets: 640 });
  assert.deepEqual(r.micro, { energie: 0.31 });
  assert.doesNotMatch(JSON.stringify(r), /203\.0\.113|198\.51\.100/);
});

test("stats : Firefox (paire « selected »), connexion jamais établie, rien du tout", () => {
  const firefox = resumerStats([
    { id: "P", type: "candidate-pair", selected: true, localCandidateId: "L", remoteCandidateId: "R" },
    { id: "L", type: "local-candidate", candidateType: "host", protocol: "udp" },
    { id: "R", type: "remote-candidate", candidateType: "host" },
    { id: "I", type: "inbound-rtp", mediaType: "audio", bytesReceived: 10 },
  ]);
  assert.equal(firefox.paire.local, "host");
  assert.equal(firefox.recu.octets, 10);
  const sans = resumerStats([{ id: "P", type: "candidate-pair", state: "in-progress" }]);
  assert.deepEqual(sans, { paire: null, recu: null, envoye: null, micro: null });
  assert.deepEqual(resumerStats(undefined), { paire: null, recu: null, envoye: null, micro: null });
});

test("conclusion : chemin de la voix et son entendu", () => {
  const base = nouvelleTrace({ sens: "sortant", maintenant: 0 });
  assert.deepEqual(conclure({ ...base, webrtc: resumerStats(statsRelais()) }), { chemin: "relais", sonRecu: true, sonEnvoye: true });
  // Connecté, des paquets arrivent, mais ils ne portent que du silence.
  assert.equal(conclure({ ...base, webrtc: resumerStats(statsRelais({ energie: 0 })) }).sonRecu, false);
  // Connecté, rien n'arrive.
  assert.equal(conclure({ ...base, webrtc: resumerStats(statsRelais({ octetsRecus: 0 })) }).sonRecu, false);
  // Jamais connecté.
  assert.deepEqual(conclure(base), { chemin: "aucun", sonRecu: false, sonEnvoye: false });
  // Relais de secours : on compte ce qui a été joué.
  assert.deepEqual(conclure({ ...base, secours: { envoyes: 12, recus: 0, joues: 0, contexte: "running" } }),
    { chemin: "secours", sonRecu: false, sonEnvoye: true });
  assert.equal(conclure({ ...base, secours: { envoyes: 12, recus: 9, joues: 9 } }).sonRecu, true);
  const direct = resumerStats(statsRelais()); direct.paire.local = "host";
  assert.equal(conclure({ ...base, webrtc: direct }).chemin, "direct");
});

test("étapes horodatées, bornées ; compte rendu sans heure absolue", () => {
  const t = nouvelleTrace({ sens: "entrant", ua: "x".repeat(500), maintenant: 1000 });
  assert.equal(t.ua.length, 160);
  noter(t, "connecting", 1450);
  noter(t, "connected", 3210);
  assert.deepEqual(t.etapes, [["connecting", 0.5], ["connected", 2.2]]);
  for (let i = 0; i < 100; i++) noter(t, `e${i}`, 4000);
  assert.equal(t.etapes.length, 40);
  assert.doesNotThrow(() => noter(null, "rien"));
  const cr = compteRendu(t, 34000);
  assert.equal(cr.duree, 33);
  assert.equal(cr.t0, undefined);
  assert.equal(cr.chemin, "aucun");
  assert.ok(JSON.stringify(cr).length < 6000, "doit tenir dans la limite de la base");
});

test("migration : compte rendu réservé aux deux participants, table sans lecture", () => {
  const nom = readdirSync("supabase/migrations").find((f) => f.endsWith("_appels_trace.sql"));
  const sql = readFileSync(`supabase/migrations/${nom}`, "utf8");
  assert.match(sql, /moi not in \(a\.appelant_id, a\.appele_id\)/);
  assert.match(sql, /alter table public\.msg_appels_traces enable row level security/);
  assert.match(sql, /revoke all on table public\.msg_appels_traces from anon, authenticated/);
  assert.match(sql, /revoke all on function public\.msg_appel_tracer\(uuid, jsonb\) from public, anon/);
  assert.doesNotMatch(sql, /create policy/i);
});

test("appel : relevé pendant la connexion, dépôt à la fin de tout appel décroché", () => {
  const code = readFileSync("src/components/messagerie/audio/use-appels.js", "utf8");
  // Avant la fermeture : après, la connexion n'a plus de compteurs.
  assert.match(code, /const r = ref\.current;\r?\n {4}deposerTrace\(r\);/);
  assert.match(code, /if \(!id \|\| !trace \|\| !\(r\.reponduIci \|\| r\.distantOk\)\) return;/);
  assert.match(code, /setInterval\(\(\) => releverStats\(ref\.current\), RELEVE_STATS_MS\)/);
  assert.match(code, /noter\(r\.trace, `bascule:/);
  const webrtc = readFileSync("src/components/messagerie/audio/webrtc.js", "utf8");
  assert.match(webrtc, /onLecture\?\.\(false\)/);
});
