// ═══════════════════════════════════════════════════════════════════════════
//  EduGest — Migration : rôles historiques → postes flexibles
// ═══════════════════════════════════════════════════════════════════════════
// Pour chaque école : crée les 6 postes système (labels/modules repris de
// ecoles.role_settings, droits d'écriture legacy), puis rattache chaque compte
// de personnel existant (role enum) au poste de même clé.
//
// PRÉREQUIS : avoir exécuté supabase/postes.sql.
// Lancer : node supabase/migrate-postes.mjs            (DRY-RUN, aucune écriture)
//          node supabase/migrate-postes.mjs --apply    (exécution réelle)
// ═══════════════════════════════════════════════════════════════════════════
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE } from "./_config.mjs";
import { getRoleSettingsMap } from "../shared/role-config.js";
import { legacyPermissionsForRole } from "../shared/postes-config.js";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) { console.error("❌ config.local.mjs incomplet."); process.exit(1); }
const APPLY = process.argv.includes("--apply");
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { autoRefreshToken: false, persistSession: false } });

const ROLES_POSTES = ["direction", "admin", "comptable", "surveillant", "primaire", "college"];

async function migrerEcole(ecole) {
  console.log(`\n🏫 ${ecole.nom} (${ecole.code})`);
  const settings = getRoleSettingsMap({ roleSettings: ecole.role_settings || {} });

  // 1) Postes système depuis la config de l'école.
  const postesVoulus = ROLES_POSTES.map((role) => ({
    ecole_id: ecole.id,
    cle: role,
    label: settings[role].label,
    systeme: true,
    actif: settings[role].active !== false,
    permissions: legacyPermissionsForRole(role, { roleSettings: ecole.role_settings || {} }),
  }));

  const { data: existants } = await sb.from("postes").select("id, cle").eq("ecole_id", ecole.id);
  const dejaLa = new Set((existants || []).map((p) => p.cle));

  for (const poste of postesVoulus) {
    if (dejaLa.has(poste.cle)) { console.log(`  = poste ${poste.cle} déjà présent`); continue; }
    console.log(`  + poste ${poste.cle} « ${poste.label} » ${poste.actif ? "" : "(désactivé)"} → ${JSON.stringify(poste.permissions)}`);
    if (APPLY) {
      const { error } = await sb.from("postes").insert(poste);
      if (error) { console.error(`  ❌ insertion ${poste.cle}: ${error.message}`); process.exitCode = 1; return; }
    }
  }

  // 2) Rattachement des comptes de personnel (role enum → poste de même clé).
  const { data: postes } = await sb.from("postes").select("id, cle").eq("ecole_id", ecole.id);
  const posteParCle = Object.fromEntries((postes || []).map((p) => [p.cle, p.id]));
  const { data: comptes } = await sb.from("comptes")
    .select("id, login, role, poste_id").eq("ecole_id", ecole.id)
    .in("role", ROLES_POSTES).is("poste_id", null);

  for (const compte of comptes || []) {
    const posteId = posteParCle[compte.role];
    if (!posteId) {
      console.warn(`  ⚠ ${compte.login} (${compte.role}) : poste absent${APPLY ? "" : " (normal en dry-run)"}`);
      continue;
    }
    console.log(`  ↳ compte ${compte.login} (${compte.role}) → poste ${compte.role}`);
    if (APPLY) {
      const { error } = await sb.from("comptes").update({ poste_id: posteId }).eq("id", compte.id);
      if (error) { console.error(`  ❌ rattachement ${compte.login}: ${error.message}`); process.exitCode = 1; }
    }
  }
}

async function verifier(ecole) {
  const { count: sansPoste } = await sb.from("comptes")
    .select("id", { count: "exact", head: true })
    .eq("ecole_id", ecole.id).in("role", ROLES_POSTES).is("poste_id", null);
  const { count: nbPostes } = await sb.from("postes")
    .select("id", { count: "exact", head: true }).eq("ecole_id", ecole.id);
  console.log(`  ✔ vérif ${ecole.code} : ${nbPostes} postes, ${sansPoste} compte(s) de personnel sans poste`);
}

async function main() {
  console.log(APPLY ? "⚡ MODE APPLY — écritures réelles" : "🔍 DRY-RUN — aucune écriture (ajouter --apply pour exécuter)");
  const { data: ecoles, error } = await sb.from("ecoles").select("id, code, nom, role_settings").order("code");
  if (error) { console.error("❌ lecture écoles:", error.message); process.exit(1); }
  console.log(`Écoles : ${ecoles.length}`);
  for (const ecole of ecoles) await migrerEcole(ecole);
  if (APPLY) for (const ecole of ecoles) await verifier(ecole);
  console.log("\nTerminé.");
}

main().catch((e) => { console.error("❌", e); process.exit(1); });
