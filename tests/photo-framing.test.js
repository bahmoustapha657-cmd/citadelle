// Cadrage de la photo d'élève : consignes données pendant l'aperçu et
// recadrage portrait 3:4 centré sur le visage.
import test from "node:test";
import assert from "node:assert/strict";
import {
  COMPOSITION, FORMAT_PHOTO, SORTIE_MAX, analyserCadrage, calculerRecadrage, diagnosticLumiere,
  mesurerLumiere, orientationTete, regionVisible, tailleMaxCote, tailleSortie, versApercu, versVisages,
  visagePrincipal, zoneAnalyse, zoneLoupe,
} from "../src/components/camera-capture/photo-framing.js";

// Webcam Full HD paysage : l'aperçu 3:4 en montre la bande centrale.
const L = 1920;
const H = 1080;

// Visage synthétique à la manière de BlazeFace : boîte carrée, yeux, nez.
// `lacet` : décalage du nez le long de l'axe des yeux (tête tournée),
// `roulis` : inclinaison de la ligne des yeux, en degrés.
function visage({ cx, cy, h, score = 0.95, lacet = 0, roulis = 0 }) {
  const a = (roulis * Math.PI) / 180;
  const u = { x: Math.cos(a), y: Math.sin(a) };
  const n = { x: -Math.sin(a), y: Math.cos(a) };
  const ecart = 0.36 * h;
  const milieu = { x: cx + n.x * -0.12 * h, y: cy + n.y * -0.12 * h };
  const oeilGauche = { x: milieu.x - (u.x * ecart) / 2, y: milieu.y - (u.y * ecart) / 2 };
  const oeilDroit = { x: milieu.x + (u.x * ecart) / 2, y: milieu.y + (u.y * ecart) / 2 };
  const nez = {
    x: milieu.x + u.x * lacet * ecart + n.x * 0.17 * h,
    y: milieu.y + u.y * lacet * ecart + n.y * 0.17 * h,
  };
  return { x: cx - h / 2, y: cy - h / 2, w: h, h, score, points: [oeilDroit, oeilGauche, nez] };
}

// Visage idéalement placé dans l'aperçu.
const CENTRE_X = L / 2;
const CENTRE_Y = COMPOSITION.centreY * H;
const BIEN_PLACE = { cx: CENTRE_X, cy: CENTRE_Y, h: COMPOSITION.hauteurVisage * H };

test("aperçu 3:4 : bande centrale d'une image paysage, milieu d'une image portrait", () => {
  assert.deepEqual(regionVisible(1920, 1080), { x: 555, y: 0, w: 810, h: 1080 });
  // Téléphone tenu verticalement.
  assert.deepEqual(regionVisible(1080, 1920), { x: 0, y: 240, w: 1080, h: 1440 });
  assert.deepEqual(regionVisible(900, 1200), { x: 0, y: 0, w: 900, h: 1200 });
});

test("détections MediaPipe ramenées à l'image pleine définition", () => {
  const detection = {
    boundingBox: { originX: 100, originY: 50, width: 120, height: 120, angle: 0 },
    categories: [{ score: 0.93 }],
    keypoints: [{ x: 0.5, y: 0.25 }],
  };
  const [v] = versVisages([detection], { largeurAnalyse: 480, hauteurAnalyse: 270, zone: { x: 0, y: 0, w: L, h: H } });
  assert.deepEqual(v, { x: 400, y: 200, w: 480, h: 480, score: 0.93, points: [{ x: 960, y: 270 }] });
  // Canvas d'analyse copié d'une partie de l'image : décalage et échelle de la zone.
  const [z] = versVisages([detection], { largeurAnalyse: 360, hauteurAnalyse: 480, zone: { x: 555, y: 0, w: 810, h: 1080 } });
  assert.deepEqual(z, { x: 780, y: 112.5, w: 270, h: 270, score: 0.93, points: [{ x: 960, y: 270 }] });
  // Détection sans boîte : ignorée.
  assert.deepEqual(versVisages([{ categories: [], keypoints: [] }], { largeurAnalyse: 1, hauteurAnalyse: 1, zone: { x: 0, y: 0, w: 1, h: 1 } }), []);
});

