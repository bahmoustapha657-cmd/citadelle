import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { candidats, cleCiblage, compteJoignable, destinataires, parLots } from "../supabase/functions/push/destinataires.ts";

const ECOLE_A = "ecole-a";
const ECOLE_B = "ecole-b";
const compte = (user_id, role, { ecole_id = ECOLE_A, statut = "Actif", poste = null, fusion = null } = {}) =>
  ({ user_id, role, ecole_id, statut, poste, fusion });
const poste = (cle, actif = true) => ({ cle, actif });
// `role` / `poste_cle` : ce que le navigateur a déclaré dans push_subs — à ignorer.
const abo = (user_id, ecole_id = ECOLE_A, declare = {}) => ({ user_id, ecole_id, subscription: { endpoint: user_id }, ...declare });
const demande = ({ cibles = [], userIds = [], tousStaff = false } = {}) => ({ cibles, userIds, tousStaff });
// `parents` : user_id des comptes rattachés à l'élève visé (parent_eleves).
const servis = (abos, comptes, ecoleId, d, parents = []) =>
  destinataires(abos, comptes, ecoleId, d, parents).map((a) => a.user_id).sort();

const COMPTES = [
  compte("dir", "direction", { poste: poste("direction") }),
  compte("compta-legacy", "comptable"),
  compte("compta-poste", "staff", { poste: poste("comptable") }),
  compte("censeur", "staff", { poste: poste("censeur") }),
  compte("prof", "enseignant"),
  compte("parent", "parent"),
  compte("sa", "superadmin", { ecole_id: null }),
];
const ABOS_A = COMPTES.map((c) => abo(c.user_id));

test("faille : un parent inscrit « direction » dans une AUTRE école ne reçoit rien", () => {
  const comptes = [...COMPTES, compte("intrus", "parent", { ecole_id: ECOLE_B })];
  const abos = [...ABOS_A, abo("intrus", ECOLE_A, { role: "direction", poste_cle: "direction" })];
  for (const d of [demande({ cibles: ["direction"] }), demande({ cibles: ["parent"] }), demande({ tousStaff: true }),
    demande({ userIds: ["intrus"] })]) {
    assert.ok(!servis(abos, comptes, ECOLE_A, d, ["intrus"]).includes("intrus"), JSON.stringify(d));
  }
});

test("faille : un parent qui se déclare « direction » dans SON école reste parent", () => {
  const abos = [abo("parent", ECOLE_A, { role: "direction", poste_cle: "direction" }), abo("dir")];
  assert.deepEqual(servis(abos, COMPTES, ECOLE_A, demande({ cibles: ["direction"] })), ["dir"]);
  assert.deepEqual(servis(abos, COMPTES, ECOLE_A, demande({ tousStaff: true })), ["dir"]);
  assert.deepEqual(servis(abos, COMPTES, ECOLE_A, demande({ cibles: ["parent"] }), ["parent"]), ["parent"]);
});

test("abonnement sans compte, ou d'une autre école que la demande : ignoré", () => {
  assert.deepEqual(servis([abo("fantome")], COMPTES, ECOLE_A, demande({ userIds: ["fantome"] })), []);
  // ligne d'une autre école passée par erreur : jamais servie pour A
  assert.deepEqual(servis([abo("dir", ECOLE_B)], COMPTES, ECOLE_A, demande({ cibles: ["direction"] })), []);
});

test("ciblage par rôle et par clé de poste (comptes, pas push_subs)", () => {
  assert.deepEqual(servis(ABOS_A, COMPTES, ECOLE_A, demande({ cibles: ["comptable"] })), ["compta-legacy", "compta-poste"]);
  assert.deepEqual(servis(ABOS_A, COMPTES, ECOLE_A, demande({ cibles: ["parent"] }), ["parent"]), ["parent"]);
  assert.deepEqual(servis(ABOS_A, COMPTES, ECOLE_A, demande({ cibles: ["direction", "parent"] }), ["parent"]), ["dir", "parent"]);
});

