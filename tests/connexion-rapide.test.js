// Connexion sur réseau faible (auth-supabase.js) : l'app s'ouvre sur le compte
// mémorisé sans attendre le réseau, une vérification qui échoue faute de
// réseau ne déconnecte plus, et le miroir hors ligne d'un AUTRE compte est
// purgé avant l'ouverture. Client Supabase, backend.js et client PowerSync
// sont simulés ; proprietaire.js et supabase-js (erreurs) sont les vrais.
//
// Il faut les mocks de modules du test runner :
//   node --import tsx --experimental-test-module-mocks --test tests/connexion-rapide.test.js
// `npm test` le passe. Sans ce drapeau, le test est ignoré.
import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { AuthRetryableFetchError } from "@supabase/supabase-js";

const ignore = typeof mock.module !== "function"
  && "mocks de modules absents : lancer avec --experimental-test-module-mocks";

const stock = new Map();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (k) => (stock.has(k) ? stock.get(k) : null),
    setItem: (k, v) => stock.set(k, String(v)),
    removeItem: (k) => stock.delete(k),
  },
});

const LIGNE = {
  id: "c1", user_id: "u1", login: "dg", nom: "Directeur", role: "direction",
  ecole_id: "ec1", extra: {}, poste: { id: "p1", cle: "direction", label: "Direction", permissions: { compta: "w" }, actif: true },
};
const session = (uid = "u1") => ({ user: { id: uid } });

const etat = {};
function raz() {
  stock.clear();
  Object.assign(etat, {
    sessionEnregistree: "u1",
    getSession: async () => ({ data: { session: session() }, error: null }),
    ligne: LIGNE,
    reseauCoupe: false,
    requetes: [],
    appels: [],
    ecouteurs: [],
  });
}
raz();

const requete = (table) => {
  const q = {
    select: () => q,
    eq: () => q,
    maybeSingle: async () => {
      etat.requetes.push(table);
      if (etat.reseauCoupe) return { data: null, error: { message: "TypeError: Failed to fetch" } };
      if (table === "comptes") return { data: etat.ligne, error: null };
      return { data: { code: "citadelle" }, error: null };
    },
  };
  return q;
};
const faux = {
  from: requete,
  // État public de l'école, lu par ecoleLogin avant la connexion : active.
  rpc: async () => ({ data: [{ nom: "La Citadelle", code: "citadelle", actif: true, supprime: false }], error: null }),
  auth: {
    getSession: () => etat.getSession(),
    onAuthStateChange: (cb) => {
      etat.ecouteurs.push(cb);
      return { data: { subscription: { unsubscribe() {} } } };
    },
    signInWithPassword: async () => ({ data: { user: { id: "u1" } }, error: null }),
    signOut: async () => { etat.appels.push("signOut"); return { error: null }; },
  },
};

async function monter() {
  const url = (chemin) => new URL(chemin, import.meta.url).href;
  mock.module(url("../src/supabaseClient.js"), {
    namedExports: { getSupabase: () => faux, uidSessionEnregistree: () => etat.sessionEnregistree },
  });
  mock.module(url("../src/backend.js"), {
    namedExports: {
      isSupabase: true,
      emailFor: (login, code) => `${login}.${code}@edugest.app`,
      superadminEmailFor: (login) => `${login}@superadmin.edugest.app`,
    },
  });
  mock.module(url("../src/backend/powersync/tables.js"), { namedExports: { powerSyncConfigured: true } });
  mock.module(url("../src/backend/powersync/client.js"), {
    namedExports: {
      effacerMiroir: async () => {
        etat.appels.push("effacerMiroir");
        stock.delete("LC_powersync_proprietaire");
      },
    },
  });
  return import("../src/backend/auth-supabase.js");
}

const tic = () => new Promise((r) => setTimeout(r, 5));
const suivre = () => {
  const recus = [];
  return { recus, cb: (u) => recus.push(u) };
};

