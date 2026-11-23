// Code court d'une école (migration 20261123184655_codes_ecole_courts.sql) :
// un mot de son nom, accepté partout où un code d'école est saisi, EN PLUS du
// code d'origine. Le code d'origine reste l'identifiant interne (e-mails de
// connexion, QR, chemins) : la saisie est traduite en lui dès l'écran.
//
// Vérifie : la normalisation de la saisie (navigateur ET base, mêmes
// lettres), la connexion par le code court (e-mail du compte bâti sur le code
// d'origine), le mot de passe oublié et le rattachement (Edge Functions
// appelées avec le code d'origine), et la migration elle-même (gardes
// conservées, fonctions publiques qui acceptent le code court).
//
// Les tests avec Supabase simulé demandent les mocks de modules :
//   node --import tsx --experimental-test-module-mocks --test tests/codes-ecole-courts.test.js
// `npm test` les passe. Sans ce drapeau, ils sont ignorés.
import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { codeEcoleSaisi } from "../src/components/connexion/code-ecole.js";

const ignore = typeof mock.module !== "function"
  && "mocks de modules absents : lancer avec --experimental-test-module-mocks";

// École fictive : nom long, code d'origine tiré du nom, code court = un mot.
const ECOLE = { code: "groupe-scolaire-prive-du-baobab", codeCourt: "baobab", nom: "Groupe Scolaire Privé du Baobab" };

// ── Saisie ─────────────────────────────────────────────────────────────

test("saisie : minuscules, sans espaces autour, sans accents", () => {
  assert.equal(codeEcoleSaisi("  Baobab "), "baobab");
  assert.equal(codeEcoleSaisi("BAÔBÄB"), "baobab");
  assert.equal(codeEcoleSaisi("Écolé-Çà"), "ecole-ca");
  // Le code d'origine se tape toujours comme avant.
  assert.equal(codeEcoleSaisi(" Groupe-Scolaire-Prive-du-Baobab "), ECOLE.code);
  // Espace enseignant : son numéro, inchangé.
  assert.equal(codeEcoleSaisi("+224 622 12 34 56"), "622123456");
  assert.equal(codeEcoleSaisi("superadmin"), "superadmin");
});

// ── Script de pose des codes (supabase/codes-courts.mjs) ──────────────

