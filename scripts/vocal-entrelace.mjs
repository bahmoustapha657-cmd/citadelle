// Répare un message vocal illisible parce que DEUX enregistrements y sont
// mélangés.
//
// Cause (corrigée dans use-enregistreur.js) : un double appui sur le micro
// lançait deux enregistreurs. Le premier n'était jamais arrêté et déposait ses
// morceaux (250 ms) dans le tableau du vocal en cours, et de tous les vocaux
// suivants jusqu'au rechargement de la page. Le fichier alterne donc des
// morceaux de deux flux WebM/Opus, et aucun lecteur ne s'y retrouve.
//
// Ce que l'on sait des morceaux de Chrome : chacun contient des éléments
// entiers (grappe, horodatage, blocs audio) PLUS le premier octet de
// l'élément suivant, dont le reste ouvre le morceau suivant du même flux.
// On relit donc le fichier élément par élément en tenant, pour chaque flux,
// son octet en attente et son horloge : un élément revient au flux pour
// lequel il est bien formé ET arrive à l'heure (60 ms après le précédent).
// Quand les deux flux conviennent, on essaie l'un, et l'on revient en arrière
// si la suite ne tient pas.
//
// Rien n'est décodé ni réencodé : le vocal réparé est, octet pour octet, ce
// que son enregistreur a produit.
//
//   node scripts/vocal-entrelace.mjs <entrée.webm> <sortie.webm>
//
// Tests : tests/vocal-entrelace.test.js.
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const MAGIE = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]); // en-tête EBML : début d'un flux
const TYPES = new Map([
  [0x1a45dfa3, "ebml"], [0x18538067, "segment"], [0x1549a966, "infos"],
  [0x1654ae6b, "pistes"], [0x1f43b675, "grappe"],
]);
const PREMIERS_OCTETS = [0x1f, 0xa3, 0xe7, 0x1a];
// Écart admis entre deux blocs d'un même flux (ms) : serré, puis large pour
// les vocaux à silences (blocs irréguliers).
const TOLERANCES = [[40, 80], [1, 900]];

// Taille EBML à `pos` : { n, valeur | null si inconnue } ; null s'il manque
// des octets, false si l'octet n'ouvre pas une taille.
function taille(buf, pos) {
  if (pos >= buf.length) return null;
  const b0 = buf[pos];
  if (b0 === 0) return false;
  let n = 1;
  while (!(b0 & (0x80 >> (n - 1)))) n += 1;
  if (pos + n > buf.length) return null;
  let valeur = b0 & (0xff >> n);
  let inconnue = valeur === (0xff >> n);
  for (let i = 1; i < n; i++) {
    valeur = valeur * 256 + buf[pos + i];
    if (buf[pos + i] !== 0xff) inconnue = false;
  }
  return { n, valeur: inconnue ? null : valeur };
}

// Élément au début de `buf` : { type, l (octets à consommer), rel | v } ;
// null s'il est coupé par la fin du tampon, false s'il n'en est pas un.
// Les conteneurs (segment, grappe) ne comptent que leur en-tête.
export function lire(buf) {
  if (buf.length < 1) return null;
  const b = buf[0];
  if (b === 0xa3) { // bloc audio : taille, piste 1, horodatage relatif, drapeaux
    const t = taille(buf, 1);
    if (t === null) return null;
    if (!t || t.valeur === null || t.n > 2 || t.valeur < 4 || t.valeur > 4000) return false;
    const corps = 1 + t.n;
    if (corps < buf.length && buf[corps] !== 0x81) return false;
    if (corps + 3 < buf.length && (buf[corps + 3] & 0x7f) !== 0) return false;
    if (corps + t.valeur > buf.length) return null;
    return { type: "bloc", l: corps + t.valeur, rel: buf.readInt16BE(corps + 1) };
  }
  if (b === 0xe7) { // horodatage de la grappe
    const t = taille(buf, 1);
    if (t === null) return null;
    if (!t || t.valeur === null || t.n !== 1 || t.valeur < 1 || t.valeur > 6) return false;
    if (2 + t.valeur > buf.length) return null;
    let v = 0;
    for (let i = 0; i < t.valeur; i++) v = v * 256 + buf[2 + i];
    return { type: "heure", l: 2 + t.valeur, v };
  }
  if (!PREMIERS_OCTETS.includes(b) && ![0x18, 0x15, 0x16].includes(b)) return false;
  if (buf.length < 4) return null;
  const type = TYPES.get(buf.readUInt32BE(0));
  if (!type) return false;
  const t = taille(buf, 4);
  if (t === null) return null;
  if (!t) return false;
  if (type === "segment" || type === "grappe") return { type, l: 4 + t.n };
  if (t.valeur === null || t.valeur > 4096) return false;
  if (4 + t.n + t.valeur > buf.length) return null;
  return { type, l: 4 + t.n + t.valeur };
}

