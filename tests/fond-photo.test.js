import assert from "node:assert/strict";
import test from "node:test";
import {
  CLE_FOND, CONTOUR_MAX, CONTOUR_MIN, FOND_ORIGINAL, FONDS_PRETS, affinerMasque, bornerMasque, composerFond,
  enregistrerFond, fenetreContour, filtreExtremum, hexVersRgb, lireFond, masqueDetoure, moyenneFenetre,
  normaliserCouleur, opacite, recadrerMasque, redimensionnerMasque, reduire,
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
  // Fenêtre par défaut (contour au milieu) : penche vers l'enfant.
  assert.equal(opacite(0), 0);
  assert.equal(opacite(0.25), 0);
  assert.equal(opacite(0.55), 1);
  assert.equal(opacite(1), 1);
  assert.ok(Math.abs(opacite(0.4) - 0.5) < 1e-9);
  assert.ok(opacite(0.3) < opacite(0.4) && opacite(0.4) < opacite(0.5));
  assert.equal(opacite(0.5, 0.35, 0.75) < opacite(0.5), true);
});

test("réglage « Contour » : plus large garde plus, plus serré efface plus, bornes tenues", () => {
  assert.deepEqual(fenetreContour(0), { bas: 0.25, haut: 0.55 });
  const large = fenetreContour(CONTOUR_MAX);
  const serre = fenetreContour(CONTOUR_MIN);
  assert.ok(large.bas < 0.25 && large.bas >= 0);
  assert.ok(serre.haut > 0.55 && serre.haut <= 1);
  // Une confiance de 0,3 (oreille hésitante) : effacée en serré, gardée en large.
  assert.equal(opacite(0.3, serre.bas, serre.haut), 0);
  assert.ok(opacite(0.3, large.bas, large.haut) > 0.9);
  assert.deepEqual(fenetreContour(9), large);
  assert.deepEqual(fenetreContour("n'importe quoi"), fenetreContour(0));
});

test("fusion : le décor prend la couleur, l'enfant ne bouge pas, le bord se mélange", () => {
  // 3 pixels : décor, enfant, bord.
  const pixels = new Uint8ClampedArray([10, 20, 30, 255, 100, 80, 60, 255, 0, 0, 0, 255]);
  composerFond(pixels, Float32Array.from([0.05, 0.95, 0.4]), { r: 255, g: 255, b: 255 });
  assert.deepEqual([...pixels.slice(0, 4)], [255, 255, 255, 255]);
  assert.deepEqual([...pixels.slice(4, 8)], [100, 80, 60, 255]);
  // Moitié enfant (noir), moitié fond (blanc) : gris moyen, à l'arrondi près.
  assert.ok([...pixels.slice(8, 11)].every((v) => v >= 127 && v <= 128));
  assert.equal(pixels[11], 255);
});

test("moyennes, érosion, dilatation et réduction sur fenêtre", () => {
  const ligne = Float32Array.from([0, 0, 1, 1]);
  assert.deepEqual([...moyenneFenetre(ligne, 4, 1, 1)].map((v) => +v.toFixed(3)), [0, 0.333, 0.667, 1]);
  assert.ok(moyenneFenetre(new Float32Array(12).fill(0.8), 4, 3, 2).every((v) => Math.abs(v - 0.8) < 1e-6));
  // Un point isolé au centre d'une grille 5 × 5.
  const point = new Float32Array(25); point[12] = 1;
  const dilate = filtreExtremum(point, 5, 5, 1, true);
  assert.equal([...dilate].filter((v) => v === 1).length, 9);
  assert.equal(dilate[0], 0);
  assert.equal([...filtreExtremum(dilate, 5, 5, 1, false)].filter((v) => v === 1).length, 1);
  assert.deepEqual([...filtreExtremum(ligne, 4, 1, 0, true)], [0, 0, 1, 1]);
  // Rayon plus grand que l'image : tout prend l'extremum.
  assert.ok(filtreExtremum(Float32Array.from([0, 3, 1]), 3, 1, 5, true).every((v) => v === 3));
  const r = reduire(Float32Array.from([0, 1, 1, 1, 2, 2]), 3, 2, 2);
  // Blocs 2 × 2 : (0, 1, 1, 2) → 1 ; bord droit tronqué (1, 2) → 1,5.
  assert.deepEqual({ l: r.largeur, h: r.hauteur, v: [...r.valeurs] }, { l: 2, h: 1, v: [1, 1.5] });
});

