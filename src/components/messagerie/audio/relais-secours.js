import {
  TAUX_RELAIS, creerEmission, decoderAdpcm, depuisBase64, finDeLecture, heureDeLecture, versBase64,
} from "./relais-audio-logic";
import { chiffrerPaquet, dechiffrerPaquet } from "./relais-chiffrement";

// Signe de vie : les silences n'envoient rien, il faut distinguer un
// correspondant muet d'un correspondant parti.
const BATTEMENT_MS = 4000;
const ABSENCE_MAX_MS = 20000;

// Relais de secours : capte le micro, chiffre avec `cle`, envoie par `canal`
// ({ envoyer }) et joue ce qui arrive. `recevoir(evenement, charge)` lui transmet
// les messages du canal ; `surPerte` signale un correspondant silencieux depuis
// trop longtemps.
export function demarrerRelaisSecours({ flux, canal, cle, surPerte, urlModule = "/relais-capture.worklet.js" }) {
  const Contexte = window.AudioContext || window.webkitAudioContext;
  const ctx = new Contexte();
  let arrete = false;
  let prochain = 0;
  let dernierSignal = Date.now();
  let source = null;
  let capture = null;
  // Le chiffrement est asynchrone : ces files gardent les paquets dans l'ordre.
  let fileEnvoi = Promise.resolve();
  let fileLecture = Promise.resolve();

  const envoyerPaquet = (octets) => {
    fileEnvoi = fileEnvoi
      .then(async () => canal.envoyer("a", { d: versBase64(await chiffrerPaquet(cle, octets)) }))
      .catch(() => { /* paquet perdu, comme sur le réseau */ });
  };
  const reprendre = () => { ctx.resume?.().catch(() => {}); };

  const pret = (async () => {
    await ctx.audioWorklet.addModule(urlModule);
    if (arrete) return;
    source = ctx.createMediaStreamSource(flux);
    capture = new AudioWorkletNode(ctx, "relais-capture", { numberOfOutputs: 0 });
    const emettre = creerEmission(ctx.sampleRate, envoyerPaquet);
    capture.port.onmessage = (e) => emettre(e.data);
    source.connect(capture);
    // Son encore bloqué par le navigateur : le prochain geste le débloque.
    ctx.resume?.().catch(() => {});
    if (ctx.state === "suspended") window.addEventListener("pointerdown", reprendre, { once: true });
  })();

  const jouer = (octets) => {
    const debut = heureDeLecture(prochain, ctx.currentTime);
    if (arrete || debut === null) return;
    const pcm = decoderAdpcm(octets);
    const tampon = ctx.createBuffer(1, pcm.length, TAUX_RELAIS);
    tampon.getChannelData(0).set(Float32Array.from(pcm, (e) => e / 32768));
    const lecture = ctx.createBufferSource();
    lecture.buffer = tampon;
    lecture.connect(ctx.destination);
    lecture.start(debut);
    prochain = finDeLecture(debut);
  };

  const battement = setInterval(() => {
    canal.envoyer("v");
    if (Date.now() - dernierSignal > ABSENCE_MAX_MS) surPerte?.();
  }, BATTEMENT_MS);

  return {
    pret,
    recevoir(evenement, charge) {
      dernierSignal = Date.now();
      if (evenement !== "a" || !charge?.d) return;
      fileLecture = fileLecture
        .then(async () => jouer(await dechiffrerPaquet(cle, depuisBase64(charge.d))))
        .catch(() => { /* paquet illisible : ignoré */ });
    },
    arreter() {
      arrete = true;
      clearInterval(battement);
      window.removeEventListener("pointerdown", reprendre);
      try { source?.disconnect(); capture?.disconnect(); } catch { /* déjà coupés */ }
      ctx.close?.().catch(() => {});
    },
  };
}