test("zones analysées : l'aperçu élargi, puis une loupe sur l'emplacement de la tête", () => {
  // Webcam 16:9 : bande de l'aperçu élargie de 20 % de chaque côté, sans
  // sortir de l'image ; le détecteur n'a plus à voir toute la largeur.
  assert.deepEqual(zoneAnalyse(1920, 1080), { x: 393, y: 0, w: 1134, h: 1080 });
  // Téléphone en portrait : l'aperçu couvre la largeur, marge en hauteur.
  assert.deepEqual(zoneAnalyse(1080, 1920), { x: 0, y: 96, w: 1080, h: 1728 });
  const loupe = zoneLoupe(1920, 1080);
  const region = regionVisible(1920, 1080);
  assert.ok(loupe.w < region.w * 0.6 && loupe.h < region.h * 0.6, "la loupe grossit l'élève resté loin");
  assert.ok(Math.abs(loupe.x + loupe.w / 2 - (region.x + region.w / 2)) <= 1);
  assert.ok(loupe.y >= region.y && loupe.y + loupe.h <= region.y + region.h);
});

test("visage principal : le plus grand, détections peu sûres écartées", () => {
  const grand = visage({ cx: 900, cy: 500, h: 400 });
  const petit = visage({ cx: 1300, cy: 300, h: 150 }); // (150/400)² ≈ 14 % : un visage au fond
  const douteux = visage({ cx: 700, cy: 500, h: 600, score: 0.3 });
  const { principal, plusieurs } = visagePrincipal([petit, douteux, grand]);
  assert.equal(principal, grand);
  assert.equal(plusieurs, false);
  assert.equal(visagePrincipal([grand, visage({ cx: 1400, cy: 500, h: 380 })]).plusieurs, true);
  assert.deepEqual(visagePrincipal([douteux]), { principal: null, plusieurs: false });
});

test("orientation de la tête : de face, penchée, tournée — quel que soit l'ordre des yeux", () => {
  const face = orientationTete(visage(BIEN_PLACE).points);
  assert.ok(Math.abs(face.roulis) < 0.01 && Math.abs(face.lacet) < 0.01);

  const penchee = orientationTete(visage({ ...BIEN_PLACE, roulis: 20 }).points);
  assert.ok(Math.abs(penchee.roulis - 20) < 0.01);
  assert.ok(Math.abs(penchee.lacet) < 0.01, "la tête penchée n'est pas prise pour une tête tournée");

  const tournee = orientationTete(visage({ ...BIEN_PLACE, lacet: 0.5 }).points);
  assert.ok(Math.abs(tournee.lacet - 0.5) < 0.01);

  const [a, b, nez] = visage({ ...BIEN_PLACE, roulis: -10 }).points;
  assert.deepEqual(orientationTete([b, a, nez]), orientationTete([a, b, nez]));
  assert.deepEqual(orientationTete([]), { roulis: 0, lacet: 0 });
});

const verdict = (options, extra = {}) =>
  analyserCadrage({ visages: [visage(options)], largeur: L, hauteur: H, ...extra });

test("cadrage bon : visage de face, centré, à la bonne distance", () => {
  const r = verdict(BIEN_PLACE);
  assert.equal(r.etat, "ok");
  assert.equal(r.bon, true);
  assert.equal(r.conseil, "");
});

