// Un foyer = un compte parent, pour tous ses enfants et toutes les sections.
//
// Défaut d'origine (2026-09-26) : l'Edge Function account-manage créait un
// compte par enfant. Le rattachement au compte du même foyer, que faisait
// l'API Firebase (api/_lib/account-links.js), s'était perdu au passage à
// Supabase ; la modale l'annonçait toujours. Deux frères — l'un au collège,
// l'autre au primaire — recevaient le même identifiant proposé, d'où
// « identifiant déjà pris », puis un second compte. Désormais le serveur
// retrouve le compte du foyer et y rattache les élèves (foyer.ts), et la
// saisie rapide ouvre le compte de toute la fratrie en un seul appel.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normaliserTelGuinee } from "../shared/phone.js";
import {
  chargerComptesParents, memeFoyer, nomComparable, normaliserTel, rattacherAuFoyer, trouverCompteFoyer,
} from "../supabase/functions/account-manage/foyer.ts";
import { loginParentSuggere, messageCompteParent, payloadCompteParent } from "../src/comptes-parents.js";
import { attendreFileVide } from "../src/backend/powersync/file-envoi.js";

// ── Règle « même foyer » ────────────────────────────────────────────────────
test("téléphone : même normalisation que shared/phone.js", () => {
  for (const brut of ["622123456", "+224 622 12 34 56", "00224622123456", "622123456 / 664000000",
    "Sambaya", "12345678", "", null, "6221234567"]) {
    assert.equal(normaliserTel(brut), normaliserTelGuinee(brut), String(brut));
  }
});

test("noms comparés sans casse, accents, ponctuation ni ordre des mots", () => {
  assert.equal(nomComparable("DIALLO Mamadou"), nomComparable("Mamadou  Diallo"));
  assert.equal(nomComparable("Bah Aïssatou"), nomComparable("bah aissatou"));
  assert.equal(nomComparable("Père: Bah / Mère: Barry"), nomComparable("père bah mère barry"));
  assert.notEqual(nomComparable("Mamadou Diallo"), nomComparable("Mamadou Saliou Diallo"));
  assert.equal(nomComparable(null), "");
});

test("même foyer : même tuteur, puis même numéro — ou même filiation sans numéro", () => {
  const bah = { tuteur: "Bah Alpha", contactTuteur: "622 12 34 56", filiation: "Père: Bah Alpha / Mère: Barry Kadiatou" };
  assert.equal(memeFoyer(bah, { ...bah, tuteur: "ALPHA BAH", contactTuteur: "+224622123456" }), true);
  // Numéro manquant d'un côté : la filiation départage.
  assert.equal(memeFoyer(bah, { ...bah, contactTuteur: "" }), true);
  assert.equal(memeFoyer(bah, { ...bah, contactTuteur: "", filiation: "Père: Bah Alpha / Mère: Sow Fanta" }), false);
  assert.equal(memeFoyer({ ...bah, contactTuteur: "" }, { ...bah, contactTuteur: "", filiation: "" }), false);
  // Deux numéros différents : deux foyers, même avec le même nom.
  assert.equal(memeFoyer(bah, { ...bah, contactTuteur: "664000000" }), false);
});

test("un numéro seul ne suffit jamais (numéro de l'école saisi pour des internes)", () => {
  const ecole = "620000000";
  assert.equal(memeFoyer({ tuteur: "Bah Alpha", contactTuteur: ecole }, { tuteur: "Sow Ibrahima", contactTuteur: ecole }), false);
  assert.equal(memeFoyer({ tuteur: "", contactTuteur: ecole }, { tuteur: "Sow Ibrahima", contactTuteur: ecole }), false);
  assert.equal(memeFoyer({ contactTuteur: ecole }, { contactTuteur: ecole }), false);
});

