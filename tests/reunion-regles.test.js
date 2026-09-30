import assert from "node:assert/strict";
import test from "node:test";

import { fusionnerPistes, pistesAPublier, pistesARecevoir } from "../supabase/functions/_shared/reunion.ts";

const participants = [
  { compte_id: "moi", session_id: "s-moi", pistes: [{ trackName: "audio", kind: "audio" }], quitte_at: null },
  { compte_id: "b", session_id: "s-b", pistes: [{ trackName: "audio", kind: "audio" }, { trackName: "video", kind: "video" }], quitte_at: null },
  { compte_id: "parti", session_id: "s-parti", pistes: [{ trackName: "audio", kind: "audio" }], quitte_at: "2026-09-30T10:00:00Z" },
  { compte_id: "muet", session_id: "s-muet", pistes: [], quitte_at: null },
];

test("publier : seulement audio / video, avec un mid, sans doublon", () => {
  assert.deepEqual(pistesAPublier([{ mid: "0", trackName: "audio" }]), [{ mid: "0", trackName: "audio" }]);
  assert.throws(() => pistesAPublier([{ mid: "0", trackName: "ecran-d-un-autre" }]));
  assert.throws(() => pistesAPublier([{ trackName: "audio" }]));
  assert.throws(() => pistesAPublier([{ mid: "0", trackName: "audio" }, { mid: "1", trackName: "audio" }]));
  assert.throws(() => pistesAPublier([]));
  assert.throws(() => pistesAPublier("audio"));
});

test("recevoir : uniquement les pistes publiées des AUTRES participants présents", () => {
  const demandes = [
    { compteId: "b", trackName: "audio" },
    { compteId: "b", trackName: "video" },
    { compteId: "b", trackName: "audio" }, // doublon
    { compteId: "moi", trackName: "audio" }, // soi-même
    { compteId: "parti", trackName: "audio" }, // a quitté
    { compteId: "muet", trackName: "audio" }, // n'a rien publié
    { compteId: "inconnu", trackName: "audio" }, // hors réunion
  ];
  assert.deepEqual(pistesARecevoir(demandes, participants, "moi"), [
    { location: "remote", sessionId: "s-b", trackName: "audio", compteId: "b" },
    { location: "remote", sessionId: "s-b", trackName: "video", compteId: "b" },
  ]);
  assert.deepEqual(pistesARecevoir(null, participants, "moi"), []);
});

test("pistes publiées : fusion sans doublon", () => {
  assert.deepEqual(fusionnerPistes([{ trackName: "audio", kind: "audio" }], ["video", "audio"]), [
    { trackName: "audio", kind: "audio" },
    { trackName: "video", kind: "video" },
  ]);
  assert.deepEqual(fusionnerPistes(null, ["audio"]), [{ trackName: "audio", kind: "audio" }]);
});
