// Fond de la photo d'élève : le décor derrière l'enfant (mur, porte, cour)
// remplacé par une couleur unie, au choix — les visages ressortent mieux au
// trombinoscope et sur les badges, et une classe photographiée avec le même
// fond paraît homogène. Le détourage (masque « personne ») vient de
// detourage.js ; ici, la logique pure : couleurs, mémoire du choix, fusion
// des pixels. Testable sous Node.

export const FOND_ORIGINAL = "original";

// Couleurs proposées d'un toucher ; toute autre se choisit librement.
export const FONDS_PRETS = [
  { valeur: "#ffffff", nom: "Blanc" },
  { valeur: "#cfe3f5", nom: "Bleu clair" },
  { valeur: "#e5e7eb", nom: "Gris clair" },
];

// Choix gardé d'une photo à l'autre (préférence d'appareil) : en séance
// photo, toute la classe sort avec le même fond.
export const CLE_FOND = "edugest_camera_fond";

// « #abc » ou « #aabbcc » → « #aabbcc » ; null si ce n'est pas une couleur.
export const normaliserCouleur = (valeur) => {
  const v = String(valeur ?? "").trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  if (/^#[0-9a-f]{3}$/.test(v)) return `#${[...v.slice(1)].map((c) => c + c).join("")}`;
  return null;
};

export const lireFond = (stockage) => {
  try {
    return normaliserCouleur(stockage?.getItem(CLE_FOND)) || FOND_ORIGINAL;
  } catch {
    return FOND_ORIGINAL;
  }
};

export const enregistrerFond = (stockage, fond) => {
  try {
    stockage?.setItem(CLE_FOND, normaliserCouleur(fond) || FOND_ORIGINAL);
  } catch { /* stockage indisponible : le choix vaut pour cette photo */ }
};

export const hexVersRgb = (hex) => {
  const v = normaliserCouleur(hex) || "#ffffff";
  return { r: parseInt(v.slice(1, 3), 16), g: parseInt(v.slice(3, 5), 16), b: parseInt(v.slice(5, 7), 16) };
};

// Opacité de l'enfant selon la confiance du détourage : nulle sous `bas`,
// pleine au-dessus de `haut`, transition douce entre les deux — c'est ce qui
// évite un contour en escalier autour des cheveux et des épaules.
export const opacite = (confiance, bas = 0.25, haut = 0.55) => {
  const t = Math.min(1, Math.max(0, (confiance - bas) / (haut - bas)));
  return t * t * (3 - 2 * t);
};

// Masque ramené à la taille de l'image (bilinéaire), s'il ne l'a pas déjà.
export function redimensionnerMasque(masque, ml, mh, largeur, hauteur) {
  if (ml === largeur && mh === hauteur) return masque;
  return recadrerMasque(masque, ml, mh, { x: 0, y: 0, w: ml, h: mh }, largeur, hauteur);
}

// Partie `zone` ({ x, y, w, h }, en pixels du masque) d'un masque ml × mh,
// ramenée à largeur × hauteur (bilinéaire) : le masque d'une photo suit son
// recadrage (retouche) sans refaire le détourage.
export function recadrerMasque(masque, ml, mh, zone, largeur, hauteur) {
  const sortie = new Float32Array(largeur * hauteur);
  // Colonnes sources et poids, calculés une fois pour toutes les lignes.
  const gauche = new Int32Array(largeur);
  const droite = new Int32Array(largeur);
  const poids = new Float32Array(largeur);
  for (let x = 0; x < largeur; x++) {
    const sx = Math.min(ml - 1, Math.max(0, zone.x + ((x + 0.5) * zone.w) / largeur - 0.5));
    gauche[x] = Math.floor(sx);
    droite[x] = Math.min(ml - 1, gauche[x] + 1);
    poids[x] = sx - gauche[x];
  }
  for (let y = 0; y < hauteur; y++) {
    const sy = Math.min(mh - 1, Math.max(0, zone.y + ((y + 0.5) * zone.h) / hauteur - 0.5));
    const y0 = Math.floor(sy);
    const l0 = y0 * ml;
    const l1 = Math.min(mh - 1, y0 + 1) * ml;
    const fy = sy - y0;
    for (let x = 0, i = y * largeur; x < largeur; x++, i++) {
      const fx = poids[x];
      const haut = masque[l0 + gauche[x]] * (1 - fx) + masque[l0 + droite[x]] * fx;
      const bas = masque[l1 + gauche[x]] * (1 - fx) + masque[l1 + droite[x]] * fx;
      sortie[i] = haut * (1 - fy) + bas * fy;
    }
  }
  return sortie;
}

// Moyenne sur une fenêtre carrée de rayon `r` (bords tronqués), par image
// intégrale : coût constant quel que soit le rayon.
export function moyenneFenetre(source, largeur, hauteur, r) {
  const L = largeur + 1;
  const integrale = new Float64Array(L * (hauteur + 1));
  for (let y = 0; y < hauteur; y++) {
    let ligne = 0;
    for (let x = 0; x < largeur; x++) {
      ligne += source[y * largeur + x];
      integrale[(y + 1) * L + x + 1] = integrale[y * L + x + 1] + ligne;
    }
  }
  const sortie = new Float32Array(largeur * hauteur);
  for (let y = 0; y < hauteur; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(hauteur - 1, y + r) + 1;
    for (let x = 0; x < largeur; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(largeur - 1, x + r) + 1;
      const somme = integrale[y1 * L + x1] - integrale[y0 * L + x1] - integrale[y1 * L + x0] + integrale[y0 * L + x0];
      sortie[y * largeur + x] = somme / ((y1 - y0) * (x1 - x0));
    }
  }
  return sortie;
}

// Image réduite d'un facteur `s` (moyenne de chaque bloc s × s).
export function reduire(source, largeur, hauteur, s) {
  const L = Math.ceil(largeur / s);
  const H = Math.ceil(hauteur / s);
  const sortie = new Float32Array(L * H);
  const compte = new Float32Array(L * H);
  const colonne = new Int32Array(largeur);
  for (let x = 0; x < largeur; x++) colonne[x] = (x / s) | 0;
  for (let y = 0, i = 0; y < hauteur; y++) {
    const ligne = ((y / s) | 0) * L;
    for (let x = 0; x < largeur; x++, i++) {
      const j = ligne + colonne[x];
      sortie[j] += source[i];
      compte[j]++;
    }
  }
  for (let j = 0; j < sortie.length; j++) sortie[j] /= compte[j];
  return { valeurs: sortie, largeur: L, hauteur: H };
}

// Masque recalé sur les vrais bords de la photo : filtre guidé en couleur
// (He, Sun, Tang 2010), calculé en définition réduite (`sous`) puis
// appliqué en pleine définition (« fast guided filter », He 2015).
// Le modèle produit un masque en 256 × 256 : agrandi, ce n'est qu'un
// contour flou et arrondi qui rogne les oreilles et les mèches. Guidé par
// les COULEURS de la photo, il suit le bord réel — et distingue des cheveux
// noirs d'un décor sombre mais coloré (natte, porte), là où la seule
// luminosité les confond. `pixels` : RGBA (ImageData.data).
export function affinerMasque(masque, pixels, largeur, hauteur, { rayon = 12, eps = 1e-3, sous = 2 } = {}) {
  const n = largeur * hauteur;
  const canaux = [new Float32Array(n), new Float32Array(n), new Float32Array(n)];
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    canaux[0][i] = pixels[p] / 255;
    canaux[1][i] = pixels[p + 1] / 255;
    canaux[2][i] = pixels[p + 2] / 255;
  }
  const s = Math.max(1, Math.round(sous));
  const red = canaux.map((c) => reduire(c, largeur, hauteur, s));
  const { valeurs: P, largeur: L, hauteur: H } = reduire(masque, largeur, hauteur, s);
  const [R, G, B] = red.map((c) => c.valeurs);
  const N = L * H;
  const r = Math.max(1, Math.round(rayon / s));
  const moyenne = (t) => moyenneFenetre(t, L, H, r);
  const produit = (u, v) => { const t = new Float32Array(N); for (let i = 0; i < N; i++) t[i] = u[i] * v[i]; return t; };
  const [mR, mG, mB, mP] = [R, G, B, P].map(moyenne);
  const [mRP, mGP, mBP] = [R, G, B].map((c) => moyenne(produit(c, P)));
  const [mRR, mRG, mRB, mGG, mGB, mBB] = [[R, R], [R, G], [R, B], [G, G], [G, B], [B, B]].map(([u, v]) => moyenne(produit(u, v)));
  const aR = new Float32Array(N);
  const aG = new Float32Array(N);
  const aB = new Float32Array(N);
  const b = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    // Covariance des couleurs (régularisée) et covariance couleur/masque.
    const rr = mRR[i] - mR[i] * mR[i] + eps;
    const rg = mRG[i] - mR[i] * mG[i];
    const rb = mRB[i] - mR[i] * mB[i];
    const gg = mGG[i] - mG[i] * mG[i] + eps;
    const gb = mGB[i] - mG[i] * mB[i];
    const bb = mBB[i] - mB[i] * mB[i] + eps;
    const cR = mRP[i] - mR[i] * mP[i];
    const cG = mGP[i] - mG[i] * mP[i];
    const cB = mBP[i] - mB[i] * mP[i];
    // Inverse de la matrice 3 × 3 symétrique par cofacteurs.
    const i00 = gg * bb - gb * gb;
    const i01 = gb * rb - rg * bb;
    const i02 = rg * gb - gg * rb;
    const i11 = rr * bb - rb * rb;
    const i12 = rb * rg - rr * gb;
    const i22 = rr * gg - rg * rg;
    const det = rr * i00 + rg * i01 + rb * i02;
    aR[i] = (i00 * cR + i01 * cG + i02 * cB) / det;
    aG[i] = (i01 * cR + i11 * cG + i12 * cB) / det;
    aB[i] = (i02 * cR + i12 * cG + i22 * cB) / det;
    b[i] = mP[i] - aR[i] * mR[i] - aG[i] * mG[i] - aB[i] * mB[i];
  }
  // Coefficients moyennés, ramenés en pleine définition, puis appliqués
  // aux couleurs d'origine : le contour garde la finesse de la photo.
  const [AR, AG, AB, BB] = [aR, aG, aB, b].map((t) => redimensionnerMasque(moyenne(t), L, H, largeur, hauteur));
  const sortie = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const q = AR[i] * canaux[0][i] + AG[i] * canaux[1][i] + AB[i] * canaux[2][i] + BB[i];
    sortie[i] = q < 0 ? 0 : q > 1 ? 1 : q;
  }
  return sortie;
}

