// ═══════════════════════════════════════════════════════════════════════════
//  EduGest — Audit : inscription publique (auth) + fuite de secrets
// ═══════════════════════════════════════════════════════════════════════════
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE } from "./_config.mjs";

// État d'inscription via l'endpoint PUBLIC GoTrue (aucun compte créé).
async function testInscription() {
  console.log("👤 Inscription publique — GET /auth/v1/settings :");
  const r = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_ANON_KEY } });
  const s = await r.json();
  const ouverte = s.disable_signup === false;
  console.log(`  ${ouverte ? "❌ OUVERTE" : "✅ FERMÉE"} — disable_signup=${s.disable_signup} · mailer_autoconfirm=${s.mailer_autoconfirm}`);
  if (ouverte) console.log("     → Auth → Sign In / Providers → désactiver « Allow new users to sign up ».");
  return !ouverte;
}

function fichiersTexte(dir, exts) {
  const out = [];
  const walk = (d) => {
    for (const nom of readdirSync(d)) {
      if (nom === "node_modules" || nom === ".git" || nom === "config.local.mjs") continue;
      const p = join(d, nom);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (exts.some((e) => nom.endsWith(e))) out.push(p);
    }
  };
  walk(dir);
  return out;
}

// Discriminant : la SIGNATURE JWT (après le dernier point) est UNIQUE par clé.
// (L'en-tête est identique entre anon et service_role → ne pas l'utiliser.)
function testFuiteSecret() {
  console.log("\n🔑 Fuite de la clé service_role (bundle client) — via signature JWT :");
  const sigSvc = SUPABASE_SERVICE_ROLE.split(".").pop();
  const sigAnon = SUPABASE_ANON_KEY.split(".").pop();
  const racines = [
    { label: "src/", dir: join(process.cwd(), "src") },
    { label: "dist/ (worktree)", dir: join(process.cwd(), "dist") },
    { label: "dist/ (prod)", dir: "C:/Users/ADMIN/citadelle/dist" },
  ];
  let fuite = false;
  for (const { label, dir } of racines) {
    if (!existsSync(dir)) { console.log(`  ⏭️  ${label} absent`); continue; }
    const fichiers = fichiersTexte(dir, [".js", ".jsx", ".ts", ".mjs", ".html", ".json", ".map"]);
    const svcHits = fichiers.filter((f) => readFileSync(f, "utf8").includes(sigSvc));
    const anonHits = fichiers.filter((f) => readFileSync(f, "utf8").includes(sigAnon));
    if (svcHits.length) {
      fuite = true;
      console.log(`  ❌ ${label} — CLÉ SERVICE_ROLE : ${svcHits.map((f) => f.replace(process.cwd(), ".")).join(", ")}`);
    } else {
      console.log(`  ✅ ${label} — service_role absente · anon présente dans ${anonHits.length} fichier(s) (clé publique, normal)`);
    }
  }
  return !fuite;
}

async function main() {
  const inscOk = await testInscription();
  const secretOk = testFuiteSecret();
  console.log("\n" + "═".repeat(60));
  if (inscOk && secretOk) console.log("🎉 Inscription fermée + aucun secret côté client.");
  else console.log("⚠️  Voir les points ❌ ci-dessus.");
  process.exit(inscOk && secretOk ? 0 : 1);
}

main().catch((e) => { console.error("❌", e); process.exit(1); });
