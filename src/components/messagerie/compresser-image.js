// Photo lourde → JPEG 1600 px max, qualité 0,8, avant envoi : une photo de
// téléphone passe de 3-5 Mo à ~300 Ko, ce qui compte sur données mobiles.
// Les autres fichiers (et les photos déjà légères) partent tels quels.
const COMPRESSIBLES = new Set(["image/jpeg", "image/png", "image/webp"]);
const SEUIL = 700 * 1024;
const COTE_MAX = 1600;

export async function preparerFichier(fichier, type) {
  const original = { fichier, type, nom: fichier.name };
  if (!COMPRESSIBLES.has(type) || fichier.size < SEUIL || typeof createImageBitmap !== "function") return original;
  try {
    const image = await createImageBitmap(fichier);
    const echelle = Math.min(1, COTE_MAX / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * echelle);
    canvas.height = Math.round(image.height * echelle);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff"; // PNG transparent → fond blanc plutôt que noir
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    image.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
    if (!blob || blob.size >= fichier.size) return original;
    return { fichier: blob, type: "image/jpeg", nom: `${fichier.name.replace(/\.[^.]+$/, "")}.jpg` };
  } catch {
    return original;
  }
}