// Le fichier est-il un vocal sain : un seul flux, lisible de bout en bout,
// à l'heure ?
export function estSain(fichier) {
  if (!fichier.subarray(0, 4).equals(MAGIE)) return false;
  let pos = 0;
  let flux = { attente: null, grappe: null, dernier: null, rel: null };
  while (pos < fichier.length) {
    const e = lire(fichier.subarray(pos, pos + 4200));
    if (e === false) return false;
    if (e === null) return true; // dernier élément coupé : fin d'enregistrement
    // L'heure ne recule jamais dans un flux unique. Elle peut piétiner
    // (silences) ou sauter loin en avant (micro repris après une pause) : les
    // lecteurs s'en accommodent.
    flux = accepter(flux, e, [0, Infinity]);
    if (!flux) return false;
    pos += e.l;
  }
  return true;
}

// L'élément `e` arrive-t-il à l'heure pour ce flux ? Renvoie l'état suivant
// du flux, ou null.
function accepter(flux, e, [mini, maxi]) {
  const suite = { ...flux, attente: null };
  if (e.type === "bloc") {
    if (flux.grappe !== null) {
      const abs = flux.grappe + e.rel;
      if (flux.dernier !== null && (abs - flux.dernier < mini || abs - flux.dernier > maxi)) return null;
      if (flux.dernier === null && flux.rel === null && e.rel > 10) return null; // 1er bloc d'une grappe
      suite.dernier = abs;
    } else if (flux.rel !== null && (e.rel - flux.rel < mini || e.rel - flux.rel > maxi)) return null;
    suite.rel = e.rel;
    return suite;
  }
  if (e.type === "heure") {
    if (flux.dernier !== null && (e.v - flux.dernier < mini || e.v - flux.dernier > maxi)) return null;
    // Début perdu : l'heure de la grappe précédente est inconnue, celle-ci la donne.
    if (flux.dernier === null && flux.rel !== null) suite.dernier = e.v - 60;
    suite.grappe = e.v;
    suite.rel = null;
    return suite;
  }
  if (e.type === "grappe") return suite;
  // En-têtes : seulement avant le premier son.
  return flux.grappe === null && flux.rel === null ? suite : null;
}

const fluxNeuf = () => ({ attente: null, grappe: null, dernier: null, rel: null });

