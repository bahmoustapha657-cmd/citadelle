// Vocaux illisibles : deux enregistrements mêlés dans un même fichier (double
// appui sur le micro). L'outil de réparation les sépare ; l'enregistreur n'en
// lance plus jamais deux.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { desentrelacer, duree, estSain, lire, reparer } from "../scripts/vocal-entrelace.mjs";

// ── Faux vocal WebM, façon Chrome ──
const octets = (...v) => Buffer.from(v);
const INCONNUE = octets(0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff);
const elementSimple = (id, corps) => Buffer.concat([octets(...id), octets(0x80 | corps.length), corps]);
const ENTETES = [
  elementSimple([0x1a, 0x45, 0xdf, 0xa3], Buffer.alloc(31, 0x42)),
  Buffer.concat([octets(0x18, 0x53, 0x80, 0x67), INCONNUE]),
  elementSimple([0x15, 0x49, 0xa9, 0x66], Buffer.alloc(25, 0x4d)),
  elementSimple([0x16, 0x54, 0xae, 0x6b], Buffer.alloc(63, 0x73)),
];
// Bloc audio de `taille` octets utiles, à `rel` ms dans sa grappe ; `graine`
// distingue le son de deux enregistreurs.
function bloc(rel, taille, graine) {
  const corps = Buffer.alloc(4 + taille);
  corps[0] = 0x81;
  corps.writeInt16BE(rel, 1);
  corps[3] = 0x80;
  for (let i = 0; i < taille; i++) corps[4 + i] = (graine * 31 + i * 7 + rel) & 0xff;
  const t = corps.length < 127 ? octets(0x80 | corps.length) : octets(0x40 | (corps.length >> 8), corps.length & 0xff);
  return Buffer.concat([octets(0xa3), t, corps]);
}
function heure(ms) {
  const v = [];
  let n = ms;
  do { v.unshift(n & 0xff); n = Math.floor(n / 256); } while (n > 0);
  return Buffer.concat([octets(0xe7, 0x80 | v.length), octets(...v)]);
}
// Éléments d'un enregistrement de `grappes` × 300 ms (5 blocs de 60 ms).
function elements(grappes, graine, { entetes = true } = {}) {
  const liste = entetes ? [...ENTETES] : [];
  for (let g = 0; g < grappes; g++) {
    liste.push(Buffer.concat([octets(0x1f, 0x43, 0xb6, 0x75), INCONNUE]), heure(g * 300 - (g % 3 === 1 ? 1 : 0)));
    for (let k = 0; k < 5; k++) liste.push(bloc(k * 60 + ((g + k) % 4 === 0 ? 1 : 0), 100 + ((g * 5 + k) % 9) * 20, graine));
  }
  return liste;
}
// Morceaux de 250 ms comme Chrome les rend : des éléments entiers, plus le
// premier octet de l'élément suivant (le tout premier morceau ne contient
// que cet octet).
function morceaux(liste, parMorceau = 4, premier = 3) {
  const flux = Buffer.concat(liste);
  const coupes = [1];
  let pos = 0;
  liste.forEach((e, i) => {
    pos += e.length;
    if (i >= premier && (i - premier) % parMorceau === 0 && pos < flux.length) coupes.push(pos + 1);
  });
  coupes.push(flux.length);
  const sorties = [];
  let debut = 0;
  for (const c of coupes) { if (c > debut) sorties.push(flux.subarray(debut, c)); debut = c; }
  return sorties;
}
const alterner = (a, b) => {
  const fichier = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i]) fichier.push(a[i]);
    if (b[i]) fichier.push(b[i]);
  }
  return Buffer.concat(fichier);
};

test("un vocal ordinaire est reconnu sain et laissé tel quel", () => {
  const vocal = Buffer.concat(elements(12, 1));
  assert.equal(estSain(vocal), true);
  assert.equal(reparer(vocal), null);
  assert.equal(Math.round(duree(vocal) * 10) / 10, 3.6);
  // Enregistrement arrêté au milieu d'un bloc : toujours un vocal.
  assert.equal(estSain(vocal.subarray(0, vocal.length - 37)), true);
  assert.equal(estSain(Buffer.from("pas un vocal")), false);
  // Micro repris après une pause : l'heure saute de 17 s, le vocal reste sain.
  const saut = elements(6, 1).map((e, i) => (e[0] === 0xe7 && i > 6 ? heure(17000 + i * 43) : e));
  assert.equal(estSain(Buffer.concat(saut)), true);
  assert.equal(lire(octets(0xa3, 0x85, 0x82, 0, 0, 0x80, 1)), false, "piste inconnue : pas un bloc");
});