// Minimum (`max` faux) ou maximum (`max` vrai) sur une fenêtre carrée de
// rayon `r`, en deux passes (lignes puis colonnes) — l'érosion et la
// dilatation du masque. Algorithme de van Herk / Gil-Werman : trois
// comparaisons par pixel, quel que soit le rayon.
export function filtreExtremum(source, largeur, hauteur, r, max = true) {
  if (r < 1) return Float32Array.from(source);
  const choisir = max ? Math.max : Math.min;
  const neutre = max ? -Infinity : Infinity;
  const w = 2 * r + 1;
  const passe = (entree, horizontal) => {
    const sortie = new Float32Array(entree.length);
    const [n, m] = horizontal ? [hauteur, largeur] : [largeur, hauteur];
    const pas = horizontal ? 1 : largeur;
    const longueur = m + 2 * r;
    const ligne = new Float32Array(longueur);
    const avant = new Float32Array(longueur);
    const apres = new Float32Array(longueur);
    for (let a = 0; a < n; a++) {
      const debut = horizontal ? a * largeur : a;
      ligne.fill(neutre);
      for (let b = 0; b < m; b++) ligne[r + b] = entree[debut + b * pas];
      for (let i = 0; i < longueur; i++) avant[i] = i % w === 0 ? ligne[i] : choisir(avant[i - 1], ligne[i]);
      for (let i = longueur - 1; i >= 0; i--) apres[i] = i === longueur - 1 || (i + 1) % w === 0 ? ligne[i] : choisir(apres[i + 1], ligne[i]);
      for (let b = 0; b < m; b++) sortie[debut + b * pas] = choisir(apres[b], avant[b + w - 1]);
    }
    return sortie;
  };
  return passe(passe(source, true), false);
}

