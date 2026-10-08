// Un foyer = un compte parent, pour tous ses enfants et toutes les sections.
//
// Défaut d'origine (2026-09-26) : l'Edge Function account-manage créait un
// compte par enfant. Le rattachement au compte du même foyer, que faisait
// l'API Firebase (api/_lib/account-links.js), s'était perdu au passage à
// Supabase ; la modale l'annonçait toujours. Deux frères — l'un au collège,
// l'autre au primaire — recevaient le même identifiant proposé, d'où
// « identifiant déjà pris », puis un second compte. Désormais le serveur
// retrouve le compte du parent et y rattache les élèves (foyer.ts), et la
// saisie rapide ouvre le compte de toute la fratrie en un seul appel.
//
// Étape 2 (2026-09-29) : numéro du parent (comptes.telephone) proposé comme
// identifiant, père et mère chacun leur compte, rattacher / détacher depuis
// la fiche élève — et la RLS de parent_eleves, ouverte à toutes les écoles,
// refermée (supabase/historique/comptes-parents.sql).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normaliserTelGuinee } from "../shared/phone.js";
import * as telServeur from "../supabase/functions/_shared/telephone.ts";
import {
  chargerComptesParents, fusionnerComptesParents, lienValide, memeFoyer, modifierLienParent, nomComparable,
  rattacherAuFoyer, trouverCompteFoyer,
} from "../supabase/functions/account-manage/foyer.ts";
import { peutFusionnerParents } from "../supabase/functions/account-manage/droits.ts";
import {
  chercherComptesParents, identifiantConnexion, libelleLien, loginParentSuggere, memeParent, messageCompteParent,
  nomComparable as nomComparableApp, numeroNational, payloadCompteParent, telephoneLisible,
} from "../src/comptes-parents.js";
import { groupesDoublons } from "../src/doublons-parents.js";
import { attendreFileVide } from "../src/backend/powersync/file-envoi.js";
import { numerosPartages, telephoneDuCompte } from "../supabase/_comptes-parents.mjs";

const lire = (chemin) => readFileSync(new URL(chemin, import.meta.url), "utf8").replace(/\r\n/g, "\n");

// ── Numéros et identifiants ─────────────────────────────────────────────────
const SAISIES = ["622123456", "+224 622 12 34 56", "00224622123456", "622123456 / 664000000", "622 12 34 56",
  "Sambaya", "12345678", "", null, "6221234567", "parent.bah", "mere@exemple.gn", "224622123456"];

test("serveur et app normalisent les numéros à l'identique (shared/phone.js)", () => {
  for (const brut of SAISIES) {
    assert.equal(telServeur.normaliserTel(brut), normaliserTelGuinee(brut), String(brut));
    assert.equal(telServeur.numeroNational(brut), numeroNational(brut), String(brut));
    assert.equal(telServeur.identifiantConnexion(brut), identifiantConnexion(brut), String(brut));
  }
});

test("identifiant = numéro : proposé à la création, reconnu quelle que soit son écriture", () => {
  assert.equal(loginParentSuggere("Bah", "622 12 34 56"), "622123456");
  assert.equal(loginParentSuggere("Barry Diallo", ""), "parent.barrydiallo"); // pas de numéro
  assert.equal(loginParentSuggere("Condé", "Sambaya"), "parent.conde"); // numéro illisible
  assert.equal(identifiantConnexion("+224 622 12 34 56"), "622123456");
  assert.equal(identifiantConnexion(" 622-12-34-56 "), "622123456");
  // Identifiants ordinaires, e-mails et nombres quelconques : intacts.
  assert.equal(identifiantConnexion("parent.bah"), "parent.bah");
  assert.equal(identifiantConnexion("mere@exemple.gn"), "mere@exemple.gn");
  assert.equal(identifiantConnexion("12345"), "12345");
  assert.equal(telephoneLisible("622123456"), "+224 622 12 34 56");
  assert.equal(telephoneLisible("Sambaya"), "Sambaya");
});

test("connexion : l'identifiant exact passe d'abord, le numéro normalisé ensuite", () => {
  const auth = lire("../src/backend/auth-supabase.js");
  const exact = auth.indexOf("connexionParEmail(emailFor(identifiant, schoolId)");
  const numero = auth.indexOf("connexionParEmail(emailFor(numero, schoolId)");
  assert.ok(exact > 0 && numero > exact, "essai exact puis numéro");
  const reset = lire("../supabase/functions/password-reset/index.ts");
  assert.match(reset, /import \{[^}]*\bidentifiantConnexion\b[^}]*\} from "\.\.\/_shared\/telephone\.ts";/);
  assert.ok(reset.indexOf("await chercher(login)") < reset.indexOf("await chercher(numero)"));
});

