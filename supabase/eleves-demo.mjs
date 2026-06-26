// ════════════════════════════════════════════════════════════════════════
//  EduGest / Supabase — P2 : tranche verticale « élèves »
// ════════════════════════════════════════════════════════════════════════
// Valide le PATTERN d'accès données (qu'on répétera pour notes, classes,
// paiements…) : connexion comme un vrai client (clé anon), puis créer / lister
// / modifier des élèves — le tout filtré par la RLS (école de l'utilisateur).
//
// Prérequis : avoir lancé seed.mjs (compte direction démo).
//   npm i @supabase/supabase-js
//   export SUPABASE_URL="https://xxxx.supabase.co"
//   export SUPABASE_ANON_KEY="eyJ...anon..."
//   node supabase/eleves-demo.mjs
// ════════════════════════════════════════════════════════════════════════
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
if (!URL || !ANON) {
  console.error("❌ Définis SUPABASE_URL et SUPABASE_ANON_KEY.");
  process.exit(1);
}

const sb = createClient(URL, ANON, { auth: { persistSession: false } });

const CODE = "demo";
const email = `direction.${CODE}@edugest.app`;
const PASSWORD = "Demo1234!";
const SECTION = "primaire";
const CLASSE = "CM2";

// ── Couche d'accès « élèves » (ébauche du futur module front) ───────────────
const elevesApi = {
  lister: (ecoleId, section) => sb.from("eleves")
    .select("id, nom, prenom, sexe, classe, ien")
    .eq("ecole_id", ecoleId).eq("section", section)
    .order("nom", { ascending: true }),
  creer: (eleve) => sb.from("eleves").insert(eleve).select().single(),
  modifier: (id, patch) => sb.from("eleves").update(patch).eq("id", id).select().single(),
  supprimer: (id) => sb.from("eleves").delete().eq("id", id),
};

async function main() {
  // 1) Connexion.
  const { data: auth, error: e1 } = await sb.auth.signInWithPassword({ email, password: PASSWORD });
  if (e1) throw e1;
  console.log("✓ Connecté:", auth.user.email);

  // 2) Mon périmètre (ecole_id) depuis le profil.
  const { data: compte, error: e2 } = await sb.from("comptes").select("ecole_id, role").single();
  if (e2) throw e2;
  const ecoleId = compte.ecole_id;
  console.log("✓ École:", ecoleId, "· rôle:", compte.role);

  // 3) Créer deux élèves (écriture autorisée : direction = personnel).
  const aCreer = [
    { ecole_id: ecoleId, section: SECTION, classe: CLASSE, nom: "Diallo", prenom: "Aïssatou", sexe: "F", ien: "IEN-0001" },
    { ecole_id: ecoleId, section: SECTION, classe: CLASSE, nom: "Bah", prenom: "Mamadou", sexe: "M", ien: "IEN-0002" },
  ];
  for (const e of aCreer) {
    const { data, error } = await elevesApi.creer(e);
    if (error) { console.warn("  (création ignorée:", error.message, ")"); continue; }
    console.log("✓ Élève créé:", data.nom, data.prenom, data.id);
  }

  // 4) Lister (RLS : seulement mon école).
  const { data: liste, error: e4 } = await elevesApi.lister(ecoleId, SECTION);
  if (e4) throw e4;
  console.log(`✓ ${liste.length} élève(s) en ${CLASSE}:`, liste.map((x) => `${x.nom} ${x.prenom}`));

  // 5) Modifier le premier (changement de classe).
  if (liste[0]) {
    const { data: maj, error: e5 } = await elevesApi.modifier(liste[0].id, { classe: "CM2 B" });
    if (e5) throw e5;
    console.log("✓ Modifié:", maj.nom, "→", maj.classe);
  }

  console.log("\n✅ Pattern d'accès « élèves » validé (auth + RLS + CRUD).");
  console.log("   (Astuce : relance le script — il est idempotent sur l'IEN si tu ajoutes une contrainte unique.)");
}

main().catch((e) => { console.error("❌", e.message || e); process.exit(1); });