test("script : contrôle les codes courts avant toute écriture", async () => {
  const { verifierCodesCourts } = await import("../supabase/codes-courts.mjs");
  const ecoles = [
    { id: "1", code: ECOLE.code, code_court: null, nom: ECOLE.nom },
    { id: "2", code: "ecole-primaire-de-la-colline", code_court: "colline", nom: "École Primaire de la Colline" },
    { id: "3", code: "riviere", code_court: null, nom: "Rivière" },
    { id: "4", code: "complexe-scolaire-du-fleuve", code_court: null, nom: "Complexe Scolaire du Fleuve" },
  ];
  const ok = verifierCodesCourts(ecoles, [` ${ECOLE.code}= Baôbab `, "complexe-scolaire-du-fleuve=fleuve"]);
  assert.deepEqual(ok.erreurs, []);
  assert.deepEqual(ok.changements.map((c) => [c.ecole.id, c.avant, c.apres]), [["1", null, "baobab"], ["4", null, "fleuve"]]);

  const refus = (paires) => verifierCodesCourts(ecoles, paires).erreurs;
  assert.match(refus([`${ECOLE.code}=colline`]).join(), /déjà le code de l'école « ecole-primaire-de-la-colline »/);
  assert.match(refus([`${ECOLE.code}=Rivière`]).join(), /déjà le code de l'école « riviere »/, "code d'origine d'une autre école");
  assert.match(refus([`${ECOLE.code}=fleuve`, "complexe-scolaire-du-fleuve=fleuve"]).join(), /déjà le code/, "deux fois dans la liste");
  assert.match(refus([`${ECOLE.code}=deux-mots`]).join(), /un seul mot/);
  assert.match(refus([`${ECOLE.code}=622123456`]).join(), /un seul mot/);
  assert.match(refus([`${ECOLE.code}=demo`]).join(), /réservé/);
  assert.match(refus(["inconnue=mot"]).join(), /aucune école/);
  assert.match(refus(["sans-egal"]).join(), /attendu/);
  // Échange de codes courts dans une même liste : permis.
  assert.deepEqual(verifierCodesCourts(ecoles, ["ecole-primaire-de-la-colline=", `${ECOLE.code}=colline`]).erreurs, []);
  // Retrait, et code inchangé ignoré.
  assert.deepEqual(verifierCodesCourts(ecoles, ["ecole-primaire-de-la-colline=", "riviere="]).changements.map((c) => c.apres), [null]);
});

// ── Migration ──────────────────────────────────────────────────────────

const dossier = new URL("../supabase/migrations/", import.meta.url);
const migrations = readdirSync(dossier).filter((f) => f.endsWith(".sql")).sort();
const lire = (f) => readFileSync(new URL(f, dossier), "utf8");
const MIGRATION = lire(migrations.find((f) => f.endsWith("_codes_ecole_courts.sql")));
// Dernière définition d'une fonction, toutes migrations confondues : c'est
// elle qui est en production après le déploiement.
function derniereDefinition(nom) {
  const motif = new RegExp(`create (?:or replace )?function (?:"?public"?\\.)?"?${nom}"?\\([\\s\\S]*?\\$\\$;`, "gi");
  const toutes = migrations.flatMap((f) => lire(f).match(motif) || []);
  assert.ok(toutes.length, `${nom} introuvable`);
  return toutes.at(-1);
}

test("migration : la base retire les mêmes accents que le navigateur", () => {
  const corps = derniereDefinition("normaliser_code_ecole");
  const [, de, vers] = corps.match(/'([^']{20,})',\s*'([^']{20,})'\)/) || [];
  assert.ok(de && vers, "translate introuvable");
  const lettres = [...de];
  assert.equal(lettres.length, [...vers].length, "les deux listes de translate ont la même longueur");
  lettres.forEach((lettre, i) => {
    // ø (sans décomposition Unicode) n'a pas d'équivalent côté navigateur.
    if (/[øØ]/.test(lettre)) return;
    assert.equal(codeEcoleSaisi(`x${lettre}`), `x${vers[i]}`, `« ${lettre} » → « ${vers[i]} »`);
  });
  for (const lettre of "àâäéèêëîïôöùûüçÀÂÉÈÊËÎÏÔÙÛÇ") assert.ok(de.includes(lettre), `« ${lettre} » traduit`);
});

test("migration : code court d'un seul mot, unique avec TOUS les codes", () => {
  assert.match(MIGRATION, /add column if not exists code_court text/);
  assert.match(MIGRATION, /code_court ~ '\^\[a-z\]\[a-z0-9\]\{1,29\}\$'/, "un mot, une lettre d'abord (pas un numéro)");
  assert.match(MIGRATION, /create unique index if not exists ecoles_code_court_key/);
  const garde = derniereDefinition("ecoles_codes_uniques");
  assert.match(garde, /e\.code = new\.code_court or e\.code_court = new\.code_court/, "code court ≠ codes des autres écoles");
  assert.match(garde, /e\.code_court = new\.code/, "code d'une nouvelle école ≠ code court d'une autre");
  assert.match(MIGRATION, /before insert or update of code, code_court on public\.ecoles/);
});

test("migration : ecoles_guard garde tout, plus le code court", () => {
  const garde = derniereDefinition("ecoles_guard");
  for (const motif of [
    /new\.plan is distinct from old\.plan/,
    /new\.type_espace is distinct from old\.type_espace/,
    /new\.actif is distinct from old\.actif and new\.actif = true/,
    /new\.supprime is distinct from old\.supprime and new\.supprime = false/,
    /new\.code is distinct from old\.code/,
    /new\.code_court is distinct from old\.code_court/,
  ]) assert.match(garde, motif);
});

test("migration : les fonctions publiques qui reçoivent un code acceptent le code court", () => {
  const resolution = derniereDefinition("ecole_id_par_code");
  assert.match(resolution, /e\.code_court = public\.normaliser_code_ecole\(p_code\)/);
  assert.match(resolution, /e\.code = lower\(btrim\(p_code\)\)/, "le code d'origine reste accepté tel quel");
  for (const nom of ["etat_ecole", "annonces_publiques", "login_pour_email"]) {
    assert.match(derniereDefinition(nom), /public\.ecole_id_par_code\(p_code\)/, nom);
  }
  // L'écran de connexion lit le code d'origine ET le code court.
  assert.match(derniereDefinition("etat_ecole"), /code_court text\s*\)/);
  // Pas d'appel direct : seulement via les fonctions ci-dessus.
  assert.match(MIGRATION, /revoke all on function public\.ecole_id_par_code\(text\) from public, anon, authenticated;/);
  assert.match(MIGRATION, /grant execute on function public\.etat_ecole\(text\) to anon, authenticated, service_role;/);
});