// Sépare les flux d'un fichier entrelacé pour une tolérance donnée. Renvoie
// la liste des éléments attribués ({ f, attente, de, a }), ou null.
function separer(fichier, tolerance, attenteInitiale, attenteAutre = null) {
  // Chaque étape : { p, f (flux courant), flux: [a, b], besoin, choix, trace }
  const morts = new Set();
  const cle = (s) => `${s.p}|${s.f}|${s.besoin ? 1 : 0}|${s.flux.map((x) => `${x.attente}/${x.grappe}/${x.dernier}/${x.rel}`).join("|")}`;
  const depart = {
    p: 0, f: 0, besoin: attenteInitiale !== null, trace: null,
    flux: [{ ...fluxNeuf(), attente: attenteInitiale }, { ...fluxNeuf(), attente: attenteAutre }],
  };
  const pile = [{ etat: depart, i: 0 }];
  let pas = 0;
  while (pile.length) {
    if ((pas += 1) > 4_000_000) return null;
    const cadre = pile[pile.length - 1];
    const s = cadre.etat;
    if (s.p >= fichier.length) return { trace: s.trace, doutes: doutes(pile) };
    const options = cadre.options || (cadre.options = suites(fichier, s, tolerance));
    if (cadre.i >= options.length) { morts.add(cle(s)); pile.pop(); continue; }
    const suivant = options[cadre.i];
    cadre.i += 1;
    if (suivant.fin) return { trace: suivant.trace, doutes: doutes(pile) };
    if (!morts.has(cle(suivant))) pile.push({ etat: suivant, i: 0 });
  }
  return null;
}

// Étapes du chemin retenu où un autre choix restait possible : à zéro, la
// séparation est certaine ; sinon quelques blocs ont pu passer d'un flux à
// l'autre (même instant, même forme : rien ne les distingue).
const doutes = (pile) => pile.filter((c) => c.options && c.i < c.options.length).length;

// États atteignables depuis `s`, du plus probable au moins probable.
function suites(fichier, s, tolerance) {
  const prendre = (etat) => {
    const x = etat.flux[etat.f];
    const tete = x.attente === null ? [] : [Buffer.from([x.attente])];
    const e = lire(Buffer.concat([...tete, fichier.subarray(etat.p, etat.p + 4200)]));
    if (e === false) return null;
    const pris = x.attente === null ? 0 : 1;
    if (e === null) {
      // Élément coupé par la fin du fichier : l'enregistrement s'arrête là.
      return { fin: true, trace: { f: etat.f, attente: x.attente, de: etat.p, a: fichier.length, avant: etat.trace } };
    }
    const apres = accepter(x, e, tolerance);
    if (!apres) return null;
    const flux = etat.flux.slice();
    flux[etat.f] = apres;
    const a = etat.p + e.l - pris;
    return { p: a, f: etat.f, besoin: false, flux, trace: { f: etat.f, attente: x.attente, de: etat.p, a, avant: etat.trace } };
  };
  if (s.besoin) { const u = prendre(s); return u ? [u] : []; }
  const autre = 1 - s.f;
  const sorties = [];
  // 1. Le flux courant continue.
  const continuer = prendre(s);
  if (continuer) sorties.push(continuer);
  // 2. Son morceau finit sur le premier octet de son élément suivant.
  if (s.flux[s.f].attente === null && PREMIERS_OCTETS.includes(fichier[s.p])) {
    const flux = s.flux.slice();
    flux[s.f] = { ...flux[s.f], attente: fichier[s.p] };
    const bascule = prendre({ p: s.p + 1, f: autre, flux, trace: s.trace });
    if (bascule) sorties.push(bascule);
  }
  // 2 bis. … et le morceau de l'autre flux ne contient que le premier octet
  // de SON élément suivant (son tout premier morceau, par exemple).
  if (s.flux[s.f].attente === null && s.flux[autre].attente === null
      && PREMIERS_OCTETS.includes(fichier[s.p]) && PREMIERS_OCTETS.includes(fichier[s.p + 1])) {
    const flux = s.flux.slice();
    flux[s.f] = { ...flux[s.f], attente: fichier[s.p] };
    flux[autre] = { ...flux[autre], attente: fichier[s.p + 1] };
    const retour = prendre({ p: s.p + 2, f: s.f, flux, trace: s.trace });
    if (retour) sorties.push(retour);
  }
  // 3. Son morceau finit pile entre deux éléments.
  const net = prendre({ ...s, f: autre });
  if (net) sorties.push(net);
  return sorties;
}

