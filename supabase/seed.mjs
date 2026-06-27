// ════════════════════════════════════════════════════════════════════════
//  EduGest / Supabase — Seed (P1) : école démo + compte direction
// ════════════════════════════════════════════════════════════════════════
// Crée de quoi tester la connexion : une école, un utilisateur auth (email
// synthétisé) et sa ligne `comptes`. Utilise la clé SERVICE_ROLE (jamais
// côté client).
//
// Prérequis :
//   npm i @supabase/supabase-js
//   export SUPABASE_URL="https://xxxx.supabase.co"
//   export SUPABASE_SERVICE_ROLE="eyJ...service_role..."
//   node supabase/seed.mjs
// ════════════════════════════════════════════════════════════════════════
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE } from "./_config.mjs";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error("❌ Renseigne `url` et `serviceRole` dans supabase/config.local.mjs (copie de config.example.mjs).");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { autoRefreshToken: false, persistSession: false } });

const CODE = "demo";
const LOGIN = "direction";
const PASSWORD = "Demo1234!";
const emailFor = (login, code) => `${login}.${code}@edugest.app`;

async function main() {
  // 1) École démo (idempotent sur `code`).
  const { data: ecole, error: e1 } = await sb
    .from("ecoles")
    .upsert({ code: CODE, nom: "École Démo" }, { onConflict: "code" })
    .select()
    .single();
  if (e1) throw e1;
  console.log("✓ École:", ecole.nom, ecole.id);

  // 2) Utilisateur auth (email synthétisé). Idempotent : si déjà créé, on le retrouve.
  const email = emailFor(LOGIN, CODE);
  let userId;
  const { data: created, error: e2 } = await sb.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
  });
  if (e2 && !/already|exists|registered/i.test(e2.message)) throw e2;
  userId = created?.user?.id;
  if (!userId) {
    const { data: list } = await sb.auth.admin.listUsers();
    userId = list.users.find((u) => u.email === email)?.id;
  }
  if (!userId) throw new Error("Impossible de créer/retrouver l'utilisateur auth.");
  console.log("✓ Auth user:", email, userId);

  // 3) Profil applicatif (rôle + périmètre) lié à l'utilisateur auth.
  const { error: e3 } = await sb.from("comptes").upsert({
    user_id: userId,
    ecole_id: ecole.id,
    login: LOGIN,
    role: "direction",
    nom: "Directeur Démo",
    label: "Direction",
    statut: "Actif",
    premiere_co: false,
  }, { onConflict: "user_id" });
  if (e3) throw e3;

  console.log("\n✅ Seed terminé. Connecte-toi avec :");
  console.log({ code: CODE, login: LOGIN, password: PASSWORD, email });
}

main().catch((e) => { console.error("❌", e.message || e); process.exit(1); });
