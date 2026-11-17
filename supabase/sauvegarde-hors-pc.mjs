// ════════════════════════════════════════════════════════════════════════
//  EduGest — Sauvegarde HORS DU PC (lancée chaque nuit par GitHub Actions)
// ════════════════════════════════════════════════════════════════════════
// Prépare dans <sortie> la copie CHIFFRÉE du jour, que le workflow envoie
// ensuite dans Google Drive (.github/workflows/sauvegarde-hors-pc.yml) :
//
//   <sortie>/sauvegardes/backup-<date>/_manifest.json.chiffre
//                                     donnees.sql.gz.chiffre     (pg_dump : données,
//                                     schema-public.sql.gz.chiffre  comptes ET mots de passe)
//   <sortie>/fichiers/<compartiment>/<nom>.chiffre             (seulement les NOUVEAUX)
//
// Pour le workflow (GITHUB_OUTPUT) : nom = backup-<date>, illisibles = nombre
// de fichiers déposés illisibles (la base part quand même, l'alerte vient après).
//
// Aucune dépendance npm (fetch et node:crypto seulement) : la tâche qui
// détient les secrets de la production n'installe aucun paquet.
//
// Chiffrée avec les clés PUBLIQUES de supabase/cles-sauvegarde.txt : cette
// machine ne peut pas relire ce qu'elle produit, seules les clés privées
// des détenteurs le peuvent (scripts/dechiffrer-sauvegarde.mjs).
//
//   node supabase/sauvegarde-hors-pc.mjs <sortie> <deja-dans-drive.txt>
//
// <deja-dans-drive.txt> : fichiers déjà rangés dans Drive (rclone lsf -R
// --files-only), pour ne télécharger chaque fichier déposé qu'une fois : ils
// ne changent jamais une fois déposés.
//
// Le journal d'un dépôt public est public : on n'y écrit que des tailles et
// des nombres de fichiers, jamais de contenu ni de compte de lignes.
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { chiffrer, lireFichierCles } from "./chiffrage-sauvegarde.mjs";
import { listerFichiers, sauvegarderBase } from "./sauvegarde-base.mjs";

const ICI = dirname(fileURLToPath(import.meta.url));
const [sortie, listeDeja] = process.argv.slice(2);
// .trim() : un secret collé avec un retour à la ligne final reste valable.
const DB_URL = (process.env.SUPABASE_DB_URL || "").trim();
const SUPABASE_URL = (process.env.SUPABASE_URL || "").trim();
const SERVICE_ROLE = (process.env.SUPABASE_SERVICE_ROLE || "").trim();
const PG_BIN = process.env.EDUGEST_PG_BIN || "/usr/lib/postgresql/17/bin";
const FICHIER_CLES = process.env.EDUGEST_CLES_PUBLIQUES || join(ICI, "cles-sauvegarde.txt");

const mo = (octets) => `${(octets / 1e6).toFixed(1)} Mo`;
const deux = (n) => String(n).padStart(2, "0");

// Comme supabase-js storage.download : GET /storage/v1/object/<compartiment>/<nom>.
async function telecharger(compartiment, nom) {
  const chemin = [compartiment, ...nom.split("/")].map(encodeURIComponent).join("/");
  try {
    const r = await fetch(`${SUPABASE_URL.replace(/\/+$/, "")}/storage/v1/object/${chemin}`, {
      headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
      signal: AbortSignal.timeout(120_000),
    });
    return r.ok ? Buffer.from(await r.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

async function main() {
  if (!sortie || !listeDeja) throw new Error("usage : node supabase/sauvegarde-hors-pc.mjs <sortie> <deja-dans-drive.txt>");
  if (!DB_URL || !SUPABASE_URL || !SERVICE_ROLE) throw new Error("SUPABASE_DB_URL, SUPABASE_URL et SUPABASE_SERVICE_ROLE sont requis");
  const cles = lireFichierCles(readFileSync(FICHIER_CLES, "utf8"));
  console.log(`🔐 ${cles.length} détenteur(s) de clé`);

  const d = new Date();
  const nom = `backup-${d.getUTCFullYear()}-${deux(d.getUTCMonth() + 1)}-${deux(d.getUTCDate())}-${deux(d.getUTCHours())}h${deux(d.getUTCMinutes())}`;
  const dossierCopie = join(sortie, "sauvegardes", nom);
  mkdirSync(dossierCopie, { recursive: true });

  // 1. La base (pg_dump), dans un dossier temporaire effacé aussitôt après.
  const temp = mkdtempSync(join(tmpdir(), "edugest-"));
  let base;
  try {
    base = await sauvegarderBase(temp, { dbUrl: DB_URL, pgBin: PG_BIN });
    if (!base.ok) throw new Error(`copie de la base impossible : ${base.absente || "raison inconnue"}`);
    for (const fichier of ["donnees.sql", "schema-public.sql"]) {
      const chiffre = chiffrer(gzipSync(readFileSync(join(temp, "base", fichier))), cles);
      writeFileSync(join(dossierCopie, `${fichier}.gz.chiffre`), chiffre);
      console.log(`  ✅ ${fichier.padEnd(20)} ${mo(chiffre.length)} chiffrés`);
    }
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }

  // 2. Les fichiers déposés qui ne sont pas encore dans Drive.
  const deja = new Set(readFileSync(listeDeja, "utf8").split(/\r?\n/).map((l) => l.trim()).filter(Boolean));
  const tous = await listerFichiers({ dbUrl: DB_URL, pgBin: PG_BIN });
  let nouveaux = 0;
  let octets = 0;
  const illisibles = [];
  for (const [compartiment, nomFichier] of tous) {
    if (deja.has(`${compartiment}/${nomFichier}.chiffre`)) continue;
    const contenu = await telecharger(compartiment, nomFichier);
    if (!contenu) { illisibles.push(`${compartiment}/${nomFichier}`); continue; }
    const chiffre = chiffrer(contenu, cles);
    const chemin = join(sortie, "fichiers", compartiment, ...`${nomFichier}.chiffre`.split("/"));
    mkdirSync(dirname(chemin), { recursive: true });
    writeFileSync(chemin, chiffre);
    nouveaux += 1;
    octets += chiffre.length;
  }
  console.log(`  ✅ fichiers déposés    ${tous.length} au total, ${nouveaux} nouveaux (${mo(octets)})${illisibles.length ? `, ${illisibles.length} illisibles` : ""}`);

  // 3. Le manifeste (chiffré : il contient le nombre de lignes de chaque table).
  const manifeste = {
    date: d.toISOString(), complet: true, horsPc: true, base,
    fichiers: { ok: illisibles.length === 0, total: tous.length, nouveaux, nbManquants: illisibles.length, manquants: illisibles.slice(0, 20) },
  };
  writeFileSync(join(dossierCopie, "_manifest.json.chiffre"), chiffrer(Buffer.from(JSON.stringify(manifeste, null, 2)), cles));
  if (!existsSync(join(dossierCopie, "donnees.sql.gz.chiffre"))) throw new Error("copie chiffrée absente");
  // Un fichier déposé illisible n'empêche pas d'envoyer la base : le
  // workflow l'envoie d'abord, puis signale l'alerte (job en rouge).
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `nom=${nom}\nillisibles=${illisibles.length}\n`);
  console.log(`🎉 ${nom} prête à partir dans Drive`);
}

main().catch((e) => {
  console.error(`❌ ${e.message}`);
  process.exit(1);
});
