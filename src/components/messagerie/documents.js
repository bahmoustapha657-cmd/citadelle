// ══════════════════════════════════════════════════════════════
//  Documents partagés (discussions, annonces) — logique pure
// ══════════════════════════════════════════════════════════════
// Types acceptés : ceux du bucket « messagerie » (messagerie-v3.sql). Certains
// téléphones n'indiquent pas le type d'un .docx : on le déduit alors de
// l'extension.

export const TAILLE_MAX_FICHIER = 10 * 1024 * 1024;
export const MAX_PIECES_ANNONCE = 5;
// Photos : téléchargées d'office si elles pèsent moins que ça (sinon, sur
// demande — les données mobiles coûtent cher).
export const SEUIL_APERCU_AUTO = 400 * 1024;

const TYPES_PAR_EXTENSION = {
  pdf: "application/pdf",
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
  heic: "image/heic", heif: "image/heif",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  txt: "text/plain", csv: "text/csv",
};
const TYPES_ACCEPTES = new Set(Object.values(TYPES_PAR_EXTENSION));
const EXTENSION_PAR_TYPE = Object.fromEntries(
  Object.entries(TYPES_PAR_EXTENSION).reverse().map(([ext, type]) => [type, ext]),
);

// Pour <input type="file" accept>.
export const ACCEPT_DOCUMENTS = Object.keys(TYPES_PAR_EXTENSION).map((e) => `.${e}`).join(",");

export function extension(nom) {
  const m = /\.([a-z0-9]{1,5})$/i.exec(String(nom || ""));
  return m ? m[1].toLowerCase() : "";
}

export function extensionPourType(type, nom = "") {
  const ext = extension(nom);
  if (ext && TYPES_PAR_EXTENSION[ext] === type) return ext;
  return EXTENSION_PAR_TYPE[type] || "bin";
}

// Type MIME retenu pour un fichier, ou null s'il n'est pas accepté.
export function typeFichier(fichier) {
  const declare = String(fichier?.type || "").split(";")[0].trim().toLowerCase();
  if (TYPES_ACCEPTES.has(declare)) return declare;
  return TYPES_PAR_EXTENSION[extension(fichier?.name)] || null;
}

export function verifierFichier(fichier) {
  if (!fichier) return { ok: false, erreur: "Aucun fichier." };
  const type = typeFichier(fichier);
  if (!type) return { ok: false, erreur: `« ${fichier.name} » : type de fichier non accepté (PDF, photo, Word, Excel, PowerPoint, texte).` };
  if (fichier.size > TAILLE_MAX_FICHIER) return { ok: false, erreur: `« ${fichier.name} » dépasse 10 Mo.` };
  if (!fichier.size) return { ok: false, erreur: `« ${fichier.name} » est vide.` };
  return { ok: true, type };
}

export const estImage = (type) => /^image\//.test(String(type || ""));
// HEIC (iPhone) : le navigateur ne sait pas toujours l'afficher → carte.
export const imageAffichable = (type) => ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(type);

export function iconeFichier(type) {
  const t = String(type || "");
  if (t === "application/pdf") return "📕";
  if (estImage(t)) return "🖼️";
  if (/word|opendocument\.text|text\/plain/.test(t)) return "📝";
  if (/excel|spreadsheet|csv/.test(t)) return "📊";
  if (/powerpoint|presentation/.test(t)) return "📽️";
  return "📎";
}

export function formatTaille(octets) {
  const n = Number(octets) || 0;
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}
