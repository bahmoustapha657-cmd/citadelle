// ════════════════════════════════════════════════════════════════════════
//  EduGest — Sauvegarde des données Supabase (export complet, service_role)
// ════════════════════════════════════════════════════════════════════════
// Exporte TOUTES les tables (données) vers des fichiers JSON horodatés, HORS
// du dépôt git (données réelles d'élèves/paiements → jamais sur GitHub).
// Le SCHÉMA (tables, RLS, fonctions) vit déjà dans les .sql du dépôt :
//   schéma (.sql) + ces données (.json) = restauration complète.
//
//   node supabase/backup-donnees.mjs
//
// Destination : C:\Users\ADMIN\edugest-backups\backup-AAAA-MM-JJ-HHMM\
// (surchargeable via la variable d'environnement EDUGEST_BACKUP_DIR).
//
// ⚠️ Les mots de passe (hachés dans auth.users) ne sont PAS exportables par
//    l'API. En cas de restauration, les comptes seront recréés et les
//    utilisateurs referont leur mot de passe (bouton « Réinitialiser » /
//    « Mot de passe oublié »). Les DONNÉES métier, elles, sont intégrales.
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE } from "./_config.mjs";

const RETENTION = Number(process.env.EDUGEST_BACKUP_RETENTION || 60); // nb de sauvegardes conservées

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) { console.error("❌ config.local.mjs incomplet."); process.exit(1); }
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });

// Toutes les tables de données à sauvegarder.
const TABLES = [
  "ecoles", "ecoles_public", "comptes", "postes",
  "enseignants", "enseignant_classes", "classes", "matieres",
  "eleves", "notes", "absences", "emplois", "enseignements",
  "appreciations", "paiements", "tarifs", "salaires", "parent_eleves", "audit",
  "recettes", "depenses", "versements", "bons", "personnel",
  "messages", "annonces", "documents", "examens", "livrets", "honneurs",
  "membres", "evenements", "historique", "push_subs",
  "messages_internes", "messages_internes_lus",
];
// Clé de tri fiable pour la pagination (défaut : id). Certaines tables de
// liaison n'ont pas d'`id` unique → tri par une colonne présente.
const TRI = { parent_eleves: "eleve_id", enseignant_classes: "compte_id", messages_internes_lus: "message_id" };
const PAGE = 1000;

async function exporterTable(table) {
  const tri = TRI[table] || "id";
  const rows = [];
  for (let de = 0; ; de += PAGE) {
    let r = await sb.from(table).select("*").order(tri).range(de, de + PAGE - 1);
    if (r.error && /column .* does not exist|order/i.test(r.error.message)) {
      // Repli : pagination sans tri (petites tables).
      r = await sb.from(table).select("*").range(de, de + PAGE - 1);
    }
    if (r.error) {
      if (/does not exist|find the table/i.test(r.error.message)) return { rows: null, note: "table absente" };
      throw new Error(`${table}: ${r.error.message}`);
    }
    rows.push(...(r.data || []));
    if (!r.data || r.data.length < PAGE) break;
  }
  return { rows };
}

async function main() {
  const ts = new Date().toISOString().slice(0, 16).replace("T", "-").replace(":", "h");
  const base = process.env.EDUGEST_BACKUP_DIR || "C:/Users/ADMIN/edugest-backups";
  const dir = join(base, `backup-${ts}`);
  mkdirSync(dir, { recursive: true });
  console.log(`🗄️  Sauvegarde EduGest → ${dir}\n`);

  const manifest = { date: new Date().toISOString(), source: new URL(SUPABASE_URL).host, tables: {} };
  let total = 0;
  for (const table of TABLES) {
    const { rows, note } = await exporterTable(table);
    if (rows === null) { console.log(`  ⏭️  ${table.padEnd(24)} ${note}`); manifest.tables[table] = { note }; continue; }
    writeFileSync(join(dir, `${table}.json`), JSON.stringify(rows, null, 0), "utf8");
    manifest.tables[table] = { lignes: rows.length };
    total += rows.length;
    console.log(`  ✅ ${table.padEnd(24)} ${String(rows.length).padStart(6)} lignes`);
  }

  // Comptes auth (id, email, métadonnées — SANS mots de passe, non exportables).
  const authUsers = [];
  for (let page = 1; ; page++) {
    const { data } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    const u = data?.users || [];
    authUsers.push(...u.map((x) => ({ id: x.id, email: x.email, created_at: x.created_at, user_metadata: x.user_metadata })));
    if (u.length < 1000) break;
  }
  writeFileSync(join(dir, "_auth_users.json"), JSON.stringify(authUsers, null, 0), "utf8");
  manifest.authUsers = authUsers.length;
  console.log(`  ✅ ${"_auth_users".padEnd(24)} ${String(authUsers.length).padStart(6)} comptes (sans mdp)`);

  writeFileSync(join(dir, "_manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

  // Rétention : ne garder que les RETENTION sauvegardes les plus récentes.
  try {
    const anciennes = readdirSync(base).filter((n) => n.startsWith("backup-")).sort();
    const aSupprimer = anciennes.slice(0, Math.max(0, anciennes.length - RETENTION));
    for (const n of aSupprimer) rmSync(join(base, n), { recursive: true, force: true });
    if (aSupprimer.length) console.log(`   (rétention : ${aSupprimer.length} ancienne(s) sauvegarde(s) supprimée(s), ${RETENTION} conservées)`);
  } catch { /* pas bloquant */ }

  console.log(`\n🎉 Sauvegarde terminée : ${total} lignes de données + ${authUsers.length} comptes auth.`);
  console.log(`   Dossier : ${dir}`);
  console.log(`   ⤷ Copiez-le hors de ce PC (Google Drive, disque externe…) pour une vraie protection.`);
}

main().catch((e) => { console.error("❌", e); process.exit(1); });
