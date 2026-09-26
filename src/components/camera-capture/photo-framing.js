// Cadrage de la photo d'élève — logique pure, sans DOM ni caméra (testée
// dans tests/photo-framing.test.js).
//
// Toutes les mesures sont en pixels de l'image PLEINE définition, non
// inversée (le miroir de l'aperçu n'est qu'un affichage).

// Format de la photo : portrait 3:4, celui de la carte scolaire et de la
// fiche élève. L'aperçu a ce même format : ce qu'on voit est ce qu'on prend.
export const FORMAT_PHOTO = 3 / 4;

// Composition (fractions de la HAUTEUR de la photo). La boîte du détecteur
// va du front au menton : à 42 % de la hauteur, avec son centre à 47 % du
// haut, restent les cheveux au-dessus et le haut des épaules en dessous.
export const COMPOSITION = { hauteurVisage: 0.42, centreY: 0.47 };

// Ovale guide de l'aperçu (fractions du cadre visible), calé sur la
// composition : il entoure la tête entière, cheveux compris.
export const OVALE = { cx: 0.5, cy: 0.41, rx: 0.3, ry: 0.3 };

// Définition maximale de la photo enregistrée : largement assez pour
// l'impression d'une carte (≈ 300×400 px à 300 ppp) sans alourdir le
// stockage — environ 130 ko par photo en JPEG.
export const SORTIE_MAX = { largeur: 768, hauteur: 1024 };
export const QUALITE_JPEG = 0.9;

export const SEUILS = {
  scoreMin: 0.5,
  // Un second visage compte s'il fait au moins le quart du principal : un
  // camarade dans le champ, pas une affiche au fond de la salle.
  visageSecondaire: 0.25,
  // Hauteur de la boîte du visage, en fraction du cadre visible.
  tailleMin: 0.3,
  tailleMax: 0.6,
  // Décalage toléré du centre du visage (fraction du cadre visible) : le
  // recadrage final recentre, il suffit que la tête soit dans l'ovale.
  ecartMax: 0.13,
  // Tête penchée (inclinaison de la ligne des yeux, en degrés).
  roulisMax: 12,
  // Tête tournée : décalage du nez par rapport au milieu des yeux, en
  // fraction de l'écart entre les yeux (≈ 0 de face).
  laceMax: 0.32,
  // Mouvement entre deux analyses (fraction de la hauteur du cadre).
  mouvementMax: 0.035,
  variationTailleMax: 0.1,
  // Exposition du visage. La clarté d'un visage dépend d'abord de la
  // carnation : la teinte la plus foncée de l'échelle de Monk (MST-10,
  // #292420) a une luma d'environ 37 sur 255 quand elle est CORRECTEMENT
  // exposée. Le conseil ne se déclenche donc que nettement en dessous
  // (sous-exposition quelle que soit la carnation) ou quand le détail est
  // perdu : pixels bouchés (noirs) ou brûlés (blancs).
  lumaSombre: 22,
  lumaClaire: 245,
  moyenneSombreMax: 28,
  fractionSombreMax: 0.45,
  fractionClaireMax: 0.35,
};

// Zones soumises au détecteur. Son modèle travaille en 128×128 : lui passer
// toute l'image 16:9 d'une webcam réduirait un élève à quelques pixels. On
// analyse la zone de l'aperçu (un peu élargie, pour voir un visage qui en
// déborde), puis, si rien n'y est trouvé, une loupe sur son centre — là où
// se tient l'élève resté trop loin, qui reçoit alors « Approchez-vous » au
// lieu de « Aucun visage ».
export const MARGE_ANALYSE = { x: 0.2, y: 0.1 };
export const LOUPE = 0.55;

const MESSAGES = {
  absent: "Aucun visage détecté : placez l'élève face à la caméra",
  plusieurs: "Plusieurs visages : une seule personne dans le cadre",
  loin: "Approchez-vous un peu",
  proche: "Reculez un peu",
  decentre: "Centrez le visage dans l'ovale",
  tourne: "Regardez droit vers l'objectif",
  incline: "Redressez la tête",
  bouge: "Ne bougez plus…",
  ok: "Parfait, ne bougez pas !",
};

const CONSEILS_LUMIERE = {
  sombre: "Visage trop sombre : éclairez l'élève de face et évitez le contre-jour.",
  clair: "Trop de lumière sur le visage : évitez le soleil direct ou le flash.",
};

const borner = (valeur, min, max) => Math.min(Math.max(valeur, min), max);

// Partie de l'image que montre l'aperçu (object-fit: cover dans un cadre
// 3:4) : bandes latérales coupées pour une image paysage, haut et bas pour
// une image portrait de téléphone.
export function regionVisible(largeur, hauteur, format = FORMAT_PHOTO) {
  if (largeur / hauteur > format) {
    const w = hauteur * format;
    return { x: (largeur - w) / 2, y: 0, w, h: hauteur };
  }
  const h = largeur / format;
  return { x: 0, y: (hauteur - h) / 2, w: largeur, h };
}

