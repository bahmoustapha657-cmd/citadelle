// ════════════════════════════════════════════════════════════════════════
//  Réparation : classe 2025-2026 des instantanés de fin d'année (La Citadelle)
// ════════════════════════════════════════════════════════════════════════
// Une année passée se consulte avec la classe de l'instantané de clôture
// (eleves.extra.historique[annee].classe, cf. classePourAnnee). À La
// Citadelle, 2025-2026 a été promue « à l'ancienne » PUIS clôturée : chaque
// instantané a reçu la classe d'APRÈS la promotion. Résultat constaté le
// 2026-11-02 : 385 élèves sur 459 rangés une classe trop haut dans l'archive,
// soit 7 780 notes moyennées contre le programme de la classe suivante — les
// « notes perdues » vues par la direction.
//
// La vraie classe de 2025-2026 est celle de l'ancien Firestore, figé le
// 2026-07-07 (fin d'année, avant la promotion) ; chaque fiche migrée garde son
// identifiant Firestore dans extra.firestore_id. Seule la CLASSE de
// l'instantané change : la scolarité figée à la clôture (mensualités, frais)
// est la bonne et n'est pas touchée. L'ancienne valeur reste dans
// `classeAvantCorrection`.
//
// Maternelle : les classes de 2025-2026 s'appelaient « Maternelle A/B/D ».
// Les passages observés donnent A = Petite Section, B = Moyenne Section,
// D = Grande Section (les 35 enfants de D sont tous passés en 1ère Année) :
// on écrit le nom ACTUEL de la classe, que l'école, ses matières et
// getSectionForClasse connaissent.
//
// Usage :
//   node supabase/reparer-instantanes-2025-2026.mjs                       → DRY-RUN (rien écrit)
//   node supabase/reparer-instantanes-2025-2026.mjs --executer --limite 1 → un seul élève
//   node supabase/reparer-instantanes-2025-2026.mjs --executer --eleve <uuid>
//   node supabase/reparer-instantanes-2025-2026.mjs --executer            → tous
import cfg from "./config.local.mjs";
import { createClient } from "@supabase/supabase-js";
import { lecteurFirestore } from "./_firestore-lecture.mjs";

const sb = createClient(cfg.url, cfg.serviceRole);
const args = process.argv.slice(2);
const arg = (nom) => { const i = args.indexOf(nom); return i >= 0 ? args[i + 1] : null; };
const EXECUTER = args.includes("--executer");
const LIMITE = Number(arg("--limite")) || 0;
const ELEVE = arg("--eleve");
const CODE = arg("--ecole") || "citadelle";
const ANNEE = "2025-2026";

const CORRESPONDANCES = {
  citadelle: { "Maternelle A": "Petite Section A", "Maternelle B": "Moyenne Section A", "Maternelle D": "Grande Section A" },
};
const t = (v) => String(v || "").trim();
const classeReelle = (classeFirestore) => {
  const c = t(classeFirestore);
  return (CORRESPONDANCES[CODE] || {})[c] || c;
};

const { data: ecole, error: eEcole } = await sb.from("ecoles").select("id, code, nom").eq("code", CODE).single();
if (eEcole) { console.error("École introuvable :", eEcole.message); process.exit(1); }

const lire = await lecteurFirestore(CODE);
const classeFirestore = new Map();
for (const sec of ["Primaire", "College", "Lycee", "Prescolaire"]) {
  for (const d of await lire(`eleves${sec}`)) classeFirestore.set(d._id, d.classe);
}

const eleves = [];
for (let de = 0; ; de += 1000) {
  const { data, error } = await sb.from("eleves").select("id, nom, prenom, section, classe, statut, extra, updated_at")
    .eq("ecole_id", ecole.id).order("id").range(de, de + 999);
  if (error) { console.error("Lecture des élèves :", error.message); process.exit(1); }
  eleves.push(...data);
  if (data.length < 1000) break;
}

const toutes = eleves.flatMap((e) => {
  const fid = e.extra?.firestore_id;
  const snap = e.extra?.historique?.[ANNEE];
  if (!fid || !snap || !classeFirestore.has(fid)) return [];
  const apres = classeReelle(classeFirestore.get(fid));
  const avant = t(snap.classe);
  return apres && apres !== avant ? [{ ...e, avant, apres }] : [];
});
const cibles = (ELEVE ? toutes.filter((e) => e.id === ELEVE) : toutes).slice(0, LIMITE || undefined);

console.log(EXECUTER ? "⚠️  MODE EXÉCUTION — les données vont être modifiées." : "🔎 DRY-RUN — aucune écriture. Ajoutez --executer pour appliquer.");
console.log(`${ecole.nom} (${CODE}) : ${toutes.length} instantané(s) ${ANNEE} à corriger, ${cibles.length} visé(s) par cette passe.`);
const groupes = {};
for (const e of cibles) (groupes[`${e.avant} → ${e.apres}`] ||= []).push(`${e.prenom} ${e.nom}`);
for (const [g, noms] of Object.entries(groupes).sort()) console.log(`  ${g} : ${noms.length}${noms.length <= 3 ? ` (${noms.join(", ")})` : ""}`);

if (!EXECUTER || !cibles.length) process.exit(0);

// ── Écritures ───────────────────────────────────────────────────────────────
// Relecture de chaque fiche juste avant l'écriture, et écriture conditionnée à
// son updated_at : une modification faite entre-temps par l'école n'est jamais
// écrasée (la fiche est signalée et laissée en l'état).
let corriges = 0;
const conflits = [];
for (const e of cibles) {
  const { data: frais, error } = await sb.from("eleves").select("extra, updated_at").eq("id", e.id).single();
  if (error) { conflits.push(`${e.prenom} ${e.nom} (lecture : ${error.message})`); continue; }
  const historique = { ...(frais.extra?.historique || {}) };
  const snap = historique[ANNEE];
  if (!snap || t(snap.classe) !== e.avant) { conflits.push(`${e.prenom} ${e.nom} (instantané changé entre-temps)`); continue; }
  historique[ANNEE] = { ...snap, classe: e.apres, classeAvantCorrection: e.avant, classeCorrigeeLe: new Date().toISOString() };
  const { data: maj, error: eMaj } = await sb.from("eleves").update({ extra: { ...frais.extra, historique } })
    .eq("id", e.id).eq("updated_at", frais.updated_at).select("id");
  if (eMaj || !maj?.length) { conflits.push(`${e.prenom} ${e.nom} (${eMaj?.message || "fiche modifiée entre-temps"})`); continue; }
  corriges++;
  if (cibles.length <= 3) console.log(`  ✅ ${e.prenom} ${e.nom} (${e.id}) : ${e.avant} → ${e.apres}`);
}

// Trace dans le journal de l'école (module Historique).
const { error: eJournal } = await sb.from("historique").insert({
  ecole_id: ecole.id,
  extra: {
    action: "Correction des archives",
    details: `${corriges} élève(s) : classe ${ANNEE} de l'archive remise à celle de fin d'année (avant la promotion)`,
    auteur: "Maintenance EduGest",
    date: Date.now(),
  },
});
if (eJournal) console.log(`  (journal non écrit : ${eJournal.message})`);
console.log(`\n✅ ${corriges} instantané(s) corrigé(s).${conflits.length ? ` ⚠️ ${conflits.length} laissé(s) en l'état : ${conflits.join(" ; ")}` : ""}`);
process.exit(0);
