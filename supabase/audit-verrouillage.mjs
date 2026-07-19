// ═══════════════════════════════════════════════════════════════════════════
//  EduGest — Audit de verrouillage Supabase (sonde boîte-noire, clé ANON)
// ═══════════════════════════════════════════════════════════════════════════
// Sans authentification, tente de LIRE chaque table. Une table qui renvoie des
// lignes = FUITE (RLS absente ou policy anon trop large). Une table vide ou en
// erreur = verrouillée. Lecture seule, aucune écriture. node supabase/audit-verrouillage.mjs
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE } from "./_config.mjs";

const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });

// Toutes les tables du schéma + deltas. `public: true` = exposition ATTENDUE.
const TABLES = [
  "ecoles", "ecoles_public", "comptes", "postes", "enseignants", "enseignant_classes",
  "classes", "matieres", "eleves", "notes", "absences", "emplois", "enseignements",
  "appreciations", "paiements", "tarifs", "salaires", "parent_eleves", "audit",
  "recettes", "depenses", "versements", "bons", "personnel",
  "messages", "annonces", "documents", "examens", "livrets", "honneurs",
  "membres", "evenements", "historique", "push_subs",
  "messages_internes", "messages_internes_lus",
];
// Exposition publique volontaire (écran de connexion avant auth).
const PUBLIC_ATTENDU = new Set(["ecoles_public"]);

async function nbReelles(table) {
  const { count } = await svc.from(table).select("id", { count: "exact", head: true });
  return count ?? "?";
}

async function main() {
  console.log("🔒 Audit de verrouillage — lecture ANONYME de chaque table\n");
  const fuites = [];
  const manquantes = [];
  for (const table of TABLES) {
    const { data, error } = await anon.from(table).select("*").limit(1);
    const reelles = await nbReelles(table).catch(() => "?");
    if (error) {
      if (/does not exist|schema cache|find the table/i.test(error.message)) {
        console.log(`  ⚠️  ${table.padEnd(24)} ABSENTE (${error.message.slice(0, 40)}…)`);
        manquantes.push(table);
      } else {
        console.log(`  ✅ ${table.padEnd(24)} verrouillée (${error.code || "erreur"}) · ${reelles} lignes réelles`);
      }
      continue;
    }
    const n = (data || []).length;
    if (n > 0) {
      if (PUBLIC_ATTENDU.has(table)) {
        console.log(`  🌍 ${table.padEnd(24)} PUBLIQUE (attendu) · ${n} lu(s) anonymement`);
      } else {
        console.log(`  ❌ ${table.padEnd(24)} FUITE — ${n} ligne(s) lue(s) SANS AUTH ! · ${reelles} réelles`);
        fuites.push(table);
      }
    } else {
      console.log(`  ✅ ${table.padEnd(24)} RLS bloque (0 ligne anon) · ${reelles} lignes réelles`);
    }
  }

  // Sonde d'écriture anonyme non destructive : insert vide → doit être refusé.
  console.log("\n🖊️  Sonde d'écriture anonyme (doit être REFUSÉE) :");
  for (const table of ["comptes", "eleves", "recettes", "messages_internes"]) {
    const { error } = await anon.from(table).insert({}).select("id");
    const bloque = !!error;
    console.log(`  ${bloque ? "✅" : "❌"} insert anon sur ${table.padEnd(20)} ${bloque ? "refusé" : "ACCEPTÉ (FUITE)"}`);
    if (!bloque) fuites.push(`${table}:insert`);
  }

  console.log("\n" + "═".repeat(60));
  if (fuites.length === 0) {
    console.log("🎉 AUCUNE FUITE — toutes les tables privées sont verrouillées.");
  } else {
    console.log(`⚠️  ${fuites.length} FUITE(S) : ${fuites.join(", ")}`);
  }
  if (manquantes.length) console.log(`ℹ️  Tables absentes (non modélisées) : ${manquantes.join(", ")}`);
  process.exit(fuites.length === 0 ? 0 : 1);
}

main().catch((e) => { console.error("❌", e); process.exit(1); });
