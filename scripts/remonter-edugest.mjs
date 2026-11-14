// ════════════════════════════════════════════════════════════════════════
//  EduGest — Remonter toute l'école sur une machine avec Docker
// ════════════════════════════════════════════════════════════════════════
// Le plan de secours si Supabase, PowerSync ou Cloudflare disparaissent :
// depuis la dernière sauvegarde complète (supabase/backup-donnees.mjs), on
// remonte sur CETTE machine la même pile que la CI des tests e2e :
//   1. Supabase local (base + comptes + fichiers + Edge Functions), schéma
//      rebâti par les migrations du dépôt ;
//   2. les données de la copie, mots de passe compris ;
//   3. les fichiers de la messagerie ;
//   4. le service PowerSync (mode hors ligne) ;
//   5. l'application, servie sur http://127.0.0.1:4173.
// Chaque étape est chronométrée ; le rapport va dans <sauvegardes>/remontages.
//
//   node scripts/remonter-edugest.mjs [--sauvegarde <dossier backup-…>]
//                                     [--sans-powersync] [--sans-application]
//
// Prérequis : Docker Desktop démarré, Node 22, ce dépôt à jour. ⚠️ La base
// Supabase LOCALE de cette machine est remise à zéro (jamais la production).
import { spawn, spawnSync } from "node:child_process";
import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  SQL_TABLES_A_VIDER, compterLignesCopy, derniereSauvegardeComplete, ecartsComptes, lireEnv, preambuleRemontage,
} from "../supabase/sauvegarde-sql.mjs";

const RACINE = fileURLToPath(new URL("..", import.meta.url));
// Même CLI que la CI (supabase/setup-cli, ci.yml) : mêmes images, même schéma.
const CLI = "supabase@2.120.0";
const SERVICES_EXCLUS = "studio,imgproxy,logflare,vector,supavisor,realtime,postgres-meta";
const BASE_LOCALE = "supabase_db_edugest";
const KONG_LOCAL = "supabase_kong_edugest";
const POWERSYNC = "journeyapps/powersync-service:1.26.1";
const PORT_APPLICATION = 4173;
const SORTIE_APPLICATION = "dist-remontage";

const args = process.argv.slice(2);
const option = (nom) => args.includes(nom);
const valeur = (nom) => { const i = args.indexOf(nom); return i >= 0 ? args[i + 1] : null; };

const sauvegardes = process.env.EDUGEST_BACKUP_DIR || "C:/Users/ADMIN/edugest-backups";
const sauvegarde = valeur("--sauvegarde") || derniereSauvegardeComplete(sauvegardes);
if (!sauvegarde || !existsSync(join(sauvegarde, "base", "donnees.sql"))) {
  console.error(`❌ Aucune sauvegarde complète (base/donnees.sql) trouvée dans ${sauvegardes}.`);
  console.error("   Lancer d'abord : node supabase/backup-donnees.mjs (avec dbUrl dans config.local.mjs).");
  process.exit(1);
}
const manifeste = JSON.parse(readFileSync(join(sauvegarde, "_manifest.json"), "utf8"));

// ── Exécution des commandes ────────────────────────────────────────────────
// npx est un script .cmd sous Windows : il faut le shell. Docker, non (ses
// arguments SQL ne doivent pas passer par l'interprétation du shell).
function npx(cmd, { capturer = false, env } = {}) {
  const r = spawnSync(`npx --yes ${CLI} ${cmd}`, {
    cwd: RACINE, shell: true, encoding: "utf8", stdio: capturer ? "pipe" : "inherit", env: { ...process.env, ...env },
  });
  if (r.status !== 0) throw new Error(`supabase ${cmd} : échec (code ${r.status})${capturer ? `\n${r.stderr}` : ""}`);
  return r.stdout || "";
}

function docker(argsDocker, { capturer = true, tolerer = false } = {}) {
  const r = spawnSync("docker", argsDocker, { encoding: "utf8", stdio: capturer ? "pipe" : "inherit", maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw new Error(`docker introuvable : Docker Desktop est-il installé ? (${r.error.message})`);
  if (r.status !== 0 && !tolerer) throw new Error(`docker ${argsDocker[0]} : ${(r.stderr || "").trim().slice(0, 800)}`);
  return r.stdout || "";
}

// psql DANS le conteneur de la base locale, en superutilisateur (le seul qui
// puisse suspendre déclencheurs et clés étrangères le temps du versement).
const psqlArgs = ["exec", "-i", "-e", "PGPASSWORD=postgres", BASE_LOCALE,
  "psql", "-h", "127.0.0.1", "-U", "supabase_admin", "-d", "postgres", "-v", "ON_ERROR_STOP=1"];
const requete = (sql) => docker([...psqlArgs, "-AtF", "\t", "-c", sql]).trim();

// Verse le préambule puis la copie sur l'entrée de psql, en une transaction :
// tout passe, ou rien.
function verserCopie(fichier, preambule) {
  return new Promise((resolve, reject) => {
    const enfant = spawn("docker", [...psqlArgs, "-q", "--single-transaction"], { stdio: ["pipe", "inherit", "pipe"] });
    let erreurs = "";
    enfant.stderr.on("data", (d) => { erreurs += d; });
    enfant.on("error", reject);
    enfant.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`versement de la copie : ${erreurs.trim().slice(0, 1500)}`))));
    enfant.stdin.write(preambule);
    createReadStream(fichier).pipe(enfant.stdin);
  });
}

