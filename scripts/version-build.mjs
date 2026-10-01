// Identité du build : quel commit, depuis quelle branche, arbre propre ou non.
// Lue par vite.config.js (embarquée dans l'app + publiée en /version.json) et
// par scripts/deployer-pages.mjs (garde-fou du déploiement manuel).
//
// Pourquoi : avant, rien dans l'app en ligne ne disait de quel commit elle
// venait. Un build fait depuis une branche de travail est resté ~12 h en
// production (2026-09-24) sans que personne ne le voie.
import { execFileSync } from "node:child_process";

function git(args) {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

// Sortie BRUTE de `git status --porcelain` : surtout pas de trim(), qui
// mangerait l'espace de tête de la 1re ligne (« XY chemin » → chemin décalé).
export function lireStatutGit() {
  try {
    return execFileSync("git", ["status", "--porcelain"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return "";
  }
}

// Fichiers modifiés / non suivis d'après `git status --porcelain`, hors
// .claude/ (réglages locaux de Claude Code, jamais embarqués dans le bundle).
export function fichiersModifiesPertinents(porcelain) {
  return String(porcelain || "")
    .split("\n")
    .map((ligne) => ligne.trimEnd())
    .filter(Boolean)
    .map((ligne) => ligne.slice(3).replace(/^"|"$/g, ""))
    .filter((chemin) => !chemin.startsWith(".claude/"));
}

export function decrireVersion({ commit, branche, modifies = [], date }) {
  const sha = commit || "inconnu";
  const propre = modifies.length === 0;
  return {
    commit: sha,
    // « +modifs » : le build contient du travail non commité → introuvable
    // dans l'historique git. Ne doit jamais apparaître en production.
    court: sha.slice(0, 7) + (propre ? "" : "+modifs"),
    branche: branche || "",
    propre,
    date,
  };
}

export function lireVersionBuild(env = process.env) {
  return decrireVersion({
    commit: git(["rev-parse", "HEAD"]) || env.GITHUB_SHA,
    // En CI (actions/checkout), HEAD est détaché : la branche vient de l'env.
    branche: env.GITHUB_REF_NAME || git(["rev-parse", "--abbrev-ref", "HEAD"]),
    modifies: fichiersModifiesPertinents(lireStatutGit()),
    date: new Date().toISOString(),
  });
}