test("consignes : chaque défaut de cadrage a la sienne", () => {
  assert.equal(analyserCadrage({ visages: [], largeur: L, hauteur: H }).etat, "absent");
  assert.equal(verdict({ ...BIEN_PLACE, h: 0.2 * H }).etat, "loin");
  assert.equal(verdict({ ...BIEN_PLACE, h: 0.7 * H }).etat, "proche");
  assert.equal(verdict({ ...BIEN_PLACE, cx: CENTRE_X + 0.2 * 810 }).etat, "decentre");
  assert.equal(verdict({ ...BIEN_PLACE, cy: CENTRE_Y - 0.2 * H }).etat, "decentre");
  assert.equal(verdict({ ...BIEN_PLACE, lacet: 0.5 }).etat, "tourne");
  assert.equal(verdict({ ...BIEN_PLACE, roulis: 20 }).etat, "incline");
  const deux = [visage(BIEN_PLACE), visage({ ...BIEN_PLACE, cx: CENTRE_X + 300 })];
  assert.equal(analyserCadrage({ visages: deux, largeur: L, hauteur: H }).etat, "plusieurs");
  // Le plus petit visage d'une paire éloignée n'est pas une seconde personne.
  const lointain = [visage(BIEN_PLACE), visage({ cx: CENTRE_X + 300, cy: 200, h: 100 })];
  assert.equal(analyserCadrage({ visages: lointain, largeur: L, hauteur: H }).etat, "ok");
});

test("chaque consigne a un message", () => {
  const cas = [
    analyserCadrage({ visages: [], largeur: L, hauteur: H }),
    verdict({ ...BIEN_PLACE, h: 0.2 * H }), verdict({ ...BIEN_PLACE, h: 0.7 * H }),
    verdict({ ...BIEN_PLACE, lacet: 0.5 }), verdict({ ...BIEN_PLACE, roulis: 20 }), verdict(BIEN_PLACE),
  ];
  for (const r of cas) assert.ok(r.message.length > 5, `message manquant pour « ${r.etat} »`);
});

test("visage qui dépasse du cadre visible : à recentrer", () => {
  // Centre dans la tolérance, mais la boîte déborde à droite de l'aperçu.
  const r = verdict({ ...BIEN_PLACE, cx: CENTRE_X + 0.12 * 810, h: 0.58 * H });
  assert.equal(r.etat, "decentre");
});

test("stabilité : un visage qui bouge entre deux analyses n'est pas encore « bon »", () => {
  const precedent = visage({ ...BIEN_PLACE, cx: CENTRE_X - 0.05 * H });
  assert.equal(verdict(BIEN_PLACE, { precedent }).etat, "bouge");
  const quasiImmobile = visage({ ...BIEN_PLACE, cx: CENTRE_X - 0.01 * H });
  assert.equal(verdict(BIEN_PLACE, { precedent: quasiImmobile }).etat, "ok");
});

test("lumière : simple conseil, jamais bloquant", () => {
  const sombre = verdict(BIEN_PLACE, { lumiere: { moyenne: 12, fractionSombre: 0.8, fractionClaire: 0 } });
  assert.equal(sombre.etat, "ok");
  assert.equal(sombre.bon, true);
  assert.match(sombre.conseil, /sombre/);
  const brule = verdict(BIEN_PLACE, { lumiere: { moyenne: 240, fractionSombre: 0, fractionClaire: 0.6 } });
  assert.match(brule.conseil, /lumière/);
});

const pixels = (liste) => Uint8ClampedArray.from(liste.flatMap(([r, g, b]) => [r, g, b, 255]));
const repeter = (rgb, n) => Array.from({ length: n }, () => rgb);

test("exposition : un conseil de lumière ne dépend jamais de la seule carnation", () => {
  assert.equal(diagnosticLumiere(mesurerLumiere(pixels(repeter([10, 10, 10], 100)))), "sombre");
  assert.equal(diagnosticLumiere(mesurerLumiere(pixels(repeter([252, 250, 250], 100)))), "clair");
  assert.equal(diagnosticLumiere(mesurerLumiere(pixels(repeter([128, 128, 128], 100)))), null);
  // Teintes les plus foncées de l'échelle de Monk (MST-9 #3a312a, MST-10
  // #292420), correctement exposées, avec ombres (yeux, narines) et reflets :
  // aucun conseil.
  for (const [r, g, b] of [[58, 49, 42], [41, 36, 32]]) {
    const visage = pixels([...repeter([r, g, b], 70), ...repeter([12, 10, 9], 15), ...repeter([r * 1.8, g * 1.8, b * 1.8], 15)]);
    const mesure = mesurerLumiere(visage);
    assert.ok(mesure.moyenne < 60);
    assert.equal(diagnosticLumiere(mesure), null, `MST ${r},${g},${b} bien exposée`);
  }
  // La même peau MST-10 sous-exposée de 40 % : là, le conseil est justifié.
  assert.equal(diagnosticLumiere(mesurerLumiere(pixels(repeter([25, 22, 19], 100)))), "sombre");
  assert.equal(mesurerLumiere(new Uint8ClampedArray(0)), null);
  assert.equal(diagnosticLumiere(null), null);
});

