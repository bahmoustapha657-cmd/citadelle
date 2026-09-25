import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  isTitulaireSection, normalizeSection, noteBelongsToTeacherScope, teacherCollectionSlug,
} from "../src/backend/teacher-scope.js";
import { resolveCollection } from "../src/backend/collection-map.js";
import { SECTIONS_ECOLE } from "../src/constants.js";
import { peutGererRole } from "../supabase/functions/account-manage/droits.ts";
import {
  classesDuPerimetre, ecrirePerimetre, perimetrePourCompte, profilCompte, repriseMaternelle,
} from "../supabase/_comptes-enseignants.mjs";

// La maternelle (« prescolaire ») de bout en bout dans le portail enseignant :
// section et collections lues (teacher-scope.js, teacher-portal-supabase.js),
// création des comptes (Edge Function account-manage), RLS
// (teacher_can_write_note) et reprise des comptes créés « primaire »
// (supabase/reprendre-comptes-prescolaire.mjs).

test("portail : un compte de maternelle lit les collections de la MATERNELLE, plus celles du collège", () => {
  assert.equal(normalizeSection("prescolaire"), "prescolaire");
  assert.equal(normalizeSection(" Prescolaire "), "prescolaire");
  assert.equal(teacherCollectionSlug("prescolaire"), "Prescolaire");
  // Sections historiques et inconnues : inchangées.
  assert.equal(normalizeSection("secondaire"), "college");
  assert.equal(normalizeSection("lycee"), "lycee");
  assert.equal(normalizeSection(""), "college");
  assert.equal(normalizeSection("inconnue"), "college");
});

test("portail : pour chaque section de l'école, les lignes lues et écrites sont celles de SA section", () => {
  // Collections de fetchTeacherPortal, saveNote(s) et saveIncident.
  const collections = (C) => [
    `classes${C}`, `classes${C}_emplois`, `classes${C}_matieres`, `ens${C}`,
    `ens${C}_enseignements`, `eleves${C}`, `eleves${C}_absences`, `notes${C}`,
  ];
  for (const section of SECTIONS_ECOLE) {
    for (const nom of collections(teacherCollectionSlug(section))) {
      assert.equal(resolveCollection(nom)?.section, section, `${section} → ${nom}`);
    }
  }
});

test("titulaire multi-matières : maternelle et primaire, pas le secondaire", () => {
  for (const s of ["prescolaire", "primaire", "Primaire"]) assert.equal(isTitulaireSection(s), true, s);
  for (const s of ["college", "lycee", "secondaire", "", undefined]) assert.equal(isTitulaireSection(s), false, String(s));
});

test("notes affichées en maternelle : toutes les matières de la classe, jamais les élèves d'ailleurs", () => {
  const ids = new Set(["e1"]);
  const noms = new Set(["awa camara"]);
  for (const matiere of ["Langage et Communication", "Graphisme et Écriture"]) {
    assert.equal(noteBelongsToTeacherScope({ eleveId: "e1", matiere }, ids, "", noms, "prescolaire"), true, matiere);
  }
  assert.equal(noteBelongsToTeacherScope({ eleveId: "e2", matiere: "Langage et Communication" }, ids, "", noms, "prescolaire"), false);
  // Traitée comme le secondaire, une titulaire sans matière de profil ne voyait rien.
  assert.equal(noteBelongsToTeacherScope({ eleveId: "e1", matiere: "Langage et Communication" }, ids, "", noms, "college"), false);
});

