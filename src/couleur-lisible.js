// ── Lisibilité des couleurs d'école ─────────────────────────────────────────
// Chaque école choisit ses deux couleurs, et l'application les emploie pour
// DEUX usages opposés : en fond avec du texte blanc dessus (en-têtes de
// tableaux, boutons principaux) et en texte sur fond blanc (titres, moyennes,
// rangs). Un bleu nuit tient dans les deux cas ; un vert citron dans aucun.
//
// Mesuré sur les écoles réelles, contraste du blanc sur la couleur 1 :
//   ecole-adventiste  #003870 → 11,67   lisible
//   omas              #001c54 → 16,23   lisible
//   citadelle         #a8fc54 →  1,26   ILLISIBLE
//   ep-guemebo        #ffff00 →  1,07   ILLISIBLE
// La norme WCAG demande 4,5 pour du texte courant.
//
// Parti pris : on ne refuse pas la couleur de l'école — c'est son identité,
// souvent celle de son logo. On la garde pour les aplats et les filets, et on
// n'en dérive une variante que là où elle porte du TEXTE. La teinte et la
// saturation sont conservées : la couleur reste reconnaissable, elle est
// seulement poussée vers le foncé ou le clair jusqu'à devenir lisible.

const NOIR = "#0f172a";
const BLANC = "#ffffff";

// ── Les deux seuils, réglés séparément parce que les usages diffèrent ───────
//
// SEUIL_TEXTE — la couleur porte du TEXTE COURANT sur fond blanc (moyennes,
// rangs, intitulés). C'est le seuil AA de la norme : 4,5. On n'y touche pas,
// c'est là que la lisibilité se joue vraiment.
//
// SEUIL_APLAT — la couleur est un APLAT : cadre d'affiche, bandeau de
// bulletin, fond d'en-tête de tableau. Un aplat n'a pas à se lire lui-même ;
// il doit seulement être assez franc pour porter son propre texte. Le pousser
// à 4,5 le noircissait inutilement et faisait perdre son identité à l'école —
// le vert citron de La Citadelle virait au vert forêt (#428202).
// À 3,5 il reste un vert franc (#4c9603) tout en restant imprimable.
//
// Pour éclaircir encore : baisser SEUIL_APLAT (3,0 donne #51a003). Pour
// assombrir : le remonter. C'est le seul endroit à changer.
export const SEUIL_TEXTE = 4.5;
export const SEUIL_APLAT = 3.5;

// #abc et #aabbcc acceptés ; renvoie null si la valeur n'est pas exploitable.
export function versRvb(couleur) {
  const h = String(couleur || "").trim().replace(/^#/, "");
  const plein = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (!/^[0-9a-fA-F]{6}$/.test(plein)) return null;
  return {
    r: parseInt(plein.slice(0, 2), 16),
    v: parseInt(plein.slice(2, 4), 16),
    b: parseInt(plein.slice(4, 6), 16),
  };
}

const versHex = ({ r, v, b }) => `#${[r, v, b]
  .map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0"))
  .join("")}`;

// Luminance relative WCAG (canal linéarisé).
export function luminance(couleur) {
  const rvb = versRvb(couleur);
  if (!rvb) return null;
  const lin = (c) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(rvb.r) + 0.7152 * lin(rvb.v) + 0.0722 * lin(rvb.b);
}

// Rapport de contraste WCAG entre deux couleurs : de 1 (identiques) à 21
// (noir sur blanc). Seuil de 4.5 pour du texte, 3 pour du très gros texte.
export function contraste(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  if (la === null || lb === null) return null;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// Texte à poser SUR un fond de marque : noir ou blanc, celui qui se lit le
// mieux. C'est ce qui corrige d'un coup le blanc sur jaune ou sur vert citron.
export function texteSur(fond) {
  const surBlanc = contraste(fond, BLANC);
  if (surBlanc === null) return BLANC;
  return surBlanc >= contraste(fond, NOIR) ? BLANC : NOIR;
}

// Variante de `couleur` lisible sur `fond`, teinte et saturation conservées.
// On déplace la luminosité HSL pas à pas vers le foncé (fond clair) ou vers le
// clair (fond sombre) jusqu'à atteindre la cible. Renvoie la couleur d'origine
// si elle convient déjà, et la meilleure approchée si la cible est hors
// d'atteinte (un jaune pur ne montera jamais à 4.5 sans virer au brun).
export function lisibleSur(couleur, fond = BLANC, cible = SEUIL_TEXTE) {
  const rvb = versRvb(couleur);
  if (!rvb) return couleur;
  const actuel = contraste(couleur, fond);
  if (actuel !== null && actuel >= cible) return couleur;

  const { t, s, l } = versTsl(rvb);
  const fondClair = (luminance(fond) ?? 1) > 0.18;
  let meilleur = couleur;
  let meilleurRatio = actuel ?? 0;
  // Pas de 2 % : assez fin pour ne pas noircir inutilement, assez rapide.
  for (let i = 1; i <= 50; i += 1) {
    const nouvelleL = fondClair ? l - i * 0.02 : l + i * 0.02;
    if (nouvelleL < 0 || nouvelleL > 1) break;
    const candidat = versHex(versRvbDepuisTsl(t, s, nouvelleL));
    const ratio = contraste(candidat, fond);
    if (ratio > meilleurRatio) { meilleur = candidat; meilleurRatio = ratio; }
    if (ratio >= cible) return candidat;
  }
  return meilleur;
}

// ── Conversions TSL (teinte, saturation, luminosité) ────────────────────────
function versTsl({ r, v, b }) {
  const rn = r / 255; const vn = v / 255; const bn = b / 255;
  const max = Math.max(rn, vn, bn); const min = Math.min(rn, vn, bn);
  const l = (max + min) / 2;
  if (max === min) return { t: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let t;
  if (max === rn) t = ((vn - bn) / d + (vn < bn ? 6 : 0)) / 6;
  else if (max === vn) t = ((bn - rn) / d + 2) / 6;
  else t = ((rn - vn) / d + 4) / 6;
  return { t, s, l };
}

function versRvbDepuisTsl(t, s, l) {
  if (s === 0) { const g = l * 255; return { r: g, v: g, b: g }; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const canal = (decalage) => {
    let x = t + decalage;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return { r: canal(1 / 3) * 255, v: canal(0) * 255, b: canal(-1 / 3) * 255 };
}

// Jeu complet dérivé d'une couleur d'école, prêt à poser en variables CSS ou
// à injecter dans un document imprimé.
export function paletteLisible(couleur, fond = BLANC) {
  return {
    brut: couleur,            // identité : aplats, filets, cadres
    texte: lisibleSur(couleur, fond),  // la même, lisible en texte sur `fond`
    dessus: texteSur(couleur),         // ce qu'on écrit PAR-DESSUS la couleur
  };
}
