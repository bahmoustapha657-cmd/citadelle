import test from "node:test";
import assert from "node:assert/strict";
import {
  erreurEmail, normaliserEmail, coordonneesEnseignant, modesIdentifiant, loginEnseignant, identifiantAffiche,
} from "../src/comptes-enseignants.js";
import { saveEnseignantAction } from "../src/components/ecole/ecole-saves.js";

test("e-mail : vide accepté, mal formé refusé, normalisé", () => {
  assert.equal(erreurEmail(""), null);
  assert.equal(erreurEmail("  Jean.Diallo@Gmail.com "), null);
  assert.match(erreurEmail("jean@gmail"), /invalide/);
  assert.equal(normaliserEmail("  Jean.Diallo@Gmail.com "), "jean.diallo@gmail.com");
});

test("coordonnées : numéro à 9 chiffres (téléphone ou contact), e-mail valide seulement", () => {
  assert.deepEqual(coordonneesEnseignant({ telephone: "+224 622 12 34 56", email: "A@B.CO" }), { telephone: "622123456", email: "a@b.co" });
  assert.deepEqual(coordonneesEnseignant({ contact: "622123456", email: "pas-un-mail" }), { telephone: "622123456", email: null });
});

test("modes proposés : téléphone d'abord, rien sans coordonnées", () => {
  assert.deepEqual(modesIdentifiant({ telephone: "622123456", email: "a@b.co" }), ["telephone", "email"]);
  assert.deepEqual(modesIdentifiant({ email: "a@b.co" }), ["email"]);
  assert.deepEqual(modesIdentifiant({ prenom: "Ali" }), []);
});

test("identifiant : le numéro lui-même, ou un identifiant tiré de l'e-mail", () => {
  const ens = { telephone: "622 12 34 56", email: "Jean.Diallo@gmail.com" };
  assert.equal(loginEnseignant("telephone", ens), "622123456");
  assert.equal(loginEnseignant("email", ens), "ens.jeandiallogmailcom");
  assert.equal(identifiantAffiche("email", ens), "jean.diallo@gmail.com");
  assert.equal(loginEnseignant("email", { telephone: "622123456" }), "");
});

const deps = (appels) => ({
  modal: "edit_ens", ens: [], classes: [],
  toast: (m, t) => appels.toasts.push([m, t]),
  ajEns: async () => {}, modEns: async (r) => appels.mod.push(r), modC: async () => {},
  syncEmail: async (id, email) => { appels.sync.push([id, email]); return 1; },
});

test("fiche : e-mail invalide refusé, valide normalisé et reporté sur le compte", async () => {
  const appels = { toasts: [], mod: [], sync: [] };
  assert.equal(await saveEnseignantAction({ ...deps(appels), form: { _id: "e1", nom: "Bah", email: "bah@" } }), false);
  assert.equal(appels.mod.length, 0);
  assert.equal(await saveEnseignantAction({ ...deps(appels), form: { _id: "e1", nom: "Bah", email: " Bah@Mail.com " } }), true);
  assert.equal(appels.mod[0].email, "bah@mail.com");
  assert.deepEqual(appels.sync, [["e1", "bah@mail.com"]]);
});

test("fiche : échec du report sur le compte = avertissement, fiche gardée", async () => {
  const appels = { toasts: [], mod: [], sync: [] };
  const d = { ...deps(appels), syncEmail: async () => { throw new Error("Cet e-mail est déjà utilisé"); } };
  assert.equal(await saveEnseignantAction({ ...d, form: { _id: "e1", nom: "Bah", email: "bah@mail.com" } }), true);
  assert.equal(appels.mod.length, 1);
  assert.equal(appels.toasts.at(-1)[1], "warning");
});