// Le masque affiné ne peut s'écarter du contour franc du modèle (confiance
// ≥ `seuil`) que dans une bande de `marge` pixels : il y récupère une
// oreille, une mèche, mais ne coule pas dans un décor qui ressemble aux
// cheveux (natte à rayures sombres, mur foncé) — ni ne troue l'enfant au
// milieu. La bande, floue par nature, est calculée en définition réduite
// (`sous`) : c'était l'étape la plus lente en pleine définition.
export function bornerMasque(affine, brut, largeur, hauteur, marge, { seuil = 0.5, sous = 4 } = {}) {
  const s = Math.max(1, Math.round(sous));
  const coeur = new Float32Array(brut.length);
  for (let i = 0; i < brut.length; i++) coeur[i] = brut[i] >= seuil ? 1 : 0;
  const { valeurs, largeur: L, hauteur: H } = reduire(coeur, largeur, hauteur, s);
  const r = Math.max(1, Math.round(marge / s));
  const plafond = redimensionnerMasque(filtreExtremum(valeurs, L, H, r, true), L, H, largeur, hauteur);
  const plancher = redimensionnerMasque(filtreExtremum(valeurs, L, H, r, false), L, H, largeur, hauteur);
  const sortie = new Float32Array(affine.length);
  for (let i = 0; i < affine.length; i++) sortie[i] = Math.min(plafond[i], Math.max(plancher[i], affine[i]));
  return sortie;
}

