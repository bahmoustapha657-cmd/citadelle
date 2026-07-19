// ════════════════════════════════════════════════════════════════════════
//  EduGest — Verrou de bascule : fige une école Firebase après sa migration
// ════════════════════════════════════════════════════════════════════════
// Pose (ou retire) le drapeau `basculeSupabase` sur ecoles/{code} :
//   - firestore.rules (abonnementActifData) → toutes les écritures client bloquées
//   - api/_lib/security.js (isSchoolReadOnly) → APIs d'écriture bloquées
//   - compute-permissions + AppShell → lecture seule + bannière vers la
//     nouvelle adresse (schoolInfo.basculeUrl, défaut https://edugest-gn.pages.dev)
// Le drapeau est ignoré par la version Supabase (voir compute-permissions).
//
// Usage :
//   node supabase/verrouiller-firebase.mjs citadelle           (verrouille)
//   node supabase/verrouiller-firebase.mjs citadelle --off     (déverrouille)
//   node supabase/verrouiller-firebase.mjs --all               (TOUTES les écoles)
//   node supabase/verrouiller-firebase.mjs --all --off         (déverrouille tout)
//   node supabase/verrouiller-firebase.mjs citadelle --url=https://mon-domaine
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import admin from "firebase-admin";

const HERE = dirname(fileURLToPath(import.meta.url));
const off = process.argv.includes("--off");
const tout = process.argv.includes("--all");
const code = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : null;
const urlArg = process.argv.find((a) => a.startsWith("--url="));
const basculeUrl = urlArg ? urlArg.slice(6) : "https://edugest-gn.pages.dev";

if (!code && !tout) { console.error("Usage : node supabase/verrouiller-firebase.mjs <codeEcole>|--all [--off] [--url=…]"); process.exit(1); }

const svcFile = readdirSync(HERE).find((f) => /firebase-adminsdk.*\.json$/.test(f));
if (!svcFile) { console.error("❌ Clé de service Firebase introuvable dans supabase/."); process.exit(1); }
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(join(HERE, svcFile), "utf8"))) });
const db = admin.firestore();

const patch = off
  ? { basculeSupabase: admin.firestore.FieldValue.delete(), basculeUrl: admin.firestore.FieldValue.delete(), updatedAt: Date.now() }
  : { basculeSupabase: true, basculeUrl, updatedAt: Date.now() };

async function appliquer(codeEcole) {
  await db.collection("ecoles").doc(codeEcole).set(patch, { merge: true });
  console.log(`  ${off ? "🔓" : "🔒"} ${codeEcole} ${off ? "déverrouillée" : "verrouillée"}`);
}

if (tout) {
  const snap = await db.collection("ecoles").get();
  console.log(`${off ? "Déverrouillage" : "Verrouillage"} de ${snap.size} école(s)${off ? "" : ` → lecture seule + bannière vers ${basculeUrl}`} :`);
  for (const doc of snap.docs) await appliquer(doc.id);
  console.log(`\n✅ ${snap.size} école(s) traitée(s). (réversible : ${off ? "relancer sans --off" : "--all --off"})`);
} else {
  await appliquer(code);
  console.log(off ? "" : "   (réversible : --off)");
}
process.exit(0);
