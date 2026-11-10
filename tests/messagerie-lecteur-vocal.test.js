// « Vocal indisponible » alors que le fichier existe : trois causes distinctes,
// chacune avec son message et sa suite.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ESSAIS_TELECHARGEMENT, ETATS_ERREUR, raisonLecture, telechargerAvecReprises,
} from "../src/components/messagerie/lecteur-vocal-logic.js";

const sansAttente = { attendre: async () => {} };

test("téléchargement : réseau faible, le troisième essai aboutit", async () => {
  let appels = 0;
  const url = await telechargerAvecReprises(async () => {
    appels += 1;
    if (appels < 3) throw new Error("réseau");
    return "blob:vocal";
  }, sansAttente);
  assert.equal(url, "blob:vocal");
  assert.equal(appels, 3);
});

test("téléchargement : trois échecs, puis l'erreur remonte ; pauses croissantes", async () => {
  let appels = 0;
  const pauses = [];
  await assert.rejects(telechargerAvecReprises(async () => { appels += 1; throw new Error("coupé"); },
    { attendre: async (ms) => { pauses.push(ms); } }), /coupé/);
  assert.equal(appels, ESSAIS_TELECHARGEMENT);
  assert.deepEqual(pauses, [800, 2000], "aucune pause après le dernier essai");
  // Réussite immédiate : un seul appel, aucune pause.
  pauses.length = 0;
  assert.equal(await telechargerAvecReprises(async () => "ok", { attendre: async (ms) => { pauses.push(ms); } }), "ok");
  assert.deepEqual(pauses, []);
});

test("lecture refusée : la raison décide de la suite", () => {
  // Safari, son lancé trop longtemps après le toucher : le vocal est prêt.
  assert.equal(raisonLecture({ name: "NotAllowedError" }, { error: null }), "geste");
  assert.equal(raisonLecture({ name: "AbortError" }, {}), "geste");
  // Format que l'appareil ne lit pas (WebM/Opus sur un iPhone ancien).
  assert.equal(raisonLecture({ name: "NotSupportedError" }, {}), "format");
  assert.equal(raisonLecture({ name: "Error" }, { error: { code: 4 } }), "format");
  assert.equal(raisonLecture({ name: "Error" }, { error: { code: 3 } }), "format");
  assert.equal(raisonLecture(new Error("?"), undefined), "inconnue");
});

test("chaque échec a son message ; seul le format illisible ne se réessaie pas", () => {
  assert.deepEqual(Object.keys(ETATS_ERREUR).sort(), ["format", "geste", "inconnue", "reseau"]);
  assert.equal(ETATS_ERREUR.format.reessayer, false);
  for (const cle of ["reseau", "geste", "inconnue"]) assert.equal(ETATS_ERREUR[cle].reessayer, true);
  for (const l of ["fr", "en", "ar"]) {
    const voix = JSON.parse(readFileSync(`src/i18n/locales/${l}.json`, "utf8")).msg.voice;
    for (const e of Object.values(ETATS_ERREUR)) assert.ok(voix[e.cle.split(".").pop()]?.trim(), `${l} : ${e.cle}`);
    assert.ok(voix.loading?.trim());
  }
});

test("lecteur : reprises au téléchargement, vocal gardé quand seul le toucher manque", () => {
  const code = readFileSync("src/components/messagerie/LecteurVocal.jsx", "utf8");
  assert.match(code, /telechargerAvecReprises\(\(\) => urlVocal\(chemin\)\)/);
  assert.match(code, /setEtat\("reseau"\);/);
  // Déjà téléchargé : un toucher relance la lecture, sans retélécharger.
  assert.match(code, /if \(audioRef\.current\) \{ lire\(audioRef\.current\); return; \}/);
  assert.match(code, /if \(raison === "format"\) audioRef\.current = null;/);
});