// Masque final d'une photo : affiné sur ses couleurs, borné autour du
// contour du modèle. Rayon, sensibilité et largeur de bande réglés sur de
// vrais portraits (tresses, cheveux crépus, oreilles, décor de natte).
export function masqueDetoure(brut, pixels, largeur, hauteur) {
  const affine = affinerMasque(brut, pixels, largeur, hauteur, {
    rayon: Math.max(4, Math.round(largeur / 64)), eps: 1e-3, sous: 3,
  });
  return bornerMasque(affine, brut, largeur, hauteur, Math.max(3, Math.round(largeur * 0.012)));
}

// Réglage « Contour » de -2 (plus serré : moins de décor autour de
// l'enfant) à +2 (plus large : garde mieux oreilles et cheveux) → fenêtre de
// confiance de l'opacité. 0 penche déjà vers l'enfant : mieux vaut un liseré
// de décor qu'une oreille coupée.
export const CONTOUR_MIN = -2;
export const CONTOUR_MAX = 2;
export const fenetreContour = (reglage = 0) => {
  const r = Math.min(CONTOUR_MAX, Math.max(CONTOUR_MIN, Math.round(Number(reglage) || 0)));
  const centre = 0.4 - 0.1 * r;
  return { bas: centre - 0.15, haut: centre + 0.15 };
};

// Fusion EN PLACE des pixels RGBA (ImageData.data) : l'enfant reste, le
// décor prend la couleur `fond` ({ r, g, b }) selon l'opacité du masque.
export function composerFond(pixels, masque, fond, { bas, haut } = fenetreContour(0)) {
  for (let i = 0, p = 0; i < masque.length; i++, p += 4) {
    const a = opacite(masque[i], bas, haut);
    if (a >= 1) continue;
    pixels[p] = pixels[p] * a + fond.r * (1 - a);
    pixels[p + 1] = pixels[p + 1] * a + fond.g * (1 - a);
    pixels[p + 2] = pixels[p + 2] * a + fond.b * (1 - a);
    pixels[p + 3] = 255;
  }
  return pixels;
}
