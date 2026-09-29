// ════════════════════════════════════════════════════════════════════════
//  EduGest — Contrôle des sauvegardes (répond : « suis-je protégé ? »)
// ════════════════════════════════════════════════════════════════════════
// Une sauvegarde qui échoue en silence est pire que pas de sauvegarde : on
// compte dessus. Ce script relit ce qui est sur le disque et répond par un
// code de sortie, donc il peut être branché sur une tâche planifiée ou lancé
// à la main avant une opération risquée (migration, clôture d'année).
//
//   node supabase/verifier-sauvegardes.mjs           (contrôle structurel)
//   node supabase/verifier-sauvegardes.mjs --profond (relit chaque JSON)
//
// Sortie 0 = protégé · 1 = trop ancienne ou aucune valide · 2 = dossier absent.
// Seuil d'ancienneté tolérée : EDUGEST_BACKUP_MAX_JOURS (défaut 3).
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.EDUGEST_BACKUP_DIR || "C:/Users/ADMIN/edugest-backups";
const MAX_JOURS = Number(process.env.EDUGEST_BACKUP_MAX_JOURS || 3);
const PROFOND = process.argv.includes("--profond");

const jours = (ms) => (Date.now() - ms) / 86400000;
const fr = (n) => n.toLocaleString("fr-FR");

// Une sauvegarde ne vaut que si son manifeste et ses fichiers se répondent.
function auditer(nom) {
  const dir = join(BASE, nom);
  const res = { nom, age: jours(statSync(dir).mtimeMs), valide: false, raisons: [], lignes: 0, tables: 0 };

  const cheminManifeste = join(dir, "_manifest.json");
  if (!existsSync(cheminManifeste)) { res.raisons.push("manifeste absent (export interrompu)"); return res; }
  if (!existsSync(join(dir, "_auth_users.json"))) res.raisons.push("comptes auth absents");

  let manifeste;
  try {
    manifeste = JSON.parse(readFileSync(cheminManifeste, "utf8"));
  } catch (e) { res.raisons.push(`manifeste illisible (${e.message})`); return res; }

  const tables = Object.entries(manifeste.tables || {});
  res.tables = tables.length;
  res.lignes = manifeste.lignesTotales ?? null;

  for (const [table, info] of tables) {
    if (info.note) continue; // table absente de la base : normal
    const fichier = join(dir, `${table}.json`);
    if (!existsSync(fichier)) { res.raisons.push(`${table}.json manquant`); continue; }
    if (!PROFOND) continue;
    try {
      const contenu = JSON.parse(readFileSync(fichier, "utf8"));
      if (contenu.length !== info.lignes) res.raisons.push(`${table} : ${contenu.length} lignes au lieu de ${info.lignes}`);
    } catch (e) { res.raisons.push(`${table} : illisible (${e.message})`); }
  }

  // `complet` n'existe que depuis l'ajout du contrôle d'intégrité ; les
  // sauvegardes antérieures sont jugées sur leurs seuls fichiers.
  if (manifeste.complet === false) res.raisons.push("marquée incomplète");
  if (res.lignes === null) res.lignes = tables.reduce((s, [, i]) => s + (i.lignes || 0), 0);

  res.valide = res.raisons.length === 0;
  return res;
}

if (!existsSync(BASE)) {
  console.error(`❌ Dossier de sauvegardes introuvable : ${BASE}`);
  process.exit(2);
}

const dossiers = readdirSync(BASE).filter((n) => n.startsWith("backup-")).sort().reverse();
if (!dossiers.length) {
  console.error(`❌ AUCUNE sauvegarde dans ${BASE}`);
  process.exit(1);
}

const audits = dossiers.map(auditer);
const valides = audits.filter((a) => a.valide);
const douteuses = audits.filter((a) => !a.valide);

console.log(`🔎 ${audits.length} sauvegarde(s) dans ${BASE}${PROFOND ? " (contrôle profond)" : ""}\n`);
for (const a of audits.slice(0, 12)) {
  const etat = a.valide ? "✅" : "❌";
  const detail = a.valide
    ? `${a.tables} tables · ${fr(a.lignes)} lignes`
    : a.raisons.slice(0, 2).join(" ; ") + (a.raisons.length > 2 ? ` (+${a.raisons.length - 2})` : "");
  console.log(`  ${etat} ${a.nom.padEnd(26)} ${Math.floor(a.age)} j   ${detail}`);
}
if (audits.length > 12) console.log(`  … ${audits.length - 12} plus anciennes`);

console.log(`\n   valides : ${valides.length}   ·   inutilisables : ${douteuses.length}`);

const derniere = valides[0];
if (!derniere) {
  console.error("\n❌ AUCUNE sauvegarde exploitable. Les données ne sont pas protégées.");
  process.exit(1);
}

const age = Math.floor(derniere.age);
console.log(`   dernière valide : ${derniere.nom} (${age} jour${age > 1 ? "s" : ""}, ${fr(derniere.lignes)} lignes)`);

if (derniere.age > MAX_JOURS) {
  console.error(`\n❌ La dernière sauvegarde valide a ${age} jours (seuil : ${MAX_JOURS}).`);
  process.exit(1);
}
console.log("\n✅ Données protégées.");
