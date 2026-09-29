// Mot de passe oublié : le lien reçu par e-mail mène enfin à l'écran de
// nouveau mot de passe.
//
// Défaut d'origine (2026-09-26) : l'e-mail portait l'action_link de Supabase
// Auth (/auth/v1/verify?…&redirect_to=…). Sans l'app dans les « Redirect
// URLs » du projet, Supabase redirigeait vers la « Site URL »
// (http://localhost:3000 par défaut) : le lien ne menait nulle part. Et ce
// GET consommait le jeton — l'analyseur de liens d'une messagerie suffisait à
// l'expirer, l'app affichant alors l'accueil sans un mot. Désormais le lien
// pointe sur l'app (#type=recovery&token_hash=…), le jeton n'est échangé
// qu'au clic « Enregistrer », et un lien refusé est annoncé.
//
// La partie « client Supabase » demande les mocks de modules du test runner :
//   node --import tsx --experimental-test-module-mocks --test tests/password-reset.test.js
// Sans ce drapeau (npm test), seule cette partie est ignorée.
import test, { mock } from "node:test";
import assert from "node:assert/strict";
import {
  analyserRetourRecovery, estErreurReseau, identiteCompte, messageErreurRecovery,
} from "../src/backend/recovery-url.js";

test("lien actuel : jeton dans le fragment, échangé plus tard", () => {
  assert.deepEqual(
    analyserRetourRecovery({ hash: "#type=recovery&token_hash=pkce_abc%2B1", search: "" }),
    { mode: "otp", tokenHash: "pkce_abc+1" },
  );
  // Même jeton passé en paramètre de requête (gabarit d'e-mail Supabase).
  assert.deepEqual(
    analyserRetourRecovery({ hash: "", search: "?token_hash=abc&type=recovery" }),
    { mode: "otp", tokenHash: "abc" },
  );
});

test("anciens liens déjà envoyés : session dans le fragment", () => {
  assert.deepEqual(
    analyserRetourRecovery({
      search: "?recovery=1",
      hash: "#access_token=AT&expires_in=3600&refresh_token=RT&token_type=bearer&type=recovery",
    }),
    { mode: "session", accessToken: "AT", refreshToken: "RT" },
  );
});

test("lien refusé par Supabase Auth : annoncé, plus l'accueil muet", () => {
  assert.deepEqual(
    analyserRetourRecovery({
      search: "?recovery=1",
      hash: "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
    }),
    { mode: "erreur", code: "otp_expired" },
  );
  assert.deepEqual(analyserRetourRecovery({ search: "?recovery=1", hash: "" }), { mode: "erreur", code: "lien_incomplet" });
});

test("navigation ordinaire : pas d'écran de récupération", () => {
  assert.equal(analyserRetourRecovery({ hash: "", search: "" }), null);
  assert.equal(analyserRetourRecovery({ hash: "", search: "?school=citadelle" }), null);
  assert.equal(analyserRetourRecovery({ hash: "#token_hash=abc", search: "" }), null);
  assert.equal(analyserRetourRecovery({ hash: "#access_token=AT&refresh_token=RT", search: "" }), null);
  assert.equal(analyserRetourRecovery(), null);
});

test("identifiant rappelé : métadonnées, sinon l'e-mail interne", () => {
  assert.deepEqual(
    identiteCompte({ email: "x.y@edugest.app", user_metadata: { login: "parent.diallo", schoolId: "citadelle" } }),
    { login: "parent.diallo", schoolId: "citadelle" },
  );
  // Identifiant avec un point : le code école (sans point) est le dernier segment.
  assert.deepEqual(
    identiteCompte({ email: "parent.diallo.la-citadelle@edugest.app", user_metadata: {} }),
    { login: "parent.diallo", schoolId: "la-citadelle" },
  );
  assert.deepEqual(identiteCompte({ email: "admin@superadmin.edugest.app" }), { login: "", schoolId: "" });
  assert.deepEqual(identiteCompte(null), { login: "", schoolId: "" });
});

