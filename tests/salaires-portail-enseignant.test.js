// Onglet « Salaire » du portail enseignant, vide en mode Supabase.
//
// Deux causes : la RLS de `salaires` réservée au module compta (postes.sql,
// 2026-07-17 : un enseignant lisait zéro ligne) et, depuis le hors ligne
// total, la lecture du miroir PowerSync, où seul le bucket compta_data livre
// `salaires`. Remède : une policy de lecture pour l'enseignant, limitée à SES
// fiches (supabase/historique/salaires-enseignant.sql), et une lecture RÉSEAU des fiches
// dans le portail (teacher-portal-supabase.js).
//
// Les tests de bout en bout du portail (fin du fichier) demandent les mocks
// de modules du test runner :
//   node --import tsx --experimental-test-module-mocks --test tests/salaires-portail-enseignant.test.js
// Sans ce drapeau (npm test), ils sont ignorés ; le reste tourne toujours.
import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

import { matchesTeacherAlias, teacherSalaryAliases } from "../src/backend/teacher-scope.js";
import { normalizeSalaryName } from "../src/salary-utils.ts";

const sql = (fichier) => readFileSync(new URL(`../supabase/historique/${fichier}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const DELTA = sql("salaires-enseignant.sql");

// ── Noms de paie de l'enseignant (même règle que mes_noms_paie()) ───────────

test("noms de paie : ceux du compte, plus prénom + nom de SA fiche enseignant", () => {
  const compte = { enseignantId: "f1", enseignantNom: "Awa Camara", nom: "Awa Camara" };
  const roster = [
    { _id: "f1", prenom: "Awa", nom: "Camara Diallo" }, // fiche renommée après la création du compte
    { _id: "f2", prenom: "Sékou", nom: "Touré" },
  ];
  assert.deepEqual(teacherSalaryAliases(compte, roster), ["Awa Camara", "Awa Camara Diallo"]);
  // Fiche introuvable ou compte sans fiche : les noms du compte seuls.
  assert.deepEqual(teacherSalaryAliases({ ...compte, enseignantId: "f9" }, roster), ["Awa Camara"]);
  assert.deepEqual(teacherSalaryAliases({ ...compte, enseignantId: null }, roster), ["Awa Camara"]);
  // Jamais la fiche d'un collègue.
  const aliases = teacherSalaryAliases(compte, roster);
  assert.equal(matchesTeacherAlias("Sékou Touré", aliases), false);
  assert.equal(matchesTeacherAlias("AWA CAMARA DIALLO (prof)", aliases), true);
});

// ── SQL : forme normalisée identique à celle de l'application ───────────────

// Émulation de nom_paie_normalise() à partir des listes RÉELLES du fichier SQL.
function listesTranslate() {
  const corps = DELTA.match(/create or replace function nom_paie_normalise[\s\S]*?\n\$\$;/)?.[0];
  assert.ok(corps, "nom_paie_normalise présente");
  const appel = corps.match(/translate\(\s*regexp_replace\([^\n]*\),\s*([\s\S]*?)\)\),\s*'\\s\+'/)?.[1];
  assert.ok(appel, "appel translate() reconnu");
  const litteraux = (texte) => [...texte.matchAll(/'([^']*)'/g)].map((m) => m[1]).join("");
  const [de, vers] = appel.split(/,\s*\n/).map(litteraux);
  return { de: [...de], vers: [...vers] };
}

test("SQL : nom_paie_normalise() rend la même forme que matchesTeacherAlias", () => {
  const { de, vers } = listesTranslate();
  assert.equal(de.length, vers.length, "translate() : une lettre de remplacement par lettre accentuée");
  const table = new Map(de.map((c, i) => [c, vers[i]]));
  // regexp_replace (suffixe) → translate → lower → espaces réduits → btrim.
  const sqlNorm = (v) => [...String(v ?? "").replace(/\s*\([^)]*\)\s*$/, "")]
    .map((c) => table.get(c) ?? c).join("")
    .toLowerCase().replace(/\s+/g, " ").trim();

  // Toute lettre latine accentuée courante (Latin-1 et Latin étendu A).
  for (let cp = 0xC0; cp <= 0x17F; cp++) {
    const lettre = String.fromCodePoint(cp);
    assert.equal(sqlNorm(`Awa ${lettre}`), normalizeSalaryName(`Awa ${lettre}`), `U+${cp.toString(16)} ${lettre}`);
  }
  for (const nom of [
    "  AÏSSATOU   Bah (prof) ", "Fodé Kéita", "Mamadou Saliou DIALLO (titulaire)", "N'Faly Condé",
    "Élise Œuvray", "Hadja  Kadiatou\tBah", "", null,
  ]) {
    assert.equal(sqlNorm(nom), normalizeSalaryName(nom ?? ""), String(nom));
  }
  assert.equal(sqlNorm("  AÏSSATOU   Bah (prof) "), "aissatou bah");
});

test("SQL : l'enseignant LIT ses seules fiches, n'écrit rien, et anon n'appelle pas la fonction", () => {
  const policy = DELTA.match(/create policy salaires_select_enseignant on salaires[^;]*;/)?.[0];
  assert.ok(policy, "policy présente");
  assert.match(policy, /for select to authenticated/);
  assert.match(policy, /ecole_id = auth_ecole_id\(\)/);
  // Sous-requête sans corrélation : évaluée une fois par requête. Jamais
  // `= any ((select …))` : Postgres y compare le nom au tableau entier
  // (42883 text = text[], vécu à l'exécution le 2026-09-30).
  assert.match(policy, /nom_paie_normalise\(nom\) in \(select unnest\(mes_noms_paie\(\)\)\)/);
  assert.doesNotMatch(policy, /any\s*\(\s*\(\s*select/);
  assert.match(DELTA, /drop policy if exists salaires_select_enseignant on salaires;/);
  // Aucune écriture ouverte : salaires_write (compta) reste seule.
  assert.doesNotMatch(DELTA, /for (all|insert|update|delete)\b/);

  const noms = DELTA.match(/create or replace function mes_noms_paie\(\)[\s\S]*?\n\$\$;/)?.[0];
  assert.ok(noms, "mes_noms_paie présente");
  assert.match(noms, /where c\.user_id = auth\.uid\(\) and c\.role = 'enseignant'/);
  assert.match(noms, /e\.id = c\.enseignant_id and e\.ecole_id = c\.ecole_id/);
  assert.match(DELTA, /revoke execute on function mes_noms_paie\(\) from public, anon;/);
});

test("SQL : rejouer un autre fichier ne retire pas la policy de l'enseignant", () => {
  const dossier = new URL("../supabase/historique/", import.meta.url);
  for (const fichier of readdirSync(dossier).filter((f) => f.endsWith(".sql") && f !== "salaires-enseignant.sql")) {
    assert.doesNotMatch(sql(fichier), /salaires_select_enseignant/, fichier);
  }
});

test("prémisse anti-usurpation : l'enseignant ne peut changer ni son nom ni sa fiche", () => {
  // mes_noms_paie() lit ces trois colonnes de SON compte : comptes_guard doit
  // les figer pour l'intéressé (postes.sql, et sa copie restaurer-gardes.sql).
  for (const fichier of ["postes.sql", "restaurer-gardes.sql"]) {
    const garde = sql(fichier).match(/create or replace function comptes_guard\(\)[\s\S]*?\nend; \$\$;/)?.[0];
    const soiMeme = garde?.match(/if old\.user_id = auth\.uid\(\) then([\s\S]*?)\n {2}else/)?.[1];
    assert.ok(soiMeme, `${fichier} : branche « propre compte » présente`);
    for (const col of ["nom", "enseignant_nom", "enseignant_id"]) {
      assert.match(soiMeme, new RegExp(`new\\.${col} is distinct from old\\.${col}`), `${fichier} : ${col} figé`);
    }
  }
});

// ── Bout en bout : fetchTeacherPortal avec le miroir PowerSync actif ────────

const ignore = typeof mock.module !== "function"
  && "mocks de modules absents : lancer avec --experimental-test-module-mocks";

const ECOLE = { code: "citadelle", id: "ec1" };

async function monterPortail() {
  const url = (chemin) => new URL(chemin, import.meta.url).href;
  // Miroir local d'un ENSEIGNANT : académique rempli, `salaires` vide (aucun
  // bucket ne les lui livre).
  const miroir = {
    enseignants: [{ id: "f1", ecole_id: ECOLE.id, section: "college", prenom: "Awa", nom: "Camara" }],
    salaires: [],
  };
  const luesLocalement = [];
  mock.module(url("../src/backend/powersync/local-data.js"), {
    namedExports: {
      lireLocal: async (table, { section } = {}) => {
        luesLocalement.push(table);
        return (miroir[table] || []).filter((r) => !section || r.section === section);
      },
    },
  });
  mock.module(url("../src/backend/powersync/tables.js"), {
    namedExports: {
      powerSyncConfigured: true,
      estCouvertHorsLigne: () => true,
      parseJsonCols: (_table, ligne) => ligne,
      stringifyJsonCols: (_table, ligne) => ligne,
    },
  });
  // Serveur : ce que la RLS rend à l'enseignant (ses fiches). `reponse`
  // pilote le cas réseau (succès, échec, pas de réponse).
  const serveur = {
    salaires: [
      { id: "s1", ecole_id: ECOLE.id, nom: "Awa Camara", section: "Secondaire", mois: "Octobre", montant_net: 500000, details: {}, annee: "2026-2027" },
    ],
    reponse: "ok",
    requetes: 0,
    annees: [],
  };
  mock.module(url("../src/supabaseClient.js"), {
    namedExports: {
      getSupabase: () => ({
        from: (table) => {
          if (table === "ecoles") {
            return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: ECOLE.id } }) }) }) };
          }
          assert.equal(table, "salaires", "seuls les salaires passent par le réseau");
          let annee = null;
          const q = {
            select: () => q, order: () => q, range: () => q,
            eq: (col, val) => { if (col === "annee") annee = val; return q; },
            then: (resoudre, rejeter) => {
              serveur.requetes += 1;
              if (serveur.reponse === "silence") return new Promise(() => {}).then(resoudre, rejeter);
              if (serveur.reponse === "echec") {
                return Promise.resolve({ data: null, error: { message: "TypeError: Failed to fetch" } }).then(resoudre, rejeter);
              }
              serveur.annees.push(annee);
              const lignes = serveur.salaires.filter((l) => !annee || l.annee === annee);
              return Promise.resolve({ data: lignes, count: lignes.length, error: null }).then(resoudre, rejeter);
            },
          };
          return q;
        },
      }),
    },
  });
  const stock = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: (k) => stock.get(k) ?? null, setItem: (k, v) => stock.set(k, String(v)) },
  });
  const portail = await import("../src/backend/teacher-portal-supabase.js");
  return { ...portail, serveur, luesLocalement };
}

const enseignant = (uid) => ({
  uid, login: uid, schoolId: ECOLE.code, role: "enseignant", section: "college",
  enseignantId: "f1", enseignantNom: "Awa Camara", nom: "Awa Camara", matiere: "Maths",
});

test("portail enseignant : les fiches de paie viennent du serveur, pas du miroir vide", { skip: ignore }, async (t) => {
  const { fetchTeacherPortal, DELAI_SALAIRES_MS, serveur, luesLocalement } = await monterPortail();

  await t.test("fiches de l'enseignant affichées, lues une fois par session", async () => {
    const u = enseignant("u1");
    const portail = await fetchTeacherPortal(u);
    assert.deepEqual(portail.salaires.map((s) => s._id), ["s1"]);
    assert.equal(portail.salaires[0].montantNet, 500000, "forme applicative (transformRow)");
    assert.equal(portail.salairesIndisponibles, false);
    assert.ok(!luesLocalement.includes("salaires"), "jamais lues dans le miroir");
    assert.equal(serveur.requetes, 1);
    // Rechargement après une note enregistrée : pas de nouvel aller-retour.
    await fetchTeacherPortal(u);
    assert.equal(serveur.requetes, 1);
  });

  await t.test("hors ligne : onglet signalé indisponible, et le chargement suivant retente", async () => {
    const u = enseignant("u2");
    serveur.reponse = "echec";
    const horsLigne = await fetchTeacherPortal(u);
    assert.deepEqual(horsLigne.salaires, []);
    assert.equal(horsLigne.salairesIndisponibles, true);
    serveur.reponse = "ok";
    const retour = await fetchTeacherPortal(u);
    assert.deepEqual(retour.salaires.map((s) => s._id), ["s1"]);
    assert.equal(retour.salairesIndisponibles, false);
  });

  await t.test("réseau muet : le portail n'attend pas les salaires au-delà du délai", async () => {
    mock.timers.enable({ apis: ["setTimeout"] });
    try {
      serveur.reponse = "silence";
      // Le délai est armé dès l'appel : on le fait passer aussitôt.
      const enCours = fetchTeacherPortal(enseignant("u3"));
      mock.timers.tick(DELAI_SALAIRES_MS);
      const portail = await enCours;
      assert.deepEqual(portail.salaires, []);
      assert.equal(portail.salairesIndisponibles, true);
    } finally {
      mock.timers.reset();
      serveur.reponse = "ok";
    }
  });

  await t.test("une fiche d'un autre nom n'est jamais affichée, même renvoyée", async () => {
    serveur.salaires = [
      ...serveur.salaires,
      { id: "s2", ecole_id: ECOLE.id, nom: "Sékou Touré", section: "Secondaire", mois: "Octobre", montant_net: 1, details: {} },
    ];
    const portail = await fetchTeacherPortal(enseignant("u4"));
    assert.deepEqual(portail.salaires.map((s) => s._id), ["s1"]);
  });

  await t.test("seules les fiches de l'année de l'école, relues si l'année change", async () => {
    serveur.salaires = [
      ...serveur.salaires,
      { id: "s0", ecole_id: ECOLE.id, nom: "Awa Camara", section: "Secondaire", mois: "Juin", montant_net: 450000, details: {}, annee: "2025-2026" },
    ];
    const u = enseignant("u5");
    const enCours = await fetchTeacherPortal(u, { annee: "2026-2027" });
    assert.deepEqual(enCours.salaires.map((s) => s._id), ["s1"]);
    assert.equal(serveur.annees.at(-1), "2026-2027");
    // Autre année : pas de réponse gardée en session pour l'année précédente.
    const avant = await fetchTeacherPortal(u, { annee: "2025-2026" });
    assert.deepEqual(avant.salaires.map((s) => s._id), ["s0"]);
  });
});
