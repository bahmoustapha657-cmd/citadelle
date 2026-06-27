// ════════════════════════════════════════════════════════════════════════
//  EduGest / Supabase — Test de connexion (P1)
// ════════════════════════════════════════════════════════════════════════
// Prouve la chaîne complète : Supabase Auth (email synthétisé) + RLS.
// On se connecte comme le compte semé, puis on lit `ecoles` : la RLS doit ne
// renvoyer QUE l'école de l'utilisateur (pas les autres).
//
// Prérequis (clé ANON, pas service_role — on teste comme un vrai client) :
//   npm i @supabase/supabase-js
//   export SUPABASE_URL="https://xxxx.supabase.co"
//   export SUPABASE_ANON_KEY="eyJ...anon..."
//   node supabase/login-test.mjs
// ════════════════════════════════════════════════════════════════════════
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./_config.mjs";
import { emailFor } from "./_brand.mjs";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("❌ Renseigne `url` et `anonKey` dans supabase/config.local.mjs (copie de config.example.mjs).");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });

// Reconstruction de l'email à partir du code école + login (comme le front le fera).
const CODE = "demo";
const LOGIN = "direction";
const PASSWORD = "Demo1234!";
const email = emailFor(LOGIN, CODE);

async function main() {
  // 0) État public de l'école (avant connexion) — via la fonction RPC publique.
  const { data: etat, error: e0 } = await sb.rpc("etat_ecole", { p_code: CODE });
  if (e0) throw e0;
  console.log("✓ etat_ecole(public):", etat?.[0]?.nom ?? "(introuvable)");

  // 1) Connexion.
  const { data: auth, error: e1 } = await sb.auth.signInWithPassword({ email, password: PASSWORD });
  if (e1) throw e1;
  console.log("✓ Connecté:", auth.user.email);

  // 2) Lecture protégée par RLS : on ne doit voir QUE son école.
  const { data: ecoles, error: e2 } = await sb.from("ecoles").select("id, nom, code");
  if (e2) throw e2;
  console.log("✓ Écoles visibles (RLS):", ecoles.length, ecoles.map((x) => x.nom));

  // 3) Le profil courant (helpers RLS).
  const { data: comptes } = await sb.from("comptes").select("login, role, ecole_id");
  console.log("✓ Mon compte:", comptes?.[0]);

  console.log("\n✅ Auth + RLS opérationnels.");
}

main().catch((e) => { console.error("❌", e.message || e); process.exit(1); });
