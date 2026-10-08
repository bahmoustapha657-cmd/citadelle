import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { retirerAbonnementNavigateur } from "../src/backend/push-navigateur.js";

// Appareil partagé : à la déconnexion, la ligne push_subs de CE navigateur
// est retirée puis le navigateur se désabonne (auth-supabase.js, signOut).
const ADRESSE = "https://push.exemple/abonnement-de-ce-navigateur";

function monter({ abonne = true, session = { user: { id: "u1" } }, suppression = null } = {}) {
  const journal = [];
  const sub = abonne ? { endpoint: ADRESSE, unsubscribe: async () => { journal.push("unsubscribe"); return true; } } : null;
  const navigateur = {
    serviceWorker: { getRegistration: async () => ({ pushManager: { getSubscription: async () => sub } }) },
  };
  const filtres = [];
  const requete = {
    eq(col, val) {
      filtres.push([col, val]);
      if (filtres.length < 2) return requete;
      journal.push("delete");
      return suppression ? suppression() : Promise.resolve({ error: null });
    },
  };
  const sb = {
    auth: { getSession: async () => ({ data: { session } }) },
    from(table) {
      journal.push(`from:${table}`);
      return { delete: () => requete };
    },
  };
  return { journal, filtres, sb, navigateur };
}

test("retire SA ligne portant l'adresse de ce navigateur, puis se désabonne", async () => {
  const m = monter();
  await retirerAbonnementNavigateur(m);
  assert.deepEqual(m.journal, ["from:push_subs", "delete", "unsubscribe"]);
  // jamais toutes les lignes du compte : il peut être abonné sur un autre appareil
  assert.deepEqual(m.filtres, [["user_id", "u1"], ["subscription->>endpoint", ADRESSE]]);
});

test("navigateur non abonné, ou sans service worker : rien à faire", async () => {
  const m = monter({ abonne: false });
  await retirerAbonnementNavigateur(m);
  assert.deepEqual(m.journal, []);
  const sansSw = monter();
  await retirerAbonnementNavigateur({ ...sansSw, navigateur: {} });
  await retirerAbonnementNavigateur({ ...sansSw, navigateur: undefined });
  assert.deepEqual(sansSw.journal, []);
});

test("session déjà perdue : pas de suppression, mais le désabonnement a lieu", async () => {
  const m = monter({ session: null });
  await retirerAbonnementNavigateur(m);
  assert.deepEqual(m.journal, ["unsubscribe"]);
});

test("hors ligne (suppression en échec) : le navigateur se désabonne quand même", async () => {
  const m = monter({ suppression: () => Promise.reject(new TypeError("Failed to fetch")) });
  await assert.rejects(retirerAbonnementNavigateur(m), /Failed to fetch/);
  assert.deepEqual(m.journal, ["from:push_subs", "delete", "unsubscribe"]);
});

test("signOut : désabonnement borné, AVANT la révocation de la session", () => {
  const src = readFileSync(new URL("../src/backend/auth-supabase.js", import.meta.url), "utf8");
  const fn = src.slice(src.indexOf("export async function signOut()"));
  const course = fn.indexOf("await Promise.race([seDesabonnerDesPush(), new Promise((fin) => setTimeout(fin, DELAI_DESABONNEMENT))])");
  assert.ok(course > 0, "seDesabonnerDesPush en course avec un délai");
  assert.ok(course < fn.indexOf("await sb.auth.signOut()"), "avant sb.auth.signOut()");
  assert.match(src, /const DELAI_DESABONNEMENT = \d+;/);
  const push = readFileSync(new URL("../src/backend/push-supabase.js", import.meta.url), "utf8");
  assert.match(push, /retirerAbonnementNavigateur\(\{ sb: getSupabase\(\), navigateur: globalThis\.navigator \}\)/);
  // l'échec du désabonnement n'empêche jamais la déconnexion
  assert.match(push, /export async function seDesabonnerDesPush\(\) \{\r?\n {2}try \{[\s\S]*?\} catch \{/);
});
