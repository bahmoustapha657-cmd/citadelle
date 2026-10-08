// Crée supabase/migrations/<AAAAMMJJHHMMSS>_<nom>.sql (horodatage UTC, comme
// la CLI Supabase) : `npm run migration:nouvelle -- notes-coefficient`.
import { writeFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function nomDeMigration(nom, date = new Date()) {
  const propre = String(nom || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (!propre) throw new Error("Nom de migration manquant : npm run migration:nouvelle -- <nom>");
  const horodatage = date.toISOString().replace(/[-:T]/g, "").slice(0, 14);
  return `${horodatage}_${propre}.sql`;
}

const MODELE = (fichier) => `-- ${fichier}
-- Pourquoi : <le problème réglé, en une ou deux phrases>
--
-- Règles (docs/migrations-sql.md) :
--  - appliquée UNE fois, dans l'ordre, par la CI au déploiement — jamais à
--    la main dans l'éditeur SQL ;
--  - compatible avec le front encore en ligne (ajouter avant de retirer) ;
--  - ne jamais modifier une migration déjà fusionnée : en écrire une autre.

`;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const fichier = nomDeMigration(process.argv.slice(2).join(" "));
  const chemin = `supabase/migrations/${fichier}`;
  if (existsSync(chemin)) throw new Error(`${chemin} existe déjà`);
  writeFileSync(chemin, MODELE(fichier));
  console.log(`Créée : ${chemin}`);
}