// ── Étapes chronométrées ───────────────────────────────────────────────────
const rapport = { debut: new Date().toISOString(), sauvegarde, dateSauvegarde: manifeste.date, etapes: [] };
async function etape(nom, travail) {
  const t0 = Date.now();
  console.log(`\n▶ ${nom}…`);
  try {
    const detail = await travail();
    const secondes = Math.round((Date.now() - t0) / 1000);
    rapport.etapes.push({ nom, secondes, ok: true, detail });
    console.log(`  ✔ ${nom} (${secondes} s)${detail ? ` — ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""}`);
    return detail;
  } catch (e) {
    rapport.etapes.push({ nom, secondes: Math.round((Date.now() - t0) / 1000), ok: false, erreur: e.message });
    throw e;
  }
}

function ecrireRapport() {
  rapport.fin = new Date().toISOString();
  rapport.secondesTotales = rapport.etapes.reduce((s, e) => s + e.secondes, 0);
  const dossier = join(sauvegardes, "remontages");
  mkdirSync(dossier, { recursive: true });
  const fichier = join(dossier, `remontage-${rapport.debut.slice(0, 16).replace(/[:T]/g, "-")}.json`);
  writeFileSync(fichier, JSON.stringify(rapport, null, 2), "utf8");
  return fichier;
}

async function main() {
  console.log(`🏗️  Remontage d'EduGest depuis ${sauvegarde}`);
  console.log(`   copie du ${manifeste.date}, migration ${manifeste.base?.migration || "?"}`);

  await etape("Docker", () => {
    docker(["info", "--format", "{{.ServerVersion}}"]);
    return "en marche";
  });

  // Les migrations du dépôt rebâtissent le schéma : elles doivent être au
  // moins au niveau de la copie (sinon des colonnes manqueraient).
  await etape("Migrations du dépôt", () => {
    const locales = readdirSync(join(RACINE, "supabase", "migrations")).filter((f) => f.endsWith(".sql")).map((f) => f.split("_")[0]).sort();
    const derniere = locales.at(-1);
    const copie = manifeste.base?.migration;
    if (copie && derniere < copie) throw new Error(`dépôt en retard (${derniere}) sur la copie (${copie}) : git pull d'abord`);
    return `dépôt ${derniere}, copie ${copie || "?"}`;
  });

  let env;
  await etape("Supabase local (base vierge + migrations)", () => {
    // stop --no-backup : repartir d'une base vide, jamais d'un reste d'essai.
    spawnSync(`npx --yes ${CLI} stop --no-backup`, { cwd: RACINE, shell: true, stdio: "inherit" });
    npx(`start -x ${SERVICES_EXCLUS}`);
    env = lireEnv(npx("status -o env", { capturer: true }));
    if (!env.API_URL || !env.SERVICE_ROLE_KEY) throw new Error("clés de la pile locale illisibles");
    return env.API_URL;
  });

  const fichierCopie = join(sauvegarde, "base", "donnees.sql");
  const attendus = compterLignesCopy(readFileSync(fichierCopie, "utf8"));
  await etape("Versement des données (mots de passe compris)", async () => {
    await verserCopie(fichierCopie, preambuleRemontage(requete(SQL_TABLES_A_VIDER)));
    return `${Object.values(attendus).reduce((s, n) => s + n, 0)} lignes`;
  });

  await etape("Contrôle ligne à ligne", () => {
    const tables = Object.keys(attendus);
    const sql = tables.map((t) => {
      const [schema, table] = t.split(".");
      return `select '${t}', count(*) from "${schema}"."${table}"`;
    }).join(" union all ");
    const trouves = Object.fromEntries(requete(sql).split(/\r?\n/).filter(Boolean)
      .map((l) => { const [t, n] = l.split("\t"); return [t, Number(n)]; }));
    const ecarts = ecartsComptes(attendus, trouves);
    if (ecarts.length) throw new Error(`écarts : ${ecarts.slice(0, 10).map((e) => `${e.table} ${e.trouve}/${e.attendu}`).join(", ")}`);
    return `${tables.length} tables identiques à la copie (dont ${trouves["auth.users"] || 0} comptes)`;
  });

  await etape("Fichiers de la messagerie", async () => {
    const sb = createClient(env.API_URL, env.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const miroir = join(dirname(sauvegarde), "fichiers");
    const objets = requete("select bucket_id, name, coalesce(metadata->>'mimetype', 'application/octet-stream') from storage.objects order by 1, 2")
      .split(/\r?\n/).filter(Boolean).map((l) => l.split("\t"));
    let remis = 0;
    const absents = [];
    for (const [compartiment, nom, type] of objets) {
      const chemin = join(miroir, compartiment, ...nom.split("/"));
      if (!existsSync(chemin)) { absents.push(nom); continue; }
      const { error } = await sb.storage.from(compartiment).upload(nom, readFileSync(chemin), { contentType: type, upsert: true });
      if (error) absents.push(nom); else remis += 1;
    }
    return `${remis}/${objets.length} remis${absents.length ? ` (${absents.length} absents du miroir)` : ""}`;
  });

  let powersync = "";
  if (!option("--sans-powersync")) {
    await etape("Service PowerSync (hors ligne)", async () => {
      requete("alter role powersync_role with login replication bypassrls password 'powersync-local'");
      const reseau = docker(["inspect", "-f", "{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}", BASE_LOCALE]).trim();
      docker(["rm", "-f", "powersync", "ps-stockage"], { tolerer: true });
      docker(["run", "-d", "--name", "ps-stockage", "--network", reseau,
        "-e", "POSTGRES_PASSWORD=stockage", "-e", "POSTGRES_DB=powersync_storage", "postgres:16"]);
      for (let i = 0; i < 60; i++) {
        if (spawnSync("docker", ["exec", "ps-stockage", "pg_isready", "-U", "postgres", "-q"]).status === 0) break;
        await new Promise((r) => setTimeout(r, 1000));
      }
      docker(["run", "-d", "--name", "powersync", "--network", reseau, "-p", "8080:8080",
        "-v", `${join(RACINE, "e2e", "powersync")}:/config:ro`, "-v", `${join(RACINE, "supabase")}:/regles:ro`,
        "-e", "POWERSYNC_CONFIG_PATH=/config/powersync.yaml",
        "-e", `PS_DATA_SOURCE_URI=postgresql://powersync_role:powersync-local@${BASE_LOCALE}:5432/postgres`,
        "-e", "PS_STORAGE_URI=postgresql://postgres:stockage@ps-stockage:5432/powersync_storage",
        "-e", `PS_SUPABASE_JWT_SECRET=${env.JWT_SECRET}`,
        "-e", `PS_JWKS_URI=http://${KONG_LOCAL}:8000/auth/v1/.well-known/jwks.json`,
        POWERSYNC, "start", "-r", "unified"]);
      for (let i = 0; i < 90; i++) {
        const ok = await fetch("http://127.0.0.1:8080/probes/liveness").then((r) => r.ok).catch(() => false);
        if (ok) { powersync = "http://127.0.0.1:8080"; return powersync; }
        await new Promise((r) => setTimeout(r, 2000));
      }
      throw new Error(`PowerSync injoignable :\n${docker(["logs", "--tail", "30", "powersync"], { tolerer: true })}`);
    });
  }

  if (!option("--sans-application")) {
    await etape("Application (build pointé sur la pile locale)", () => {
      const r = spawnSync(`npx vite build --mode supabase --outDir ${SORTIE_APPLICATION}`, {
        cwd: RACINE, shell: true, stdio: "inherit",
        env: {
          ...process.env,
          VITE_SUPABASE_URL: env.API_URL, VITE_SUPABASE_ANON_KEY: env.ANON_KEY,
          VITE_POWERSYNC_URL: powersync, VITE_SENTRY_DSN: "",
        },
      });
      if (r.status !== 0) throw new Error("build de l'application en échec");
      return SORTIE_APPLICATION;
    });
  }

  const fichier = ecrireRapport();
  console.log(`\n✅ EduGest remonté en ${rapport.secondesTotales} s (rapport : ${fichier}).`);
  for (const e of rapport.etapes) console.log(`   ${String(e.secondes).padStart(5)} s  ${e.nom}`);
  if (option("--sans-application")) return;
  console.log(`\n👉 Ouvrez http://127.0.0.1:${PORT_APPLICATION} et connectez-vous avec un VRAI compte de l'école :`);
  console.log("   son mot de passe habituel doit marcher. Ctrl+C pour arrêter l'application.\n");
  spawnSync(`npx vite preview --outDir ${SORTIE_APPLICATION} --port ${PORT_APPLICATION} --strictPort --host 127.0.0.1`, {
    cwd: RACINE, shell: true, stdio: "inherit",
  });
}

main().catch((e) => {
  const fichier = ecrireRapport();
  console.error(`\n❌ Remontage interrompu : ${e.message}`);
  console.error(`   Rapport : ${fichier}`);
  process.exit(1);
});