// ── Navigateur, Supabase simulé ───────────────────────────────────────

const stock = new Map();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (k) => (stock.has(k) ? stock.get(k) : null),
    setItem: (k, v) => stock.set(k, String(v)),
    removeItem: (k) => stock.delete(k),
  },
});

const etat = {};
function raz() {
  stock.clear();
  Object.assign(etat, { rpc: [], connexions: [], fonctions: [], invoques: [], reseauCoupe: false });
}
raz();

// Miroir de etat_ecole : code d'origine ou code court, normalisé.
function etatEcole(pCode) {
  if (etat.reseauCoupe) return { data: null, error: { message: "TypeError: Failed to fetch" } };
  const n = codeEcoleSaisi(pCode);
  if (n !== ECOLE.code && n !== ECOLE.codeCourt) return { data: [], error: null };
  return {
    data: [{ id: "ec1", code: ECOLE.code, code_court: ECOLE.codeCourt, nom: ECOLE.nom, actif: true, supprime: false, type_espace: "ecole", rattache: false }],
    error: null,
  };
}

const LIGNE = {
  id: "c1", user_id: "u1", login: "dg", nom: "Directeur", role: "direction",
  ecole_id: "ec1", extra: {}, poste: { id: "p1", cle: "direction", label: "Direction", permissions: {}, actif: true },
};
const requete = () => {
  const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: LIGNE, error: null }) };
  return q;
};
const faux = {
  from: requete,
  rpc: async (nom, args) => {
    etat.rpc.push([nom, args]);
    if (nom === "etat_ecole") return etatEcole(args.p_code);
    if (nom === "login_pour_email") return { data: args.p_code === ECOLE.code ? "dg" : null, error: null };
    return { data: null, error: { message: `rpc ${nom} inattendue` } };
  },
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signInWithPassword: async ({ email }) => {
      etat.connexions.push(email);
      return email.startsWith("dg.") ? { data: { user: { id: "u1" } }, error: null } : { data: {}, error: { message: "Invalid login" } };
    },
    signOut: async () => ({ error: null }),
  },
  functions: {
    invoke: async (nom, { body }) => {
      etat.fonctions.push([nom, body]);
      return { data: { ok: true, method: "generic" }, error: null };
    },
  },
};

let modules;
async function monter() {
  if (modules) return modules;
  const url = (chemin) => new URL(chemin, import.meta.url).href;
  mock.module(url("../src/supabaseClient.js"), {
    namedExports: { getSupabase: () => faux, uidSessionEnregistree: () => null, creerClientEphemere: () => faux },
  });
  mock.module(url("../src/backend.js"), {
    namedExports: {
      isSupabase: true,
      emailFor: (login, code) => `${login}.${code}@edugest.app`,
      superadminEmailFor: (login) => `${login}@superadmin.edugest.app`,
    },
  });
  mock.module(url("../src/backend/powersync/tables.js"), { namedExports: { powerSyncConfigured: false } });
  mock.module(url("../src/backend/account-manage-supabase.js"), {
    namedExports: {
      invoke: async (body) => { etat.invoques.push(body); return { ok: true, demandeId: "d1", ecoleNom: ECOLE.nom }; },
    },
  });
  modules = {
    auth: await import("../src/backend/auth-supabase.js"),
    origine: await import("../src/backend/code-ecole-origine.js"),
    reset: await import("../src/backend/password-reset-supabase.js"),
    rattachement: await import("../src/backend/rattachement-supabase.js"),
  };
  return modules;
}