// ── Règle « même parent » ───────────────────────────────────────────────────
test("noms comparés sans casse, accents, ponctuation ni ordre des mots", () => {
  assert.equal(nomComparable("DIALLO Mamadou"), nomComparable("Mamadou  Diallo"));
  assert.equal(nomComparable("Bah Aïssatou"), nomComparable("bah aissatou"));
  assert.equal(nomComparable("Père: Bah / Mère: Barry"), nomComparable("père bah mère barry"));
  assert.notEqual(nomComparable("Mamadou Diallo"), nomComparable("Mamadou Saliou Diallo"));
  assert.equal(nomComparable(null), "");
});

test("même parent : même nom, puis même numéro — ou même filiation sans numéro", () => {
  const bah = { tuteur: "Bah Alpha", contactTuteur: "622 12 34 56", filiation: "Père: Bah Alpha / Mère: Barry Kadiatou" };
  assert.equal(memeFoyer(bah, { ...bah, tuteur: "ALPHA BAH", contactTuteur: "+224622123456" }), true);
  assert.equal(memeFoyer(bah, { ...bah, contactTuteur: "" }), true);
  assert.equal(memeFoyer(bah, { ...bah, contactTuteur: "", filiation: "Père: Bah Alpha / Mère: Sow Fanta" }), false);
  assert.equal(memeFoyer({ ...bah, contactTuteur: "" }, { ...bah, contactTuteur: "", filiation: "" }), false);
  assert.equal(memeFoyer(bah, { ...bah, contactTuteur: "664000000" }), false);
});

test("un numéro seul ne suffit jamais (numéro de l'école saisi pour des internes)", () => {
  const ecole = "620000000";
  assert.equal(memeFoyer({ tuteur: "Bah Alpha", contactTuteur: ecole }, { tuteur: "Sow Ibrahima", contactTuteur: ecole }), false);
  assert.equal(memeFoyer({ tuteur: "", contactTuteur: ecole }, { tuteur: "Sow Ibrahima", contactTuteur: ecole }), false);
  assert.equal(memeFoyer({ contactTuteur: ecole }, { contactTuteur: ecole }), false);
});

const PERE = { tuteur: "Bah Alpha", contactTuteur: "622123456" };
const MERE = { tuteur: "Barry Kadiatou", contactTuteur: "664000000" };
const compte = (id, champs = {}) => ({
  id, login: `parent.${id}`, statut: "Actif", premiere_co: true, created_at: "2026-01-01",
  extra: {}, telephone: null, profil: {}, foyersEnfants: [], eleveIds: [], ...champs,
});

test("choix du compte : le sien d'abord, puis celui qui suit l'élève, actif, en service, le plus ancien", () => {
  const a = compte("a", { profil: PERE });
  const b = compte("b", { profil: PERE, created_at: "2025-01-01" });
  const enService = compte("c", { profil: PERE, premiere_co: false, created_at: "2026-03-01" });
  const inactif = compte("d", { profil: PERE, statut: "Inactif", premiere_co: false, created_at: "2024-01-01" });
  const suitE1 = compte("z", { profil: PERE, eleveIds: ["e1"], created_at: "2026-06-01" });
  const anonyme = compte("y", { foyersEnfants: [PERE], created_at: "2020-01-01" });
  assert.equal(trouverCompteFoyer([a, b], PERE, ["e1"]).id, "b"); // le plus ancien
  assert.equal(trouverCompteFoyer([a, b, enService], PERE, ["e1"]).id, "c"); // en service
  assert.equal(trouverCompteFoyer([inactif, enService], PERE, ["e1"]).id, "c"); // actif d'abord
  assert.equal(trouverCompteFoyer([enService, suitE1], PERE, ["e1"]).id, "z"); // suit déjà l'élève
  assert.equal(trouverCompteFoyer([anonyme, a], PERE, ["e1"]).id, "a"); // son profil avant une déduction
});

test("père et mère : chacun son compte, même pour les mêmes enfants", () => {
  // Compte de la mère, qui suit un enfant dont la fiche nomme le père.
  const mere = compte("mere", { profil: MERE, foyersEnfants: [PERE], eleveIds: ["e1"] });
  assert.equal(trouverCompteFoyer([mere], PERE, ["e2"]), null); // → le père aura le sien
  assert.equal(trouverCompteFoyer([mere], PERE, ["e1"]), null);
  assert.equal(trouverCompteFoyer([mere], MERE, ["e2"]).id, "mere");
});

test("compte anonyme (migré, sans profil) : reconnu par la fiche d'un enfant qu'il suit", () => {
  const anonyme = compte("anon", { foyersEnfants: [PERE], eleveIds: ["e1"] });
  assert.equal(trouverCompteFoyer([anonyme], PERE, ["e2"]).id, "anon");
  assert.equal(trouverCompteFoyer([anonyme], MERE, ["e2"]), null);
});