test("choix du compte : celui qui suit déjà un élève, puis actif, en service, le plus ancien", () => {
  const foyer = { tuteur: "Bah Alpha", contactTuteur: "622123456" };
  const compte = (id, champs = {}) => ({
    id, login: `parent.${id}`, statut: "Actif", premiere_co: true, created_at: "2026-01-01",
    extra: {}, foyers: [foyer], eleveIds: [], ...champs,
  });
  const a = compte("a");
  const b = compte("b", { created_at: "2025-01-01" });
  const enService = compte("c", { premiere_co: false, created_at: "2026-03-01" });
  const inactif = compte("d", { statut: "Inactif", premiere_co: false, created_at: "2024-01-01" });
  const suitE1 = compte("z", { foyers: [], eleveIds: ["e1"], created_at: "2026-06-01" });
  assert.equal(trouverCompteFoyer([a, b], [foyer], ["e1"]).id, "b"); // le plus ancien
  assert.equal(trouverCompteFoyer([a, b, enService], [foyer], ["e1"]).id, "c"); // en service
  assert.equal(trouverCompteFoyer([inactif, enService], [foyer], ["e1"]).id, "c"); // actif d'abord
  assert.equal(trouverCompteFoyer([enService, suitE1], [foyer], ["e1"]).id, "z"); // suit déjà l'élève
  assert.equal(trouverCompteFoyer([a], [{ tuteur: "Sow Ibrahima", contactTuteur: "622123456" }], ["e9"]), null);
});

// ── Faux client service_role (le strict nécessaire de PostgREST) ─────────────
function fauxAdmin(db) {
  const ecritures = [];
  const plages = [];
  const valeur = (ligne, col) => col.split(".").reduce((v, k) => v?.[k], ligne);
  const from = (table) => {
    const filtres = [];
    let plage = null;
    let action = "select";
    let charge = null;
    const executer = () => {
      if (action === "upsert") {
        ecritures.push({ table, action, charge });
        for (const l of charge) {
          if (!db[table].some((x) => x.compte_id === l.compte_id && x.eleve_id === l.eleve_id)) db[table].push(l);
        }
        return { error: null };
      }
      if (action === "update") {
        ecritures.push({ table, action, charge });
        db[table].filter((l) => filtres.every((f) => f(l))).forEach((l) => Object.assign(l, charge));
        return { error: null };
      }
      let lignes = db[table];
      if (table === "parent_eleves") lignes = lignes.map((l) => ({ ...l, eleves: db.eleves.find((e) => e.id === l.eleve_id) }));
      lignes = lignes.filter((l) => filtres.every((f) => f(l)));
      if (plage) { plages.push(table); lignes = lignes.slice(plage[0], plage[1] + 1); }
      return { data: lignes, error: null };
    };
    const q = {
      select: () => q,
      order: () => q,
      eq: (col, val) => { filtres.push((l) => valeur(l, col) === val); return q; },
      in: (col, vals) => { filtres.push((l) => vals.includes(valeur(l, col))); return q; },
      range: (a, b) => { plage = [a, b]; return q; },
      upsert: (lignes) => { action = "upsert"; charge = lignes; return q; },
      update: (patch) => { action = "update"; charge = patch; return q; },
      then: (ok, ko) => Promise.resolve().then(executer).then(ok, ko),
    };
    return q;
  };
  return { from, ecritures, plages };
}

