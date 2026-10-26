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
export const opacite = (confiance, bas = 0.35, haut = 0.75) => {
  const t = Math.min(1, Math.max(0, (confiance - bas) / (haut - bas)));
  return t * t * (3 - 2 * t);
};

// Flou de boîte séparable du masque (rayon en pixels) : adoucit le bord
// crénelé du masque, calculé en 256 × 256 puis agrandi.
export function adoucirMasque(masque, largeur, hauteur, rayon = 1) {
  if (rayon < 1) return Float32Array.from(masque);
  const passe = (source, horizontal) => {
    const sortie = new Float32Array(source.length);
    const [n, m] = horizontal ? [hauteur, largeur] : [largeur, hauteur];
    for (let a = 0; a < n; a++) {
      for (let b = 0; b < m; b++) {
        let somme = 0;
        let compte = 0;
        for (let k = Math.max(0, b - rayon); k <= Math.min(m - 1, b + rayon); k++) {
          somme += source[horizontal ? a * largeur + k : k * largeur + a];
          compte++;
        }
        sortie[horizontal ? a * largeur + b : b * largeur + a] = somme / compte;
      }
    }
    return sortie;
  };
  return passe(passe(masque, true), false);
}

// Masque ramené à la taille de l'image (bilinéaire), s'il ne l'a pas déjà.
export function redimensionnerMasque(masque, ml, mh, largeur, hauteur) {
  if (ml === largeur && mh === hauteur) return masque;
  const sortie = new Float32Array(largeur * hauteur);
  for (let y = 0; y < hauteur; y++) {
    const sy = Math.min(mh - 1, Math.max(0, ((y + 0.5) * mh) / hauteur - 0.5));
    const y0 = Math.floor(sy);
    const y1 = Math.min(mh - 1, y0 + 1);
    const fy = sy - y0;
    for (let x = 0; x < largeur; x++) {
      const sx = Math.min(ml - 1, Math.max(0, ((x + 0.5) * ml) / largeur - 0.5));
      const x0 = Math.floor(sx);
      const x1 = Math.min(ml - 1, x0 + 1);
      const fx = sx - x0;
      const haut = masque[y0 * ml + x0] * (1 - fx) + masque[y0 * ml + x1] * fx;
      const bas = masque[y1 * ml + x0] * (1 - fx) + masque[y1 * ml + x1] * fx;
      sortie[y * largeur + x] = haut * (1 - fy) + bas * fy;
    }
  }
  return sortie;
}

// Fusion EN PLACE des pixels RGBA (ImageData.data) : l'enfant reste, le
// décor prend la couleur `fond` ({ r, g, b }) selon l'opacité du masque.
export function composerFond(pixels, masque, fond) {
  for (let i = 0, p = 0; i < masque.length; i++, p += 4) {
    const a = opacite(masque[i]);
    if (a >= 1) continue;
    pixels[p] = pixels[p] * a + fond.r * (1 - a);
    pixels[p + 1] = pixels[p + 1] * a + fond.g * (1 - a);
    pixels[p + 2] = pixels[p + 2] * a + fond.b * (1 - a);
    pixels[p + 3] = 255;
  }
  return pixels;
}
