import assert from "node:assert/strict";
import test from "node:test";
import { FOND_ORIGINAL } from "../src/components/camera-capture/fond-photo.js";
import {
  REGLAGES_NEUTRES, TON_MAX, ZOOM_MAX, appliquerTons, bornerCentre, cadrageSurVisage, deplacerCadre,
  dimensionsTournees, estNeutre, finaliserRetouche, memoireRetouche, normaliserReglages, retoucheFond,
  sourceRetouche, tableTons, tonsAuto, tourner, zoneCadrage, zonesRecherche, zoomerCadre,
} from "../src/components/camera-capture/retouche.js";

const proche = (a, b, tolerance = 1e-6) => assert.ok(Math.abs(a - b) <= tolerance, `${a} ≉ ${b}`);

// Pixels RGBA d'une image unie ou d'une liste de gris.
const gris = (valeurs) => {
  const p = new Uint8ClampedArray(valeurs.length * 4);
  valeurs.forEach((v, i) => { p.set([v, v, v, 255], i * 4); });
  return p;
};

test("réglages : bornés, quarts de tour, valeurs illisibles ramenées au neutre", () => {
  assert.deepEqual(normaliserReglages({}), { ...REGLAGES_NEUTRES });
  assert.deepEqual(normaliserReglages(), { ...REGLAGES_NEUTRES });
  const r = normaliserReglages({
    rotation: -90, zoom: 9, cx: -1, cy: "0.3", luminosite: 80, contraste: -73.4, fond: "#FFF", contour: 5,
  });
  assert.deepEqual(r, { rotation: 270, zoom: ZOOM_MAX, cx: 0, cy: 0.3, luminosite: TON_MAX, contraste: -TON_MAX, fond: "#ffffff", contour: 2 });
  assert.equal(normaliserReglages({ rotation: 100 }).rotation, 90);
  assert.equal(normaliserReglages({ rotation: 450 }).rotation, 90);
  assert.equal(normaliserReglages({ zoom: "abc", fond: "bleu" }).zoom, 1);
  assert.equal(normaliserReglages({ fond: "bleu" }).fond, FOND_ORIGINAL);
  assert.equal(normaliserReglages({ zoom: null }).zoom, 1);
});

test("cadre 3:4 : photo entière au zoom 1, plus petit au zoom, toujours dans l'image", () => {
  // Photo de la caméra (768×1024) : le cadre est la photo entière.
  assert.deepEqual(zoneCadrage(768, 1024, {}), { x: 0, y: 0, w: 768, h: 1024 });
  // Photo de galerie en paysage (1200×900) : le plus grand 3:4, centré.
  assert.deepEqual(zoneCadrage(1200, 900, {}), { x: 262.5, y: 0, w: 675, h: 900 });
  // Zoom ×2 centré.
  assert.deepEqual(zoneCadrage(768, 1024, { zoom: 2 }), { x: 192, y: 256, w: 384, h: 512 });
  // Centre poussé hors de l'image : le cadre reste au bord.
  assert.deepEqual(zoneCadrage(768, 1024, { zoom: 2, cx: 0, cy: 1 }), { x: 0, y: 512, w: 384, h: 512 });
  // … et le centre mémorisé est celui du cadre réellement montré.
  assert.deepEqual(bornerCentre(768, 1024, { zoom: 2, cx: 0, cy: 1 }), { cx: 0.25, cy: 0.75 });
});

test("glisser : la photo suit le doigt, le cadre part en sens inverse", () => {
  const depart = { zoom: 2, cx: 0.5, cy: 0.5 };
  // Aperçu de 384 px de large pour un cadre de 384 px : 1 px d'écran = 1 px d'image.
  const apres = deplacerCadre(768, 1024, depart, 96, -128, 384);
  proche(apres.cx, 0.5 - 96 / 768);
  proche(apres.cy, 0.5 + 128 / 1024);
  // Au zoom 1 sur une photo 3:4, rien ne bouge : le cadre est déjà la photo entière.
  assert.deepEqual(deplacerCadre(768, 1024, { zoom: 1, cx: 0.5, cy: 0.5 }, 50, 50, 300), { cx: 0.5, cy: 0.5 });
});

test("zoom : le point sous les doigts reste sous les doigts", () => {
  // Zoom ×2 depuis le coin haut-gauche : le cadre reste collé à ce coin.
  const coin = zoomerCadre(768, 1024, { zoom: 1, cx: 0.5, cy: 0.5 }, 2, 0, 0);
  assert.deepEqual(zoneCadrage(768, 1024, coin), { x: 0, y: 0, w: 384, h: 512 });
  // Zoom au centre de l'aperçu sur un cadre décalé : son centre ne bouge pas.
  const decale = { zoom: 2, cx: 0.4, cy: 0.6 };
  const plus = zoomerCadre(768, 1024, decale, 3, 0.5, 0.5);
  assert.equal(plus.zoom, 3);
  proche(plus.cx, 0.4, 1e-4);
  proche(plus.cy, 0.6, 1e-4);
  // Borné à ZOOM_MAX et à 1.
  assert.equal(zoomerCadre(768, 1024, decale, 99).zoom, ZOOM_MAX);
  assert.equal(zoomerCadre(768, 1024, decale, 0.2).zoom, 1);
});

