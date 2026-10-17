import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import {
  idsADetacher, peutRelierComptes, planLiaison, refusChangement,
} from "../supabase/functions/account-manage/espaces.ts";
import { cleNom, groupesRelies, libelleEspace, suggestionsEspaces } from "../src/espaces-comptes.js";
import { loginInterneEnseignant } from "../src/comptes-enseignants.js";

const E = "ecole-1";
const compte = (id, role, extra = {}) => ({ id, ecole_id: E, user_id: `u-${id}`, role, personne_id: null, extra: null, ...extra });

test("relier : Direction (et superadmin) seulement", () => {
  assert.equal(peutRelierComptes("direction"), true);
  assert.equal(peutRelierComptes("superadmin"), true);
  for (const r of ["admin", "comptable", "enseignant", "parent", "staff", "primaire"]) assert.equal(peutRelierComptes(r), false);
});

test("relier : au moins deux comptes, de l'école, actifs", () => {
  assert.equal(planLiaison([compte("a", "parent")], ["a"], E, "p").status, 400);
  assert.equal(planLiaison([compte("a", "parent")], ["a", "b"], E, "p").status, 404);
  assert.equal(planLiaison([compte("a", "parent"), compte("b", "enseignant", { ecole_id: "autre" })], ["a", "b"], E, "p").status, 404);
  assert.equal(planLiaison([compte("a", "parent"), compte("b", "enseignant", { user_id: null })], ["a", "b"], E, "p").status, 409);
  assert.equal(planLiaison([compte("a", "parent", { extra: { fusionneDans: "z" } }), compte("b", "enseignant")], ["a", "b"], E, "p").status, 409);
  assert.equal(planLiaison([compte("a", "superadmin"), compte("b", "enseignant")], ["a", "b"], E, "p").status, 400);
});

test("relier : nouveau groupe, ou ajout à un groupe existant, jamais deux groupes", () => {
  assert.deepEqual(planLiaison([compte("a", "parent"), compte("b", "enseignant")], ["a", "b", "a"], E, "neuf"), { personneId: "neuf" });
  assert.deepEqual(planLiaison([compte("a", "parent", { personne_id: "p1" }), compte("b", "comptable")], ["a", "b"], E, "neuf"), { personneId: "p1" });
  assert.equal(planLiaison([compte("a", "parent", { personne_id: "p1" }), compte("b", "comptable", { personne_id: "p2" })], ["a", "b"], E, "neuf").status, 409);
});

test("changer d'espace : seulement vers un compte RELIÉ, même école, actif", () => {
  const moi = compte("a", "parent", { personne_id: "p1" });
  assert.equal(refusChangement(moi, null).status, 404);
  assert.equal(refusChangement(moi, moi).status, 400);
  assert.equal(refusChangement(moi, compte("b", "enseignant", { personne_id: "p2" })).status, 403);
  assert.equal(refusChangement(moi, compte("b", "enseignant")).status, 403);
  assert.equal(refusChangement(compte("x", "parent"), compte("b", "enseignant")).status, 403, "appelant sans personne_id");
  assert.equal(refusChangement(moi, compte("b", "enseignant", { personne_id: "p1", ecole_id: "autre" })).status, 403);
  assert.equal(refusChangement(moi, compte("b", "enseignant", { personne_id: "p1", user_id: null })).status, 409);
  assert.equal(refusChangement(moi, compte("b", "enseignant", { personne_id: "p1", extra: { fusionneDans: "z" } })).status, 409);
  assert.equal(refusChangement(moi, compte("b", "enseignant", { personne_id: "p1" })), null);
});

test("détacher : le dernier compte d'un groupe est détaché avec", () => {
  const g = [compte("a", "parent", { personne_id: "p" }), compte("b", "enseignant", { personne_id: "p" }), compte("c", "comptable", { personne_id: "p" })];
  assert.deepEqual(idsADetacher(g[0], g), ["a"]);
  assert.deepEqual(idsADetacher(g[0], g.slice(0, 2)).sort(), ["a", "b"]);
  assert.deepEqual(idsADetacher(compte("z", "parent"), g), []);
});

test("suggestions : même nom (mots dans le désordre) ou même e-mail, rôles différents", () => {
  assert.equal(cleNom("Diallo  Mamadou"), cleNom("MAMADOU diallo"));
  const comptes = [
    { id: "1", nom: "Mamadou Diallo", role: "enseignant", user_id: "u1" },
    { id: "2", nom: "DIALLO Mamadou", role: "parent", user_id: "u2" },
    { id: "3", nom: "Awa Bah", role: "parent", user_id: "u3", email: "awa@x.gn" },
    { id: "4", nom: "A. Bah", role: "comptable", user_id: "u4", email: "AWA@x.gn" },
    { id: "5", nom: "Fanta Camara", role: "parent", user_id: "u5" },
    { id: "6", nom: "Fanta Camara", role: "parent", user_id: "u6" }, // doublon parent : pas ici
    { id: "7", nom: "Admin", role: "admin", user_id: "u7" },
    { id: "8", nom: "Admin", role: "comptable", user_id: "u8" }, // un seul mot : ignoré
  ];
  const s = suggestionsEspaces(comptes);
  assert.deepEqual(s.map((g) => g.comptes.map((c) => c.id).sort().join(",")).sort(), ["1,2", "3,4"]);
  assert.equal(s.find((g) => g.comptes.some((c) => c.id === "3")).motif, "Même e-mail");
  // Déjà reliés entre eux : plus suggérés.
  const relies = comptes.map((c) => (c.id === "1" || c.id === "2" ? { ...c, personne_id: "p" } : c));
  assert.equal(suggestionsEspaces(relies).some((g) => g.comptes.some((c) => c.id === "1")), false);
});

test("groupes reliés et libellés d'espace", () => {
  const g = groupesRelies([{ id: "1", personne_id: "p", nom: "B" }, { id: "2", personne_id: "p", nom: "B" }, { id: "3", nom: "C" }]);
  assert.equal(g.length, 1);
  assert.equal(g[0].comptes.length, 2);
  assert.equal(libelleEspace({ role: "enseignant" }).titre, "Enseignant");
  assert.equal(libelleEspace({ role: "parent" }).titre, "Parent d'élève");
  assert.equal(libelleEspace({ role: "staff", label: "Comptable" }).titre, "Comptable");
});

test("identifiant interne de l'espace enseignant relié", () => {
  assert.equal(loginInterneEnseignant("622123456"), "ens.622123456");
  assert.equal(loginInterneEnseignant("ens.awagmailcom"), "ens.awagmailcom.ens");
});

test("migration : personne_id verrouillé hors service_role, mes_espaces fermé à anon", () => {
  const f = readdirSync("supabase/migrations").find((n) => n.endsWith("_espaces_multiples.sql"));
  const sql = readFileSync(`supabase/migrations/${f}`, "utf8");
  assert.match(sql, /before insert or update on public\.comptes/);
  assert.match(sql, /new\.personne_id is not null/);
  assert.match(sql, /new\.personne_id is distinct from old\.personne_id/);
  assert.match(sql, /revoke all on function public\.mes_espaces\(\) from public, anon;/);
  assert.match(sql, /where c\.user_id = auth\.uid\(\) and c\.personne_id is not null/);
});
