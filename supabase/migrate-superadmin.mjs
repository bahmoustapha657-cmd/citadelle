// ════════════════════════════════════════════════════════════════════════
//  EduGest — Migration du/des compte(s) SUPERADMIN (collection globale)
// ════════════════════════════════════════════════════════════════════════
// Le superadmin vit dans la collection Firestore top-level `superadmins`
// (hors écoles) → ignoré par migrate.mjs. Ici on le recrée dans Supabase Auth
// (email login@superadmin.edugest.app, mot de passe aléatoire → reset à la 1re
// connexion) + une ligne `comptes` role='superadmin', ecole_id=NULL.
//
// PRÉREQUIS : avoir exécuté supabase/superadmin.sql (ecole_id nullable + RLS).
// Lancer : node supabase/migrate-superadmin.mjs
// ════════════════════════════════════════════════════════════════════════
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import admin from "firebase-admin";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE } from "./_config.mjs";
import { superadminEmailFor } from "./_brand.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) { console.error("❌ config.local.mjs incomplet."); process.exit(1); }

const svcFile = readdirSync(HERE).find((f) => /firebase-adminsdk.*\.json$/.test(f));
if (!svcFile) { console.error("❌ Clé de service Firebase introuvable dans supabase/."); process.exit(1); }
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(join(HERE, svcFile), "utf8"))) });
const fdb = admin.firestore();
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { autoRefreshToken: false, persistSession: false } });
const rnd = () => "Tmp-" + Math.random().toString(36).slice(2, 10) + "A9!";

async function main() {
  const snap = await fdb.collection("superadmins").get();
  console.log("Superadmins dans Firebase:", snap.size);
  for (const d of snap.docs) {
    const x = d.data();
    const login = x.login; if (!login) { console.warn("  ⚠ doc sans login, ignoré"); continue; }
    const email = superadminEmailFor(login);
    let userId;
    const { data: created, error } = await sb.auth.admin.createUser({ email, password: rnd(), email_confirm: true });
    if (error && !/already|exists|registered/i.test(error.message)) { console.warn("  ⚠ auth:", error.message); continue; }
    userId = created?.user?.id;
    if (!userId) { const { data: l } = await sb.auth.admin.listUsers(); userId = l.users.find((u) => u.email === email)?.id; }
    if (!userId) { console.warn("  ⚠ user introuvable:", email); continue; }
    const { error: e2 } = await sb.from("comptes").upsert({
      user_id: userId, ecole_id: null, login, role: "superadmin",
      nom: x.nom || "Super Admin", label: "Super Admin", statut: "Actif", premiere_co: true,
      extra: { firestore_id: d.id },
    }, { onConflict: "user_id" });
    if (e2) { console.warn("  ⚠ comptes:", e2.message); continue; }
    console.log("✓ superadmin migré:", login, "→", email);
  }
  console.log("\n✅ Terminé. Mot de passe à redéfinir à la 1re connexion.");
  process.exit(0);
}
main().catch((e) => { console.error("❌", e.message || e); process.exit(1); });