test("connexion par le code court : compte de l'école, code d'origine partout", { skip: ignore }, async (t) => {
  const { auth, origine } = await monter();

  await t.test("code court tapé → e-mail du compte bâti sur le code d'origine", async () => {
    raz();
    const r = await auth.ecoleLogin({ login: "dg", mdp: "x", schoolId: codeEcoleSaisi(" Baôbab ") });
    assert.equal(r.ok, true, r.data?.error);
    assert.deepEqual(etat.connexions, [`dg.${ECOLE.code}@edugest.app`]);
    // La session s'ouvre sur le code d'origine (LC_schoolId, chemins, QR).
    assert.equal(r.data.compte.schoolId, ECOLE.code);
  });

  await t.test("le code d'origine marche toujours", async () => {
    raz();
    const r = await auth.ecoleLogin({ login: "dg", mdp: "x", schoolId: ECOLE.code });
    assert.equal(r.ok, true);
    assert.deepEqual(etat.connexions, [`dg.${ECOLE.code}@edugest.app`]);
    assert.equal(r.data.compte.schoolId, ECOLE.code);
  });

  await t.test("connexion par e-mail réel avec le code court : login cherché dans l'école d'origine", async () => {
    raz();
    const r = await auth.ecoleLogin({ login: "direction@exemple.org", mdp: "x", schoolId: "baobab" });
    assert.equal(r.ok, true);
    assert.deepEqual(etat.rpc.find(([nom]) => nom === "login_pour_email")[1], { p_code: ECOLE.code, p_email: "direction@exemple.org" });
    assert.deepEqual(etat.connexions, [`dg.${ECOLE.code}@edugest.app`]);
  });

  await t.test("code inconnu : la saisie telle quelle, comme avant", async () => {
    raz();
    const r = await auth.ecoleLogin({ login: "dg", mdp: "x", schoolId: "inconnue" });
    assert.equal(r.ok, true);
    assert.deepEqual(etat.connexions, ["dg.inconnue@edugest.app"]);
  });

  await t.test("écran de connexion : l'école trouvée par son code court montre les deux codes", async () => {
    raz();
    const { info, code } = await auth.fetchEtatEcole("baobab");
    assert.equal(code, ECOLE.code);
    assert.equal(info.code, ECOLE.code);
    assert.equal(info.codeCourt, ECOLE.codeCourt);
    assert.equal(info.nom, ECOLE.nom);
  });

  await t.test("codeEcoleOrigine : code court → code d'origine ; réseau coupé → la saisie", async () => {
    raz();
    assert.equal(await origine.codeEcoleOrigine("Baobab"), ECOLE.code);
    assert.equal(await origine.codeEcoleOrigine(ECOLE.code), ECOLE.code);
    assert.equal(await origine.codeEcoleOrigine("inconnue"), "inconnue");
    assert.equal(await origine.codeEcoleOrigine(""), "");
    etat.reseauCoupe = true;
    assert.equal(await origine.codeEcoleOrigine(" Baobab "), "baobab");
  });
});

test("mot de passe oublié et rattachement : Edge Functions appelées avec le code d'origine", { skip: ignore }, async (t) => {
  const { reset, rattachement } = await monter();

  await t.test("demande de réinitialisation", async () => {
    raz();
    await reset.demanderReinitialisation({ schoolId: "baobab", identifiant: "dg" });
    assert.deepEqual(etat.fonctions, [["password-reset", { schoolId: ECOLE.code, identifiant: "dg" }]]);
  });

  await t.test("code reçu par SMS", async () => {
    raz();
    await reset.validerCodeReinitialisation({ schoolId: "baobab", identifiant: "dg", code: "123456", nouveauMdp: "nouveau-mdp" });
    assert.equal(etat.fonctions[0][1].schoolId, ECOLE.code);
    assert.equal(etat.fonctions[0][1].action, "verifier_code");
  });

  await t.test("demande de rattachement d'un enseignant", async () => {
    raz();
    const r = await rattachement.demanderRattachement("Baobab");
    assert.equal(r.ecoleNom, ECOLE.nom);
    assert.deepEqual(etat.invoques, [{ action: "demander_rattachement", codeEcole: ECOLE.code }]);
  });
});
