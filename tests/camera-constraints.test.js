// Caméra de la photo d'élève : meilleure définition du capteur, repli si le
// pilote refuse, caméra mémorisée, libellés.
import test from "node:test";
import assert from "node:assert/strict";
import {
  apercuEnMiroir, cameraRetrouvee, cameraSuivante, ecrirePreferenceCamera, libelleCamera, libelleResolution,
  lirePreferenceCamera, ouvrirMeilleurFlux, tentativesCamera,
} from "../src/components/camera-capture/camera-constraints.js";

const erreur = (name) => Object.assign(new Error(name), { name });

test("tentatives : la plus haute définition d'abord, cadence fluide, caméra arrière par défaut", () => {
  const tentatives = tentativesCamera();
  assert.equal(tentatives.length, 4);
  const [premiere] = tentatives;
  assert.equal(premiere.parAppareil, false);
  assert.deepEqual(premiere.contraintes, {
    audio: false,
    video: {
      width: { ideal: 3840 }, height: { ideal: 2160 }, frameRate: { ideal: 30 },
      facingMode: { ideal: "environment" },
    },
  });
  // Dernier recours : le navigateur choisit seul.
  assert.deepEqual(tentatives.at(-1).contraintes, { audio: false, video: true });
});

test("tentatives : la caméra mémorisée passe en premier, à chaque palier", () => {
  const tentatives = tentativesCamera({ deviceId: "webcam-hd", facing: "user" });
  const parAppareil = tentatives.filter((t) => t.parAppareil);
  assert.equal(parAppareil.length, 3);
  assert.deepEqual(parAppareil.map((t) => t.contraintes.video.deviceId), Array(3).fill({ exact: "webcam-hd" }));
  assert.deepEqual(parAppareil.map((t) => t.contraintes.video.width.ideal), [3840, 1920, 1280]);
  assert.ok(tentatives.slice(0, 3).every((t) => t.parAppareil), "les tentatives par appareil passent avant les génériques");
  assert.equal(tentatives[3].contraintes.video.facingMode.ideal, "user");
});

test("ouverture : premier flux obtenu", async () => {
  const appels = [];
  const flux = await ouvrirMeilleurFlux(async (c) => { appels.push(c); return "flux"; }, {});
  assert.equal(flux, "flux");
  assert.equal(appels.length, 1);
});

test("ouverture : pilote qui refuse la 4K → palier suivant", async () => {
  const appels = [];
  const flux = await ouvrirMeilleurFlux(async (c) => {
    appels.push(c.video.width?.ideal);
    if (c.video.width?.ideal === 3840) throw erreur("NotReadableError");
    return "flux-1080p";
  }, {});
  assert.equal(flux, "flux-1080p");
  assert.deepEqual(appels, [3840, 1920]);
});

test("ouverture : accès refusé → aucune autre tentative", async () => {
  let appels = 0;
  await assert.rejects(
    ouvrirMeilleurFlux(async () => { appels += 1; throw erreur("NotAllowedError"); }, { deviceId: "x" }),
    { name: "NotAllowedError" },
  );
  assert.equal(appels, 1);
});

test("ouverture : caméra mémorisée débranchée → on passe directement aux caméras génériques", async () => {
  const essais = [];
  const flux = await ouvrirMeilleurFlux(async (c) => {
    essais.push(c.video.deviceId ? "appareil" : "generique");
    if (c.video.deviceId) throw erreur("OverconstrainedError");
    return "flux";
  }, { deviceId: "webcam-debranchee" });
  assert.equal(flux, "flux");
  assert.deepEqual(essais, ["appareil", "generique"]);
});

test("ouverture : tout échoue → dernière erreur remontée", async () => {
  await assert.rejects(
    ouvrirMeilleurFlux(async () => { throw erreur("NotReadableError"); }, {}),
    { name: "NotReadableError" },
  );
});

test("libellé de définition, selon le petit côté (portrait de téléphone compris)", () => {
  assert.equal(libelleResolution(3840, 2160), "3840×2160 · 4K");
  assert.equal(libelleResolution(2560, 1440), "2560×1440 · QHD");
  assert.equal(libelleResolution(1920, 1080), "1920×1080 · Full HD");
  assert.equal(libelleResolution(1080, 1920), "1080×1920 · Full HD");
  assert.equal(libelleResolution(1280, 720), "1280×720 · HD");
  assert.equal(libelleResolution(640, 480), "640×480 · SD");
  assert.equal(libelleResolution(0, 0), "");
});

test("nom de caméra : identifiant USB retiré, repli numéroté", () => {
  assert.equal(libelleCamera({ label: "HD Pro Webcam C920 (046d:082d)" }), "HD Pro Webcam C920");
  assert.equal(libelleCamera({ label: "" }, 1), "Caméra 2");
  assert.equal(libelleCamera(undefined), "Caméra 1");
});

test("bascule de caméra en boucle", () => {
  const cameras = [{ deviceId: "a" }, { deviceId: "b" }, { deviceId: "c" }];
  assert.equal(cameraSuivante(cameras, "a").deviceId, "b");
  assert.equal(cameraSuivante(cameras, "c").deviceId, "a");
  assert.equal(cameraSuivante(cameras, "inconnue").deviceId, "a");
  assert.equal(cameraSuivante([], "a"), null);
});

test("miroir : caméra tournée vers l'utilisateur ou webcam sans orientation déclarée", () => {
  assert.equal(apercuEnMiroir("user"), true);
  assert.equal(apercuEnMiroir(undefined), true);
  assert.equal(apercuEnMiroir("environment"), false);
});

test("caméra mémorisée : identifiant et nom, lecture tolérante", () => {
  const brut = ecrirePreferenceCamera("id-c920", "HD Pro Webcam C920 (046d:082d)");
  assert.deepEqual(lirePreferenceCamera(brut), { deviceId: "id-c920", label: "HD Pro Webcam C920 (046d:082d)" });
  assert.deepEqual(lirePreferenceCamera(null), { deviceId: "", label: "" });
  // Valeur non JSON : prise pour un identifiant seul.
  assert.deepEqual(lirePreferenceCamera("id-brut"), { deviceId: "id-brut", label: "" });
});

test("caméra mémorisée retrouvée par son nom quand le navigateur a renouvelé les identifiants", () => {
  const cameras = [
    { deviceId: "nouvel-id-integree", label: "Integrated Camera" },
    { deviceId: "nouvel-id-c920", label: "HD Pro Webcam C920 (046d:082d)" },
  ];
  const preference = { deviceId: "ancien-id-c920", label: "HD Pro Webcam C920 (046d:082d)" };
  // La caméra intégrée s'est ouverte à la place de la webcam mémorisée.
  assert.equal(cameraRetrouvee(cameras, preference, "nouvel-id-integree").deviceId, "nouvel-id-c920");
  // Déjà ouverte, débranchée ou sans nom mémorisé : rien à rouvrir.
  assert.equal(cameraRetrouvee(cameras, preference, "nouvel-id-c920"), null);
  assert.equal(cameraRetrouvee(cameras.slice(0, 1), preference, "nouvel-id-integree"), null);
  assert.equal(cameraRetrouvee(cameras, { deviceId: "x", label: "" }, "nouvel-id-integree"), null);
  assert.equal(cameraRetrouvee(cameras, null, "nouvel-id-integree"), null);
  // Identifiant inchangé : la caméra mémorisée est celle qui s'est ouverte.
  assert.equal(cameraRetrouvee(cameras, { deviceId: "nouvel-id-integree", label: "Integrated Camera" }, "nouvel-id-integree"), null);
});
