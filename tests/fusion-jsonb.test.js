// Fusion des jsonb (extra/details) : la file hors ligne et les écritures en
// ligne n'envoient plus le jsonb entier, mais les chemins qui changent. Deux
// postes qui encaissent chacun un mois du même élève ne s'effacent plus.
import test from "node:test";
import assert from "node:assert/strict";
import { appliquerOperations, operationsChamps, operationsDiff } from "../src/backend/fusion-jsonb.js";
import { envoyerOperation } from "../src/backend/powersync/envoi-operation.js";
import { EcritureSansEffet } from "../src/backend/ecritures-refusees.js";
import { AppSchema } from "../src/backend/powersync/schema.js";

test("diff : seules les feuilles changées, en profondeur ; retrait des clés disparues", () => {
  const avant = { mens: { Oct: "Payé", Nov: "Impayé" }, acompte: 5, tags: [1, 2], vieux: true };
  const apres = { mens: { Oct: "Payé", Nov: "Payé" }, acompte: 5, tags: [1, 2, 3], neuf: { a: null } };
  assert.deepEqual(operationsDiff(avant, apres), [
    { chemin: ["vieux"] },
    { chemin: ["mens", "Nov"], valeur: "Payé" },
    { chemin: ["tags"], valeur: [1, 2, 3] },
    { chemin: ["neuf"], valeur: { a: null } },
  ]);
  assert.deepEqual(operationsDiff(avant, structuredClone(avant)), []);
});

test("deux postes encaissent deux mois différents : les deux restent", () => {
  const serveur = { mens: { Oct: "Impayé", Nov: "Impayé" }, archives: { "2025-2026": { ok: true } } };
  // Poste A : encaisse Octobre sur sa copie ; poste B : Novembre sur la sienne.
  const opsA = operationsDiff(serveur, { ...serveur, mens: { ...serveur.mens, Oct: "Payé" } });
  const opsB = operationsDiff(serveur, { ...serveur, mens: { ...serveur.mens, Nov: "Payé" } });
  const final = appliquerOperations(appliquerOperations(serveur, opsA), opsB);
  assert.deepEqual(final, { mens: { Oct: "Payé", Nov: "Payé" }, archives: { "2025-2026": { ok: true } } });
});

test("appliquer : crée les parents manquants, retirer un chemin absent ne casse rien", () => {
  assert.deepEqual(appliquerOperations(null, [{ chemin: ["a", "b"], valeur: 1 }]), { a: { b: 1 } });
  assert.deepEqual(appliquerOperations({ a: 2 }, [{ chemin: ["a", "b"], valeur: 1 }]), { a: { b: 1 } });
  assert.deepEqual(appliquerOperations({ a: 2 }, [{ chemin: ["x", "y"] }]), { a: 2 });
  assert.deepEqual(operationsChamps({ a: 1, b: undefined, c: null }), [
    { chemin: ["a"], valeur: 1 }, { chemin: ["c"], valeur: null },
  ]);
});

// Faux client supabase-js : update (avec .eq) et rpc.
function fauxClient({ update = { error: null, count: 1 }, rpc = { data: true, error: null } } = {}) {
  const appels = [];
  return {
    appels,
    from: (table) => ({
      update: (patch, opts) => {
        const p = Promise.resolve({ ...update });
        return Object.assign(p, { eq: (col, val) => { appels.push(["update", table, patch, opts, val]); return p; } });
      },
    }),
    rpc: async (nom, args) => { appels.push(["rpc", nom, args]); return { ...rpc }; },
  };
}

test("file hors ligne : PATCH avec valeur précédente → diff fusionnée en base, colonnes à part", async () => {
  const sb = fauxClient();
  await envoyerOperation(sb, { op: "PATCH", table: "eleves", id: "e1" }, {
    patch: { statut: "Actif", extra: { mens: { Oct: "Payé", Nov: "Payé" } } },
    precedent: { extra: { mens: { Oct: "Payé", Nov: "Impayé" } } },
  });
  assert.deepEqual(sb.appels, [
    ["update", "eleves", { statut: "Actif" }, { count: "exact" }, "e1"],
    ["rpc", "fusionner_jsonb", {
      p_table: "eleves", p_id: "e1", p_colonne: "extra",
      p_operations: [{ chemin: ["mens", "Nov"], valeur: "Payé" }],
    }],
  ]);

  // Salaires : la colonne s'appelle details.
  const s2 = fauxClient();
  await envoyerOperation(s2, { op: "PATCH", table: "salaires", id: "s1" }, {
    patch: { details: { prime: 10 } }, precedent: { details: null },
  });
  assert.equal(s2.appels[0][2].p_colonne, "details");
});

test("file hors ligne : rien de changé dans le jsonb → aucune requête ; refus RLS → EcritureSansEffet", async () => {
  const rien = fauxClient();
  await envoyerOperation(rien, { op: "PATCH", table: "eleves", id: "e1" }, {
    patch: { extra: { a: 1 } }, precedent: { extra: { a: 1 } },
  });
  assert.deepEqual(rien.appels, []);

  const refus = fauxClient({ rpc: { data: false, error: null } });
  await assert.rejects(envoyerOperation(refus, { op: "PATCH", table: "eleves", id: "e1" }, {
    patch: { extra: { a: 2 } }, precedent: { extra: { a: 1 } },
  }), EcritureSansEffet);

  const coupure = fauxClient({ rpc: { data: null, error: { message: "Service Unavailable" }, status: 503 } });
  const e = await envoyerOperation(coupure, { op: "PATCH", table: "eleves", id: "e1" }, {
    patch: { extra: { a: 2 } }, precedent: { extra: { a: 1 } },
  }).catch((x) => x);
  assert.equal(e.status, 503);
});

test("file hors ligne : opération sans valeur précédente (mise en file avant) → envoi entier comme avant", async () => {
  const sb = fauxClient();
  await envoyerOperation(sb, { op: "PATCH", table: "eleves", id: "e1" }, { patch: { extra: { a: 1 } } });
  assert.deepEqual(sb.appels, [["update", "eleves", { extra: { a: 1 } }, { count: "exact" }, "e1"]]);
});

test("schéma local : les tables à extra/details gardent la valeur précédente du jsonb", () => {
  const tables = Object.fromEntries(AppSchema.tables.map((t) => [t.name, t]));
  assert.deepEqual(tables.eleves.trackPrevious, { columns: ["extra"] });
  assert.deepEqual(tables.salaires.trackPrevious, { columns: ["details"] });
  assert.equal(tables.notes.trackPrevious, false);
});
