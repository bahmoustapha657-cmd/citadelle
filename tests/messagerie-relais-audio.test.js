import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

import {
  AVANCE_LECTURE_S, ECHANTILLONS_PAR_PAQUET, RETARD_MAX_S, TAUX_RELAIS, creerEmission, creerReducteur,
  decoderAdpcm, depuisBase64, encoderAdpcm, finDeLecture, heureDeLecture, versBase64,
} from "../src/components/messagerie/audio/relais-audio-logic.js";

// Voix de synthèse : deux sinusoïdes, à l'échelle des échantillons 16 bits.
const voix = (n, amplitude = 9000) => Int16Array.from({ length: n }, (_, i) => Math.round(
  amplitude * (Math.sin((2 * Math.PI * 300 * i) / TAUX_RELAIS) + 0.5 * Math.sin((2 * Math.PI * 1200 * i) / TAUX_RELAIS)) / 1.5,
));

// Rapport signal/bruit en dB.
function rsb(reference, obtenu) {
  let signal = 0;
  let bruit = 0;
  reference.forEach((v, i) => { signal += v * v; bruit += (v - obtenu[i]) ** 2; });
  return 10 * Math.log10(signal / bruit);
}

const flottants = (n, taux, amplitude) => Float32Array.from({ length: n }, (_, i) => amplitude * Math.sin((2 * Math.PI * 440 * i) / taux));

test("ADPCM : la voix revient intelligible, quatre fois plus légère", () => {
  const pcm = voix(ECHANTILLONS_PAR_PAQUET);
  const paquet = encoderAdpcm(pcm, { predicteur: 0, index: 0 });
  assert.equal(paquet.length, 3 + ECHANTILLONS_PAR_PAQUET / 2);
  const relu = decoderAdpcm(paquet);
  assert.equal(relu.length, ECHANTILLONS_PAR_PAQUET);
  // Le début sert au codec à s'ajuster : on juge sur la suite.
  assert.ok(rsb(pcm.subarray(200), relu.subarray(200)) > 15, "qualité insuffisante");
});

test("ADPCM : chaque paquet se lit seul, un paquet perdu n'abîme pas le suivant", () => {
  const pcm = voix(ECHANTILLONS_PAR_PAQUET * 3);
  const etat = { predicteur: 0, index: 0 };
  const tranche = (i) => pcm.subarray(i * ECHANTILLONS_PAR_PAQUET, (i + 1) * ECHANTILLONS_PAR_PAQUET);
  encoderAdpcm(tranche(0), etat);
  encoderAdpcm(tranche(1), etat);
  const troisieme = decoderAdpcm(encoderAdpcm(tranche(2), etat));
  assert.ok(rsb(tranche(2), troisieme) > 15, "le 3e paquet dépend des précédents");
});

test("ADPCM : les extrêmes ne débordent pas", () => {
  const pcm = Int16Array.from({ length: 400 }, (_, i) => (i % 40 < 20 ? 32767 : -32768));
  const relu = decoderAdpcm(encoderAdpcm(pcm, { predicteur: 0, index: 0 }));
  assert.ok(relu.every((v) => v >= -32768 && v <= 32767));
});

test("base64 : aller-retour exact", () => {
  const octets = Uint8Array.from({ length: 256 }, (_, i) => i);
  assert.deepEqual(depuisBase64(versBase64(octets)), octets);
});

test("réduction : 8 kHz quel que soit le taux du navigateur, sans dérive", () => {
  for (const taux of [48000, 44100, 16000]) {
    const reduire = creerReducteur(taux);
    let total = 0;
    for (let i = 0; i < 100; i += 1) total += reduire(flottants(taux / 100, taux, 0.5)).length;
    assert.ok(Math.abs(total - TAUX_RELAIS) <= 1, `${taux} Hz → ${total} échantillons`);
  }
});

test("réduction : le niveau de la voix est conservé", () => {
  const sortie = creerReducteur(48000)(flottants(48000, 48000, 0.5));
  const crete = Math.max(...sortie);
  assert.ok(crete > 15000 && crete <= 16384, `crête ${crete}`);
});

// Tranches de 200 ms de son (true) ou de silence (false) passées à l'émission ;
// renvoie le nombre total de paquets partis après chaque tranche.
function emettre(sequence) {
  let paquets = 0;
  const emission = creerEmission(TAUX_RELAIS, () => { paquets += 1; });
  return sequence.map((parle) => {
    emission(Float32Array.from({ length: ECHANTILLONS_PAR_PAQUET }, (_, j) => (parle
      ? 0.3 * Math.sin((2 * Math.PI * 300 * j) / TAUX_RELAIS)
      : 0)));
    return paquets;
  });
}

test("silence : rien n'est envoyé tant que personne ne parle", () => {
  assert.equal(emettre(Array(20).fill(false)).at(-1), 0);
});

test("parole : envoyée, avec le paquet d'avant et une fin de phrase", () => {
  // 3 silences, 2 de parole, puis silence : 1 avant + 2 de parole + 2 après.
  const cumul = emettre([false, false, false, true, true, ...Array(10).fill(false)]);
  assert.deepEqual(cumul.slice(0, 8), [0, 0, 0, 2, 3, 4, 5, 5]);
  assert.equal(cumul.at(-1), 5);
});

test("parole : un paquet complet toutes les 200 ms, quelle que soit la taille des blocs", () => {
  const paquets = [];
  const emission = creerEmission(TAUX_RELAIS, (p) => paquets.push(p));
  const parole = flottants(ECHANTILLONS_PAR_PAQUET * 3, TAUX_RELAIS, 0.3);
  for (let i = 0; i < parole.length; i += 317) emission(parole.subarray(i, i + 317));
  assert.equal(paquets.length, 3);
  assert.equal(paquets[0].length, 3 + ECHANTILLONS_PAR_PAQUET / 2);
});

test("lecture : à la suite ; tampon après un blanc ; rattrapage du retard", () => {
  assert.equal(heureDeLecture(0, 10), 10 + AVANCE_LECTURE_S);
  assert.equal(heureDeLecture(10.1, 10), 10.1);
  assert.equal(heureDeLecture(10 + RETARD_MAX_S + 0.01, 10), null);
  assert.ok(Math.abs(finDeLecture(10) - 10.2) < 1e-9);
});

test("migration : canal réservé aux participants, sans exécution publique", () => {
  const nom = readdirSync("supabase/migrations").find((f) => f.endsWith("_relais_appels_secours.sql"));
  const sql = readFileSync(`supabase/migrations/${nom}`, "utf8");
  assert.match(sql, /a\.statut = 'en_cours'/);
  assert.match(sql, /my_compte_id\(\) in \(a\.appelant_id, a\.appele_id\)/);
  assert.match(sql, /revoke all on function public\.msg_relais_autorise\(text\) from public, anon/);
  assert.match(sql, /for select to authenticated/);
  assert.match(sql, /for insert to authenticated/);
});