test("quart de tour : sens horaire et inverse, le cadrage repart de la photo entière", () => {
  const r = { ...REGLAGES_NEUTRES, zoom: 2, cx: 0.2, luminosite: 10 };
  assert.deepEqual(tourner(r, 1), { ...r, rotation: 90, zoom: 1, cx: 0.5, cy: 0.5 });
  assert.equal(tourner(r, -1).rotation, 270);
  assert.equal(tourner({ ...r, rotation: 270 }, 1).rotation, 0);
  assert.deepEqual(dimensionsTournees(768, 1024, 90), { largeur: 1024, hauteur: 768 });
  assert.deepEqual(dimensionsTournees(768, 1024, 180), { largeur: 768, hauteur: 1024 });
});

test("centrer le visage : cadrage d'identité autour du visage trouvé", () => {
  // Enfant photographié de loin : visage de 200 px de haut en (500, 300).
  const visage = { x: 500, y: 300, w: 160, h: 200 };
  const r = cadrageSurVisage(visage, 1200, 1600);
  const z = zoneCadrage(1200, 1600, r);
  assert.ok(r.zoom > 1);
  // Visage à 42 % de la hauteur du cadre, centré en largeur.
  proche(visage.h / z.h, 0.42, 0.01);
  proche(z.x + z.w / 2, visage.x + visage.w / 2, 1);
  // Visage énorme : zoom 1, on ne peut pas reculer.
  assert.equal(cadrageSurVisage({ x: 0, y: 0, w: 700, h: 1000 }, 768, 1024).zoom, 1);
});

test("recherche du visage : photo entière, puis carrés chevauchants qui couvrent tout", () => {
  const passes = zonesRecherche(768, 1024);
  assert.deepEqual(passes[0], [{ x: 0, y: 0, w: 768, h: 1024 }]);
  for (const zones of passes.slice(1)) {
    const cote = zones[0].w;
    assert.ok(zones.every((z) => z.w === cote && z.h === cote && z.x >= 0 && z.y >= 0 && z.x + cote <= 768 && z.y + cote <= 1024));
    // Les bords droit et bas sont couverts.
    assert.ok(zones.some((z) => z.x + cote === 768) && zones.some((z) => z.y + cote === 1024));
  }
  assert.equal(passes[1][0].w, 384);
  assert.equal(passes[1].length, 3 * 5);
  // Un visage de 100 px, où qu'il soit, tient entier dans un carré de la 2e passe.
  for (const [vx, vy] of [[0, 0], [300, 470], [668, 924]]) {
    assert.ok(passes[1].some((z) => vx >= z.x && vy >= z.y && vx + 100 <= z.x + z.w && vy + 100 <= z.y + z.h));
  }
});

test("neutre : rien à refaire seulement si la photo sortirait identique", () => {
  assert.equal(estNeutre(REGLAGES_NEUTRES, 768, 1024), true);
  assert.equal(estNeutre({ ...REGLAGES_NEUTRES, zoom: 1.5 }, 768, 1024), false);
  assert.equal(estNeutre({ ...REGLAGES_NEUTRES, rotation: 90 }, 768, 1024), false);
  assert.equal(estNeutre({ ...REGLAGES_NEUTRES, luminosite: 5 }, 768, 1024), false);
  assert.equal(estNeutre({ ...REGLAGES_NEUTRES, fond: "#ffffff" }, 768, 1024), false);
  // Photo de galerie en paysage : même sans zoom, elle serait recadrée en 3:4.
  assert.equal(estNeutre(REGLAGES_NEUTRES, 1200, 900), false);
});

test("lumière : la luminosité éclaircit les tons moyens sans griser noirs et blancs", () => {
  const neutre = tableTons(0, 0);
  assert.ok([...neutre].every((v, i) => v === i));
  const clair = tableTons(30, 0);
  assert.equal(clair[0], 0);
  assert.equal(clair[255], 255);
  assert.ok(clair[60] > 60 + 20);
  const sombre = tableTons(-30, 0);
  assert.ok(sombre[128] < 128);
  // Contraste : les sombres plus sombres, les clairs plus clairs.
  const contraste = tableTons(0, 30);
  assert.ok(contraste[64] < 64 && contraste[192] > 192);
  assert.ok(tableTons(0, -30)[64] > 64);
  // Appliqué en place, transparence intacte.
  const pixels = new Uint8ClampedArray([60, 60, 60, 128]);
  appliquerTons(pixels, clair);
  assert.deepEqual([...pixels], [clair[60], clair[60], clair[60], 128]);
});

