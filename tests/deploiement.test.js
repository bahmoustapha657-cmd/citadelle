import test from "node:test";
import assert from "node:assert/strict";
import { fichiersModifiesPertinents, decrireVersion } from "../scripts/version-build.mjs";
import { verifierEtatDepot } from "../scripts/deployer-pages.mjs";

const SHA = "e37641c0123456789abcdef0123456789abcdef0";

test("fichiersModifiesPertinents ignore .claude/ et garde le reste", () => {
  const porcelain = [
    " M .claude/settings.local.json",
    "?? .claude/worktrees/x/",
    " M src/App.jsx",
    "?? notes.txt",
    "",
  ].join("\n");
  assert.deepEqual(fichiersModifiesPertinents(porcelain), ["src/App.jsx", "notes.txt"]);
  assert.deepEqual(fichiersModifiesPertinents(""), []);
});

test("decrireVersion signale un arbre non propre dans la version courte", () => {
  const propre = decrireVersion({ commit: SHA, branche: "master", modifies: [], date: "d" });
  assert.equal(propre.court, "e37641c");
  assert.equal(propre.propre, true);

  const sale = decrireVersion({ commit: SHA, branche: "x", modifies: ["src/App.jsx"], date: "d" });
  assert.equal(sale.court, "e37641c+modifs");
  assert.equal(sale.propre, false);

  assert.equal(decrireVersion({ modifies: [] }).commit, "inconnu");
});

test("verifierEtatDepot n'accepte que master propre et à jour", () => {
  const ok = { branche: "master", modifies: [], head: SHA, origine: SHA };
  assert.deepEqual(verifierEtatDepot(ok), []);

  assert.equal(verifierEtatDepot({ ...ok, branche: "claude/x" }).length, 1);
  assert.equal(verifierEtatDepot({ ...ok, modifies: ["src/a.js"] }).length, 1);
  assert.equal(verifierEtatDepot({ ...ok, origine: "f".repeat(40) }).length, 1);
  assert.equal(verifierEtatDepot({ ...ok, origine: "" }).length, 1);
  assert.equal(
    verifierEtatDepot({ branche: "x", modifies: ["a"], head: SHA, origine: "f".repeat(40) }).length,
    3,
  );
});
