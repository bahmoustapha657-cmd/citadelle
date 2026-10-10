// Une relecture en échec (retour d'onglet hors réseau, SQLite local
// indisponible…) ne doit pas vider la liste affichée : chargerCollection
// renvoie `{ items: [], erreur }`, et ce tableau vide remplaçait les élèves
// et les notes à l'écran.
//
// Il faut les mocks de modules du test runner (`npm test` passe le drapeau) :
// le hook importe le client Supabase, qui lit import.meta.env (propre à Vite).
import test, { mock } from "node:test";
import assert from "node:assert/strict";

const ignore = typeof mock.module !== "function"
  && "mocks de modules absents : lancer avec --experimental-test-module-mocks";

let actionLecture, firestoreReducer;
if (!ignore) {
  const url = (chemin) => new URL(chemin, import.meta.url).href;
  mock.module(url("../src/backend/data-supabase.js"), {
    namedExports: {
      chargerCollection: async () => ({ items: [] }),
      ajouterDoc: async () => ({}),
      modifierDoc: async () => {},
      modifierChampDoc: async () => {},
      supprimerDoc: async () => {},
    },
  });
  mock.module(url("../src/backend/realtime-supabase.js"), {
    namedExports: { subscribeCollection: () => () => {} },
  });
  ({ actionLecture, firestoreReducer } = await import("../src/hooks/useFirestore.js"));
}

const ELEVES = [{ _id: "e1", nom: "Diallo" }, { _id: "e2", nom: "Bah" }];

const lire = (state, resultat) => firestoreReducer(state, actionLecture(resultat));

test("une relecture en échec garde la liste et remonte l'erreur", { skip: ignore }, () => {
  let state = { items: [], chargement: true, erreur: null };
  state = lire(state, { items: ELEVES });
  assert.deepEqual(state, { items: ELEVES, chargement: false, erreur: null });

  state = firestoreReducer(state, { type: "loading" });
  state = lire(state, { items: [], erreur: "Failed to fetch" });
  assert.equal(state.items, ELEVES);
  assert.equal(state.chargement, false);
  assert.equal(state.erreur, "Failed to fetch");
});

test("la lecture suivante réussie efface l'erreur", { skip: ignore }, () => {
  let state = lire({ items: ELEVES, chargement: false, erreur: null }, { items: [], erreur: "hors ligne" });
  state = lire(state, { items: [ELEVES[0]] });
  assert.deepEqual(state, { items: [ELEVES[0]], chargement: false, erreur: null });
});

test("une liste vraiment vide, sans erreur, reste un succès", { skip: ignore }, () => {
  const state = lire({ items: ELEVES, chargement: false, erreur: null }, { items: [] });
  assert.deepEqual(state, { items: [], chargement: false, erreur: null });
});

test("un premier chargement en échec sort de l'état de chargement", { skip: ignore }, () => {
  const state = lire({ items: [], chargement: true, erreur: null }, { items: [], erreur: "École introuvable." });
  assert.deepEqual(state, { items: [], chargement: false, erreur: "École introuvable." });
});

test("les patches temps réel conservent l'erreur en cours", { skip: ignore }, () => {
  let state = lire({ items: ELEVES, chargement: false, erreur: null }, { items: [], erreur: "hors ligne" });
  state = firestoreReducer(state, { type: "upsert", item: { _id: "e3", nom: "Sow" } });
  assert.equal(state.items.length, 3);
  assert.equal(state.erreur, "hors ligne");
});
