// Génération de QR codes pour les documents imprimés (bulletins, reçus, fiches
// de paie). Le QR encode les champs clés du document : un agent peut le scanner
// pour vérifier l'authenticité (toute falsification du papier ne correspondra
// plus au contenu encodé).
import QRCode from "qrcode";
import { encryptQrPayload, schoolSecret } from "./qr-crypto.js";

// Construit une charge utile compacte « clé:valeur » séparée par « | ».
// Les champs vides sont ignorés.
export function qrPayload(champs = {}) {
  return Object.entries(champs)
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== "")
    .map(([k, v]) => `${k}:${String(v).replace(/[|\n]/g, " ").trim()}`)
    .join("|");
}

// Renvoie un fragment HTML <img crossOrigin="anonymous"> avec le QR en data URL (ou "" si échec).
// À générer APRÈS window.open (await) pour ne pas casser l'ouverture liée au
// geste utilisateur.
// `size` est la taille IMPRIMÉE en px CSS (≈ 3,8 px par mm). En dessous de
// ~20 mm, un QR au contenu chiffré (donc long et dense) devient illisible à
// la caméra : les modules tombent sous le pouvoir de résolution du capteur.
// Les appelants passent des tailles ≥ 76 px pour cette raison.
export async function qrImgHtml(payload, { size = 92, alt = "QR de vérification" } = {}) {
  const texte = String(payload || "").trim();
  if (!texte) return "";
  try {
    const dataUrl = await QRCode.toDataURL(texte, {
      margin: 2, // zone de silence : en dessous de 2 modules, la détection souffre
      width: size * 4, // sur-échantillonnage pour un rendu net à l'impression
      errorCorrectionLevel: "Q", // 25 % de redondance : tolère l'encre baveuse et les plis
    });
    return `<img crossOrigin="anonymous" src="${dataUrl}" width="${size}" height="${size}" alt="${alt}" style="display:block"/>`;
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