test("fuite entre familles : « parent » ne sert que les parents de l'élève", () => {
  const comptes = [
    ...COMPTES,
    compte("mere-x", "parent"), compte("pere-x", "parent"), // élève X
    compte("parent-y", "parent"), // élève Y, même école
    compte("parent-b", "parent", { ecole_id: ECOLE_B }), // lié par erreur, autre école
  ];
  const abos = comptes.map((c) => abo(c.user_id));
  const parents = demande({ cibles: ["parent"] });
  // Les deux parents de X, et eux seuls.
  assert.deepEqual(servis(abos, comptes, ECOLE_A, parents, ["mere-x", "pere-x"]), ["mere-x", "pere-x"]);
  // Sans liste de parents : AUCUN parent (jamais tout le rôle).
  assert.deepEqual(servis(abos, comptes, ECOLE_A, parents), []);
  assert.deepEqual(servis(abos, comptes, ECOLE_A, parents, []), []);
  // Parent d'une autre école dans la liste : écarté.
  assert.deepEqual(servis(abos, comptes, ECOLE_A, parents, ["pere-x", "parent-b"]), ["pere-x"]);
  // Compte non parent dans la liste : la cible « parent » ne le sert pas.
  assert.deepEqual(servis(abos, comptes, ECOLE_A, parents, ["pere-x", "dir", "prof"]), ["pere-x"]);
  // Liste fournie mais cible « parent » absente : aucun parent.
  assert.deepEqual(servis(abos, comptes, ECOLE_A, demande({ cibles: ["direction"] }), ["pere-x"]), ["dir"]);
  assert.ok(!servis(abos, comptes, ECOLE_A, demande({ tousStaff: true }), ["pere-x"]).includes("pere-x"));
  // Le personnel visé en même temps reste servi.
  assert.deepEqual(servis(abos, comptes, ECOLE_A, demande({ cibles: ["comptable", "parent"] }), ["mere-x"]),
    ["compta-legacy", "compta-poste", "mere-x"]);
  // Messagerie : un parent nommé (userIds) reste joignable.
  assert.deepEqual(servis(abos, comptes, ECOLE_A, demande({ userIds: ["parent-y"] })), ["parent-y"]);
});

test("candidats : seules les personnes visées, sinon toute l'école", () => {
  // Parents d'un élève (+ messagerie) : lecture nominative, sans doublon.
  assert.deepEqual(candidats(demande({ cibles: ["parent"] }), ["p1", "p2"]), ["p1", "p2"]);
  assert.deepEqual(candidats(demande({ cibles: ["parent"], userIds: ["p1", "u1"] }), ["p1", "p2"]), ["p1", "u1", "p2"]);
  assert.deepEqual(candidats(demande({ cibles: ["parent"] })), []);
  assert.deepEqual(candidats(demande({ userIds: ["u1"] }), ["p1"]), ["u1"]);
  // Rôle ou poste du personnel, tousStaff : toute l'école (tri sur comptes).
  assert.equal(candidats(demande({ cibles: ["direction"] })), null);
  assert.equal(candidats(demande({ cibles: ["direction", "parent"] }), ["p1"]), null);
  assert.equal(candidats(demande({ tousStaff: true })), null);
});

test("postes flexibles : le rôle 'staff' reçoit par la clé de son poste", () => {
  assert.deepEqual(servis(ABOS_A, COMPTES, ECOLE_A, demande({ cibles: ["censeur"] })), ["censeur"]);
  assert.deepEqual(servis(ABOS_A, COMPTES, ECOLE_A, demande({ cibles: ["staff"] })), ["censeur", "compta-poste"]);
  assert.ok(servis(ABOS_A, COMPTES, ECOLE_A, demande({ tousStaff: true })).includes("censeur"));
  assert.ok(!servis(ABOS_A, COMPTES, ECOLE_A, demande({ cibles: ["direction"] })).includes("censeur"));
});

test("tousStaff : tout le personnel, ni parents ni enseignants", () => {
  assert.deepEqual(servis(ABOS_A, COMPTES, ECOLE_A, demande({ tousStaff: true })),
    ["censeur", "compta-legacy", "compta-poste", "dir", "sa"]);
});

test("userIds : seulement les personnes nommées, si elles sont de l'école", () => {
  assert.deepEqual(servis(ABOS_A, COMPTES, ECOLE_A, demande({ userIds: ["prof", "parent"] })), ["parent", "prof"]);
  assert.deepEqual(servis(ABOS_A, COMPTES, ECOLE_A, demande({ cibles: ["direction"], userIds: ["prof"] })), ["dir", "prof"]);
});

