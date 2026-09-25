// Réglages de la fiche ÉCOLE : un refus de la RLS n'est plus pris pour un succès.
//
// Défaut d'origine (2026-09-25) : le comptable n'a pas le droit de modifier la
// fiche école (policy ecoles_update, postes.sql § 8). Sous RLS, un UPDATE
// refusé ne lève aucune erreur, il modifie zéro ligne — le bouton « Bloquer
// l'accès parents » et la monnaie affichaient donc un succès sans rien écrire.
// Ses deux réglages passent désormais par la RPC maj_reglages_compta
// (supabase/reglages-compta.sql, sondes dans test-rls-postes.mjs), et les
// mises à jour directes échouent bruyamment. Ici : le VRAI data-supabase.js
// face à un faux client Supabase.
//
// Il faut les mocks de modules du test runner :
//   node --import tsx --experimental-test-module-mocks --test tests/reglages-ecole.test.js
// Sans ce drapeau (npm test), le test est ignoré.
import test, { mock } from "node:test";
import assert from "node:assert/strict";

const ignore = typeof mock.module !== "function"
  && "mocks de modules absents : lancer avec --experimental-test-module-mocks";

const etat = {
  ecole: { id: "ec1", code: "citadelle", extra: { monnaie: "GNF" } },
  rlsRefuse: false,
  rpcErreur: null,
  updates: [],
  rpcs: [],
};

// Faux client Supabase : juste les appels des écritures de la fiche école.
const fauxClient = {
  from: () => ({
    select: () => ({
      eq: (_col, code) => ({
        maybeSingle: async () => ({
          data: code === etat.ecole.code ? { id: etat.ecole.id, extra: etat.ecole.extra } : null,
          error: null,
        }),
      }),
    }),
    update: (patch) => ({
      eq: () => ({
        select: async () => {
          etat.updates.push(patch);
          // La RLS n'oppose pas d'erreur : elle ignore la ligne refusée.
          if (etat.rlsRefuse) return { data: [], error: null };
          Object.assign(etat.ecole, patch);
          return { data: [{ id: etat.ecole.id }], error: null };
        },
      }),
    }),
  }),
  rpc: async (nom, args) => {
    etat.rpcs.push({ nom, args });
    if (etat.rpcErreur) return { data: null, error: { message: etat.rpcErreur } };
    return { data: args.p_champs, error: null };
  },
};

async function monter() {
  const url = (chemin) => new URL(chemin, import.meta.url).href;
  mock.module(url("../src/supabaseClient.js"), {
    namedExports: { getSupabase: () => fauxClient },
  });
  mock.module(url("../src/backend/powersync/tables.js"), {
    namedExports: { powerSyncConfigured: false, estCouvertHorsLigne: () => false },
  });
  return import("../src/backend/data-supabase.js");
}

test("fiche école : écritures autorisées, refusées, et réglages de la compta", { skip: ignore }, async (t) => {
  const { sauverParametresEcole, majVerrou, majReglagesCompta } = await monter();

  await t.test("Paramètres autorisés : extra FUSIONNÉ, succès", async () => {
    assert.deepEqual(await sauverParametresEcole("citadelle", { triEleves: "nom" }), { ok: true });
    assert.deepEqual(etat.ecole.extra, { monnaie: "GNF", triEleves: "nom" });
  });

  await t.test("refus de la RLS (zéro ligne) : erreur explicite, pas de faux succès", async () => {
    etat.rlsRefuse = true;
    await assert.rejects(sauverParametresEcole("citadelle", { monnaie: "XOF" }), /Enregistrement refusé/);
    await assert.rejects(majVerrou("citadelle", "primaire", true), /Enregistrement refusé/);
    assert.equal(etat.ecole.extra.monnaie, "GNF");
    etat.rlsRefuse = false;
  });

  await t.test("réglages de la compta : la RPC, jamais un update direct", async () => {
    etat.updates = [];
    const enregistre = await majReglagesCompta({ blocageParentImpaye: true });
    assert.deepEqual(etat.rpcs.at(-1), {
      nom: "maj_reglages_compta",
      args: { p_champs: { blocageParentImpaye: true } },
    });
    assert.deepEqual(enregistre, { blocageParentImpaye: true });
    assert.equal(etat.updates.length, 0);
  });

  await t.test("réglages de la compta : le refus du serveur remonte tel quel", async () => {
    etat.rpcErreur = "Droits insuffisants : réservé à la comptabilité.";
    await assert.rejects(majReglagesCompta({ monnaie: "XOF" }), /Droits insuffisants/);
    etat.rpcErreur = null;
  });
});