test("parent inconnu (fiche sans nom de tuteur) : le compte qui suit déjà l'élève, pas un doublon", () => {
  const suit = compte("suit", { profil: PERE, eleveIds: ["e1"] });
  assert.equal(trouverCompteFoyer([suit], { tuteur: "", contactTuteur: "622123456" }, ["e1"]).id, "suit");
  assert.equal(trouverCompteFoyer([suit], { tuteur: "" }, ["e9"]), null);
});

// ── Faux client service_role (le strict nécessaire de PostgREST) ─────────────
function fauxAdmin(db) {
  const ecritures = [];
  const plages = [];
  const valeur = (ligne, col) => col.split(".").reduce((v, k) => v?.[k], ligne);
  const from = (table) => {
    const filtres = [];
    const egalites = [];
    let plage = null;
    let unique = false;
    let action = "select";
    let charge = null;
    let options = {};
    const selection = () => db[table]
      .map((l) => (table === "parent_eleves" ? { ...l, eleves: db.eleves.find((e) => e.id === l.eleve_id) } : l))
      .filter((l) => filtres.every((f) => f(l)));
    const executer = () => {
      if (action === "upsert") {
        ecritures.push({ table, action, charge, options });
        for (const l of charge) {
          const existe = db[table].find((x) => x.compte_id === l.compte_id && x.eleve_id === l.eleve_id);
          if (!existe) db[table].push({ ...l });
          else if (!options.ignoreDuplicates) Object.assign(existe, l);
        }
        return { error: null };
      }
      if (action === "update") {
        ecritures.push({ table, action, charge, egalites });
        selection().forEach((l) => Object.assign(db[table].find((x) => x.id === l.id), charge));
        return { error: null };
      }
      if (action === "delete") {
        ecritures.push({ table, action, egalites });
        const avant = db[table].length;
        db[table] = db[table].filter((l) => !filtres.every((f) => f(l)));
        return { error: null, count: avant - db[table].length };
      }
      let lignes = selection();
      if (plage) { plages.push(table); lignes = lignes.slice(plage[0], plage[1] + 1); }
      return { data: unique ? lignes[0] || null : lignes, error: null };
    };
    const q = {
      select: () => q,
      order: () => q,
      eq: (col, val) => { filtres.push((l) => valeur(l, col) === val); egalites.push([col, val]); return q; },
      in: (col, vals) => { filtres.push((l) => vals.includes(valeur(l, col))); return q; },
      range: (a, b) => { plage = [a, b]; return q; },
      maybeSingle: () => { unique = true; return q; },
      upsert: (lignes, opts = {}) => { action = "upsert"; charge = [].concat(lignes); options = opts; return q; },
      update: (patch) => { action = "update"; charge = patch; return q; },
      delete: () => { action = "delete"; return q; },
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
    { id: "sow2", ecole_id: "ec1", tuteur: "Sow Ibrahima", contact_tuteur: "664000000", filiation: "" },
    { id: "ailleurs", ecole_id: "ec2", tuteur: "Bah Alpha", contact_tuteur: "622123456", filiation: "" },
  ],
  comptes: [
    // Compte migré : ni profil ni numéro, seule la fiche de l'aîné parle.
    { id: "cpt-bah", ecole_id: "ec1", role: "parent", login: "parent.bah", statut: "Actif", premiere_co: false, created_at: "2025-10-01", telephone: null, extra: {} },
    { id: "cpt-sow", ecole_id: "ec1", role: "parent", login: "parent.sow", statut: "Actif", premiere_co: true, created_at: "2025-10-02", telephone: null, extra: { tuteur: "Sow Ibrahima", contactTuteur: "664000000" } },
    { id: "cpt-autre-ecole", ecole_id: "ec2", role: "parent", login: "parent.x", statut: "Actif", extra: {} },
    { id: "cpt-staff", ecole_id: "ec1", role: "staff", login: "compta", statut: "Actif", extra: {} },
  ],
  parent_eleves: [
    { compte_id: "cpt-bah", eleve_id: "aine", lien: null },
    { compte_id: "cpt-sow", eleve_id: "autre", lien: "pere" },
  ],
});

test("comptes parents : leur profil (numéro de la colonne d'abord) et les fiches de leurs enfants", async () => {
  const db = base();
  db.comptes[1].telephone = "+224664000000";
  db.comptes[1].extra.contactTuteur = "620000000";
  const comptes = await chargerComptesParents(fauxAdmin(db), "ec1");
  const bah = comptes.find((c) => c.id === "cpt-bah");
  assert.deepEqual(bah.eleveIds, ["aine"]);
  assert.equal(bah.foyersEnfants[0].tuteur, "Bah Alpha");
  assert.equal(comptes.find((c) => c.id === "cpt-sow").profil.contactTuteur, "+224664000000");
  assert.equal(comptes.some((c) => c.id === "cpt-staff" || c.id === "cpt-autre-ecole"), false);
});

