// File hors ligne (PowerSync) : une session expirée n'est pas un refus de la
// donnée. Les écritures attendent la reconnexion au lieu d'être jetées —
// auparavant un 401 (jeton périmé après plusieurs jours hors ligne) ou un
// envoi parti avec la clé anonyme (rafraîchissement du jeton raté) passait
// pour un « refus définitif » et la saisie était perdue.
import test from "node:test";
import assert from "node:assert/strict";
import { estErreurPassagere, estErreurSession, exigerSession } from "../src/backend/powersync/envoi-operation.js";

test("jeton refusé ou expiré : erreur de session, donc passagère", () => {
  for (const err of [
    { message: "JWT expired", code: "PGRST301", status: 401 },
    { message: "Unauthorized", status: 401 },
    { message: "JWT expired" },
    { message: "No suitable key or wrong key type", code: "PGRST301" },
    { message: "Anonymous access is disabled", code: "PGRST302" },
  ]) {
    assert.equal(estErreurSession(err), true, err.message);
    assert.equal(estErreurPassagere(err), true, err.message);
  }
});

test("un vrai refus reste définitif", () => {
  for (const err of [
    { message: "new row violates row-level security policy", code: "42501", status: 403 },
    { message: "violates foreign key constraint", code: "23503", status: 409 },
    { message: "internal error", status: 500 },
  ]) {
    assert.equal(estErreurSession(err), false, err.message);
    assert.equal(estErreurPassagere(err), false, err.message);
  }
});

const client = (reponse) => ({ auth: { getSession: async () => reponse } });

test("pas de session utilisable : l'envoi attend (erreur passagère), sinon il part", async () => {
  await exigerSession(client({ data: { session: { access_token: "jeton" } }, error: null }));
  for (const reponse of [
    { data: { session: null }, error: null },
    { data: { session: null }, error: { message: "Invalid Refresh Token: Refresh Token Not Found" } },
  ]) {
    const err = await exigerSession(client(reponse)).then(() => null, (e) => e);
    assert.ok(err, "doit lever");
    assert.equal(estErreurPassagere(err), true);
  }
});
