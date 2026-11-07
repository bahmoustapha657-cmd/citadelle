// Relecture après écriture groupée (useFirestore) : N écritures simultanées
// ne doivent plus coûter N relectures complètes, et chacune doit quand même
// attendre une relecture lancée APRÈS elle.
import test from "node:test";
import assert from "node:assert/strict";
import { creerRelectureGroupee } from "../src/hooks/relecture-groupee.js";

// Lecture contrôlée à la main : chaque appel est retenu jusqu'à `finir()`.
function lectureManuelle() {
  const appels = [];
  const lire = () => new Promise((resolve, reject) => appels.push({ resolve, reject }));
  return { appels, lire };
}
const tic = () => new Promise((r) => setTimeout(r, 0));

test("une écriture seule : une relecture", async () => {
  const { appels, lire } = lectureManuelle();
  const relire = creerRelectureGroupee(lire);
  const p = relire();
  await tic();
  assert.equal(appels.length, 1);
  appels[0].resolve("ok");
  assert.equal(await p, "ok");
});

test("30 écritures pendant une relecture : une seule relecture de plus", async () => {
  const { appels, lire } = lectureManuelle();
  const relire = creerRelectureGroupee(lire);
  const premiere = relire();
  await tic();
  const autres = Array.from({ length: 30 }, () => relire());
  await tic();
  assert.equal(appels.length, 1, "pas de relecture parallèle");
  appels[0].resolve(1);
  await premiere;
  await tic();
  assert.equal(appels.length, 2, "une seule relecture groupée derrière");
  appels[1].resolve(2);
  assert.deepEqual(await Promise.all(autres), Array(30).fill(2));
});

test("une écriture pendant la relecture en cours n'est pas servie par elle", async () => {
  const { appels, lire } = lectureManuelle();
  const relire = creerRelectureGroupee(lire);
  relire();
  await tic();
  let servie = false;
  relire().then(() => { servie = true; });
  appels[0].resolve();
  await tic(); await tic();
  assert.equal(servie, false, "attend la relecture lancée après l'écriture");
  appels[1].resolve();
  await tic();
  assert.equal(servie, true);
});

test("une relecture en échec ne bloque pas la suivante", async () => {
  const { appels, lire } = lectureManuelle();
  const relire = creerRelectureGroupee(lire);
  const p1 = relire();
  await tic();
  const p2 = relire();
  appels[0].reject(new Error("réseau"));
  await assert.rejects(p1, /réseau/);
  await tic();
  appels[1].resolve("ok");
  assert.equal(await p2, "ok");
  // Plus rien en cours : la prochaine repart aussitôt.
  const p3 = relire();
  await tic();
  assert.equal(appels.length, 3);
  appels[2].resolve("encore");
  assert.equal(await p3, "encore");
});