// Sépare les flux d'un fichier entrelacé : { flux: [Buffer…], elements }.
// Seuls les flux qui ont leur en-tête (donc lisibles) sont renvoyés.
export function desentrelacer(fichier) {
  for (const tolerance of TOLERANCES) {
    // Un flux peut être pris en route : le premier octet de son élément était
    // alors à la fin d'un morceau perdu, on le devine (pour l'un et l'autre).
    const devinettes = [null, ...PREMIERS_OCTETS];
    for (const [attente, autre] of devinettes.flatMap((a) => devinettes.map((b) => [a, b]))) {
      const issue = separer(fichier, tolerance, attente, autre);
      if (!issue) continue;
      const { trace } = issue;
      const parFlux = [[], []];
      let elements = 0;
      for (let t = trace; t; t = t.avant) {
        elements += 1;
        parFlux[t.f].unshift(fichier.subarray(t.de, t.a));
        if (t.attente !== null) parFlux[t.f].unshift(Buffer.from([t.attente]));
      }
      const flux = parFlux.map((m) => Buffer.concat(m)).filter((b) => b.subarray(0, 4).equals(MAGIE));
      if (flux.length) return { flux, elements, doutes: issue.doutes };
    }
  }
  throw new Error("séparation impossible : le fichier ne ressemble pas à deux vocaux entrelacés");
}

// Durée (s) d'un flux sain, d'après l'heure de son dernier bloc.
export function duree(fluxSain) {
  let pos = 0;
  let grappe = 0;
  let fin = 0;
  while (pos < fluxSain.length) {
    const e = lire(fluxSain.subarray(pos, pos + 4200));
    if (!e) break;
    if (e.type === "heure") grappe = e.v;
    if (e.type === "bloc") fin = grappe + e.rel + 60;
    pos += e.l;
  }
  return fin / 1000;
}

// Vocal réparé : parmi les flux complets, celui dont la durée colle à la durée
// annoncée du message (à défaut, le plus long). null si le fichier est sain.
export function reparer(fichier, dureeAnnoncee = null) {
  if (estSain(fichier)) return null;
  const { flux, elements, doutes: incertains } = desentrelacer(fichier);
  const bons = flux.filter(estSain).map((vocal) => ({ vocal, duree: duree(vocal) }));
  if (!bons.length) throw new Error("aucun flux complet à récupérer");
  bons.sort((a, b) => (dureeAnnoncee === null
    ? b.duree - a.duree
    : Math.abs(a.duree - dureeAnnoncee) - Math.abs(b.duree - dureeAnnoncee)));
  // Garde-fou : un vocal « réparé » qui n'a presque rien gardé du fichier, ou
  // loin de la durée annoncée, n'est pas une réparation.
  const meilleur = bons[0];
  if (meilleur.vocal.length < fichier.length * 0.3
      || (dureeAnnoncee !== null && Math.abs(meilleur.duree - dureeAnnoncee) > Math.max(2, dureeAnnoncee * 0.2))) {
    throw new Error("réparation refusée : le flux retrouvé ne correspond pas au vocal attendu");
  }
  return { ...meilleur, elements, flux: flux.length, doutes: incertains };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [entree, sortie, annoncee] = process.argv.slice(2);
  if (!entree || !sortie) {
    console.error("Usage : node scripts/vocal-entrelace.mjs <entrée.webm> <sortie.webm> [durée annoncée en s]");
    process.exit(2);
  }
  const resultat = reparer(readFileSync(entree), annoncee ? Number(annoncee) : null);
  if (!resultat) {
    console.log("déjà sain, rien à faire");
  } else {
    writeFileSync(sortie, resultat.vocal);
    console.log(`${resultat.flux} flux lisible(s), ${resultat.elements} éléments → ${resultat.vocal.length} octets, ${resultat.duree.toFixed(1)} s`);
  }
}
