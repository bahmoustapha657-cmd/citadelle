import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { ligneCarteEnseignant } from "../src/components/ecole/ecole-logic.js";
import { getSessionPermissions, hasRead } from "../shared/postes-config.js";
import { CLES_PAIE_ENSEIGNANT, avecPaie, extrairePaie, fusionnerPaie, indexerPaie } from "../src/paie-enseignants.js";
import { resolveCollection, toRow, transformRow } from "../src/backend/collection-map.js";

// Les chefs de section (Direction primaire, Bureau collège…) ne doivent pas
// voir le salaire des enseignants. L'onglet Enseignants du module École
// affichait le forfait mensuel sur chaque carte du primaire, à quiconque
// ouvrait le module. Le forfait est désormais réservé à qui lit la
// Comptabilité ; les autres voient la classe dont l'enseignant est titulaire.

const RACINE = join(fileURLToPath(import.meta.url), "..", "..");
const titulaire = { prenom: "Aïssatou", nom: "Diallo", classeTitle: "CM1", montantForfait: 1500000, matiere: "" };

test("chef de section : la carte montre la classe, jamais le forfait", () => {
  const ligne = ligneCarteEnseignant(titulaire, { isPrimarySection: true, voitSalaires: false });
  assert.equal(ligne, "Titulaire · CM1");
  assert.doesNotMatch(ligne, /forfait|GNF|500/i);
});

test("chef de section : sans classe de titulaire, la matière (ou rien) — toujours pas de montant", () => {
  assert.equal(ligneCarteEnseignant({ ...titulaire, classeTitle: "" }, { isPrimarySection: true }), "");
  assert.equal(
    ligneCarteEnseignant({ ...titulaire, classeTitle: "", matiere: "Anglais" }, { isPrimarySection: true }),
    "Anglais",
  );
  // Ancien champ de base salariale : même règle.
  const ligne = ligneCarteEnseignant({ salaireBase: 900000 }, { isPrimarySection: true });
  assert.doesNotMatch(ligne, /GNF|900/);
});

test("qui lit la Comptabilité garde le forfait sur la carte", () => {
  const ligne = ligneCarteEnseignant(titulaire, { isPrimarySection: true, voitSalaires: true });
  assert.match(ligne, /^Forfait 1.500.000 GNF$/);
});

test("secondaire et maternelle : la matière, comme avant", () => {
  const prof = { matiere: "Mathématiques", montantForfait: 800000 };
  assert.equal(ligneCarteEnseignant(prof, { isPrimarySection: false, voitSalaires: true }), "Mathématiques");
  assert.equal(ligneCarteEnseignant(prof, { isPrimarySection: false, voitSalaires: false }), "Mathématiques");
});

test("les chefs de section ne lisent pas la Comptabilité ; la direction et le comptable si", () => {
  for (const role of ["primaire", "college", "surveillant"]) {
    assert.equal(hasRead(getSessionPermissions({ role }), "compta"), false, role);
  }
  for (const role of ["direction", "comptable"]) {
    assert.equal(hasRead(getSessionPermissions({ role }), "compta"), true, role);
  }
  // Poste personnalisé : la carte du poste fait foi, dans les deux sens.
  const principal = { role: "staff", permissions: { secondaire: "ecriture", calendrier: "lecture" } };
  assert.equal(hasRead(getSessionPermissions(principal), "compta"), false);
  const intendant = { role: "staff", permissions: { primaire: "lecture", compta: "lecture" } };
  assert.equal(hasRead(getSessionPermissions(intendant), "compta"), true);
});

test("garde-fou : l'onglet Enseignants ne calcule plus le forfait lui-même", () => {
  const liste = readFileSync(join(RACINE, "src/components/ecole/ens-tab/EnsListe.jsx"), "utf8");
  assert.doesNotMatch(liste, /getTeacherMonthlyForfait|montantForfait|salaireBase/);
  assert.match(liste, /ligneCarteEnseignant\(paieDe\(e\), \{ isPrimarySection, voitSalaires \}\)/);
  const hook = readFileSync(join(RACINE, "src/components/ecole/use-ecole.js"), "utf8");
  assert.match(hook, /const voitSalaires = hasRead\(permissions, "compta"\);/);
  // La paie n'est jamais remise sur la fiche qu'on modifie : seulement pour l'affichage.
  assert.match(hook, /const paieDe = \(enseignant\) => \(voitSalaires \? fusionnerPaie\(enseignant, paieParId\) : enseignant\);/);
  assert.doesNotMatch(hook, /avecPaie\(/);
});

// ── Paie sortie de la fiche enseignant (table paie_enseignants) ────────────
// La fiche enseignant est lisible par toute l'école ; la paie part dans une
// table que seule la Comptabilité lit. Côté front : la liste des clés doit
// être EXACTEMENT celle du SQL, et la compta remet la paie sur chaque fiche.

const MIGRATION = readFileSync(join(RACINE, "supabase/migrations/20261027171600_paie_enseignants.sql"), "utf8");

test("clés de paie : la liste du front est celle du SQL (fonction et reprise)", () => {
  const listes = [...MIGRATION.matchAll(/array\[([^\]]+)\]/g)]
    .map((m) => m[1].split(",").map((s) => s.trim().replace(/^'|'$/g, "")));
  assert.equal(listes.length, 2);
  for (const liste of listes) assert.deepEqual(liste, [...CLES_PAIE_ENSEIGNANT]);
});

// Phase 2 : la paie est effacée des fiches, et retirée de toute écriture.
const PHASE2 = readFileSync(join(RACINE, "supabase/migrations/20261027173102_paie_enseignants_hors_fiche.sql"), "utf8");

