// ════════════════════════════════════════════════════════════════════════
//  Export des FICHIERS de Supabase Storage (photos, logos, signatures,
//  documents et vocaux de la messagerie) pour la sauvegarde hors site.
// ════════════════════════════════════════════════════════════════════════
// Le dump de la base ne contient que les RÉFÉRENCES des fichiers
// (storage.objects), pas leur contenu : sans cet export, une restauration
// rendrait des fiches d'élèves sans photo et des messages sans pièce jointe.
//
//   node scripts/exporter-stockage.mjs <dossier-de-sortie>
//   node scripts/exporter-stockage.mjs --simulation   (compte, ne télécharge rien)
//
// Variables : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (lecture de tous les
// buckets, privés compris). Écrit <sortie>/<bucket>/<chemin> et
// <sortie>/manifeste.tsv (bucket, chemin, taille). N'affiche que des
// totaux : le journal d'une action GitHub de ce dépôt est PUBLIC.
// Sortie 1 si un seul fichier n'a pas pu être téléchargé : une sauvegarde
// partielle ne doit jamais passer pour complète.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const simulation = process.argv.includes("--simulation");
const sortie = simulation ? "(simulation)" : process.argv[2];
const URL_PROJET = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const CLE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!sortie || !URL_PROJET || !CLE) {
  console.error("Usage : SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/exporter-stockage.mjs <dossier>");
  process.exit(2);
}

const ENTETES = { Authorization: `Bearer ${CLE}`, apikey: CLE };
const PAGE = 1000;
const PARALLELE = 8;

async function api(chemin, options = {}) {
  const r = await fetch(`${URL_PROJET}/storage/v1/${chemin}`, {
    ...options, headers: { ...ENTETES, ...(options.headers || {}) },
  });
  if (!r.ok) throw new Error(`${options.method || "GET"} ${chemin.split("/").slice(0, 2).join("/")} → HTTP ${r.status}`);
  return r;
}

// Liste récursive d'un bucket : une entrée sans `id` est un dossier.
async function lister(bucket, prefixe = "") {
  const fichiers = [];
  for (let offset = 0; ; offset += PAGE) {
    const r = await api(`object/list/${bucket}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefix: prefixe, limit: PAGE, offset, sortBy: { column: "name", order: "asc" } }),
    });
    const entrees = await r.json();
    for (const e of entrees) {
      const chemin = `${prefixe}${e.name}`;
      if (e.id == null) fichiers.push(...await lister(bucket, `${chemin}/`));
      else fichiers.push({ chemin, taille: e.metadata?.size ?? null });
    }
    if (entrees.length < PAGE) return fichiers;
  }
}

const encoder = (chemin) => chemin.split("/").map(encodeURIComponent).join("/");

async function telecharger(bucket, { chemin }) {
  const r = await api(`object/${bucket}/${encoder(chemin)}`);
  const contenu = Buffer.from(await r.arrayBuffer());
  const cible = join(sortie, bucket, ...chemin.split("/"));
  mkdirSync(dirname(cible), { recursive: true });
  writeFileSync(cible, contenu);
  return contenu.length;
}

const buckets = await (await api("bucket")).json();
const manifeste = ["bucket\tchemin\ttaille"];
let echecs = 0;
let totalFichiers = 0;
let totalOctets = 0;
for (const { id: bucket } of buckets) {
  const fichiers = await lister(bucket);
  if (simulation) {
    const octets = fichiers.reduce((s, f) => s + (f.taille || 0), 0);
    console.log(`${bucket} : ${fichiers.length} fichier(s), ${(octets / 1e6).toFixed(1)} Mo (simulation)`);
    continue;
  }
  let octets = 0;
  for (let i = 0; i < fichiers.length; i += PARALLELE) {
    await Promise.all(fichiers.slice(i, i + PARALLELE).map(async (f) => {
      try {
        const n = await telecharger(bucket, f);
        octets += n;
        manifeste.push(`${bucket}\t${f.chemin}\t${n}`);
      } catch (e) {
        echecs++;
        console.error(`échec (${bucket}) : ${e.message}`);
      }
    }));
  }
  totalFichiers += fichiers.length;
  totalOctets += octets;
  console.log(`${bucket} : ${fichiers.length} fichier(s), ${(octets / 1e6).toFixed(1)} Mo`);
}
if (simulation) process.exit(0);
mkdirSync(sortie, { recursive: true });
writeFileSync(join(sortie, "manifeste.tsv"), manifeste.join("\n") + "\n");
console.log(`Total : ${totalFichiers} fichier(s), ${(totalOctets / 1e6).toFixed(1)} Mo, ${echecs} échec(s)`);
if (echecs) process.exit(1);
