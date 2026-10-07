import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

// Garde-fou client de la fuite entre familles : l'Edge push refuse la cible
// « parent » sans eleveId (droits.ts, refusParents). Un écran qui l'oublie
// n'enverrait plus rien — chaque appel doit donc nommer l'élève concerné.
const SRC = fileURLToPath(new URL("../src/", import.meta.url));

function fichiers(dossier) {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((e) => {
    const chemin = join(dossier, e.name);
    if (e.isDirectory()) return fichiers(chemin);
    return /\.(js|jsx)$/.test(e.name) ? [chemin] : [];
  });
}

// Appels envoyerPush(["parent"], …) / envoyerPush?.(["parent"], …), jusqu'au
// `);` qui les clôt (aucun des textes envoyés n'en contient).
function appelsParents() {
  const appels = [];
  for (const f of fichiers(SRC)) {
    const src = readFileSync(f, "utf8");
    const motif = /envoyerPush(?:\?\.)?\(\s*\[\s*"parent"\s*\]/g;
    let m;
    while ((m = motif.exec(src))) {
      const fin = src.indexOf(");", m.index);
      appels.push({ fichier: f.slice(SRC.length), appel: src.slice(m.index, fin + 2) });
    }
  }
  return appels;
}

test("chaque push aux parents nomme l'élève concerné (eleveId)", () => {
  const appels = appelsParents();
  // mensualités (3) + versement, discipline, réponse aux parents, signalement
  assert.ok(appels.length >= 7, `appels trouvés : ${appels.length}`);
  for (const { fichier, appel } of appels) {
    assert.match(appel, /eleveId/, `${fichier} : ${appel.slice(0, 120)}…`);
  }
});

test("push-supabase.js transmet eleveId à l'Edge", () => {
  const src = readFileSync(new URL("../src/backend/push-supabase.js", import.meta.url), "utf8");
  assert.match(src, /export async function envoyerPush\(cibles, titre, corps, url = "\/", \{ eleveId = null \} = \{\}\)/);
  assert.match(src, /body: \{ schoolId: sid, cibles, titre, corps, url, \.\.\.\(eleveId \? \{ eleveId \} : \{\}\) \}/);
  const api = readFileSync(new URL("../src/components/app/app-shell-api.js", import.meta.url), "utf8");
  assert.match(api, /envoyerPushSupabase\(cibles, titre, corps, url, options\)/);
  const shell = readFileSync(new URL("../src/components/app/use-app-shell.js", import.meta.url), "utf8");
  assert.match(shell, /envoyerPushApi\(cibles, titre, corps, url, options\)/);
});
