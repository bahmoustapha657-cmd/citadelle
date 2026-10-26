import assert from "node:assert/strict";
import test from "node:test";
import {
  CLE_FOND, FOND_ORIGINAL, FONDS_PRETS, adoucirMasque, composerFond, enregistrerFond, hexVersRgb,
  lireFond, normaliserCouleur, opacite, redimensionnerMasque,
} from "../src/components/camera-capture/fond-photo.js";

const stockageMemoire = (initial = {}) => {
  const donnees = { ...initial };
  return { getItem: (k) => (k in donnees ? donnees[k] : null), setItem: (k, v) => { donnees[k] = String(v); }, donnees };
};

test("couleurs : normalisées, courtes acceptées, le reste refusé", () => {
  assert.equal(normaliserCouleur("#FFF"), "#ffffff");
  assert.equal(normaliserCouleur(" #CFE3F5 "), "#cfe3f5");
  assert.equal(normaliserCouleur("bleu"), null);
  assert.equal(normaliserCouleur("#12345"), null);
  assert.deepEqual(hexVersRgb("#cfe3f5"), { r: 207, g: 227, b: 245 });
  assert.deepEqual(hexVersRgb("n'importe quoi"), { r: 255, g: 255, b: 255 });
  assert.ok(FONDS_PRETS.every((f) => normaliserCouleur(f.valeur) === f.valeur));
});

test("choix du fond gardé d'une photo à l'autre, original par défaut", () => {
  const s = stockageMemoire();
  assert.equal(lireFond(s), FOND_ORIGINAL);
  enregistrerFond(s, "#CFE3F5");
  assert.equal(s.donnees[CLE_FOND], "#cfe3f5");
  assert.equal(lireFond(s), "#cfe3f5");
  enregistrerFond(s, FOND_ORIGINAL);
  assert.equal(lireFond(s), FOND_ORIGINAL);
  assert.equal(lireFond(stockageMemoire({ [CLE_FOND]: "<script>" })), FOND_ORIGINAL);
  // Stockage bloqué (navigation privée) : pas d'exception.
  const bloque = { getItem() { throw new Error("bloqué"); }, setItem() { throw new Error("bloqué"); } };
  assert.equal(lireFond(bloque), FOND_ORIGINAL);
  assert.doesNotThrow(() => enregistrerFond(bloque, "#ffffff"));
  assert.equal(lireFond(null), FOND_ORIGINAL);
});

test("opacité : décor effacé, enfant gardé, transition douce entre les deux", () => {
  assert.equal(opacite(0), 0);
  assert.equal(opacite(0.35), 0);
  assert.equal(opacite(0.75), 1);
  assert.equal(opacite(1), 1);
  assert.ok(Math.abs(opacite(0.55) - 0.5) < 1e-9);
  assert.ok(opacite(0.45) < opacite(0.5) && opacite(0.5) < opacite(0.6));
});

test("fusion : le décor prend la couleur, l'enfant ne bouge pas, le bord se mélange", () => {
  // 3 pixels : décor, enfant, bord.
  const pixels = new Uint8ClampedArray([10, 20, 30, 255, 100, 80, 60, 255, 0, 0, 0, 255]);
  composerFond(pixels, Float32Array.from([0.05, 0.95, 0.55]), { r: 255, g: 255, b: 255 });
  assert.deepEqual([...pixels.slice(0, 4)], [255, 255, 255, 255]);
  assert.deepEqual([...pixels.slice(4, 8)], [100, 80, 60, 255]);
  // Moitié enfant (noir), moitié fond (blanc) : gris moyen, à l'arrondi près.
  assert.ok([...pixels.slice(8, 11)].every((v) => v >= 127 && v <= 128));
  assert.equal(pixels[11], 255);
});

test("masque adouci : uniforme inchangé, bord dur étalé", () => {
  const plein = new Float32Array(12).fill(0.8);
  assert.ok(adoucirMasque(plein, 4, 3, 1).every((v) => Math.abs(v - 0.8) < 1e-6));
  // Bord vertical net au milieu d'une image 4 × 1.
  const bord = adoucirMasque(Float32Array.from([0, 0, 1, 1]), 4, 1, 1);
  assert.deepEqual([...bord].map((v) => +v.toFixed(3)), [0, 0.333, 0.667, 1]);
  assert.deepEqual([...adoucirMasque(Float32Array.from([0, 1]), 2, 1, 0)], [0, 1]);
});

test("masque redimensionné à la taille de la photo", () => {
  const m = Float32Array.from([0, 1, 0, 1]);
  assert.equal(redimensionnerMasque(m, 2, 2, 2, 2), m);
  const grand = redimensionnerMasque(m, 2, 2, 4, 4);
  assert.equal(grand.length, 16);
  assert.deepEqual([...grand.slice(0, 4)].map((v) => +v.toFixed(2)), [0, 0.25, 0.75, 1]);
});
