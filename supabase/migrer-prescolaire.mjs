// ════════════════════════════════════════════════════════════════════════
//  Migration : classes de maternelle → section 'prescolaire'
// ════════════════════════════════════════════════════════════════════════
// Le préscolaire est devenu une section à part entière (voir prescolaire.sql).
// Les classes de maternelle existantes portent encore section='primaire' :
// ce script les rebascule, avec les lignes liées (notes, absences,
// appréciations, matières, emplois, enseignements) dont la colonne `section`
// doit rester cohérente.
//
// PRÉREQUIS : exécuter supabase/prescolaire-1-enum.sql puis prescolaire-2-permissions.sql AVANT (la valeur d'enum
// 'prescolaire' doit exister).
//
// Usage :
//   node supabase/migrer-prescolaire.mjs                  → DRY-RUN (rien écrit)
//   node supabase/migrer-prescolaire.mjs --executer        → applique
//   node supabase/migrer-prescolaire.mjs --executer --ecole citadelle
//
// Renommage éventuel des classes (« Maternelle A » → « Petite Section A »…) :
// il n'est PAS deviné. Les suffixes A/B/D sont des divisions, pas des niveaux —
// seule l'école sait laquelle correspond à quel niveau. Fournissez-le
// explicitement si vous le souhaitez :
//   --renommer "Maternelle A=Petite Section A,Maternelle B=Moyenne Section B"
// Sans cette option, les noms de classes sont conservés (ils restent reconnus
// comme préscolaire par getSectionForClasse).
import cfg from "./config.local.mjs";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(cfg.url, cfg.serviceRole);
const args = process.argv.slice(2);
const EXECUTER = args.includes("--executer");
const codeEcole = (() => {
  const i = args.indexOf("--ecole");
  return i >= 0 ? args[i + 1] : null;
})();
const renommages = (() => {
  const i = args.indexOf("--renommer");
  if (i < 0) return {};
  return (args[i + 1] || "").split(",").reduce((acc, paire) => {
    const [de, vers] = paire.split("=").map((s) => (s || "").trim());
    if (de && vers) acc[de] = vers;
    return acc;
  }, {});
})();

// Motif des classes de maternelle (miroir de RE_CLASSE_PRESCOLAIRE côté app).
const EST_PRESCOLAIRE = (nom) => /^\s*(maternelle|(petite|moyenne|grande)\s+section)/i.test(nom || "");

// Tables portant une colonne `section` à recaler, et leur lien à l'élève/classe.
const TABLES_PAR_ELEVE = ["notes", "absences", "appreciations"];
const TABLES_PAR_CLASSE = ["matieres", "emplois", "enseignements"];
// `tarifs` référence la classe par son NOM mais garde `section` à null (les
// tarifs sont résolus par nom de classe, cf. collection-map). En cas de
// renommage il faut donc suivre le nom, SANS toucher à la section : sinon la
// scolarité des élèves migrés devient introuvable (montant remis à 0).
const TABLES_RENOMMAGE_SEUL = ["tarifs"];

async function pagineTout(table, colonnes, ecoleId) {
  const lignes = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await sb.from(table).select(colonnes)
      .eq("ecole_id", ecoleId).order("id").range(de, de + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    lignes.push(...data);
    if (data.length < 1000) break;
  }
  return lignes;
}

