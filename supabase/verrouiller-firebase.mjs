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
//   node supabase/verrouiller-firebase.mjs citadelle --url=https://mon-domaine
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import admin from "firebase-admin";

const HERE = dirname(fileURLToPath(import.meta.url));
const code = process.argv[2];
const off = process.argv.includes("--off");
const urlArg = process.argv.find((a) => a.startsWith("--url="));
const basculeUrl = urlArg ? urlArg.slice(6) : "https://edugest-gn.pages.dev";

if (!code) { console.error("Usage : node supabase/verrouiller-firebase.mjs <codeEcole> [--off] [--url=…]"); process.exit(1); }

const svcFile = readdirSync(HERE).find((f) => /firebase-adminsdk.*\.json$/.test(f));
if (!svcFile) { console.error("❌ Clé de service Firebase introuvable dans supabase/."); process.exit(1); }
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(join(HERE, svcFile), "utf8"))) });

const ref = admin.firestore().collection("ecoles").doc(code);
if (off) {
  await ref.set({ basculeSupabase: admin.firestore.FieldValue.delete(), basculeUrl: admin.firestore.FieldValue.delete(), updatedAt: Date.now() }, { merge: true });
  console.log(`🔓 École « ${code} » DÉVERROUILLÉE — Firebase redevient utilisable en écriture.`);
} else {
  await ref.set({ basculeSupabase: true, basculeUrl, updatedAt: Date.now() }, { merge: true });
  console.log(`🔒 École « ${code} » VERROUILLÉE — lecture seule + bannière vers ${basculeUrl}.`);
  console.log("   (réversible : relancer avec --off)");
}
process.exit(0);