test("account-manage : la Direction primaire gère aussi les enseignants de maternelle", () => {
  assert.equal(peutGererRole("primaire", "enseignant", "prescolaire"), true);
  assert.equal(peutGererRole("primaire", "enseignant", "primaire"), true);
  // Ce qui reste refusé.
  assert.equal(peutGererRole("primaire", "enseignant", "college"), false);
  assert.equal(peutGererRole("primaire", "enseignant", undefined), false);
  assert.equal(peutGererRole("primaire", "parent", "prescolaire"), false);
  assert.equal(peutGererRole("primaire", "direction", "prescolaire"), false);
  assert.equal(peutGererRole("college", "enseignant", "prescolaire"), false);
  assert.equal(peutGererRole("comptable", "enseignant", "prescolaire"), false);
  // Inchangé pour les autres appelants.
  assert.equal(peutGererRole("college", "enseignant", "lycee"), true);
  assert.equal(peutGererRole("direction", "enseignant", "prescolaire"), true);
  assert.equal(peutGererRole("admin", "enseignant", "prescolaire"), true);
  assert.equal(peutGererRole("staff", "enseignant", "prescolaire", false), false);
  assert.equal(peutGererRole("staff", "enseignant", "prescolaire", true), true);
});

test("account-manage : index.ts applique droits.ts, sans copie locale des règles", () => {
  const source = readFileSync(new URL("../supabase/functions/account-manage/index.ts", import.meta.url), "utf8");
  assert.match(source, /import \{ peutGererRole \} from "\.\/droits\.ts";/);
  assert.doesNotMatch(source, /function peutGererRole/);
});

