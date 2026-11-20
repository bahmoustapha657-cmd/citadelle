// ════════════════════════════════════════════════════════════════════════
//  Remet les FICHIERS d'une sauvegarde (dossier stockage/) dans les buckets
//  d'un projet Supabase — le pendant de scripts/exporter-stockage.mjs.
// ════════════════════════════════════════════════════════════════════════
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
//     node scripts/restaurer-stockage.mjs <sauvegarde>/stockage
//
// Les buckets doivent exister (migrations appliquées). Chaque fichier est
// remis au même chemin, en écrasant l'éventuelle version présente. Les
// fiches de la base pointent vers ces chemins : rien d'autre à reprendre.
// Sortie 1 si un seul fichier n'a pas pu être remis.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const [dossier] = process.argv.slice(2);
const URL_PROJET = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const CLE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!dossier || !URL_PROJET || !CLE) {
  console.error("Usage : SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/restaurer-stockage.mjs <sauvegarde>/stockage");
  process.exit(2);
}

const TYPES = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
  heic: "image/heic", heif: "image/heif", pdf: "application/pdf",
  webm: "audio/webm", ogg: "audio/ogg", m4a: "audio/mp4", mp4: "audio/mp4", mp3: "audio/mpeg", aac: "audio/aac", wav: "audio/wav",
  doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};
const typeDe = (chemin) => TYPES[chemin.split(".").pop().toLowerCase()] || "application/octet-stream";
const encoder = (chemin) => chemin.split("/").map(encodeURIComponent).join("/");

const lignes = readFileSync(join(dossier, "manifeste.tsv"), "utf8").trim().split("\n").slice(1);
let remis = 0;
let echecs = 0;
for (let i = 0; i < lignes.length; i += 8) {
  await Promise.all(lignes.slice(i, i + 8).map(async (ligne) => {
    const [bucket, chemin] = ligne.split("\t");
    try {
      const r = await fetch(`${URL_PROJET}/storage/v1/object/${bucket}/${encoder(chemin)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${CLE}`, apikey: CLE, "Content-Type": typeDe(chemin), "x-upsert": "true" },
        body: readFileSync(join(dossier, bucket, ...chemin.split("/"))),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      remis++;
    } catch (e) {
      echecs++;
      console.error(`échec (${bucket}) : ${e.message}`);
    }
  }));
}
console.log(`${remis} fichier(s) remis, ${echecs} échec(s)`);
if (echecs) process.exit(1);
