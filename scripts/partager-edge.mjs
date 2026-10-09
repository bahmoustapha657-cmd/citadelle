// ════════════════════════════════════════════════════════════════════════
//  Copie la logique métier PURE de l'app vers les Edge Functions
// ════════════════════════════════════════════════════════════════════════
// Le paiement en ligne s'impute côté serveur avec EXACTEMENT les règles de la
// caisse (reste dû, ordre d'encaissement, acomptes, journal). Plutôt que de
// les réécrire en TypeScript — deux versions qui finiraient par diverger —
// on copie les modules de src/ dans supabase/functions/_shared/app/, en
// gardant leur arborescence relative.
//
// Seule adaptation : Deno exige l'extension réelle d'un import (Vite et tsx
// acceptent « ./x.js » pour un fichier x.ts) ; les chemins sont corrigés dans
// la copie. Aucun autre changement.
//
//   npm run partager:edge            (régénère)
//   npm run partager:edge -- --verifier  (sortie 1 si la copie est périmée)
//
// tests/partage-edge.test.js fait échouer la CI si src/ a bougé sans que la
// copie soit régénérée.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DOSSIER_COPIE = "supabase/functions/_shared/app";

// Points d'entrée : les modules dont les Edge Functions ont besoin. Leurs
// dépendances relatives suivent automatiquement.
export const ENTREES = [
  "src/versements.js",
  "src/paiements-scolarite.js",
  "src/mensualite-utils.ts",
  "src/backend/collection-map.js",
  "src/components/comptabilite/paiements-journal.js",
];

const IMPORTS = /((?:import|export)\s[^;]*?from\s+|import\(\s*)(["'])(\.{1,2}\/[^"']+)\2/g;

function resoudre(depuis, spec) {
  const base = path.resolve(path.dirname(depuis), spec);
  for (const c of [base, base.replace(/\.js$/, ".ts"), `${base}.js`, `${base}.ts`]) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  throw new Error(`Import introuvable dans ${path.relative(RACINE, depuis)} : ${spec}`);
}

// Fichiers à copier → contenu adapté, clés = chemin de la copie (relatif à
// la racine du dépôt, séparateurs « / »).
export function genererCopies(racine = RACINE) {
  const copies = new Map();
  const aTraiter = ENTREES.map((e) => path.resolve(racine, e));
  const vus = new Set();
  while (aTraiter.length) {
    const fichier = aTraiter.pop();
    if (vus.has(fichier)) continue;
    vus.add(fichier);
    const relatif = path.relative(racine, fichier).split(path.sep).join("/");
    const source = fs.readFileSync(fichier, "utf8").replace(/\r\n/g, "\n");
    const adapte = source.replace(IMPORTS, (tout, avant, guillemet, spec) => {
      const cible = resoudre(fichier, spec);
      aTraiter.push(cible);
      let reel = path.relative(path.dirname(fichier), cible).split(path.sep).join("/");
      if (!reel.startsWith(".")) reel = `./${reel}`;
      return `${avant}${guillemet}${reel}${guillemet}`;
    });
    const entete = `// GÉNÉRÉ par scripts/partager-edge.mjs depuis ${relatif} — ne pas modifier ici.\n`;
    copies.set(`${DOSSIER_COPIE}/${relatif}`, entete + adapte);
  }
  return copies;
}

// Fichiers présents dans la copie (pour retirer ceux qui n'ont plus lieu d'être).
function existants(racine) {
  const dossier = path.join(racine, DOSSIER_COPIE);
  if (!fs.existsSync(dossier)) return [];
  const out = [];
  const parcourir = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) parcourir(p); else out.push(path.relative(racine, p).split(path.sep).join("/"));
    }
  };
  parcourir(dossier);
  return out;
}

// Écarts entre la copie attendue et le disque : [{ chemin, raison }].
export function ecarts(racine = RACINE) {
  const attendues = genererCopies(racine);
  const liste = [];
  for (const [chemin, contenu] of attendues) {
    const p = path.join(racine, chemin);
    if (!fs.existsSync(p)) liste.push({ chemin, raison: "absente" });
    else if (fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n") !== contenu) liste.push({ chemin, raison: "périmée" });
  }
  for (const chemin of existants(racine)) if (!attendues.has(chemin)) liste.push({ chemin, raison: "en trop" });
  return liste;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--verifier")) {
    const liste = ecarts();
    for (const { chemin, raison } of liste) console.error(`${raison} : ${chemin}`);
    if (liste.length) { console.error("→ npm run partager:edge"); process.exit(1); }
    console.log("Copie à jour.");
  } else {
    const attendues = genererCopies();
    for (const chemin of existants(RACINE)) if (!attendues.has(chemin)) fs.rmSync(path.join(RACINE, chemin));
    for (const [chemin, contenu] of attendues) {
      fs.mkdirSync(path.dirname(path.join(RACINE, chemin)), { recursive: true });
      fs.writeFileSync(path.join(RACINE, chemin), contenu);
    }
    console.log(`${attendues.size} fichier(s) copiés dans ${DOSSIER_COPIE}`);
  }
}