test("connexion sur réseau faible", { skip: ignore }, async (t) => {
  const { watchAuthState, ecoleLogin } = await monter();

  // Compte tel que chargerCompte le construit pour LIGNE (via une vraie connexion).
  raz();
  const { data: { compte: COMPTE } } = await ecoleLogin({ login: "dg", mdp: "x", schoolId: "citadelle" });
  assert.equal(COMPTE.uid, "u1");
  assert.equal(COMPTE.schoolId, "citadelle");
  const memoriser = () => stock.set("LC_compte_session", JSON.stringify(COMPTE));

  await t.test("démarrage : le compte mémorisé s'affiche AVANT la réponse du réseau", async () => {
    raz(); memoriser();
    let repondre;
    etat.getSession = () => new Promise((r) => { repondre = r; });
    const { recus, cb } = suivre();
    const fini = watchAuthState(cb);
    await tic();
    assert.deepEqual(recus, [COMPTE], "ouvert sans attendre getSession");
    repondre({ data: { session: session() }, error: null });
    await fini; await tic();
    assert.equal(recus.length, 1, "vérification identique : pas de second rendu");
    assert.deepEqual(etat.requetes, ["comptes"], "code école connu : pas de requête ecoles");
  });

  await t.test("vérification en échec faute de réseau : PAS de déconnexion", async () => {
    raz(); memoriser();
    etat.reseauCoupe = true;
    const { recus, cb } = suivre();
    await watchAuthState(cb); await tic();
    assert.deepEqual(recus, [COMPTE]);
    assert.ok(stock.has("LC_compte_session"), "compte mémorisé conservé");
  });

  await t.test("jeton expiré hors ligne (getSession en erreur réseau) : l'app reste ouverte", async () => {
    raz(); memoriser();
    etat.getSession = async () => ({ data: { session: null }, error: new AuthRetryableFetchError("Failed to fetch", 0) });
    const { recus, cb } = suivre();
    await watchAuthState(cb); await tic();
    assert.deepEqual(recus, [COMPTE]);
  });

  await t.test("sans compte mémorisé et sans réseau : écran de connexion", async () => {
    raz();
    etat.reseauCoupe = true;
    const { recus, cb } = suivre();
    await watchAuthState(cb);
    assert.deepEqual(recus, [null]);
  });

  await t.test("session terminée : déconnexion et compte oublié", async () => {
    raz(); memoriser();
    etat.getSession = async () => ({ data: { session: null }, error: null });
    const { recus, cb } = suivre();
    await watchAuthState(cb);
    assert.deepEqual(recus, [COMPTE, null]);
    assert.equal(stock.has("LC_compte_session"), false);
  });

  await t.test("compte supprimé ou poste désactivé (réponse serveur) : déconnexion", async () => {
    raz(); memoriser();
    etat.ligne = { ...LIGNE, poste: { ...LIGNE.poste, actif: false } };
    const { recus, cb } = suivre();
    await watchAuthState(cb); await tic();
    assert.deepEqual(recus, [COMPTE, null]);
  });

  await t.test("session d'un autre compte que le compte mémorisé : pas d'ouverture d'office", async () => {
    raz(); memoriser();
    etat.sessionEnregistree = "u9";
    let repondre;
    etat.getSession = () => new Promise((r) => { repondre = r; });
    const { recus, cb } = suivre();
    const fini = watchAuthState(cb);
    await tic();
    assert.deepEqual(recus, [], "attend la vérification");
    repondre({ data: { session: null }, error: null });
    await fini;
    assert.deepEqual(recus, [null]);
  });

  await t.test("événements : INITIAL_SESSION et SIGNED_IN ne relisent pas le compte", async () => {
    raz(); memoriser();
    const { recus, cb } = suivre();
    await watchAuthState(cb); await tic();
    const avant = etat.requetes.length;
    const ecouter = etat.ecouteurs.at(-1);
    ecouter("INITIAL_SESSION", session());
    ecouter("SIGNED_IN", session());
    await tic();
    assert.equal(etat.requetes.length, avant, "aucune requête de plus");
    assert.deepEqual(recus, [COMPTE]);
    ecouter("TOKEN_REFRESHED", session());
    await tic();
    assert.equal(etat.requetes.length, avant + 1, "le renouvellement du jeton revérifie le compte");
    ecouter("SIGNED_OUT", null);
    await tic();
    assert.deepEqual(recus, [COMPTE, null]);
  });

  await t.test("première connexion levée : le compte mémorisé suit", async () => {
    raz(); memoriser();
    const { ajusterCompteMemorise } = await import("../src/backend/auth-supabase.js");
    ajusterCompteMemorise("u9", { premiereCo: false });
    assert.equal(stock.get("LC_compte_session"), JSON.stringify(COMPTE), "autre compte : rien");
    ajusterCompteMemorise("u1", { premiereCo: false });
    assert.equal(JSON.parse(stock.get("LC_compte_session")).premiereCo, false);
  });

  await t.test("connexion d'un autre compte sur l'appareil : miroir purgé AVANT l'ouverture", async () => {
    raz();
    stock.set("LC_powersync_proprietaire", "u0");
    const r = await ecoleLogin({ login: "dg", mdp: "x", schoolId: "citadelle" });
    assert.equal(r.ok, true);
    assert.deepEqual(etat.appels, ["effacerMiroir"]);
    assert.ok(stock.has("LC_compte_session"), "compte mémorisé pour le prochain démarrage");
  });

  await t.test("même compte qui revient : miroir gardé", async () => {
    raz();
    stock.set("LC_powersync_proprietaire", "u1");
    await ecoleLogin({ login: "dg", mdp: "x", schoolId: "citadelle" });
    assert.deepEqual(etat.appels, []);
  });

  await t.test("réseau coupé juste après le mot de passe : message clair, session fermée", async () => {
    raz();
    etat.reseauCoupe = true;
    const r = await ecoleLogin({ login: "dg", mdp: "x", schoolId: "citadelle" });
    assert.equal(r.ok, false);
    assert.match(r.data.error, /connexion internet/);
    assert.ok(etat.appels.includes("signOut"));
  });
});
