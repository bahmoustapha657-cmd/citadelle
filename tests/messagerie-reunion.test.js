import assert from "node:assert/strict";
import test from "node:test";

import { ordreTuiles, pistesATirer } from "../src/components/messagerie/audio/reunion-logic.js";
import { apercuMessage, libelleAppel } from "../src/components/messagerie/messagerie-logic.js";

const p = (id, minute, { camera = false, video = false, session = `s-${id}` } = {}) => ({
  compte_id: id, session_id: session, camera, rejoint_at: `2026-09-30T10:${String(minute).padStart(2, "0")}:00Z`,
  pistes: [{ trackName: "audio", kind: "audio" }, ...(video ? [{ trackName: "video", kind: "video" }] : [])],
});

test("appel de groupe : le son de chacun, jamais le sien", () => {
  const demandes = pistesATirer([p("moi", 0), p("a", 1), p("b", 2)], "moi", new Set());
  assert.deepEqual(demandes.map((d) => d.cle), ["a:s-a:audio", "b:s-b:audio"]);
});

test("appel de groupe : pistes déjà reçues ignorées, session renouvelée re-tirée", () => {
  const deja = new Set(["a:s-a:audio"]);
  assert.deepEqual(pistesATirer([p("a", 1)], "moi", deja), []);
  // Revenu après une coupure : nouvelle session Cloudflare.
  assert.deepEqual(pistesATirer([p("a", 1, { session: "s-a2" })], "moi", deja).map((d) => d.cle), ["a:s-a2:audio"]);
});

test("appel de groupe : vidéo seulement caméra allumée, 6 au plus, par ordre d'arrivée", () => {
  const participants = Array.from({ length: 9 }, (_, i) => p(`c${i}`, 9 - i, { camera: true, video: true }));
  participants.push(p("eteinte", 0, { camera: false, video: true }));
  const videos = pistesATirer(participants, "moi", new Set()).filter((d) => d.trackName === "video");
  assert.equal(videos.length, 6);
  assert.deepEqual(videos.map((d) => d.compteId), ["c8", "c7", "c6", "c5", "c4", "c3"]);
  // Déjà 5 vidéos reçues : une seule de plus.
  const deja = new Set(["x1:s:video", "x2:s:video", "x3:s:video", "x4:s:video", "x5:s:video"]);
  assert.equal(pistesATirer(participants, "moi", deja).filter((d) => d.trackName === "video").length, 1);
});

test("tuiles : moi d'abord, puis par ordre d'arrivée", () => {
  assert.deepEqual(ordreTuiles([p("b", 2), p("moi", 5), p("a", 1)], "moi").map((x) => x.compte_id), ["moi", "a", "b"]);
});

test("traces : appel de groupe et document", () => {
  assert.equal(libelleAppel("reunion:1380:7", false), "Appel de groupe · 23 min 00 s · 7 participants");
  assert.equal(libelleAppel("reunion:40:1", true), "Appel de groupe · 40 s · 1 participant");
  assert.equal(apercuMessage({ type: "fichier", fichier_nom: "note.pdf" }), "📎 note.pdf");
});