test("recadrage : visage bien placé → exactement le cadre de l'aperçu", () => {
  assert.deepEqual(calculerRecadrage(visage(BIEN_PLACE), L, H), regionVisible(L, H));
});

test("recadrage : format 3:4, visage à la hauteur et à la position de la composition", () => {
  // Caméra 4K, visage plus petit et décentré : la photo est centrée sur lui.
  const v = visage({ cx: 1500, cy: 1000, h: 600 });
  const c = calculerRecadrage(v, 3840, 2160);
  assert.ok(Math.abs(c.w / c.h - FORMAT_PHOTO) < 0.002);
  assert.ok(Math.abs(v.h / c.h - COMPOSITION.hauteurVisage) < 0.002);
  assert.ok(Math.abs((v.x + v.w / 2 - c.x) / c.w - 0.5) < 0.002);
  assert.ok(Math.abs((v.y + v.h / 2 - c.y) / c.h - COMPOSITION.centreY) < 0.002);
});

test("recadrage : toujours dans l'image, même visage au bord ou trop près", () => {
  const dansImage = (c, l, h) => c.x >= 0 && c.y >= 0 && c.x + c.w <= l && c.y + c.h <= h;
  const auBord = calculerRecadrage(visage({ cx: 250, cy: 300, h: 400 }), L, H);
  assert.ok(dansImage(auBord, L, H));
  assert.equal(auBord.x, 0);
  const tropPres = calculerRecadrage(visage({ cx: CENTRE_X, cy: CENTRE_Y, h: 800 }), L, H);
  assert.ok(dansImage(tropPres, L, H));
  assert.equal(tropPres.h, H);
  assert.equal(tropPres.w, 810);
  // Téléphone en portrait.
  const portrait = calculerRecadrage(visage({ cx: 540, cy: 900, h: 500 }), 1080, 1920);
  assert.ok(dansImage(portrait, 1080, 1920));
});

test("taille de sortie : plafonnée, jamais agrandie, proportions conservées", () => {
  assert.deepEqual(tailleSortie(810, 1080), { largeur: SORTIE_MAX.largeur, hauteur: SORTIE_MAX.hauteur });
  assert.deepEqual(tailleSortie(300, 400), { largeur: 300, hauteur: 400 });
  const grande = tailleSortie(1620, 2160);
  assert.deepEqual(grande, { largeur: 768, hauteur: 1024 });
  assert.deepEqual(tailleMaxCote(4000, 3000, 1200), { largeur: 1200, hauteur: 900 });
  assert.deepEqual(tailleMaxCote(3000, 4000, 1200), { largeur: 900, hauteur: 1200 });
  assert.deepEqual(tailleMaxCote(800, 600, 1200), { largeur: 800, hauteur: 600 });
});

test("repère de l'aperçu : le cadre visible occupe tout le calque 300×400", () => {
  const region = regionVisible(L, H);
  assert.deepEqual(versApercu(region, region), { x: 0, y: 0, w: 300, h: 400 });
  const moitie = versApercu({ x: region.x + region.w / 2, y: region.h / 2, w: region.w / 2, h: region.h / 2 }, region);
  assert.deepEqual(moitie, { x: 150, y: 200, w: 150, h: 200 });
});
