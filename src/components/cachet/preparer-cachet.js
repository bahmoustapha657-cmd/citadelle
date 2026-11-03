// Image du cachet signé, prête à imprimer.
// Le cachet arrive presque toujours en PHOTO de téléphone : papier gris ou
// beige, ombre légère. Posé tel quel sur un reçu, il imprimerait un rectangle
// grisé autour du tampon. On efface donc le papier (transparent), on garde
// l'encre, on recadre au plus près et on réduit l'image : 600 px suffisent
// largement pour 2 cm imprimés, et l'envoi reste léger sur réseau faible.
const COTE_MAX = 600;
const MARGE = 6; // px laissés autour de l'encre au recadrage
const CELLULE = 24; // côté des zones où le niveau du papier est mesuré

const luminance = (px, i) => 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];

// Centile `q` d'un histogramme de luminances comptant `n` pixels.
function centile(histo, n, q) {
  let cumul = 0;
  for (let l = 0; l < 256; l += 1) {
    cumul += histo[l];
    if (cumul >= n * q) return l;
  }
  return 255;
}

// Niveau du papier zone par zone : une photo de téléphone n'est jamais
// éclairée uniformément (ombre de la main, dégradé vers un coin). Dans chaque
// zone, le papier est la teinte claire (90e centile) ; chaque zone prend la
// plus claire de ses voisines, pour qu'un trait épais ne passe pas pour du
// papier, et ne descend jamais très en dessous du papier de toute l'image.
function grillePapier(lum, visible, largeur, hauteur) {
  const nx = Math.ceil(largeur / CELLULE);
  const ny = Math.ceil(hauteur / CELLULE);
  const histo = new Uint32Array(256);
  let n = 0;
  for (let p = 0; p < lum.length; p += 1) if (visible[p]) { histo[lum[p]] += 1; n += 1; }
  if (!n) return null;
  const global = centile(histo, n, 0.75);

  const brute = new Float32Array(nx * ny);
  for (let cy = 0; cy < ny; cy += 1) {
    for (let cx = 0; cx < nx; cx += 1) {
      histo.fill(0);
      let k = 0;
      for (let y = cy * CELLULE; y < Math.min(hauteur, (cy + 1) * CELLULE); y += 1) {
        for (let x = cx * CELLULE; x < Math.min(largeur, (cx + 1) * CELLULE); x += 1) {
          const p = y * largeur + x;
          if (visible[p]) { histo[lum[p]] += 1; k += 1; }
        }
      }
      brute[cy * nx + cx] = k ? centile(histo, k, 0.9) : global;
    }
  }
  const grille = new Float32Array(nx * ny);
  for (let cy = 0; cy < ny; cy += 1) {
    for (let cx = 0; cx < nx; cx += 1) {
      let v = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const x = cx + dx; const y = cy + dy;
          if (x >= 0 && y >= 0 && x < nx && y < ny) v = Math.max(v, brute[y * nx + x]);
        }
      }
      grille[cy * nx + cx] = Math.max(v, global * 0.85);
    }
  }
  // Niveau au pixel (x, y) : interpolation entre les centres des zones.
  return (x, y) => {
    const gx = Math.min(nx - 1, Math.max(0, (x + 0.5) / CELLULE - 0.5));
    const gy = Math.min(ny - 1, Math.max(0, (y + 0.5) / CELLULE - 0.5));
    const x0 = Math.floor(gx); const y0 = Math.floor(gy);
    const x1 = Math.min(nx - 1, x0 + 1); const y1 = Math.min(ny - 1, y0 + 1);
    const fx = gx - x0; const fy = gy - y0;
    const haut = grille[y0 * nx + x0] * (1 - fx) + grille[y0 * nx + x1] * fx;
    const bas = grille[y1 * nx + x0] * (1 - fx) + grille[y1 * nx + x1] * fx;
    return haut * (1 - fy) + bas * fy;
  };
}