const base = () => ({
  eleves: [
    { id: "aine", ecole_id: "ec1", tuteur: "Bah Alpha", contact_tuteur: "622123456", filiation: "" },
    { id: "cadet", ecole_id: "ec1", tuteur: "Bah Alpha", contact_tuteur: "622 12 34 56", filiation: "" },
    { id: "autre", ecole_id: "ec1", tuteur: "Sow Ibrahima", contact_tuteur: "664000000", filiation: "" },
    { id: "ailleurs", ecole_id: "ec2", tuteur: "Bah Alpha", contact_tuteur: "622123456", filiation: "" },
  ],
  // Compte migré : son extra ne dit rien du foyer, sa fiche d'enfant si.
  comptes: [
    { id: "cpt-bah", ecole_id: "ec1", role: "parent", login: "parent.bah", statut: "Actif", premiere_co: false, created_at: "2025-10-01", extra: {} },
    { id: "cpt-sow", ecole_id: "ec1", role: "parent", login: "parent.sow", statut: "Actif", premiere_co: true, created_at: "2025-10-02", extra: { tuteur: "Sow Ibrahima", contactTuteur: "664000000" } },
  ],
  parent_eleves: [
    { compte_id: "cpt-bah", eleve_id: "aine" },
    { compte_id: "cpt-sow", eleve_id: "autre" },
  ],
});

test("comptes parents : chacun avec ses enfants et les foyers connus", async () => {
  const db = base();
  const comptes = await chargerComptesParents(fauxAdmin(db), "ec1");
  const bah = comptes.find((c) => c.id === "cpt-bah");
  assert.deepEqual(bah.eleveIds, ["aine"]);
  assert.equal(bah.foyers.length, 2); // extra (vide) + fiche de l'aîné
  assert.equal(bah.foyers[1].tuteur, "Bah Alpha");
});

test("le cadet, dans une autre section, rejoint le compte de l'aîné", async () => {
  const db = base();
  const admin = fauxAdmin(db);
  const r = await rattacherAuFoyer(admin, {
    ecoleId: "ec1", eleveIds: ["cadet"], foyer: { tuteur: "Bah Alpha", contactTuteur: "622123456", filiation: "" },
  });
  assert.equal(r.compte.id, "cpt-bah");
  assert.equal(r.rattaches, 1);
  assert.ok(db.parent_eleves.some((l) => l.compte_id === "cpt-bah" && l.eleve_id === "cadet"));
  // Profil du foyer complété sur le compte migré, pour la suite.
  assert.equal(db.comptes[0].extra.tuteur, "Bah Alpha");
  assert.equal(db.comptes[0].extra.contactTuteur, "622123456");
});

test("élève déjà rattaché : rien n'est réécrit", async () => {
  const db = base();
  const admin = fauxAdmin(db);
  const r = await rattacherAuFoyer(admin, {
    ecoleId: "ec1", eleveIds: ["autre"], foyer: { tuteur: "Sow Ibrahima", contactTuteur: "664000000" },
  });
  assert.equal(r.compte.id, "cpt-sow");
  assert.equal(r.rattaches, 0);
  assert.deepEqual(admin.ecritures, []);
});

test("nouveau foyer : pas de compte trouvé, à créer par l'appelant", async () => {
  const db = base();
  db.eleves.push({ id: "neuf", ecole_id: "ec1", tuteur: "Camara Fodé", contact_tuteur: "655000000", filiation: "" });
  const admin = fauxAdmin(db);
  const r = await rattacherAuFoyer(admin, {
    ecoleId: "ec1", eleveIds: ["neuf"], foyer: { tuteur: "Camara Fodé", contactTuteur: "655000000" },
  });
  assert.equal(r, null);
  assert.deepEqual(admin.ecritures, []);
});

test("élève d'une autre école, ou pas encore remonté : refus explicite", async () => {
  const db = base();
  for (const eleveIds of [["ailleurs"], ["cadet", "inconnu"]]) {
    const admin = fauxAdmin(db);
    const r = await rattacherAuFoyer(admin, { ecoleId: "ec1", eleveIds, foyer: { tuteur: "Bah Alpha" } });
    assert.equal(r.status, 409);
    assert.match(r.error, /introuvable/);
    assert.deepEqual(admin.ecritures, []);
  }
});

test("au-delà de 1000 comptes, la lecture continue page après page", async () => {
  const db = base();
  for (let i = 0; i < 1000; i++) {
    db.comptes.push({ id: `x${i}`, ecole_id: "ec1", role: "parent", login: `p${i}`, statut: "Actif", extra: {} });
  }
  const admin = fauxAdmin(db);
  const comptes = await chargerComptesParents(admin, "ec1");
  assert.equal(comptes.length, 1002);
  assert.equal(admin.plages.filter((t) => t === "comptes").length, 2);
});