test("deux enregistreurs partis ensemble : le même vocal en double, récupéré à l'identique", () => {
  const liste = elements(20, 1);
  const vocal = Buffer.concat(liste);
  const m = morceaux(liste);
  const fichier = alterner(m, m);
  assert.equal(fichier.length, vocal.length * 2);
  assert.equal(estSain(fichier), false);
  const r = reparer(fichier, 6);
  assert.ok(r.vocal.equals(vocal), "octet pour octet, le vocal d'origine");
  assert.equal(Math.round(r.duree), 6);
  // Durée annoncée sans rapport avec ce que l'on retrouve : pas de réparation.
  assert.throws(() => reparer(fichier, 60), /réparation refusée/);
});

test("enregistreur oublié depuis longtemps : il pollue le vocal suivant, que l'on retrouve intact", () => {
  // A tourne depuis 138 s (début perdu, horloge très en avance) ; B est le vocal.
  const vieux = elements(40, 9, { entetes: false }).map((e) => {
    if (e[0] !== 0xe7) return e;
    let v = 0;
    for (let i = 2; i < e.length; i++) v = v * 256 + e[i];
    return heure(v + 138491);
  });
  // Comme observé sur les vrais fichiers : ses morceaux finissent avec une
  // grappe (7 éléments), les premiers sont partis avec un autre vocal.
  const mA = morceaux(vieux, 7, 6).slice(3);
  const listeB = elements(30, 2);
  const vocal = Buffer.concat(listeB);
  const fichier = alterner(mA, morceaux(listeB));
  assert.equal(estSain(fichier), false);
  assert.notEqual(fichier[0], 0x1a, "le fichier commence au milieu de l'enregistreur oublié");
  const r = reparer(fichier, 9);
  assert.ok(r.vocal.equals(vocal), "le vocal, sans un octet de l'autre enregistreur");
  assert.equal(r.flux, 1, "l'enregistreur oublié, sans en-tête, n'est pas rendu");
});

test("les deux flux au même point de leur grappe : vocal complet et régulier, à l'instant près", () => {
  // Limite connue : quand les deux enregistreurs en sont au même bloc de leur
  // grappe, rien dans le fichier ne dit lequel a écrit le bloc suivant.
  // Quelques blocs peuvent alors passer d'un flux à l'autre — c'est le même
  // son, au même instant. Le vocal rendu reste entier et à l'heure.
  const listeA = elements(25, 5);
  const decale = elements(25, 6).map((e) => {
    if (e[0] !== 0xe7) return e;
    let v = 0;
    for (let i = 2; i < e.length; i++) v = v * 256 + e[i];
    return heure(v + 60000);
  });
  const mB = morceaux(decale, 5).slice(2);
  const r = desentrelacer(alterner(morceaux(listeA, 5), mB));
  assert.equal(r.flux.length, 1);
  const attendu = Buffer.concat(listeA);
  assert.equal(estSain(r.flux[0]), true);
  assert.equal(r.flux[0].length, attendu.length);
  assert.equal(duree(r.flux[0]), duree(attendu));
});

test("fichier qui n'est pas un vocal entrelacé : refus net, rien d'inventé", () => {
  const bruit = Buffer.from(Array.from({ length: 4000 }, (_, i) => (i * 37 + 11) & 0xff));
  assert.throws(() => reparer(bruit), /séparation impossible/);
});

test("enregistreur : jamais deux à la fois, morceaux propres à chacun", () => {
  const code = readFileSync("src/components/messagerie/audio/use-enregistreur.js", "utf8");
  // Second appui pendant l'attente du micro ou pendant l'enregistrement : refusé.
  assert.match(code, /if \(r\.rec \|\| r\.demarrage\) return false;/);
  // Les morceaux ne passent plus par l'état partagé entre enregistreurs.
  assert.match(code, /const morceaux = \[\];/);
  assert.doesNotMatch(code, /r\.morceaux/);
  // Annulé pendant l'attente : le micro est relâché, rien ne démarre.
  assert.match(code, /if \(r\.demarrage !== tour\) \{ arreterFlux\(flux\); return false; \}/);
  // Chaque enregistreur relâche SON micro en s'arrêtant.
  assert.match(code, /arreterFlux\(flux\);\r?\n {8}if \(courant\) nettoyer\(\);/);
});