test("superadmin (sans école) : reçoit dans toute école ce qui le vise", () => {
  const abosB = [abo("sa", ECOLE_B), abo("dir", ECOLE_B)];
  assert.deepEqual(servis(abosB, COMPTES, ECOLE_B, demande({ cibles: ["superadmin"] })), ["sa"]);
  assert.deepEqual(servis(abosB, COMPTES, ECOLE_B, demande({ userIds: ["sa"] })), ["sa"]);
  assert.deepEqual(servis(abosB, COMPTES, ECOLE_B, demande({ tousStaff: true })), ["sa"]);
  assert.ok(!servis(ABOS_A, COMPTES, ECOLE_A, demande({ cibles: ["direction"] })).includes("sa"));
});

test("comptes bloqués à la connexion : rien ne leur part", () => {
  const comptes = [
    compte("inactif", "comptable", { statut: "Inactif" }),
    compte("poste-off", "staff", { poste: poste("censeur", false) }),
    compte("fusionne", "parent", { fusion: "autre-compte" }),
    compte("sans-statut", "comptable", { statut: null }),
  ];
  const abos = comptes.map((c) => abo(c.user_id));
  assert.deepEqual(servis(abos, comptes, ECOLE_A, demande({ cibles: ["comptable", "censeur", "parent"] }), ["fusionne"]),
    ["sans-statut"]);
  assert.deepEqual(servis(abos, comptes, ECOLE_A, demande({ userIds: ["inactif", "poste-off", "fusionne"] })), []);
});

test("cleCiblage : poste, sinon rôle ; parents et enseignants hors postes", () => {
  assert.equal(cleCiblage(compte("x", "staff", { poste: poste("censeur") })), "censeur");
  assert.equal(cleCiblage(compte("x", "comptable")), "comptable");
  assert.equal(cleCiblage(compte("x", "parent", { poste: poste("direction") })), "parent");
  assert.equal(cleCiblage(compte("x", "enseignant", { poste: poste("direction") })), "enseignant");
  // le parent rattaché (à tort) au poste direction ne reçoit pas la direction
  const comptes = [compte("p", "parent", { poste: poste("direction") })];
  assert.deepEqual(servis([abo("p")], comptes, ECOLE_A, demande({ cibles: ["direction"] })), []);
});

test("compteJoignable : école du compte, superadmin partout", () => {
  assert.equal(compteJoignable(undefined, ECOLE_A), false);
  assert.equal(compteJoignable(compte("x", "direction", { ecole_id: null }), ECOLE_A), false);
  assert.equal(compteJoignable(compte("x", "direction", { ecole_id: ECOLE_B }), ECOLE_A), false);
  assert.equal(compteJoignable(compte("x", "direction"), ECOLE_A), true);
  assert.equal(compteJoignable(compte("x", "superadmin", { ecole_id: null }), ECOLE_B), true);
  assert.equal(compteJoignable(compte("x", "superadmin", { ecole_id: null, statut: "Inactif" }), ECOLE_B), false);
});

test("parLots : découpe sans perte", () => {
  assert.deepEqual(parLots([], 2), []);
  assert.deepEqual(parLots([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.equal(parLots(Array.from({ length: 250 }, (_, i) => i), 100).flat().length, 250);
});

test("index.ts trie sur les comptes, jamais sur push_subs.role / poste_cle", () => {
  const src = readFileSync(new URL("../supabase/functions/push/index.ts", import.meta.url), "utf8");
  const code = src.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  assert.ok(!/poste_cle|role\.in\.|\.or\(/.test(code), "aucun filtre sur les colonnes déclarées");
  assert.ok(!/push_subs"\)\.select\([^)]*role/.test(code), "role non lu dans push_subs");
  const tri = code.indexOf("destinataires(abonnements, comptes, ec.id, demande, parentsEleve)");
  assert.ok(tri > 0, "destinataires() appliqué");
  assert.ok(code.indexOf("await lireComptes(") < tri, "comptes lus avant le tri");
  assert.ok(tri < code.indexOf("webpush.sendNotification("), "tri avant l'envoi");
  assert.match(code, /\.order\("user_id"\)\.range\(/, "lecture paginée (plafond 1000)");
});
