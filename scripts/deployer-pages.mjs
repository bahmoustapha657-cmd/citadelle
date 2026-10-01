// Déploiement MANUEL de secours vers Cloudflare Pages (`npm run deploy:pages`).
//
// La voie normale est GitHub Actions : onglet Actions → « CI » → Run workflow
// sur master (cf. docs/deploiement.md). Ce script ne sert que si GitHub est
// indisponible.
//
// Garde-fou : l'ancien script publiait l'ARBRE DE TRAVAIL tel quel
// (`--commit-dirty=true`), branche de travail et modifications non commitées
// comprises. Désormais on refuse de déployer autre chose que master, propre et
// identique à origin/master — c'est-à-dire exactement ce que la CI déploierait.
import { execFileSync, execSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { fichiersModifiesPertinents, lireStatutGit } from "./version-build.mjs";

export function verifierEtatDepot({ branche, modifies, head, origine }) {
  const erreurs = [];
  if (branche !== "master") {
    erreurs.push(`branche courante « ${branche || "?"} » : on ne déploie que master.`);
  }
  if (modifies.length) {
    const apercu = modifies.slice(0, 5).join(", ") + (modifies.length > 5 ? ", …" : "");
    erreurs.push(`${modifies.length} fichier(s) modifié(s) ou non suivi(s) : ${apercu}`);
  }
  if (!origine) {
    erreurs.push("origin/master introuvable (le git fetch a-t-il échoué ?).");
  } else if (head !== origine) {
    erreurs.push(`master local (${(head || "?").slice(0, 7)}) ≠ origin/master (${origine.slice(0, 7)}) : git pull (ou git push) d'abord.`);
  }
  return erreurs;
}

function git(args) {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}

function main() {
  git(["fetch", "--quiet", "origin", "master"]);
  const etat = {
    branche: git(["rev-parse", "--abbrev-ref", "HEAD"]),
    modifies: fichiersModifiesPertinents(lireStatutGit()),
    head: git(["rev-parse", "HEAD"]),
    origine: git(["rev-parse", "--verify", "--quiet", "origin/master"]),
  };
  const erreurs = verifierEtatDepot(etat);
  if (erreurs.length) {
    console.error("\n✖ Déploiement refusé :");
    for (const e of erreurs) console.error("  - " + e);
    console.error("\nVoie normale : GitHub → Actions → « CI » → Run workflow (branche master).\n");
    process.exit(1);
  }

  console.log(`→ Déploiement de secours du commit ${etat.head.slice(0, 7)} (master = origin/master)`);
  execSync("npm run build:supabase", { stdio: "inherit" });
  // --commit-dirty=true : seulement pour taire l'avertissement de wrangler,
  // déclenché par .claude/ ; la propreté réelle a été vérifiée ci-dessus.
  execSync(
    `npx --yes wrangler@4 pages deploy dist --project-name=edugest-gn --branch=master --commit-hash=${etat.head} --commit-dirty=true`,
    { stdio: "inherit" },
  );
  console.log("\nVérifier : https://edugest-gn.pages.dev/version.json");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