test("messages : réseau, lien expiré, mot de passe refusé", () => {
  const reseau = { name: "AuthRetryableFetchError", status: 0, message: "Failed to fetch" };
  assert.equal(estErreurReseau(reseau), true);
  assert.match(messageErreurRecovery(reseau, "lien"), /Connexion au serveur impossible/);
  assert.match(messageErreurRecovery(reseau, "mdp"), /Connexion au serveur impossible/);

  const expire = { name: "AuthApiError", status: 403, code: "otp_expired", message: "Token has expired or is invalid" };
  assert.equal(estErreurReseau(expire), false);
  assert.match(messageErreurRecovery(expire, "lien"), /expiré ou a déjà été utilisé/);

  assert.match(messageErreurRecovery({ status: 422, code: "same_password" }, "mdp"), /différent de l'ancien/);
  assert.match(messageErreurRecovery({ status: 422, code: "weak_password" }, "mdp"), /trop faible/);
  assert.equal(
    messageErreurRecovery({ status: 500, message: "boom" }, "mdp"),
    "Impossible d'enregistrer le mot de passe : boom",
  );
});

// ── Client Supabase (mocks de modules) ─────────────────────────────────────
const ignore = typeof mock.module !== "function"
  && "mocks de modules absents : lancer avec --experimental-test-module-mocks";

const USER = { id: "u1", email: "parent.diallo.citadelle@edugest.app", user_metadata: {} };
const etat = { clients: 0, appels: [], verifyErreur: null, updateErreurs: [] };

function fauxClientEphemere() {
  etat.clients += 1;
  return {
    auth: {
      verifyOtp: async (params) => {
        etat.appels.push(["verifyOtp", params]);
        return etat.verifyErreur
          ? { data: { user: null, session: null }, error: etat.verifyErreur }
          : { data: { user: USER, session: { access_token: "AT" } }, error: null };
      },
      setSession: async (params) => {
        etat.appels.push(["setSession", params]);
        return { data: { user: USER, session: { access_token: params.access_token } }, error: null };
      },
      updateUser: async (params) => {
        etat.appels.push(["updateUser", params]);
        return { data: { user: USER }, error: etat.updateErreurs.shift() || null };
      },
      signOut: async () => { etat.appels.push(["signOut"]); return { error: null }; },
    },
    from: (table) => ({
      update: (patch) => ({
        eq: async (col, val) => { etat.appels.push(["update", table, patch, col, val]); return { error: null }; },
      }),
    }),
  };
}

async function monter() {
  const url = (chemin) => new URL(chemin, import.meta.url).href;
  mock.module(url("../src/supabaseClient.js"), {
    namedExports: {
      getSupabase: () => { throw new Error("la récupération ne doit pas toucher le client de l'app"); },
      creerClientEphemere: fauxClientEphemere,
    },
  });
  return import("../src/backend/password-reset-supabase.js");
}

const noms = () => etat.appels.map((a) => a[0]);
const raz = () => Object.assign(etat, { clients: 0, appels: [], verifyErreur: null, updateErreurs: [] });

test("enregistrement : jeton échangé au clic, une seule fois", { skip: ignore }, async (t) => {
  const { creerRecuperation } = await monter();

  await t.test("succès : vérifie, enregistre, lève premiere_co, ferme la session", async () => {
    raz();
    const compte = await creerRecuperation({ mode: "otp", tokenHash: "th" }).enregistrer("Nouveau123");
    assert.deepEqual(compte, { login: "parent.diallo", schoolId: "citadelle" });
    assert.deepEqual(noms(), ["verifyOtp", "updateUser", "update", "signOut"]);
    assert.deepEqual(etat.appels[0][1], { type: "recovery", token_hash: "th" });
    assert.deepEqual(etat.appels[2], ["update", "comptes", { premiere_co: false }, "user_id", "u1"]);
  });

  await t.test("mot de passe refusé : le lien n'est pas re-vérifié au nouvel essai", async () => {
    raz();
    etat.updateErreurs = [{ status: 422, code: "same_password" }];
    const recuperation = creerRecuperation({ mode: "otp", tokenHash: "th" });
    await assert.rejects(recuperation.enregistrer("Ancien123"), (e) => /différent de l'ancien/.test(e.message) && !e.lienInvalide);
    await recuperation.enregistrer("Nouveau123");
    assert.deepEqual(noms(), ["verifyOtp", "updateUser", "updateUser", "update", "signOut"]);
    assert.equal(etat.clients, 1);
  });

  await t.test("deux « Enregistrer » simultanés : un seul échange du jeton", async () => {
    raz();
    const recuperation = creerRecuperation({ mode: "otp", tokenHash: "th" });
    await Promise.all([recuperation.enregistrer("Nouveau123"), recuperation.enregistrer("Nouveau123")]);
    assert.equal(noms().filter((n) => n === "verifyOtp").length, 1);
    assert.equal(etat.clients, 1);
  });

  await t.test("lien expiré : signalé comme tel, rien d'enregistré", async () => {
    raz();
    etat.verifyErreur = { name: "AuthApiError", status: 403, code: "otp_expired" };
    await assert.rejects(
      creerRecuperation({ mode: "otp", tokenHash: "th" }).enregistrer("Nouveau123"),
      (e) => e.lienInvalide === true && /expiré/.test(e.message),
    );
    assert.deepEqual(noms(), ["verifyOtp"]);
  });

  await t.test("réseau coupé : ni lien grillé ni lien déclaré invalide", async () => {
    raz();
    etat.verifyErreur = { name: "AuthRetryableFetchError", status: 0 };
    const recuperation = creerRecuperation({ mode: "otp", tokenHash: "th" });
    await assert.rejects(recuperation.enregistrer("Nouveau123"), (e) => e.lienInvalide === false);
    etat.verifyErreur = null;
    await recuperation.enregistrer("Nouveau123");
    assert.deepEqual(noms(), ["verifyOtp", "verifyOtp", "updateUser", "update", "signOut"]);
  });

  await t.test("ancien lien : la session du fragment est reprise telle quelle", async () => {
    raz();
    await creerRecuperation({ mode: "session", accessToken: "AT", refreshToken: "RT" }).enregistrer("Nouveau123");
    assert.deepEqual(etat.appels[0], ["setSession", { access_token: "AT", refresh_token: "RT" }]);
  });
});