// Efface le fond papier de pixels RGBA (modifiés en place). Nettement plus
// clair que l'encre — à une marge près du papier de sa zone : transparent ;
// nettement plus sombre : encre opaque ; entre les deux, un fondu qui garde
// les bords du tracé nets.
// Renvoie le cadre de l'encre { x, y, l, h }, ou null si rien ne reste. Une
// ligne ou une colonne n'y compte qu'à partir de deux points d'encre : un
// grain isolé du papier n'élargit pas le recadrage.
export function effacerFondPapier(px, largeur, hauteur) {
  const total = largeur * hauteur;
  const lum = new Uint8Array(total);
  const visible = new Uint8Array(total);
  for (let p = 0; p < total; p += 1) {
    lum[p] = Math.round(luminance(px, p * 4));
    visible[p] = px[p * 4 + 3] > 0 ? 1 : 0;
  }
  const papierEn = grillePapier(lum, visible, largeur, hauteur);
  if (!papierEn) return null;

  const parLigne = new Uint32Array(hauteur);
  const parColonne = new Uint32Array(largeur);
  for (let y = 0; y < hauteur; y += 1) {
    for (let x = 0; x < largeur; x += 1) {
      const p = y * largeur + x;
      const papier = papierEn(x, y);
      const haut = papier - 14; // ≥ : papier → transparent
      const bas = papier * 0.6; // ≤ : encre → opaque
      const l = lum[p];
      const opacite = l >= haut ? 0 : l <= bas ? 1 : (haut - l) / (haut - bas);
      const a = Math.min(px[p * 4 + 3], Math.round(opacite * 255));
      px[p * 4 + 3] = a;
      if (a > 128) { parLigne[y] += 1; parColonne[x] += 1; }
    }
  }
  const bornes = (comptes) => {
    let debut = -1; let fin = -1;
    for (let i = 0; i < comptes.length; i += 1) {
      if (comptes[i] >= 2) { if (debut < 0) debut = i; fin = i; }
    }
    return [debut, fin];
  };
  const [y0, y1] = bornes(parLigne);
  const [x0, x1] = bornes(parColonne);
  if (x0 < 0 || y0 < 0) return null;
  const gauche = Math.max(0, x0 - MARGE); const dessus = Math.max(0, y0 - MARGE);
  const droite = Math.min(largeur - 1, x1 + MARGE); const dessous = Math.min(hauteur - 1, y1 + MARGE);
  return { x: gauche, y: dessus, l: droite - gauche + 1, h: dessous - dessus + 1 };
}

async function chargerImage(fichier) {
  if (typeof createImageBitmap === "function") return createImageBitmap(fichier);
  const url = URL.createObjectURL(fichier);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Fichier choisi → data URL. `nettoyer` : effacer le papier (PNG transparent) ;
// sinon l'image est seulement réduite (JPEG). Lève une erreur lisible si
// l'image est illisible ou vide une fois le papier effacé.
export async function preparerCachet(fichier, { nettoyer = true } = {}) {
  if (!fichier || !/^image\//.test(fichier.type || "")) throw new Error("Choisissez une image (photo ou scan).");
  let image;
  try {
    image = await chargerImage(fichier);
  } catch {
    throw new Error("Image illisible : essayez une autre photo (JPEG ou PNG).");
  }
  const echelle = Math.min(1, COTE_MAX / Math.max(image.width, image.height));
  const largeur = Math.max(1, Math.round(image.width * echelle));
  const hauteur = Math.max(1, Math.round(image.height * echelle));
  const canvas = document.createElement("canvas");
  canvas.width = largeur;
  canvas.height = hauteur;
  const ctx = canvas.getContext("2d", { willReadFrequently: nettoyer });
  if (!nettoyer) {
    ctx.fillStyle = "#fff"; // PNG transparent → fond blanc plutôt que noir
    ctx.fillRect(0, 0, largeur, hauteur);
  }
  ctx.drawImage(image, 0, 0, largeur, hauteur);
  image.close?.();
  if (!nettoyer) return canvas.toDataURL("image/jpeg", 0.9);

  const donnees = ctx.getImageData(0, 0, largeur, hauteur);
  const cadre = effacerFondPapier(donnees.data, largeur, hauteur);
  if (!cadre) throw new Error("Aucun tracé trouvé sur l'image : photographiez le cachet de plus près, bien éclairé.");
  ctx.putImageData(donnees, 0, 0);
  const recadre = document.createElement("canvas");
  recadre.width = cadre.l;
  recadre.height = cadre.h;
  recadre.getContext("2d").drawImage(canvas, cadre.x, cadre.y, cadre.l, cadre.h, 0, 0, cadre.l, cadre.h);
  return recadre.toDataURL("image/png");
}
