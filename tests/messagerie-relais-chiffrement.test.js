import assert from "node:assert/strict";
import test from "node:test";

import { encoderAdpcm } from "../src/components/messagerie/audio/relais-audio-logic.js";
import {
  chiffrerPaquet, cleCommune, creerEchangeCles, dechiffrerPaquet,
} from "../src/components/messagerie/audio/relais-chiffrement.js";

const APPEL = "7c1f0a52-7b1a-4a54-9a59-1d6f0f7e2b10";

// Un vrai paquet de voix, avec sa structure lisible en clair.
const voix = () => encoderAdpcm(Int16Array.from({ length: 1600 }, (_, i) => Math.round(9000 * Math.sin(i / 5))), { predicteur: 0, index: 0 });

async function deuxCotes() {
  const [a, b] = await Promise.all([creerEchangeCles(), creerEchangeCles()]);
  const [cleA, cleB] = await Promise.all([cleCommune(a, b.publique, APPEL), cleCommune(b, a.publique, APPEL)]);
  return { a, b, cleA, cleB };
}

const contient = (grand, petit) => Buffer.from(grand).includes(Buffer.from(petit));

test("relais chiffré : chaque côté lit la voix de l'autre, dans les deux sens", async () => {
  const { cleA, cleB } = await deuxCotes();
  const paquet = voix();
  assert.deepEqual(await dechiffrerPaquet(cleB, await chiffrerPaquet(cleA, paquet)), paquet);
  assert.deepEqual(await dechiffrerPaquet(cleA, await chiffrerPaquet(cleB, paquet)), paquet);
});

test("relais chiffré : ce qui transite ne laisse rien voir de la voix", async () => {
  const { cleA } = await deuxCotes();
  const paquet = voix();
  const premier = await chiffrerPaquet(cleA, paquet);
  const second = await chiffrerPaquet(cleA, paquet);
  assert.equal(contient(premier, paquet.subarray(100, 132)), false);
  assert.notDeepEqual(premier, second, "un même son ne doit jamais donner le même paquet");
  assert.equal(premier.length, paquet.length + 28, "12 octets de vecteur, 16 d'authentification");
});

test("relais chiffré : qui voit passer les clés publiques ne peut pas écouter", async () => {
  const { a, b, cleA } = await deuxCotes();
  const espion = await creerEchangeCles();
  const paquet = await chiffrerPaquet(cleA, voix());
  await assert.rejects(dechiffrerPaquet(await cleCommune(espion, a.publique, APPEL), paquet));
  await assert.rejects(dechiffrerPaquet(await cleCommune(espion, b.publique, APPEL), paquet));
});

test("relais chiffré : une clé ne sert que pour son appel", async () => {
  const { a, b, cleA } = await deuxCotes();
  const paquet = await chiffrerPaquet(cleA, voix());
  await assert.rejects(dechiffrerPaquet(await cleCommune(b, a.publique, "autre-appel"), paquet));
});

test("relais chiffré : un paquet modifié en route est refusé", async () => {
  const { cleA, cleB } = await deuxCotes();
  const paquet = await chiffrerPaquet(cleA, voix());
  paquet[40] ^= 1;
  await assert.rejects(dechiffrerPaquet(cleB, paquet));
});

test("relais chiffré : sans échange de clés, pas de clé commune", async () => {
  const a = await creerEchangeCles();
  assert.equal(await cleCommune(null, a.publique, APPEL), null);
  assert.equal(await cleCommune(a, undefined, APPEL), null);
  assert.equal(await cleCommune(a, "pas une clé", APPEL), null);
  assert.equal(await cleCommune(a, a.publique, ""), null);
});

test("relais chiffré : la clé privée n'est pas exportable", async () => {
  const { privee } = await creerEchangeCles();
  assert.equal(privee.extractable, false);
});