test("le cadet, dans une autre section, rejoint le compte (anonyme) de l'aîné — sans identité déduite", async () => {
  const db = base();
  const admin = fauxAdmin(db);
  const r = await rattacherAuFoyer(admin, {
    ecoleId: "ec1", eleveIds: ["cadet"], foyer: { tuteur: "Bah Alpha", contactTuteur: "622123456" }, lien: "pere",
  });
  assert.equal(r.compte.id, "cpt-bah");
  assert.equal(r.rattaches, 1);
  assert.deepEqual(db.parent_eleves.find((l) => l.eleve_id === "cadet"), { compte_id: "cpt-bah", eleve_id: "cadet", lien: "pere" });
  // Reconnu par la fiche d'un enfant seulement : le profil du compte reste vide.
  assert.deepEqual(admin.ecritures.map((e) => e.table), ["parent_eleves"]);
});

test("compte reconnu à son profil : complété (numéro), jamais écrasé", async () => {
  const db = base();
  const admin = fauxAdmin(db);
  const r = await rattacherAuFoyer(admin, {
    ecoleId: "ec1", eleveIds: ["sow2"], foyer: { tuteur: "Sow Ibrahima", contactTuteur: "664 00 00 00", filiation: "Père: Sow" },
  });
  assert.equal(r.compte.id, "cpt-sow");
  const sow = db.comptes.find((c) => c.id === "cpt-sow");
  assert.equal(sow.telephone, "+224664000000");
  assert.equal(sow.extra.filiation, "Père: Sow");
  assert.equal(sow.extra.contactTuteur, "664000000"); // pas écrasé
});

test("élève déjà rattaché à un compte complet : rien n'est réécrit", async () => {
  const db = base();
  db.comptes[1].telephone = "+224664000000";
  const admin = fauxAdmin(db);
  const r = await rattacherAuFoyer(admin, {
    ecoleId: "ec1", eleveIds: ["autre"], foyer: { tuteur: "Sow Ibrahima", contactTuteur: "664000000" },
  });
  assert.equal(r.compte.id, "cpt-sow");
  assert.equal(r.rattaches, 0);
  assert.deepEqual(admin.ecritures, []);
});