test("phase 2 : effacement et déplacement portent sur les mêmes clés que le front", () => {
  const listes = [...PHASE2.matchAll(/array\[([^\]]+)\]/g)]
    .map((m) => m[1].split(",").map((s) => s.trim().replace(/^'|'$/g, "")));
  assert.equal(listes.length, 4);
  for (const liste of listes) assert.deepEqual(liste, [...CLES_PAIE_ENSEIGNANT]);
  // Ordre : filet de recopie, retrait de l'ancien déclencheur, effacement, nouveau déclencheur.
  const pos = (motif) => PHASE2.search(motif);
  assert.ok(pos(/insert into public\.paie_enseignants/) < pos(/drop trigger if exists trg_paie_enseignant_recopier/));
  assert.ok(pos(/drop trigger if exists trg_paie_enseignant_recopier/) < pos(/update public\.enseignants/));
  assert.ok(pos(/update public\.enseignants/) < pos(/create trigger trg_paie_enseignant_deplacer before insert or update of extra/));
  // Le filet n'écrase jamais une ligne existante : la table fait foi.
  assert.match(PHASE2, /on conflict \(id\) do nothing;\s+-- ── 2\./);
  // Seule la Comptabilité (ou le serveur) range la paie ; tout le monde la perd sur la fiche.
  assert.match(PHASE2, /new\.extra := new\.extra - array\[[^\]]+\];\s+if coalesce\(auth\.role\(\), 'service_role'\) = 'authenticated' and not has_module_write\('compta'\) then\s+return new;/);
});

test("la table de paie n'est lue et écrite que par la Comptabilité", () => {
  assert.match(MIGRATION, /create policy paie_enseignants_select on public\.paie_enseignants for select to authenticated\s+using \(ecole_id = public\.auth_ecole_id\(\) and public\.has_module_read\('compta'\)\);/);
  assert.match(MIGRATION, /create policy paie_enseignants_write on public\.paie_enseignants to authenticated\s+using \(ecole_id = public\.auth_ecole_id\(\) and public\.has_module_write\('compta'\)\)\s+with check \(ecole_id = public\.auth_ecole_id\(\) and public\.has_module_write\('compta'\)\);/);
  assert.match(MIGRATION, /enable row level security/);
  // Aucune policy pour anon, aucun droit de table pour anon.
  assert.doesNotMatch(MIGRATION, /to anon/);
  // Le déclencheur ne recopie la paie que pour un rédacteur de la compta.
  assert.match(MIGRATION, /= 'authenticated' and not has_module_write\('compta'\) then\s+return null;/);
});

test("fusion : la paie de la table revient sur la fiche, sans toucher au reste", () => {
  const paie = indexerPaie([{ _id: "e1", montantForfait: 1500000, primeHoraire: 0, autre: "ignoré" }]);
  assert.deepEqual(Object.keys(paie.get("e1")), ["montantForfait", "primeHoraire"]);
  const fiche = { _id: "e1", nom: "BALDE", classeTitle: "CP A" };
  assert.deepEqual(fusionnerPaie(fiche, paie), { ...fiche, montantForfait: 1500000, primeHoraire: 0 });
  // Sans ligne de paie : la fiche telle quelle (même objet).
  const autre = { _id: "e2", nom: "SOW" };
  assert.equal(fusionnerPaie(autre, paie), autre);
  assert.deepEqual(avecPaie([fiche, autre], paie).map((e) => e.montantForfait), [1500000, undefined]);
});

test("fusion : une paie encore sur la fiche (saisie en attente) l'emporte", () => {
  const paie = indexerPaie([{ _id: "e1", montantForfait: 1500000, primeParClasse: [] }]);
  const fiche = { _id: "e1", montantForfait: 1800000 };
  assert.deepEqual(fusionnerPaie(fiche, paie), { _id: "e1", montantForfait: 1800000, primeParClasse: [] });
  assert.deepEqual(extrairePaie({ nom: "X", primeHoraire: 15000, forfait: 2 }), { forfait: 2, primeHoraire: 15000 });
});

test("collection paieEnseignants : table plate, paie dans extra", () => {
  assert.deepEqual(resolveCollection("paieEnseignants"), { table: "paie_enseignants", section: null });
  assert.deepEqual(transformRow("paie_enseignants", { id: "e1", ecole_id: "x", extra: { montantForfait: 1 } }),
    { _id: "e1", montantForfait: 1 });
  assert.deepEqual(toRow("paie_enseignants", { _id: "e1", montantForfait: 1 }).row, { extra: { montantForfait: 1 } });
  // tables.js lit import.meta.env (Vite) : on contrôle sa source.
  const tables = readFileSync(join(RACINE, "src/backend/powersync/tables.js"), "utf8");
  assert.match(tables.split("export function estCouvertHorsLigne")[0], /"paie_enseignants",/);
  assert.match(tables, /paie_enseignants: \["extra"\]/);
});

test("garde-fou : toute la Comptabilité lit les enseignants avec leur paie", () => {
  const compta = readFileSync(join(RACINE, "src/components/comptabilite/use-comptabilite.js"), "utf8");
  for (const s of ["College", "Lycee", "Primaire", "Prescolaire"]) {
    assert.match(compta, new RegExp(`const ens${s} = useMemo\\(\\(\\) => avecPaie\\(ens${s}Brut, paieParId\\)`));
  }
  assert.match(compta, /useFirestore\("paieEnseignants"\)/);
});