test("Edge Function : index.ts délègue le rattachement à foyer.ts", () => {
  const source = readFileSync(new URL("../supabase/functions/account-manage/index.ts", import.meta.url), "utf8");
  assert.match(source, /import \{ rattacherAuFoyer \} from "\.\/foyer\.ts";/);
  assert.doesNotMatch(source, /function memeFoyer/);
});

// ── Côté app ────────────────────────────────────────────────────────────────
const fratrie = [
  { _id: "e1", prenom: "Aminata", nom: "Bah", classe: "6ème Année", section: "college", sexe: "F",
    tuteur: "Bah Alpha", contactTuteur: "622123456", filiation: "Père: Bah Alpha" },
  { _id: "e2", prenom: "Ibrahima", nom: "Bah", classe: "2ème Année", section: "primaire", sexe: "M",
    tuteur: "Bah Alpha", contactTuteur: "622123456", filiation: "Père: Bah Alpha" },
];

test("identifiant suggéré : parent.<nom> sans accents ni espaces", () => {
  assert.equal(loginParentSuggere("Barry Diallo"), "parent.barrydiallo");
  assert.equal(loginParentSuggere("Condé"), "parent.conde");
});

test("charge utile : toute la fratrie, sans section au compte", () => {
  const p = payloadCompteParent({ schoolId: "citadelle", login: " Parent.Bah ", mdp: "Secret123", eleves: fratrie });
  assert.equal(p.login, "parent.bah");
  assert.equal(p.role, "parent");
  assert.deepEqual(p.eleveIds, ["e1", "e2"]);
  assert.equal(p.eleveId, "e1");
  assert.equal(p.nom, "Bah Alpha");
  assert.equal(p.contactTuteur, "622123456");
  assert.equal("section" in p, false);
  assert.equal("sections" in p, false);
  assert.deepEqual(p.elevesAssocies.map((a) => a.section), ["college", "primaire"]);
});

test("saisie rapide hors ligne : on attend la remontée des élèves, jamais indéfiniment", async () => {
  // La file se vide : prêt.
  const comptes = [2, 1, 0];
  assert.equal(await attendreFileVide(async () => ({ count: comptes.shift() }), 1000, 1), true);
  // Base locale illisible : rien à attendre.
  assert.equal(await attendreFileVide(async () => { throw new Error("pas ouverte"); }, 1000, 1), true);
  // Hors ligne, la file reste pleine : on rend la main au bout du délai.
  assert.equal(await attendreFileVide(async () => ({ count: 3 }), 30, 5), false);
  // Base qui ne répond jamais : délai tenu quand même.
  const debut = Date.now();
  assert.equal(await attendreFileVide(() => new Promise(() => {}), 50, 5), false);
  assert.ok(Date.now() - debut < 1000);
});

test("messages : créé, rattaché au foyer, déjà rattaché — accordés", () => {
  assert.match(messageCompteParent({ login: "parent.bah", rattache: false }, fratrie), /Compte parent « parent\.bah » créé pour Aminata, Ibrahima/);
  assert.equal(
    messageCompteParent({ login: "parent.bah", rattache: true }, [fratrie[0]]),
    "Même foyer : Aminata ajoutée au compte parent « parent.bah ». Le mot de passe du parent ne change pas.",
  );
  assert.match(messageCompteParent({ login: "parent.bah", rattache: true }, fratrie), /Aminata, Ibrahima ajoutés/);
  assert.equal(
    messageCompteParent({ login: "parent.bah", rattache: true, dejaRattache: true }, [fratrie[1]]),
    "Ibrahima : déjà rattaché au compte parent « parent.bah ».",
  );
});
