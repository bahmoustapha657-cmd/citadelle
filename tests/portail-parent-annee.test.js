// Portail parent : les notes se lisent dans l'année officielle de l'école.
// Sans ce filtre, bulletins et moyennes mélangeaient l'année close et
// l'année en cours (La Citadelle : 8 956 notes, toutes de 2025-2026,
// affichées en 2026-2027).
//
// Il faut les mocks de modules du test runner :
//   node --import tsx --experimental-test-module-mocks --test tests/portail-parent-annee.test.js
import test, { mock } from "node:test";
import assert from "node:assert/strict";

const ignore = typeof mock.module !== "function"
  && "mocks de modules absents : lancer avec --experimental-test-module-mocks";

test("les notes du parent sont filtrées par l'année de l'école", { skip: ignore }, async () => {
  const filtres = [];
  const NOTES = [
    { id: "n1", eleve_id: "e1", annee: "2025-2026", note: 12 },
    { id: "n2", eleve_id: "e1", annee: "2026-2027", note: 8 },
  ];
  // Requête PostgREST minimale : enregistre les .eq() et filtre les notes.
  const requete = (table) => {
    const eq = {};
    const q = {
      select: () => q, in: () => q, order: () => q, limit: () => q,
      eq: (col, val) => { eq[col] = val; filtres.push(`${table}.${col}=${val}`); return q; },
      range: async () => ({
        data: table === "notes" ? NOTES.filter((n) => !eq.annee || n.annee === eq.annee) : [],
        error: null,
      }),
      then: (ok) => ok({ data: table === "eleves" ? [{ id: "e1", nom: "BAH" }] : [], error: null }),
    };
    return q;
  };
  const m = mock.module(new URL("../src/supabaseClient.js", import.meta.url).href, {
    namedExports: { getSupabase: () => ({ from: requete }) },
  });
  try {
    const { fetchParentPortal } = await import("../src/backend/parent-portal-supabase.js");

    const enCours = await fetchParentPortal({ annee: "2026-2027" });
    assert.deepEqual(enCours.notes.map((n) => n._id), ["n2"]);
    assert.ok(filtres.includes("notes.annee=2026-2027"));

    // Année inconnue (école pas encore chargée) : comportement d'avant, tout.
    const tout = await fetchParentPortal();
    assert.equal(tout.notes.length, 2);
  } finally {
    m.restore();
  }
});