test("la mère d'un enfant déjà suivi par le père : pas de compte trouvé, le sien sera créé", async () => {
  const db = base();
  const admin = fauxAdmin(db);
  const r = await rattacherAuFoyer(admin, { ecoleId: "ec1", eleveIds: ["autre"], foyer: { tuteur: "Diallo Mariama", contactTuteur: "655000000" } });
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

// ── Rattacher / détacher depuis la fiche élève ──────────────────────────────
test("rattacher : lien de parenté enregistré ; sans lien, un rattachement existant garde le sien", async () => {
  const db = base();
  const admin = fauxAdmin(db);
  assert.deepEqual(await modifierLienParent(admin, { ecoleId: "ec1", compteId: "cpt-sow", eleveId: "cadet", lien: "mere", rattacher: true }), { login: "parent.sow" });
  assert.equal(db.parent_eleves.find((l) => l.eleve_id === "cadet").lien, "mere");
  await modifierLienParent(admin, { ecoleId: "ec1", compteId: "cpt-sow", eleveId: "autre", rattacher: true });
  assert.equal(db.parent_eleves.find((l) => l.eleve_id === "autre").lien, "pere");
  assert.equal(admin.ecritures.at(-1).options.ignoreDuplicates, true);
  assert.equal(lienValide("oncle"), null);
});

test("détacher : le lien disparaît, le compte reste", async () => {
  const db = base();
  const admin = fauxAdmin(db);
  await modifierLienParent(admin, { ecoleId: "ec1", compteId: "cpt-bah", eleveId: "aine", rattacher: false });
  assert.equal(db.parent_eleves.some((l) => l.compte_id === "cpt-bah"), false);
  assert.ok(db.comptes.some((c) => c.id === "cpt-bah"));
  assert.deepEqual(admin.ecritures[0].egalites, [["compte_id", "cpt-bah"], ["eleve_id", "aine"]]);
});

test("rattacher / détacher : compte et élève de l'école de l'appelant, compte parent seulement", async () => {
  for (const [compteId, eleveId, attendu] of [
    ["cpt-autre-ecole", "cadet", /Compte parent introuvable/],
    ["cpt-staff", "cadet", /Compte parent introuvable/],
    ["cpt-bah", "ailleurs", /Élève introuvable/],
  ]) {
    const db = base();
    const admin = fauxAdmin(db);
    const r = await modifierLienParent(admin, { ecoleId: "ec1", compteId, eleveId, rattacher: true });
    assert.equal(r.status, 404);
    assert.match(r.error, attendu);
    assert.deepEqual(admin.ecritures, []);
  }
});

test("Edge Functions : index.ts délègue à foyer.ts et au module téléphone partagé", () => {
  const source = lire("../supabase/functions/account-manage/index.ts");
  assert.match(source, /import \{ fusionnerComptesParents, lienValide, modifierLienParent, rattacherAuFoyer \} from "\.\/foyer\.ts";/);
  assert.match(source, /import \{ normaliserTel \} from "\.\.\/_shared\/telephone\.ts";/);
  assert.match(source, /action === "rattacher_parent" \|\| action === "detacher_parent"/);
  assert.doesNotMatch(source, /function memeFoyer|function normaliserTel/);
});

test("RLS parent_eleves : lecture limitée à l'école, plus aucune écriture depuis le navigateur", () => {
  for (const fichier of ["../supabase/historique/rls.sql", "../supabase/historique/comptes-parents.sql"]) {
    const sql = lire(fichier);
    const politique = sql.match(/create policy parent_eleves_select[\s\S]*?;\n/)?.[0] || "";
    assert.match(politique, /e\.ecole_id = auth_ecole_id\(\)/, fichier);
    assert.match(sql, /drop policy if exists parent_eleves_write on parent_eleves;/, fichier);
    assert.doesNotMatch(sql, /create policy parent_eleves_write/, fichier);
  }
});

// ── Côté app ────────────────────────────────────────────────────────────────
const fratrie = [
  { _id: "e1", prenom: "Aminata", nom: "Bah", classe: "6ème Année", section: "college", sexe: "F",
    tuteur: "Bah Alpha", contactTuteur: "622123456", filiation: "Père: Bah Alpha" },
  { _id: "e2", prenom: "Ibrahima", nom: "Bah", classe: "2ème Année", section: "primaire", sexe: "M",
    tuteur: "Bah Alpha", contactTuteur: "622123456", filiation: "Père: Bah Alpha" },
];

test("charge utile : toute la fratrie, le numéro du parent, pas de section au compte", () => {
  const p = payloadCompteParent({ schoolId: "citadelle", login: " 622123456 ", mdp: "Secret123", eleves: fratrie });
  assert.equal(p.login, "622123456");
  assert.equal(p.role, "parent");
  assert.deepEqual(p.eleveIds, ["e1", "e2"]);
  assert.equal(p.nom, "Bah Alpha");
  assert.equal(p.telephone, "622123456");
  assert.equal(p.lien, null);
  assert.equal("section" in p, false);
  assert.equal("sections" in p, false);
  assert.deepEqual(p.elevesAssocies.map((a) => a.section), ["college", "primaire"]);
});

test("charge utile : compte du second parent, avec son nom, son numéro et son lien", () => {
  const p = payloadCompteParent({
    schoolId: "citadelle", login: "664000000", mdp: "Secret123", eleves: [fratrie[0]],
    parent: { nom: "Barry Kadiatou", telephone: "664 00 00 00", lien: "mere" },
  });
  assert.equal(p.nom, "Barry Kadiatou");
  assert.equal(p.tuteur, "Barry Kadiatou");
  assert.equal(p.telephone, "664 00 00 00");
  assert.equal(p.contactTuteur, "664 00 00 00");
  assert.equal(p.lien, "mere");
  assert.equal(p.filiation, "Père: Bah Alpha"); // celle de l'enfant
});

test("recherche d'un compte parent : numéro quelle que soit l'écriture, nom ou identifiant", () => {
  const comptes = [
    { id: "1", login: "622123456", nom: "Bah Alpha", telephone: "+224622123456", extra: {} },
    { id: "2", login: "parent.conde", nom: "Condé Fatoumata", telephone: "", extra: { contactTuteur: "664 00 00 00" } },
    { id: "3", login: "parent.sow", nom: "Sow Ibrahima", telephone: "", extra: { tuteur: "Sow Ibrahima" } },
  ];
  const ids = (saisie) => chercherComptesParents(comptes, saisie).map((c) => c.id);
  assert.deepEqual(ids("+224 622 12 34 56"), ["1"]);
  assert.deepEqual(ids("664000000"), ["2"]); // numéro du profil (compte d'avant la colonne)
  assert.deepEqual(ids("conde"), ["2"]); // sans accent
  assert.deepEqual(ids("PARENT.SOW"), ["3"]);
  assert.deepEqual(ids("a"), []); // trop court
  assert.equal(chercherComptesParents(comptes, "parent", 1).length, 1);
  assert.equal(libelleLien("mere"), "Mère");
});

test("messages : créé, rattaché au foyer, déjà rattaché — accordés", () => {
  assert.match(messageCompteParent({ login: "622123456", rattache: false }, fratrie), /Compte parent « 622123456 » créé pour Aminata, Ibrahima/);
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

test("saisie rapide hors ligne : on attend la remontée des élèves, jamais indéfiniment", async () => {
  const comptes = [2, 1, 0];
  assert.equal(await attendreFileVide(async () => ({ count: comptes.shift() }), 1000, 1), true);
  assert.equal(await attendreFileVide(async () => { throw new Error("pas ouverte"); }, 1000, 1), true);
  assert.equal(await attendreFileVide(async () => ({ count: 3 }), 30, 5), false);
  const debut = Date.now();
  assert.equal(await attendreFileVide(() => new Promise(() => {}), 50, 5), false);
  assert.ok(Date.now() - debut < 1000);
});

// ── Reprise des numéros (supabase/telephones-parents.mjs) ───────────────────
test("numéro d'un compte existant : son profil, sinon celui — unique — de ses enfants", () => {
  assert.deepEqual(telephoneDuCompte({ extra: { contactTuteur: "622 12 34 56" } }, ["664000000"]),
    { telephone: "+224622123456", source: "profil" });
  assert.deepEqual(telephoneDuCompte({ extra: {} }, ["622123456", "+224 622 12 34 56", ""]),
    { telephone: "+224622123456", source: "enfants" });
  assert.deepEqual(telephoneDuCompte({ extra: {} }, ["622123456", "664000000"]), { telephone: null, source: "ambigu" });
  assert.deepEqual(telephoneDuCompte({ extra: { contactTuteur: "Sambaya" } }, []), { telephone: null, source: "aucun" });
});

test("numéros portés par plusieurs comptes : signalés, pour examen", () => {
  const partages = numerosPartages([
    { login: "parent.bah", telephone: "+224622123456" },
    { login: "parent.bah2", telephone: "+224622123456" },
    { login: "parent.sow", telephone: "+224664000000" },
    { login: "parent.x", telephone: null },
  ]);
  assert.deepEqual(partages.map((p) => [p.telephone, p.comptes.map((c) => c.login)]),
    [["+224622123456", ["parent.bah", "parent.bah2"]]]);
});

// ── Étape 3 : doublons parents, fusion validée par la Direction ────────────
test("app et serveur appliquent la même règle « même parent »", () => {
  const cas = [
    [{ tuteur: "Bah Alpha", contactTuteur: "622123456" }, { tuteur: "ALPHA bah", contactTuteur: "+224 622 12 34 56" }],
    [{ tuteur: "Bah Alpha", contactTuteur: "622123456" }, { tuteur: "Bah Alpha", contactTuteur: "664000000" }],
    [{ tuteur: "Bah Alpha", filiation: "Père: Bah / Mère: Sow" }, { tuteur: "Bah Alpha", filiation: "mère sow père bah" }],
    [{ tuteur: "Bah Alpha" }, { tuteur: "Bah Alpha" }],
    [{ tuteur: "", contactTuteur: "620000000" }, { tuteur: "", contactTuteur: "620000000" }],
    [{ tuteur: "Sow Ibrahima", contactTuteur: "620000000" }, { tuteur: "Camara Fodé", contactTuteur: "620000000" }],
  ];
  for (const [a, b] of cas) assert.equal(memeParent(a, b), memeFoyer(a, b), JSON.stringify([a, b]));
  for (const t of ["DIALLO Mamadou", "Aïssatou Barry-Sow", "", null, "  père : x / mère : y "]) {
    assert.equal(nomComparableApp(t), nomComparable(t), String(t));
  }
});

test("fusion : la Direction, ou un poste qui écrit Comptes & Postes — pas le comptable", () => {
  assert.equal(peutFusionnerParents("direction"), true);
  assert.equal(peutFusionnerParents("superadmin"), true);
  assert.equal(peutFusionnerParents("staff", true), true);
  assert.equal(peutFusionnerParents("staff", false), false);
  assert.equal(peutFusionnerParents("comptable"), false);
  assert.equal(peutFusionnerParents("admin"), false);
});

const baseFusion = () => ({
  eleves: [],
  comptes: [
    { id: "T", ecole_id: "ec1", role: "parent", login: "622123456", statut: "Actif", telephone: null, user_id: "uT", extra: { tuteur: "Bah Alpha" } },
    { id: "S1", ecole_id: "ec1", role: "parent", login: "parent.bah", statut: "Actif", telephone: "+224622123456", user_id: "u1", extra: { filiation: "Père: Bah Alpha" } },
    { id: "S2", ecole_id: "ec1", role: "parent", login: "parent.bah2", statut: "Actif", telephone: null, user_id: null, extra: {} },
    { id: "X", ecole_id: "ec2", role: "parent", login: "ailleurs", statut: "Actif", extra: {} },
    { id: "P", ecole_id: "ec1", role: "staff", login: "compta", statut: "Actif", extra: {} },
    { id: "I", ecole_id: "ec1", role: "parent", login: "inactif", statut: "Inactif", extra: {} },
  ],
  parent_eleves: [
    { compte_id: "T", eleve_id: "e1", lien: null },
    { compte_id: "S1", eleve_id: "e1", lien: "mere" }, // déjà suivi par le compte conservé
    { compte_id: "S1", eleve_id: "e2", lien: "pere" },
    { compte_id: "S2", eleve_id: "e3", lien: null },
    { compte_id: "S2", eleve_id: "e2", lien: null }, // même enfant chez deux absorbés
  ],
});

test("fusion : enfants rattachés au compte conservé, absorbés vidés et désactivés", async () => {
  const db = baseFusion();
  const admin = fauxAdmin(db);
  const r = await fusionnerComptesParents(admin, { ecoleId: "ec1", cibleId: "T", sourceIds: ["S1", "S2", "T", "S1"] });
  assert.deepEqual(r.cible, { id: "T", login: "622123456" });
  assert.deepEqual(r.absorbes, [
    { id: "S1", login: "parent.bah", user_id: "u1" },
    { id: "S2", login: "parent.bah2", user_id: null },
  ]);
  assert.equal(r.liensDeplaces, 2);
  const liens = db.parent_eleves.map((l) => `${l.compte_id}:${l.eleve_id}:${l.lien}`).sort();
  assert.deepEqual(liens, ["T:e1:null", "T:e2:pere", "T:e3:null"]); // le lien existant de e1 est gardé
  const [T, S1, S2] = ["T", "S1", "S2"].map((id) => db.comptes.find((c) => c.id === id));
  assert.equal(T.telephone, "+224622123456"); // complété depuis un absorbé
  assert.equal(T.extra.filiation, "Père: Bah Alpha");
  assert.equal(T.extra.tuteur, "Bah Alpha"); // rien d'écrasé
  for (const s of [S1, S2]) {
    assert.equal(s.statut, "Inactif");
    assert.equal(s.extra.fusionneDans, "T");
  }
  // Rejouer (fusion interrompue puis relancée) ne casse rien.
  const encore = await fusionnerComptesParents(fauxAdmin(db), { ecoleId: "ec1", cibleId: "T", sourceIds: ["S1", "S2"] });
  assert.equal(encore.liensDeplaces, 0);
  assert.equal(db.parent_eleves.length, 3);
});

test("fusion refusée : autre école, pas un parent, compte conservé inactif ou absorbé, rien à fusionner", async () => {
  for (const [cibleId, sourceIds, status, motif] of [
    ["T", ["X"], 404, /introuvable/],
    ["T", ["P"], 404, /introuvable/],
    ["X", ["T"], 404, /introuvable/],
    ["I", ["T"], 409, /compte actif/],
    ["T", [], 400, /au moins un compte/],
    ["T", ["T"], 400, /au moins un compte/],
  ]) {
    const db = baseFusion();
    const admin = fauxAdmin(db);
    const r = await fusionnerComptesParents(admin, { ecoleId: "ec1", cibleId, sourceIds });
    assert.equal(r.status, status, `${cibleId} ← ${sourceIds}`);
    assert.match(r.error, motif);
    assert.deepEqual(admin.ecritures, []);
  }
  const db = baseFusion();
  db.comptes[0].extra.fusionneDans = "autre";
  const r = await fusionnerComptesParents(fauxAdmin(db), { ecoleId: "ec1", cibleId: "T", sourceIds: ["S1"] });
  assert.equal(r.status, 409);
});

test("Edge Function : fusion réservée, comptes absorbés bloqués à la connexion, trace dans audit", () => {
  const source = lire("../supabase/functions/account-manage/index.ts");
  const bloc = source.slice(source.indexOf('if (action === "fusionner_parents")'), source.indexOf('if (action === "reset_password")'));
  assert.match(bloc, /peutFusionnerParents\(caller\.role, callerAdminPanel\)/);
  assert.match(bloc, /ban_duration: "876000h"/);
  assert.match(bloc, /from\("audit"\)\.insert/);
  const auth = lire("../src/backend/auth-supabase.js");
  assert.match(auth, /error\?\.code === "user_banned"/);
  assert.match(auth, /c\.extra\?\.fusionneDans\) return \{ desactive: true, regroupe: true \}/);
  const reset = lire("../supabase/functions/password-reset/index.ts");
  // Compte absorbé : trouverCompte ne le désigne pas → réponse générique.
  assert.match(reset, /\?\.fusionneDans\) return null;/);
  assert.match(reset, /if \(!trouve\) return json\(generique\);/);
});

// Données de l'écran Doublons parents (comptes + liens avec fiche d'élève).
const eleve = (prenom, classe, tuteur, contact = "", filiation = "") =>
  ({ prenom, nom: "Bah", classe, section: "college", tuteur, contact_tuteur: contact, filiation });
const doublons = () => {
  const comptes = [
    { id: "A", login: "622123456", nom: "Bah Alpha", telephone: "+224622123456", statut: "Actif", premiere_co: false, created_at: "2026-02-01", extra: { tuteur: "Bah Alpha" } },
    { id: "B", login: "parent.bah", nom: "Parent", telephone: null, statut: "Actif", premiere_co: true, created_at: "2025-09-01", extra: {} },
    { id: "C", login: "parent.bah2", nom: "Bah Alpha", telephone: null, statut: "Actif", premiere_co: true, created_at: "2025-10-01", extra: { tuteur: "Bah Alpha", contactTuteur: "622 12 34 56" } },
    { id: "D1", login: "parent.sow", nom: "Sow Ibrahima", telephone: "+224620000000", statut: "Actif", premiere_co: true, created_at: "2025-09-01", extra: { tuteur: "Sow Ibrahima" } },
    { id: "D2", login: "parent.camara", nom: "Camara Fodé", telephone: "+224620000000", statut: "Actif", premiere_co: true, created_at: "2025-09-02", extra: { tuteur: "Camara Fodé" } },
    { id: "E1", login: "parent.diallo", nom: "Diallo Mamadou", telephone: null, statut: "Actif", premiere_co: true, created_at: "2025-09-01", extra: { tuteur: "Diallo Mamadou", filiation: "Père: Diallo Mamadou / Mère: Barry Aïssatou" } },
    { id: "E2", login: "parent.diallo2", nom: "Diallo Mamadou", telephone: null, statut: "Actif", premiere_co: true, created_at: "2025-09-03", extra: { tuteur: "MAMADOU DIALLO", filiation: "mère barry aissatou, père diallo mamadou" } },
    { id: "H", login: "parent.diallo3", nom: "Diallo Mamadou", telephone: null, statut: "Actif", premiere_co: true, created_at: "2025-09-04", extra: { tuteur: "Diallo Mamadou", filiation: "Père: Diallo Mamadou / Mère: Sow Fanta" } },
    { id: "F", login: "parent.seul", nom: "Condé", telephone: "+224655000000", statut: "Actif", premiere_co: true, created_at: "2025-09-01", extra: { tuteur: "Condé Fatoumata" } },
    { id: "G", login: "parent.absorbe", nom: "Bah Alpha", telephone: "+224622123456", statut: "Inactif", premiere_co: true, created_at: "2025-09-01", extra: { tuteur: "Bah Alpha", fusionneDans: "A" } },
  ];
  const liens = [
    { compte_id: "A", eleve_id: "e1", lien: "pere", eleves: eleve("Aminata", "7ème A", "Bah Alpha", "622123456") },
    { compte_id: "B", eleve_id: "e2", lien: null, eleves: eleve("Ibrahima", "2ème A", "Bah Alpha", "622 12 34 56") },
    { compte_id: "C", eleve_id: "e3", lien: null, eleves: eleve("Moussa", "CP", "Bah Alpha", "622123456") },
    { compte_id: "Z", eleve_id: "e9", lien: null, eleves: null }, // lien d'une autre école (RLS)
  ];
  return { comptes, liens };
};

test("doublons : même numéro (compte anonyme compris), ou même nom et même filiation", () => {
  const { comptes, liens } = doublons();
  const groupes = groupesDoublons(comptes, liens);
  const resume = groupes.map((g) => [g.comptes.map((c) => c.id).join(","), g.verdict, g.telephone, g.cibleId]);
  assert.deepEqual(resume, [
    ["A,B,C", "meme", "+224622123456", "A"], // A déjà utilisé par le parent → conservé
    ["E1,E2", "meme", null, "E1"], // même nom et même filiation, sans numéro
    ["D2,D1", "a_verifier", "+224620000000", "D1"], // numéro de l'école : noms différents (tri par identifiant)
  ]);
  const bah = groupes[0].comptes.find((c) => c.id === "B");
  assert.deepEqual(bah.enfants.map((e) => `${e.prenom} (${e.classe})`), ["Ibrahima (2ème A)"]);
  // Compte absorbé (G), compte seul (F), homonyme d'une autre famille (H) : hors groupes.
  assert.equal(groupes.some((g) => g.comptes.some((c) => ["F", "G", "H"].includes(c.id))), false);
});

test("doublons : un compte inactif n'est jamais proposé comme compte conservé", () => {
  const { comptes, liens } = doublons();
  comptes.find((c) => c.id === "A").statut = "Inactif";
  const g = groupesDoublons(comptes, liens).find((x) => x.comptes.some((c) => c.id === "A"));
  assert.notEqual(g.cibleId, "A");
  assert.equal(g.cibleId, "B"); // à égalité (jamais connectés, 1 enfant), le plus ancien
});