// Zones en pixels entiers : une copie alignée sur la grille de l'image n'est
// pas rééchantillonnée pour rien.
export function zoneAnalyse(largeur, hauteur) {
  const r = regionVisible(largeur, hauteur);
  const x = Math.max(0, Math.round(r.x - r.w * MARGE_ANALYSE.x));
  const y = Math.max(0, Math.round(r.y - r.h * MARGE_ANALYSE.y));
  const droite = Math.min(largeur, Math.round(r.x + r.w * (1 + MARGE_ANALYSE.x)));
  const bas = Math.min(hauteur, Math.round(r.y + r.h * (1 + MARGE_ANALYSE.y)));
  return { x, y, w: droite - x, h: bas - y };
}

// Loupe : centrée à l'emplacement de la tête dans l'ovale.
export function zoneLoupe(largeur, hauteur) {
  const r = regionVisible(largeur, hauteur);
  const w = Math.round(r.w * LOUPE);
  const h = Math.round(r.h * LOUPE);
  const x = Math.round(r.x + (r.w - w) / 2);
  const y = Math.round(borner(r.y + OVALE.cy * r.h - h / 2, r.y, r.y + r.h - h));
  return { x, y, w, h };
}

// Détections MediaPipe → visages en pixels de l'image pleine définition.
// `zone` : partie de l'image copiée dans le canvas d'analyse ; la boîte est
// exprimée en pixels de ce canvas, les points clés en coordonnées normalisées.
export function versVisages(detections = [], { largeurAnalyse, hauteurAnalyse, zone }) {
  const ex = zone.w / largeurAnalyse;
  const ey = zone.h / hauteurAnalyse;
  return detections
    .filter((d) => d?.boundingBox)
    .map((d) => ({
      x: zone.x + d.boundingBox.originX * ex,
      y: zone.y + d.boundingBox.originY * ey,
      w: d.boundingBox.width * ex,
      h: d.boundingBox.height * ey,
      score: d.categories?.[0]?.score ?? 0,
      points: (d.keypoints || []).map((k) => ({ x: zone.x + k.x * zone.w, y: zone.y + k.y * zone.h })),
    }));
}

const aire = (v) => v.w * v.h;

// Visage principal (le plus grand) et présence d'autres visages notables.
export function visagePrincipal(visages = []) {
  const fiables = visages.filter((v) => v.score >= SEUILS.scoreMin).sort((a, b) => aire(b) - aire(a));
  const [principal = null, ...autres] = fiables;
  const plusieurs = !!principal && autres.some((v) => aire(v) >= aire(principal) * SEUILS.visageSecondaire);
  return { principal, plusieurs };
}

// Orientation de la tête d'après les points clés de BlazeFace (0 et 1 : les
// yeux, 2 : le bout du nez). Nuls si les points manquent.
export function orientationTete(points = []) {
  const [oeil1, oeil2, nez] = points;
  if (!oeil1 || !oeil2 || !nez) return { roulis: 0, lacet: 0 };
  const [g, d] = oeil1.x <= oeil2.x ? [oeil1, oeil2] : [oeil2, oeil1];
  const dx = d.x - g.x;
  const dy = d.y - g.y;
  const ecart = Math.hypot(dx, dy);
  if (!ecart) return { roulis: 0, lacet: 0 };
  const roulis = (Math.atan2(dy, dx) * 180) / Math.PI;
  // Projection du nez sur l'axe des yeux, depuis leur milieu : insensible à
  // l'inclinaison, proportionnelle à la rotation gauche-droite.
  const lacet = ((nez.x - (g.x + d.x) / 2) * dx + (nez.y - (g.y + d.y) / 2) * dy) / (ecart * ecart);
  return { roulis, lacet };
}

// Position et taille du visage dans le cadre visible.
export function mesurerVisage(visage, region) {
  const cx = (visage.x + visage.w / 2 - region.x) / region.w;
  const cy = (visage.y + visage.h / 2 - region.y) / region.h;
  const dansLeCadre = visage.x >= region.x && visage.y >= region.y
    && visage.x + visage.w <= region.x + region.w && visage.y + visage.h <= region.y + region.h;
  return {
    taille: visage.h / region.h,
    ecartX: cx - 0.5,
    ecartY: cy - COMPOSITION.centreY,
    dansLeCadre,
    ...orientationTete(visage.points),
  };
}

export function aBouge(precedent, visage, region) {
  if (!precedent || !visage) return false;
  const deplacement = Math.hypot(
    precedent.x + precedent.w / 2 - (visage.x + visage.w / 2),
    precedent.y + precedent.h / 2 - (visage.y + visage.h / 2),
  );
  return deplacement / region.h > SEUILS.mouvementMax
    || Math.abs(visage.h - precedent.h) / precedent.h > SEUILS.variationTailleMax;
}

