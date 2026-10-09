// La copie de la logique métier dans les Edge Functions (scripts/partager-edge.mjs)
// doit rester IDENTIQUE à src/ : sinon le paiement en ligne imputerait avec
// d'autres règles que la caisse.
import assert from "node:assert/strict";
import test from "node:test";
import { ecarts, genererCopies } from "../scripts/partager-edge.mjs";

test("la copie pour les Edge Functions est à jour (sinon : npm run partager:edge)", () => {
  assert.deepEqual(ecarts(), []);
});

test("la copie ne change que les extensions d'import, pour Deno", () => {
  const copies = genererCopies();
  const versements = copies.get("supabase/functions/_shared/app/src/versements.js");
  assert.match(versements, /from "\.\/mensualite-utils\.ts"/, "x.js → x.ts quand le fichier réel est en TypeScript");
  assert.match(versements, /^\/\/ GÉNÉRÉ par scripts\/partager-edge\.mjs/);
  // Aucun module de la copie ne dépend d'un paquet ni du navigateur au chargement.
  for (const [chemin, contenu] of copies) {
    assert.doesNotMatch(contenu, /from\s+["'](?!\.)/, `${chemin} importe un paquet`);
    assert.doesNotMatch(contenu, /import\.meta\.env/, `${chemin} lit l'environnement Vite`);
  }
});
