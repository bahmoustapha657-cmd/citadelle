// Génération de QR codes pour les documents imprimés (bulletins, reçus, fiches
// de paie). Le QR encode les champs clés du document : un agent peut le scanner
// pour vérifier l'authenticité (toute falsification du papier ne correspondra
// plus au contenu encodé).
import QRCode from "qrcode";

// Construit une charge utile compacte « clé:valeur » séparée par « | ».
// Les champs vides sont ignorés.
export function qrPayload(champs = {}) {
  return Object.entries(champs)
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== "")
    .map(([k, v]) => `${k}:${String(v).replace(/[|\n]/g, " ").trim()}`)
    .join("|");
}

// Renvoie un fragment HTML <img> avec le QR en data URL (ou "" si échec).
// À générer APRÈS window.open (await) pour ne pas casser l'ouverture liée au
// geste utilisateur.
export async function qrImgHtml(payload, { size = 92, alt = "QR de vérification" } = {}) {
  const texte = String(payload || "").trim();
  if (!texte) return "";
  try {
    const dataUrl = await QRCode.toDataURL(texte, {
      margin: 1,
      width: size * 3, // rendu net à l'impression
      errorCorrectionLevel: "M",
    });
    return `<img src="${dataUrl}" width="${size}" height="${size}" alt="${alt}" style="display:block"/>`;
  } catch {
    return "";
  }
}
