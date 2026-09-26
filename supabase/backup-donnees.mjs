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
import { mkdirSync, writeFileSync, readFileSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE } from "./_config.mjs";

// ── Règle d'or : un dossier « backup-… » n'existe QUE s'il est complet ──────
// Historique : la tâche planifiée s'exécutait fenêtre visible ; fermer cette
// console tuait Node par Ctrl+C (0xC000013A). Le process meurt alors SANS
// passer par le catch, donc l'export à moitié écrit restait sur place, avec un
// nom de sauvegarde valide et rien pour le distinguer d'une vraie. Sur 30
// dossiers, 15 étaient ainsi vides ou tronqués — un filet de sécurité qui
// mentait. On écrit désormais dans un dossier « .en-cours-… » renommé en
// « backup-… » seulement une fois l'export vérifié : quelle que soit la façon
// dont le script meurt (Ctrl+C, kill, coupure de courant), il ne peut plus
// laisser derrière lui une sauvegarde d'apparence saine.
const PREFIXE_TEMP = ".en-cours-";

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

// Dossier temporaire de l'export en cours (renommé en « backup-… » à la fin).
let dossierTemp = null;

// ── Alerte visible ─────────────────────────────────────────────────────────
// Un échec n'était signalé que dans _journal.log, que personne n'ouvre : les
// sauvegardes ont pu échouer des semaines sans que rien ne le dise. Un fichier
// sur le Bureau, lui, se remarque. Il est effacé dès qu'une sauvegarde réussit.
const fichierAlerte = () => join(
  process.env.USERPROFILE || "C:/Users/ADMIN", "Desktop", "⚠ SAUVEGARDE-EDUGEST-EN-ECHEC.txt",
);

function poserAlerte(raison) {
  try {
    writeFileSync(fichierAlerte(), [
      "SAUVEGARDE EDUGEST EN ECHEC",
      "",
      raison,
      "",
      "Les donnees de l'ecole ne sont PLUS sauvegardees.",
      "Relancer a la main :  node supabase/backup-donnees.mjs",
      "Etat des sauvegardes :  node supabase/verifier-sauvegardes.mjs",
      "",
      "Ce fichier disparait tout seul des qu'une sauvegarde reussit.",
    ].join("\r\n"), "utf8");
  } catch { /* le Bureau peut être redirigé : l'alerte est un plus, pas un dû */ }
}

const leverAlerte = () => { try { rmSync(fichierAlerte(), { force: true }); } catch { /* rien à lever */ } };

function nettoyerTemp() {
  if (!dossierTemp) return;
  try { rmSync(dossierTemp, { recursive: true, force: true }); } catch { /* best-effort */ }
  dossierTemp = null;
}

// Le chemin qui manquait : tué par Ctrl+C ou par la fermeture de session, Node
// ne passe PAS par le catch de main(). Sans ces handlers, l'export à moitié
// écrit survivait au processus.
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"]) {
  process.on(signal, () => {
    console.error(`\n⛔ Interrompu (${signal}) — export inachevé supprimé, AUCUNE sauvegarde.`);
    nettoyerTemp();
    poserAlerte(`Sauvegarde interrompue (${signal}) le ${new Date().toLocaleString("fr-FR")}.`);
    process.exit(130);
  });
}

// Relit ce qui vient d'être écrit : un fichier illisible ou tronqué doit être
// découvert MAINTENANT, pas le jour de la restauration.
function verifierExport(dir, manifest) {
  const anomalies = [];
  for (const [table, info] of Object.entries(manifest.tables)) {
    if (info.note) continue; // table absente de la base : rien à vérifier
    const fichier = join(dir, `${table}.json`);
    try {
      const lignes = JSON.parse(readFileSync(fichier, "utf8"));
      if (!Array.isArray(lignes)) anomalies.push(`${table} : contenu inattendu`);
      else if (lignes.length !== info.lignes) {
        anomalies.push(`${table} : ${lignes.length} lignes relues pour ${info.lignes} exportées`);
      }
    } catch (e) {
      anomalies.push(`${table} : illisible (${e.message})`);
    }
  }
  const attendues = TABLES.length;
  const traitees = Object.keys(manifest.tables).length;
  if (traitees !== attendues) anomalies.push(`${traitees} tables traitées sur ${attendues}`);
  return anomalies;
}

async function main() {
  const ts = new Date().toISOString().slice(0, 16).replace("T", "-").replace(":", "h");
  const base = process.env.EDUGEST_BACKUP_DIR || "C:/Users/ADMIN/edugest-backups";
  const dirFinal = join(base, `backup-${ts}`);
  const dir = join(base, `${PREFIXE_TEMP}${ts}`);
  mkdirSync(dir, { recursive: true });
  dossierTemp = dir;

  // Restes d'exécutions tuées avant l'ajout des garde-fous (> 6 h).
  try {
    for (const nom of readdirSync(base).filter((n) => n.startsWith(PREFIXE_TEMP))) {
      const chemin = join(base, nom);
      if (chemin !== dir && Date.now() - statSync(chemin).mtimeMs > 6 * 3600 * 1000) {
        rmSync(chemin, { recursive: true, force: true });
      }
    }
  } catch { /* pas bloquant */ }

  console.log(`🗄️  Sauvegarde EduGest → ${dirFinal}\n`);

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

  manifest.lignesTotales = total;
  manifest.complet = true; // n'est écrit que si toutes les tables sont passées
  writeFileSync(join(dir, "_manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

  // Contrôle d'intégrité AVANT de donner à l'export son nom de sauvegarde.
  const anomalies = verifierExport(dir, manifest);
  if (anomalies.length) {
    throw new Error(`export incohérent :\n     - ${anomalies.join("\n     - ")}`);
  }

  // Bascule atomique : c'est ici, et seulement ici, que la sauvegarde existe.
  renameSync(dir, dirFinal);
  dossierTemp = null;

  // Rétention : ne garder que les RETENTION sauvegardes les plus récentes.
  try {
    const anciennes = readdirSync(base).filter((n) => n.startsWith("backup-")).sort();
    const aSupprimer = anciennes.slice(0, Math.max(0, anciennes.length - RETENTION));
    for (const n of aSupprimer) rmSync(join(base, n), { recursive: true, force: true });
    if (aSupprimer.length) console.log(`   (rétention : ${aSupprimer.length} ancienne(s) sauvegarde(s) supprimée(s), ${RETENTION} conservées)`);
  } catch { /* pas bloquant */ }

  leverAlerte();
  console.log(`\n🎉 Sauvegarde terminée et vérifiée : ${total} lignes de données + ${authUsers.length} comptes auth.`);
  console.log(`   Dossier : ${dirFinal}`);
  console.log(`   ⤷ Copiez-le hors de ce PC (Google Drive, disque externe…) pour une vraie protection.`);
}

main().catch((e) => {
  console.error("❌", e.message || e);
  // L'export inachevé est supprimé, jamais promu : mieux vaut un trou visible
  // qu'une sauvegarde d'apparence saine sur laquelle on comptera le jour où
  // tout aura brûlé. L'alerte, elle, reste sur le Bureau jusqu'au prochain
  // succès — c'est ce qui manquait pour que les échecs se voient.
  nettoyerTemp();
  poserAlerte(`Echec de la sauvegarde du ${new Date().toLocaleString("fr-FR")} :\n${e.message || e}`);
  process.exit(1);
});
