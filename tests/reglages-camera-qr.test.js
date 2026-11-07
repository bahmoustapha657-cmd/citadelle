import assert from "node:assert/strict";
import test from "node:test";
import { aLampe, etapesMiseAuPoint, plageZoom, zoomInitial } from "../src/components/verif-qr/reglages-camera-qr.js";

test("zoom d'un téléphone (rapport 1–8) : ×2 à l'ouverture", () => {
  const caps = { zoom: { min: 1, max: 8, step: 0.1 } };
  assert.deepEqual(plageZoom(caps), { min: 1, max: 8, step: 0.1 });
  assert.equal(zoomInitial(caps), 2);
});

test("zoom borné par l'appareil, et ignoré s'il n'est pas un rapport", () => {
  assert.equal(zoomInitial({ zoom: { min: 1, max: 1.5, step: 0.1 } }), 1.5);
  assert.equal(zoomInitial({ zoom: { min: 100, max: 500, step: 1 } }), null); // webcam, unité inconnue
  assert.equal(zoomInitial({ zoom: { min: 1, max: 1 } }), null);
  assert.equal(zoomInitial({}), null);
  assert.equal(plageZoom({ zoom: { min: 1, max: 4 } }).step, 0.1);
});

test("lampe proposée seulement si l'appareil en a une", () => {
  assert.equal(aLampe({ torch: true }), true);
  assert.equal(aLampe({ torch: [false, true] }), true);
  assert.equal(aLampe({ torch: false }), false);
  assert.equal(aLampe({}), false);
});

test("toucher : mise au point ponctuelle sur le point touché, puis retour en continu", () => {
  const point = { x: 0.5, y: 0.4 };
  assert.deepEqual(etapesMiseAuPoint({ focusMode: ["continuous", "single-shot"], pointsOfInterest: true }, point), [
    { pointsOfInterest: [point], focusMode: "single-shot" },
    { focusMode: "continuous" },
  ]);
  assert.deepEqual(etapesMiseAuPoint({ focusMode: ["single-shot"] }, point), [{ focusMode: "single-shot" }]);
  assert.deepEqual(etapesMiseAuPoint({ focusMode: ["continuous"] }, point), []);
  assert.deepEqual(etapesMiseAuPoint({}, point), []);
});
