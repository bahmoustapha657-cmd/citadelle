import test from "node:test";
import assert from "node:assert/strict";
import { saveEnseignantAction } from "../src/components/ecole/ecole-saves.js";

const base = () => {
  const appels = { aj: [], mod: [], modC: [], toasts: [] };
  return {
    appels,
    deps: {
      modal: "add_ens", ens: [],
      classes: [{ _id: "c1", nom: "3ème Année A", enseignant: "" }],
      toast: (m) => appels.toasts.push(m),
      ajEns: async (r) => appels.aj.push(r),
      modEns: async (r) => appels.mod.push(r),
      modC: async (c) => appels.modC.push(c),
    },
  };
};

test("classe titulaire inconnue : refus, aucun enseignant ni classe créés", async () => {
  const { appels, deps } = base();
  const ok = await saveEnseignantAction({ ...deps, form: { nom: "Bah", prenom: "Ali", classeTitle: "3eme Annee A" } });
  assert.equal(ok, false);
  assert.equal(appels.aj.length, 0);
  assert.equal(appels.modC.length, 0);
  assert.match(appels.toasts[0], /n'existe pas/);
});

test("classe existante : enseignant créé et désigné titulaire de la classe", async () => {
  const { appels, deps } = base();
  const ok = await saveEnseignantAction({ ...deps, form: { nom: "Bah", prenom: "Ali", classeTitle: "3ème Année A" } });
  assert.equal(ok, true);
  assert.equal(appels.aj.length, 1);
  assert.equal(appels.modC[0].enseignant, "Ali Bah");
});

test("sans classe titulaire : enregistré normalement", async () => {
  const { appels, deps } = base();
  assert.equal(await saveEnseignantAction({ ...deps, form: { nom: "Bah", prenom: "Ali" } }), true);
  assert.equal(appels.aj.length, 1);
  assert.equal(appels.modC.length, 0);
});