test("lumière auto : photo sombre éclaircie, peau foncée devant un mur clair laissée telle quelle", () => {
  // Classe mal éclairée : tout entre 20 et 110.
  const sombre = tonsAuto(gris(Array.from({ length: 200 }, (_, i) => 20 + (i % 91))));
  assert.ok(sombre.luminosite > 10, JSON.stringify(sombre));
  // Peau foncée (40-70) devant un mur blanc (230-250) : bien exposée.
  const peauFonceeMurClair = tonsAuto(gris([
    ...Array.from({ length: 100 }, (_, i) => 40 + (i % 31)),
    ...Array.from({ length: 100 }, (_, i) => 230 + (i % 21)),
  ]));
  assert.deepEqual(peauFonceeMurClair, { luminosite: 0, contraste: 0 });
  // Photo terne (tout entre 100 et 160) : du relief en plus.
  const terne = tonsAuto(gris(Array.from({ length: 200 }, (_, i) => 100 + (i % 61))));
  assert.ok(terne.contraste > 0, JSON.stringify(terne));
  assert.deepEqual(tonsAuto(new Uint8ClampedArray(0)), { luminosite: 0, contraste: 0 });
});

test("mémoire de la retouche : on repart de l'origine tant que la photo est la sienne", () => {
  const memoire = {
    origine: "https://s/photos/a.jpg", resultat: "https://s/photos/b.jpg",
    rotation: 0, zoom: 1.5, cx: 0.5, cy: 0.4, luminosite: 10, contraste: 0, fond: "#cfe3f5", contour: 1,
  };
  const depart = sourceRetouche("https://s/photos/b.jpg", memoire);
  assert.equal(depart.source, "https://s/photos/a.jpg");
  assert.equal(depart.reglages.zoom, 1.5);
  assert.equal(depart.reglages.fond, "#cfe3f5");
  // Photo reprise depuis : la mémoire ne vaut plus.
  assert.deepEqual(sourceRetouche("https://s/photos/c.jpg", memoire),
    { source: "https://s/photos/c.jpg", reglages: { ...REGLAGES_NEUTRES } });
  assert.deepEqual(sourceRetouche("", null), { source: "", reglages: { ...REGLAGES_NEUTRES } });
});

test("mémoire enregistrée : avec l'URL de la nouvelle photo, jamais en data URL", () => {
  const apres = memoireRetouche("https://s/photos/a.jpg", { zoom: 2, fond: "#FFF" }, "data:image/jpeg;base64,xx");
  assert.equal(apres.resultat, "data:image/jpeg;base64,xx");
  assert.equal(apres.fond, "#ffffff");
  const gardee = finaliserRetouche(apres, "data:image/jpeg;base64,xx", "https://s/photos/n.jpg");
  assert.equal(gardee.origine, "https://s/photos/a.jpg");
  assert.equal(gardee.resultat, "https://s/photos/n.jpg");
  assert.equal(gardee.zoom, 2);
  // Pas la photo envoyée, origine pas encore enregistrée, origine elle-même : rien.
  assert.equal(finaliserRetouche(apres, "data:autre", "https://s/photos/n.jpg"), null);
  assert.equal(finaliserRetouche({ ...apres, origine: "data:image/jpeg;base64,yy" }, apres.resultat, "https://s/photos/n.jpg"), null);
  assert.equal(finaliserRetouche(apres, apres.resultat, "https://s/photos/a.jpg"), null);
  assert.equal(finaliserRetouche(null, "x", "https://s/photos/n.jpg"), null);
  // Fiche enregistrée sans toucher à la photo : la mémoire valable reste.
  const deja = { ...gardee };
  assert.deepEqual(finaliserRetouche(deja, "https://s/photos/n.jpg", "https://s/photos/n.jpg"), gardee);
});

test("fond de toute la classe : seulement les photos à changer, le reste de la retouche gardé", () => {
  const jamais = retoucheFond("https://s/p1.jpg", null, "#FFFFFF");
  assert.deepEqual(jamais, { source: "https://s/p1.jpg", reglages: { ...REGLAGES_NEUTRES, fond: "#ffffff" } });
  const memoire = { origine: "https://s/p0.jpg", resultat: "https://s/p2.jpg", zoom: 1.4, fond: "#ffffff" };
  // Déjà ce fond : rien à faire.
  assert.equal(retoucheFond("https://s/p2.jpg", memoire, "#ffffff"), null);
  // Autre couleur : depuis l'origine, zoom conservé.
  const bleu = retoucheFond("https://s/p2.jpg", memoire, "#cfe3f5");
  assert.equal(bleu.source, "https://s/p0.jpg");
  assert.equal(bleu.reglages.zoom, 1.4);
  assert.equal(bleu.reglages.fond, "#cfe3f5");
  // Fond d'origine : seulement pour une photo dont le fond a été changé ici.
  assert.equal(retoucheFond("https://s/p1.jpg", null, FOND_ORIGINAL), null);
  assert.equal(retoucheFond("https://s/p2.jpg", memoire, FOND_ORIGINAL).reglages.fond, FOND_ORIGINAL);
  assert.equal(retoucheFond("", null, "#ffffff"), null);
});
