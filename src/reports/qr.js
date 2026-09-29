// Génération de QR codes pour les documents imprimés (bulletins, reçus, fiches
// de paie). Le QR encode les champs clés du document : un agent peut le scanner
// pour vérifier l'authenticité (toute falsification du papier ne correspondra
// plus au contenu encodé).
import QRCode from "qrcode";
import { CLES_QR, TYPES_QR, encryptQrPayload, schoolSecret } from "./qr-crypto.js";

// Construit une charge utile compacte « clé:valeur » séparée par « | ».
// Les champs vides sont ignorés. Les clés connues (et le type de document)
// sont réduites à une lettre (cf. CLES_QR) ; le scanner les rétablit.
export function qrPayload(champs = {}) {
  return Object.entries(champs)
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== "")
    .map(([k, v]) => {
      const valeur = k === "EduGest" ? (TYPES_QR[v] || v) : v;
      return `${CLES_QR[k] || k}:${String(valeur).replace(/[|\n]/g, " ").trim()}`;
    })
    .join("|");
}

// Renvoie un fragment HTML <img crossOrigin="anonymous"> avec le QR en data URL (ou "" si échec).
// À générer APRÈS window.open (await) pour ne pas casser l'ouverture liée au
// geste utilisateur.
//
// Ce qui décide de la lecture à la caméra, c'est la taille IMPRIMÉE d'un
// module (le petit carré élémentaire) : sous ~0,35 mm, beaucoup de téléphones
// n'y arrivent plus. Elle vaut taille du QR ÷ nombre de modules, d'où :
// - un contenu court (clés d'une lettre, base45 → mode alphanumérique) :
//   49 à 53 modules de côté au lieu de 77 à 85 ;
// - la correction d'erreur M (15 %) plutôt que Q (25 %) : à taille égale,
//   des modules plus gros valent mieux que plus de redondance ;
// - un rendu VECTORIEL (SVG) : bords nets à la résolution de l'imprimante,
//   là où une image PNG agrandie à l'impression floutait chaque module ;
// - `size`, la taille imprimée en px CSS (≈ 3,8 px par mm) : 88 à 104 px
//   (≈ 23 à 27 mm, ≥ 0,4 mm par module) ; 68 px seulement sur le bulletin
//   compact, dont la demi-page coupe tout dépassement (overflow:hidden).
export async function qrImgHtml(payload, { size = 92, alt = "QR de vérification" } = {}) {
  const texte = String(payload || "").trim();
  if (!texte) return "";
  try {
    const svg = await QRCode.toString(texte, {
      type: "svg",
      margin: 2, // zone de silence : en dessous de 2 modules, la détection souffre
      errorCorrectionLevel: "M",
    });
    const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    return `<img crossOrigin="anonymous" src="${src}" width="${size}" height="${size}" alt="${alt}" style="display:block"/>`;
  } catch {
    return "";
  }
}

// QR CHIFFRÉ pour un document : le contenu est chiffré avec le secret de
// l'école → illisible par un lecteur QR grand public, déchiffrable seulement
// par le scanner EduGest de la direction. Renvoie un fragment <img crossOrigin="anonymous"> (ou "").
export async function qrSecuriseImgHtml(payload, schoolInfo = {}, opts = {}) {
  const token = await encryptQrPayload(payload, schoolSecret(schoolInfo));
  return qrImgHtml(token, opts);
}
