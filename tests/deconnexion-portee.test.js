// Portée des déconnexions : sans argument, `auth.signOut()` de supabase-js
// ferme la session du compte sur TOUS ses appareils (`scope: "global"`). Se
// déconnecter du téléphone, ou une connexion interrompue par le réseau,
// mettait ainsi dehors le PC du même compte une heure plus tard au plus, sans
// explication. Chaque appel doit donc dire quels appareils il ferme.
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = fileURLToPath(new URL("../src", import.meta.url));

function fichiers(dossier) {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) return fichiers(chemin);
    return /\.(js|jsx|ts|tsx)$/.test(nom) ? [chemin] : [];
  });
}

// Tous les appels `….auth.signOut(…)` de l'app, avec leur argument.
const appels = fichiers(SRC).flatMap((chemin) => {
  const texte = readFileSync(chemin, "utf8");
  return [...texte.matchAll(/\.auth\.signOut\(([^)]*)\)/g)]
    .map((m) => ({ fichier: chemin.slice(SRC.length + 1).replace(/\\/g, "/"), argument: m[1].trim() }));
});

test("chaque auth.signOut() précise sa portée", () => {
  assert.ok(appels.length >= 8, "appels trouvés");
  const sansPortee = appels.filter((a) => !a.argument).map((a) => a.fichier);
  assert.deepEqual(sansPortee, [], "signOut() sans argument = tous les appareils du compte déconnectés");
});

test("seuls les changements de mot de passe ferment les AUTRES appareils", () => {
  const autres = appels.filter((a) => a.argument !== "CET_APPAREIL");
  assert.deepEqual(autres.map((a) => `${a.fichier} ${a.argument}`).sort(), [
    // Mot de passe changé par son titulaire : les autres appareils dehors, lui reste.
    'backend/account-manage-supabase.js { scope: "others" }',
    // Mot de passe oublié puis remplacé : tout le monde ressaisit le nouveau.
    'backend/password-reset-supabase.js { scope: "global" }',
  ]);
  const auth = readFileSync(join(SRC, "backend/auth-supabase.js"), "utf8");
  assert.match(auth, /export const CET_APPAREIL = \{ scope: "local" \};/);
});
