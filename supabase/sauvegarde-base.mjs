// ── Sauvegarde COMPLÈTE de la base (pg_dump) et des fichiers déposés ───────
// Complète l'export JSON de backup-donnees.mjs, qui ne peut pas tout prendre :
// l'API ne livre ni les mots de passe hachés (auth.users), ni le contenu des
// fichiers de la messagerie (vocaux, pièces jointes). Ici :
//   • base/donnees.sql   : données de public, auth et storage (pg_dump), de
//                          quoi remonter l'école À L'IDENTIQUE, mots de passe
//                          compris (scripts/remonter-edugest.mjs) ;
//   • base/schema-public.sql : schéma de référence, pour comparer avec les
//                          migrations du dépôt ;
//   • ../fichiers/<compartiment>/… : miroir des fichiers, partagé par toutes
//                          les sauvegardes (un fichier n'est téléchargé qu'une
//                          fois : ils ne changent jamais une fois déposés).
// Sans adresse de base (SUPABASE_DB_URL) ou sans pg_dump, la copie complète
// est sautée et le manifeste le dit : l'export JSON reste fait.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { SCHEMAS_COPIES, TABLES_NON_COPIEES, compterLignesCopy, decouperUrl } from "./sauvegarde-sql.mjs";

const exe = (pgBin, nom) => join(pgBin, process.platform === "win32" ? `${nom}.exe` : nom);

// Lance un outil PostgreSQL ; renvoie sa sortie standard, lève s'il échoue.
function lancer(programme, args, { mdp }) {
  return new Promise((resolve, reject) => {
    const enfant = spawn(programme, args, { env: { ...process.env, PGPASSWORD: mdp, PGCONNECT_TIMEOUT: "30" } });
    let sortie = "";
    let erreurs = "";
    enfant.stdout.on("data", (d) => { sortie += d; });
    enfant.stderr.on("data", (d) => { erreurs += d; });
    enfant.on("error", reject);
    enfant.on("close", (code) => {
      if (code === 0) resolve(sortie);
      else reject(new Error(`${programme.split(/[\\/]/).pop()} (code ${code}) : ${erreurs.trim().slice(0, 500)}`));
    });
  });
}

// Copie de la base dans `dir`/base. Renvoie ce qui va au manifeste.
export async function sauvegarderBase(dir, { dbUrl, pgBin }) {
  if (!dbUrl) return { absente: "adresse de la base non configurée (dbUrl dans config.local.mjs)" };
  if (!existsSync(exe(pgBin, "pg_dump"))) return { absente: `pg_dump introuvable dans ${pgBin}` };
  const { url, mdp } = decouperUrl(dbUrl);
  const dossier = join(dir, "base");
  mkdirSync(dossier, { recursive: true });
  const donnees = join(dossier, "donnees.sql");
  const commun = ["--no-owner", "--no-privileges", "--quote-all-identifiers"];

  await lancer(exe(pgBin, "pg_dump"), [
    "--data-only", ...commun,
    ...SCHEMAS_COPIES.map((s) => `--schema=${s}`),
    ...TABLES_NON_COPIEES.map((t) => `--exclude-table=${t}`),
    `--file=${donnees}`, url,
  ], { mdp });
  await lancer(exe(pgBin, "pg_dump"), [
    "--schema-only", ...commun, "--schema=public", `--file=${join(dossier, "schema-public.sql")}`, url,
  ], { mdp });
  const migration = (await lancer(exe(pgBin, "psql"), [
    "-Atc", "select max(version) from supabase_migrations.schema_migrations", url,
  ], { mdp })).trim();

  // Relu tout de suite : une copie tronquée doit se voir aujourd'hui, pas le
  // jour du remontage.
  const comptes = compterLignesCopy(readFileSync(donnees, "utf8"));
  if (!("public.eleves" in comptes)) throw new Error("copie de la base sans la table des élèves");
  if (!comptes["auth.users"]) throw new Error("copie de la base sans les comptes (auth.users)");
  return { ok: true, octets: statSync(donnees).size, migration, lignes: comptes };
}

// Miroir des fichiers déposés (storage). `base` : dossier des sauvegardes.
// `sb` : client supabase-js en service_role (téléchargement).
export async function sauvegarderFichiers(base, { dbUrl, pgBin, sb }) {
  if (!dbUrl || !existsSync(exe(pgBin, "psql"))) return { absente: "copie complète non configurée" };
  const { url, mdp } = decouperUrl(dbUrl);
  const liste = (await lancer(exe(pgBin, "psql"), [
    "-AtF", "\t", "-c", "select bucket_id, name from storage.objects order by 1, 2", url,
  ], { mdp })).split(/\r?\n/).filter(Boolean).map((l) => l.split("\t"));

  const miroir = join(base, "fichiers");
  let nouveaux = 0;
  const manquants = [];
  for (const [compartiment, nom] of liste) {
    const chemin = join(miroir, compartiment, ...nom.split("/"));
    if (existsSync(chemin)) continue;
    const { data, error } = await sb.storage.from(compartiment).download(nom);
    if (error || !data) { manquants.push(`${compartiment}/${nom}`); continue; }
    mkdirSync(dirname(chemin), { recursive: true });
    writeFileSync(chemin, Buffer.from(await data.arrayBuffer()));
    nouveaux += 1;
  }
  return { ok: manquants.length === 0, total: liste.length, nouveaux, manquants: manquants.slice(0, 20), nbManquants: manquants.length };
}
