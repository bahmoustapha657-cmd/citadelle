// ════════════════════════════════════════════════════════════════════════
//  EduGest — Migration des logos base64 → stockage objet
// ════════════════════════════════════════════════════════════════════════
//   node supabase/migrer-logos.mjs            (simulation, n'écrit rien)
//   node supabase/migrer-logos.mjs --appliquer
//
// Les logos vivaient en base64 dans `ecoles.logo` (jusqu'à 339 ko), donc
// retéléchargés à chaque lecture de la fiche école. On les dépose dans le
// bucket `photos` et la colonne ne garde qu'une URL.
//
// Le base64 d'origine est sauvegardé sur disque AVANT écriture : la migration
// reste réversible tant que le fichier de sauvegarde existe.
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE } from "./_config.mjs";

const APPLIQUER = process.argv.includes("--appliquer");
const BUCKET = "photos";
const SAUVEGARDE = process.env.EDUGEST_BACKUP_DIR || "C:/Users/ADMIN/edugest-backups";

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });

const EXT = { "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/svg+xml": "svg" };

const { data: ecoles, error } = await sb.from("ecoles").select("id, code, logo");
if (error) { console.error("❌", error.message); process.exit(1); }

const aMigrer = ecoles.filter((e) => typeof e.logo === "string" && e.logo.startsWith("data:"));
console.log(`${ecoles.length} écoles · ${aMigrer.length} logo(s) en base64 à migrer`
  + (APPLIQUER ? "" : "   [SIMULATION — relancer avec --appliquer]") + "\n");
if (!aMigrer.length) process.exit(0);

if (APPLIQUER) {
  mkdirSync(SAUVEGARDE, { recursive: true });
  const copie = aMigrer.map(({ id, code, logo }) => ({ id, code, logo }));
  const fichier = join(SAUVEGARDE, `logos-base64-${new Date().toISOString().slice(0, 10)}.json`);
  writeFileSync(fichier, JSON.stringify(copie, null, 0), "utf8");
  console.log(`sauvegarde des originaux : ${fichier}\n`);
}

for (const ecole of aMigrer) {
  const mime = (ecole.logo.match(/^data:([^;]+);/) || [])[1] || "image/jpeg";
  const ext = EXT[mime] || "jpg";
  const octets = Buffer.from(ecole.logo.split(",")[1] || "", "base64");
  const chemin = `${ecole.code}/logo/${crypto.randomUUID()}.${ext}`;

  if (!APPLIQUER) {
    console.log(`  ${ecole.code.padEnd(30)} ${mime} · ${Math.round(octets.length / 1024)} ko → ${chemin}`);
    continue;
  }

  const up = await sb.storage.from(BUCKET).upload(chemin, octets, { contentType: mime, upsert: true });
  if (up.error) { console.log(`  ❌ ${ecole.code} : dépôt impossible — ${up.error.message}`); continue; }

  const url = sb.storage.from(BUCKET).getPublicUrl(chemin).data.publicUrl;
  // Contrôle AVANT d'écraser la colonne : si l'image n'est pas lisible, on
  // laisse le base64 en place plutôt que de perdre le logo.
  const verif = await fetch(url);
  if (!verif.ok) { console.log(`  ❌ ${ecole.code} : URL illisible (${verif.status}), colonne inchangée`); continue; }

  const { error: e2 } = await sb.from("ecoles").update({ logo: url }).eq("id", ecole.id);
  console.log(e2
    ? `  ❌ ${ecole.code} : ${e2.message}`
    : `  ✅ ${ecole.code.padEnd(30)} ${Math.round(octets.length / 1024)} ko → URL (${verif.headers.get("content-type")})`);
}
