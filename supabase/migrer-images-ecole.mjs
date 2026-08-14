// ════════════════════════════════════════════════════════════════════════
//  EduGest — Migration des images d'école base64 → stockage objet
// ════════════════════════════════════════════════════════════════════════
//   node supabase/migrer-images-ecole.mjs            (simulation, n'écrit rien)
//   node supabase/migrer-images-ecole.mjs --appliquer
//
// Couvre les trois emplacements où une image d'établissement pouvait vivre
// en base64, donc être retéléchargée à CHAQUE lecture de la fiche école :
//   • ecoles.logo                      (jusqu'à 339 ko observés)
//   • extra.accueil.bannerUrl          (page publique)
//   • extra.accueil.photos[].url       (galerie de la page publique)
//
// Les originaux base64 sont sauvegardés sur disque AVANT écriture : la
// migration reste réversible tant que le fichier de sauvegarde existe.
//
// ⚠️ DÉPLOYER LE CODE AVANT DE MIGRER. Tant que l'ancienne version tourne,
//    enregistrer les paramètres réinjecte le base64 gardé dans le formulaire
//    — c'est arrivé sur citadelle entre deux passes.
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE } from "./_config.mjs";

const APPLIQUER = process.argv.includes("--appliquer");
const BUCKET = "photos";
const SAUVEGARDE = process.env.EDUGEST_BACKUP_DIR || "C:/Users/ADMIN/edugest-backups";

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });
const EXT = { "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/svg+xml": "svg" };
const estBase64 = (v) => typeof v === "string" && v.startsWith("data:");

// Dépose une image base64 et renvoie son URL — ou null si quoi que ce soit
// échoue, auquel cas l'appelant LAISSE le base64 en place.
async function deposer(base64, code, categorie) {
  const mime = (base64.match(/^data:([^;]+);/) || [])[1] || "image/jpeg";
  const octets = Buffer.from(base64.split(",")[1] || "", "base64");
  const chemin = `${code}/${categorie}/${crypto.randomUUID()}.${EXT[mime] || "jpg"}`;

  const up = await sb.storage.from(BUCKET).upload(chemin, octets, { contentType: mime, upsert: true });
  if (up.error) { console.log(`     ❌ dépôt impossible — ${up.error.message}`); return null; }

  const url = sb.storage.from(BUCKET).getPublicUrl(chemin).data.publicUrl;
  // Contrôle AVANT d'écraser quoi que ce soit : une URL illisible ferait
  // perdre l'image.
  const verif = await fetch(url);
  if (!verif.ok) { console.log(`     ❌ URL illisible (${verif.status})`); return null; }
  console.log(`     ✅ ${Math.round(octets.length / 1024)} ko → ${verif.headers.get("content-type")}`);
  return url;
}

const { data: ecoles, error } = await sb.from("ecoles").select("id, code, logo, extra");
if (error) { console.error("❌", error.message); process.exit(1); }

// Inventaire d'abord : on ne touche à rien tant qu'on n'a pas tout listé.
const travaux = [];
for (const e of ecoles) {
  const accueil = e.extra?.accueil || {};
  const items = [];
  if (estBase64(e.logo)) items.push({ genre: "logo", categorie: "logo", taille: e.logo.length });
  if (estBase64(accueil.bannerUrl)) items.push({ genre: "banniere", categorie: "accueil", taille: accueil.bannerUrl.length });
  (accueil.photos || []).forEach((p, i) => {
    if (estBase64(p?.url)) items.push({ genre: `galerie[${i}]`, categorie: "accueil", index: i, taille: p.url.length });
  });
  if (items.length) travaux.push({ ecole: e, items });
}

const totalKo = travaux.reduce((s, t) => s + t.items.reduce((x, i) => x + Math.round(i.taille / 1024), 0), 0);
console.log(`${ecoles.length} écoles · ${travaux.length} concernée(s) · ${totalKo} ko de base64`
  + (APPLIQUER ? "" : "   [SIMULATION — relancer avec --appliquer]") + "\n");
if (!travaux.length) process.exit(0);

if (APPLIQUER) {
  mkdirSync(SAUVEGARDE, { recursive: true });
  const copie = travaux.map(({ ecole }) => ({ id: ecole.id, code: ecole.code, logo: ecole.logo, accueil: ecole.extra?.accueil || null }));
  const fichier = join(SAUVEGARDE, `images-ecole-base64-${new Date().toISOString().slice(0, 10)}.json`);
  writeFileSync(fichier, JSON.stringify(copie, null, 0), "utf8");
  console.log(`sauvegarde des originaux : ${fichier}\n`);
}

for (const { ecole, items } of travaux) {
  console.log(`${ecole.code} :`);
  const extra = { ...(ecole.extra || {}) };
  const accueil = { ...(extra.accueil || {}) };
  let photos = [...(accueil.photos || [])];
  let logo = ecole.logo;
  let modifie = false;

  for (const item of items) {
    console.log(`   ${item.genre.padEnd(14)} ${Math.round(item.taille / 1024)} ko`);
    if (!APPLIQUER) continue;

    const source = item.genre === "logo" ? logo
      : item.genre === "banniere" ? accueil.bannerUrl
        : photos[item.index].url;
    const url = await deposer(source, ecole.code, item.categorie);
    if (!url) continue; // échec : on laisse le base64 en place

    if (item.genre === "logo") logo = url;
    else if (item.genre === "banniere") accueil.bannerUrl = url;
    else photos[item.index] = { ...photos[item.index], url };
    modifie = true;
  }

  if (!APPLIQUER || !modifie) continue;
  accueil.photos = photos;
  extra.accueil = accueil;
  const { error: e2 } = await sb.from("ecoles").update({ logo, extra }).eq("id", ecole.id);
  console.log(e2 ? `   ❌ écriture : ${e2.message}` : "   → fiche mise à jour");
}