// Image test 40 × 10 : enfant sombre à gauche (x < 20), décor clair à
// droite ; le modèle n'en donne qu'un masque flou qui « hésite » sur 12 px.
const L = 40;
const H = 10;
const pixelsBord = (decor = [230, 220, 200]) => {
  const p = new Uint8ClampedArray(L * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < L; x++) {
      const c = x < 20 ? [40, 30, 35] : decor;
      p.set([...c, 255], (y * L + x) * 4);
    }
  }
  return p;
};
const masqueFlou = () => Float32Array.from({ length: L * H }, (_, i) => Math.min(1, Math.max(0, (26 - (i % L)) / 12)));

test("filtre guidé : le masque flou se recale sur le vrai bord de la photo", () => {
  const brut = masqueFlou();
  const affine = affinerMasque(brut, pixelsBord(), L, H, { rayon: 4, eps: 1e-3, sous: 1 });
  const saut = (m) => m[5 * L + 19] - m[5 * L + 20];
  // Le modèle « hésite » (0,58 → 0,50 entre x = 19 et 20) ; affiné, le
  // masque marque un vrai saut au bord réel de la photo.
  assert.ok(saut(brut) < 0.1);
  assert.ok(saut(affine) > 0.3, `saut au bord : ${saut(affine)}`);
  assert.ok(affine[5 * L + 19] > brut[5 * L + 19] + 0.1, "côté enfant renforcé");
  assert.ok(affine[5 * L + 21] < brut[5 * L + 21] - 0.1, "côté décor allégé");
  assert.ok(affine.every((v) => v >= 0 && v <= 1));
  // En définition réduite (comme dans l'app), même résultat à peu près.
  const reduit = affinerMasque(brut, pixelsBord(), L, H, { rayon: 4, eps: 1e-3, sous: 2 });
  assert.ok(saut(reduit) > 0.3);
});

test("bande de contour : le masque affiné ne déborde pas loin du contour du modèle", () => {
  const brut = Float32Array.from({ length: L * H }, (_, i) => (i % L < 20 ? 1 : 0));
  const affine = new Float32Array(L * H).fill(1); // filtre qui « coulerait » partout
  const borne = bornerMasque(affine, brut, L, H, 4, { sous: 1 });
  assert.equal(borne[5 * L + 22], 1, "près du contour : permis");
  assert.equal(borne[5 * L + 35], 0, "loin dans le décor : interdit");
  const troue = bornerMasque(new Float32Array(L * H), brut, L, H, 4, { sous: 1 });
  assert.equal(troue[5 * L + 5], 1, "loin à l'intérieur : jamais troué");
});

test("masque final d'une photo : bornes [0, 1] et taille conservée", () => {
  const masque = masqueDetoure(masqueFlou(), pixelsBord(), L, H);
  assert.equal(masque.length, L * H);
  assert.ok(masque.every((v) => v >= 0 && v <= 1));
  assert.ok(masque[5 * L + 2] > 0.9 && masque[5 * L + 38] < 0.1);
});

test("masque redimensionné à la taille de la photo", () => {
  const m = Float32Array.from([0, 1, 0, 1]);
  assert.equal(redimensionnerMasque(m, 2, 2, 2, 2), m);
  const grand = redimensionnerMasque(m, 2, 2, 4, 4);
  assert.equal(grand.length, 16);
  assert.deepEqual([...grand.slice(0, 4)].map((v) => +v.toFixed(2)), [0, 0.25, 0.75, 1]);
});

test("masque recadré : il suit le cadre de la photo retouchée", () => {
  // Masque 4×2 : moitié gauche décor (0), moitié droite enfant (1).
  const m = new Float32Array([0, 0, 1, 1, 0, 0, 1, 1]);
  // Cadre sur la moitié droite, rendu en 2×2 : tout enfant.
  assert.deepEqual([...recadrerMasque(m, 4, 2, { x: 2, y: 0, w: 2, h: 2 }, 2, 2)], [1, 1, 1, 1]);
  // Cadre sur la moitié gauche : tout décor.
  assert.deepEqual([...recadrerMasque(m, 4, 2, { x: 0, y: 0, w: 2, h: 2 }, 2, 2)], [0, 0, 0, 0]);
  // Cadre entier : même résultat que le simple redimensionnement.
  assert.deepEqual([...recadrerMasque(m, 4, 2, { x: 0, y: 0, w: 4, h: 2 }, 8, 4)], [...redimensionnerMasque(m, 4, 2, 8, 4)]);
});