async function migrerEcole(ecole) {
  const eleves = await pagineTout("eleves", "id, classe, section", ecole.id);
  const classes = await pagineTout("classes", "id, nom, section", ecole.id);

  const elevesCibles = eleves.filter((e) => EST_PRESCOLAIRE(e.classe) && e.section !== "prescolaire");
  const classesCibles = classes.filter((c) => EST_PRESCOLAIRE(c.nom) && c.section !== "prescolaire");
  if (!elevesCibles.length && !classesCibles.length) return null;

  const idsEleves = elevesCibles.map((e) => e.id);
  const nomsClasses = [...new Set(classesCibles.map((c) => c.nom))];

  // Compte des lignes liées (pour le rapport)
  const compte = {};
  for (const t of TABLES_PAR_ELEVE) {
    if (!idsEleves.length) { compte[t] = 0; continue; }
    const { count } = await sb.from(t).select("*", { count: "exact", head: true })
      .eq("ecole_id", ecole.id).in("eleve_id", idsEleves);
    compte[t] = count || 0;
  }
  for (const t of [...TABLES_PAR_CLASSE, ...TABLES_RENOMMAGE_SEUL]) {
    if (!nomsClasses.length) { compte[t] = 0; continue; }
    const { count } = await sb.from(t).select("*", { count: "exact", head: true })
      .eq("ecole_id", ecole.id).in("classe", nomsClasses);
    compte[t] = count || 0;
  }

  const parClasse = elevesCibles.reduce((acc, e) => {
    acc[e.classe] = (acc[e.classe] || 0) + 1;
    return acc;
  }, {});

  console.log(`\n── ${ecole.nom || ecole.code} (${ecole.code}) ──`);
  console.log(`   classes à basculer : ${classesCibles.length}`);
  for (const c of classesCibles) {
    const cible = renommages[c.nom];
    console.log(`     • ${c.nom}${cible ? `  →  ${cible}` : ""}  (${parClasse[c.nom] || 0} élève(s))`);
  }
  console.log(`   élèves : ${elevesCibles.length}`);
  for (const [t, n] of Object.entries(compte)) if (n) console.log(`   ${t} : ${n} ligne(s)`);

  if (!EXECUTER) return { eleves: elevesCibles.length, classes: classesCibles.length };

  // ── Écritures ─────────────────────────────────────────────────────────────
  // Ordre : lignes liées d'abord (elles se réfèrent aux anciens noms de
  // classe), puis élèves, puis classes.
  for (const t of TABLES_PAR_ELEVE) {
    if (!idsEleves.length) continue;
    for (let i = 0; i < idsEleves.length; i += 200) {
      const lot = idsEleves.slice(i, i + 200);
      const { error } = await sb.from(t).update({ section: "prescolaire" })
        .eq("ecole_id", ecole.id).in("eleve_id", lot);
      if (error) throw new Error(`${t}: ${error.message}`);
    }
  }
  for (const t of TABLES_PAR_CLASSE) {
    if (!nomsClasses.length) continue;
    const { error } = await sb.from(t).update({ section: "prescolaire" })
      .eq("ecole_id", ecole.id).in("classe", nomsClasses);
    if (error) throw new Error(`${t}: ${error.message}`);
  }
  // Renommage : le nom de classe est une clé fonctionnelle (élèves, emplois,
  // matières, enseignements ET tarifs). Tout doit suivre, sinon la scolarité
  // et l'emploi du temps se retrouvent orphelins.
  for (const [de, vers] of Object.entries(renommages)) {
    const { error } = await sb.from("eleves").update({ classe: vers })
      .eq("ecole_id", ecole.id).eq("classe", de);
    if (error) throw new Error(`eleves(renommage ${de}): ${error.message}`);
    for (const t of [...TABLES_PAR_CLASSE, ...TABLES_RENOMMAGE_SEUL]) {
      const { error: e2 } = await sb.from(t).update({ classe: vers })
        .eq("ecole_id", ecole.id).eq("classe", de);
      if (e2) throw new Error(`${t}(renommage ${de}): ${e2.message}`);
    }
  }
  for (let i = 0; i < idsEleves.length; i += 200) {
    const lot = idsEleves.slice(i, i + 200);
    const { error } = await sb.from("eleves").update({ section: "prescolaire" })
      .eq("ecole_id", ecole.id).in("id", lot);
    if (error) throw new Error(`eleves: ${error.message}`);
  }
  for (const c of classesCibles) {
    const patch = { section: "prescolaire" };
    if (renommages[c.nom]) patch.nom = renommages[c.nom];
    const { error } = await sb.from("classes").update(patch).eq("id", c.id);
    if (error) throw new Error(`classes(${c.nom}): ${error.message}`);
  }
  console.log("   ✅ appliqué");
  return { eleves: elevesCibles.length, classes: classesCibles.length };
}

let q = sb.from("ecoles").select("id, code, nom");
if (codeEcole) q = q.eq("code", codeEcole);
const { data: ecoles, error } = await q.order("code");
if (error) { console.error("Lecture des écoles impossible :", error.message); process.exit(1); }

console.log(EXECUTER
  ? "⚠️  MODE EXÉCUTION — les données vont être modifiées."
  : "🔎 DRY-RUN — aucune écriture. Ajoutez --executer pour appliquer.");
if (Object.keys(renommages).length) console.log("Renommages demandés :", renommages);

let total = { eleves: 0, classes: 0, ecoles: 0 };
for (const ecole of ecoles) {
  const res = await migrerEcole(ecole);
  if (res) { total.eleves += res.eleves; total.classes += res.classes; total.ecoles++; }
}
console.log(`\n${EXECUTER ? "Migré" : "À migrer"} : ${total.eleves} élève(s), ${total.classes} classe(s), ${total.ecoles} école(s).`);
if (!total.ecoles) console.log("(rien à faire — aucune classe de maternelle en section primaire)");
process.exit(0);