test("RLS : teacher_can_write_note dispense la maternelle du filtre matière, à l'identique dans les deux fichiers", () => {
  const sql = (fichier) => readFileSync(new URL(`../supabase/${fichier}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
  const definition = (texte) => texte.match(/create or replace function teacher_can_write_note\([\s\S]*?\n\$\$;/)?.[0];
  const canonique = definition(sql("teacher-security.sql"));
  const correctif = definition(sql("prescolaire-3-enseignants.sql"));
  assert.ok(canonique && correctif, "définition présente dans les deux fichiers");
  assert.equal(correctif, canonique, "prescolaire-3-enseignants.sql reprend teacher-security.sql tel quel");
  // Comparaison en ::text : sur une base neuve, 'prescolaire' n'est pas encore
  // dans l'enum quand teacher-security.sql s'applique.
  assert.match(canonique, /ec\.section::text in \('primaire', 'prescolaire'\)/);
});

// ── Reprise des comptes de maternelle créés « primaire » ────────────────────

test("reprise : seuls les comptes « primaire » rattachés à une fiche de maternelle sont repris", () => {
  const ficheMaternelle = { id: "f1", section: "prescolaire" };
  const compte = (champs = {}) => ({
    role: "enseignant", section: "primaire", sections: ["primaire"], enseignant_id: "f1", ...champs,
  });
  const attendu = { section: "prescolaire", sections: ["prescolaire"] };
  assert.deepEqual(repriseMaternelle(compte(), ficheMaternelle), attendu);
  assert.deepEqual(repriseMaternelle(compte({ sections: null }), ficheMaternelle), attendu);
  // Pas concernés.
  assert.equal(repriseMaternelle(compte(), { id: "f2", section: "primaire" }), null, "enseignant du primaire");
  assert.equal(repriseMaternelle(compte(), null), null, "fiche introuvable");
  assert.equal(repriseMaternelle(compte({ section: "prescolaire" }), ficheMaternelle), null, "déjà repris");
  assert.equal(repriseMaternelle(compte({ role: "parent" }), ficheMaternelle), null);
  // Sections mêlées : signalé, jamais modifié.
  const mele = repriseMaternelle(compte({ sections: ["primaire", "college"] }), ficheMaternelle);
  assert.ok(mele.aExaminer, "cas à examiner");
  assert.equal(mele.section, undefined);
});

// Client Supabase simulé : filtres eq, pagination range, delete, insert.
function faussebase(tables) {
  const lectures = [];
  const ecritures = [];
  return {
    lectures,
    ecritures,
    from(table) {
      const filtres = {};
      let suppression = false;
      const q = {
        select: () => q,
        order: () => q,
        eq: (colonne, valeur) => { filtres[colonne] = valeur; return q; },
        range: (de, a) => {
          lectures.push({ table, ...filtres, de });
          const lignes = (tables[table] || [])
            .filter((r) => Object.entries(filtres).every(([k, v]) => r[k] === v));
          return Promise.resolve({ data: lignes.slice(de, a + 1), error: null });
        },
        delete: () => { suppression = true; return q; },
        insert: (lignes) => {
          ecritures.push({ table, insert: lignes });
          return Promise.resolve({ error: null });
        },
        then: (resoudre) => {
          if (suppression) ecritures.push({ table, delete: { ...filtres } });
          resoudre({ error: null });
        },
      };
      return q;
    },
  };
}

test("reprise : le nouveau périmètre est lu dans la maternelle, pages au-delà de 1000 élèves comprises", async () => {
  const ecoleId = "ec1";
  const eleve = (i, section, classe) => ({ id: `e${String(i).padStart(5, "0")}`, ecole_id: ecoleId, section, classe, nom: "X", prenom: "Y" });
  const eleves = [
    eleve(1, "prescolaire", "Petite Section A"),
    ...Array.from({ length: 1000 }, (_, i) => eleve(i + 2, "prescolaire", "Moyenne Section A")),
    // Au-delà de la première page de 1000 : perdue sans pagination.
    eleve(2000, "prescolaire", "Petite Section B"),
    eleve(3000, "primaire", "1ère Année A"),
  ];
  const sb = faussebase({
    eleves,
    enseignants: [{ id: "f1", ecole_id: ecoleId, section: "prescolaire", nom: "Camara", prenom: "Awa", extra: { classeTitle: "Petite Section" } }],
  });
  const compte = {
    id: "c1", user_id: "u1", role: "enseignant", nom: "awa.camara",
    enseignant_id: "f1", enseignant_nom: "Awa Camara", section: "primaire", sections: ["primaire"], extra: {},
  };

  // Tel que créé jusqu'ici : lu dans le primaire, périmètre vide.
  assert.deepEqual(await perimetrePourCompte(sb, ecoleId, compte), { section: "primaire", classes: [] });

  const repris = { ...compte, ...repriseMaternelle(compte, { id: "f1", section: "prescolaire" }) };
  sb.lectures.length = 0;
  const perimetre = await perimetrePourCompte(sb, ecoleId, repris);
  assert.equal(perimetre.section, "prescolaire");
  assert.deepEqual(perimetre.classes.sort(), ["Petite Section A", "Petite Section B"]);
  assert.ok(sb.lectures.every((l) => l.section === "prescolaire"), "uniquement des lignes de la maternelle");
  assert.ok(sb.lectures.some((l) => l.table === "eleves" && l.de === 1000), "deuxième page lue");

  await ecrirePerimetre(sb, ecoleId, repris, perimetre);
  const [suppression, ajout] = sb.ecritures;
  assert.deepEqual(suppression, { table: "enseignant_classes", delete: { compte_id: "c1" } });
  assert.deepEqual(ajout.insert.map((l) => l.classe).sort(), ["Petite Section A", "Petite Section B"]);
  for (const ligne of ajout.insert) {
    assert.deepEqual({ ...ligne, classe: undefined }, {
      compte_id: "c1", ecole_id: ecoleId, section: "prescolaire", classe: undefined, user_id: "u1",
    });
  }
});

test("périmètre : la fiche titulaire se résout en classes réelles d'élèves (logique pure)", () => {
  const u = profilCompte({ nom: "awa.camara", enseignant_id: "f1", enseignant_nom: "Awa Camara", section: "prescolaire" });
  const classes = classesDuPerimetre(u, {
    roster: [{ _id: "f1", nom: "Camara", prenom: "Awa", classeTitle: "Grande Section" }],
    eleves: [{ classe: "Grande Section A" }, { classe: "Grande Section B" }, { classe: "Moyenne Section A" }],
  });
  assert.deepEqual(classes.sort(), ["Grande Section A", "Grande Section B"]);
});