// Mesure d'exposition sur des pixels RGBA (ImageData.data de la zone du visage).
export function mesurerLumiere(rgba) {
  let total = 0;
  let sombres = 0;
  let claires = 0;
  let somme = 0;
  for (let i = 0; i + 2 < rgba.length; i += 4) {
    const luma = 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
    somme += luma;
    if (luma < SEUILS.lumaSombre) sombres += 1;
    else if (luma > SEUILS.lumaClaire) claires += 1;
    total += 1;
  }
  if (!total) return null;
  return { moyenne: somme / total, fractionSombre: sombres / total, fractionClaire: claires / total };
}

export function diagnosticLumiere(lumiere) {
  if (!lumiere) return null;
  if (lumiere.moyenne < SEUILS.moyenneSombreMax || lumiere.fractionSombre > SEUILS.fractionSombreMax) return "sombre";
  if (lumiere.fractionClaire > SEUILS.fractionClaireMax) return "clair";
  return null;
}

// Zone du visage où mesurer la lumière : le centre de la boîte (joues, nez,
// yeux), sans les cheveux ni le fond qui fausseraient la mesure.
export function zoneLumiere(visage) {
  return { x: visage.x + visage.w * 0.2, y: visage.y + visage.h * 0.25, w: visage.w * 0.6, h: visage.h * 0.6 };
}

// Verdict de cadrage pour l'image courante. `precedent` : visage retenu à
// l'analyse précédente (stabilité). La lumière n'est qu'un conseil : elle ne
// bloque jamais la prise, pour ne pas pénaliser les peaux foncées devant un
// fond clair quand l'éclairage ne peut pas être amélioré.
export function analyserCadrage({ visages = [], largeur, hauteur, precedent = null, lumiere = null }) {
  const region = regionVisible(largeur, hauteur);
  const diagnostic = diagnosticLumiere(lumiere);
  const conseil = diagnostic ? CONSEILS_LUMIERE[diagnostic] : "";
  const { principal, plusieurs } = visagePrincipal(visages);
  if (!principal) return { etat: "absent", bon: false, message: MESSAGES.absent, conseil: "", visage: null, region };

  const m = mesurerVisage(principal, region);
  let etat = "ok";
  if (plusieurs) etat = "plusieurs";
  else if (m.taille < SEUILS.tailleMin) etat = "loin";
  else if (m.taille > SEUILS.tailleMax) etat = "proche";
  else if (!m.dansLeCadre || Math.abs(m.ecartX) > SEUILS.ecartMax || Math.abs(m.ecartY) > SEUILS.ecartMax) etat = "decentre";
  else if (Math.abs(m.lacet) > SEUILS.laceMax) etat = "tourne";
  else if (Math.abs(m.roulis) > SEUILS.roulisMax) etat = "incline";
  else if (aBouge(precedent, principal, region)) etat = "bouge";
  return { etat, bon: etat === "ok", message: MESSAGES[etat], conseil, visage: principal, region, mesures: m };
}

// Recadrage 3:4 centré sur le visage, selon la composition. Le cadre reste
// dans l'image : visage près d'un bord → cadre décalé ; visage trop proche
// → plus grand cadre 3:4 qui tient dans l'image.
export function calculerRecadrage(visage, largeur, hauteur, { format = FORMAT_PHOTO, composition = COMPOSITION } = {}) {
  let h = visage.h / composition.hauteurVisage;
  let w = h * format;
  const echelle = Math.min(1, largeur / w, hauteur / h);
  w = Math.min(largeur, Math.round(w * echelle));
  h = Math.min(hauteur, Math.round(h * echelle));
  const x = borner(Math.round(visage.x + visage.w / 2 - w / 2), 0, largeur - w);
  const y = borner(Math.round(visage.y + visage.h / 2 - composition.centreY * h), 0, hauteur - h);
  return { x, y, w, h };
}

// Dimensions de sortie : réduites à SORTIE_MAX, jamais agrandies (un
// agrandissement n'ajoute aucun détail, seulement du poids).
export function tailleSortie(w, h, max = SORTIE_MAX) {
  const echelle = Math.min(1, max.largeur / w, max.hauteur / h);
  return { largeur: Math.max(1, Math.round(w * echelle)), hauteur: Math.max(1, Math.round(h * echelle)) };
}

// Dimensions d'une image importée : grand côté ramené à `cote`, sans agrandir.
export function tailleMaxCote(w, h, cote) {
  const echelle = Math.min(1, cote / Math.max(w, h));
  return { largeur: Math.max(1, Math.round(w * echelle)), hauteur: Math.max(1, Math.round(h * echelle)) };
}

// Passage du repère de l'image au repère de l'aperçu (viewBox 300×400 du
// cadre visible) pour dessiner la boîte du visage.
export function versApercu(rect, region, vue = { largeur: 300, hauteur: 400 }) {
  return {
    x: ((rect.x - region.x) / region.w) * vue.largeur,
    y: ((rect.y - region.y) / region.h) * vue.hauteur,
    w: (rect.w / region.w) * vue.largeur,
    h: (rect.h / region.h) * vue.hauteur,
  };
}
