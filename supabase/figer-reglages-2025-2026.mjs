// ════════════════════════════════════════════════════════════════════════
//  Réglages 2025-2026 reconstitués depuis l'ancien Firestore (La Citadelle)
// ════════════════════════════════════════════════════════════════════════
// Depuis reglages-annee.js, la clôture fige les réglages d'évaluation de
// l'année (matières de chaque section, périodicité, formes, modèle de
// bulletin) et une année close se consulte avec les siens. 2025-2026 a été
// clôturée AVANT ce mécanisme : rien n'est figé, ses bulletins se calculent
// avec les réglages de 2026-2027. Constaté le 2026-11-02 :
//  • collège réglé en SEMESTRES en 2025-2026, en trimestres aujourd'hui —
//    les 1 495 notes S1/S2 du collège n'apparaissent dans aucune période ;
//  • « Calcul écrit » au coefficient 2, aujourd'hui 1 ;
//  • dix matières créées depuis pour toutes les classes du primaire, qui
//    comptent 0 dans chaque bulletin 2025-2026.
//
// L'ancien Firestore, figé le 2026-07-07 (fin d'année, avant la promotion),
// a les réglages réels de l'année. La maternelle vivait alors dans le
// primaire, sous les noms « Maternelle A/B/D » : ses matières passent dans la
// section préscolaire sous les noms ACTUELS des classes (mêmes
// correspondances que reparer-instantanes-2025-2026.mjs).
//
// Usage :
//   node supabase/figer-reglages-2025-2026.mjs             → DRY-RUN (rien écrit)
//   node supabase/figer-reglages-2025-2026.mjs --executer  → écrit l'instantané
import cfg from "./config.local.mjs";
import { createClient } from "@supabase/supabase-js";
import { lecteurFirestore } from "./_firestore-lecture.mjs";
import { CLES_REGLAGES_ECOLE, figerReglages } from "../src/reglages-annee.js";

const sb = createClient(cfg.url, cfg.serviceRole);
const EXECUTER = process.argv.includes("--executer");
const CODE = "citadelle";
const ANNEE = "2025-2026";
const MATERNELLE = { "Maternelle A": "Petite Section A", "Maternelle B": "Moyenne Section A", "Maternelle D": "Grande Section A" };
const estMaternelle = (classe) => /^\s*maternelle/i.test(classe);

// Matière Firestore → matière d'une section, ses classes réduites à celles
// de la section. Liste vide d'origine = toutes les classes (gardée telle
// quelle) ; liste qui se vide en route = la matière n'était pas de la section.
const pourSection = (matiere, garder) => {
  const { classesEdit: _ignore, ...m } = matiere;
  const origine = m.classes || [];
  if (!origine.length) return { ...m, classes: [] };
  const classes = garder(origine);
  return classes.length ? { ...m, classes } : null;
};

const { data: ecole, error: eEcole } = await sb.from("ecoles").select("id, nom, extra").eq("code", CODE).single();
if (eEcole) { console.error("École introuvable :", eEcole.message); process.exit(1); }
if (ecole.extra?.reglagesAnnees?.[ANNEE]) {
  console.log(`Réglages ${ANNEE} déjà figés (${ecole.extra.reglagesAnnees[ANNEE].figesLe}) : rien à faire.`);
  process.exit(0);
}

const lire = await lecteurFirestore(CODE);
const infoFirestore = await lire.ecole();
const primaire = await lire("classesPrimaire_matieres");
const college = await lire("classesCollege_matieres");

const matieresParSection = {
  prescolaire: primaire.map((m) => pourSection(m, (cl) => cl.map((c) => MATERNELLE[c]).filter(Boolean))).filter(Boolean),
  primaire: primaire.map((m) => pourSection(m, (cl) => cl.filter((c) => !estMaternelle(c)))).filter(Boolean),
  college: college.map((m) => pourSection(m, (cl) => cl)).filter(Boolean),
  lycee: [],
};
const reglagesFirestore = Object.fromEntries(CLES_REGLAGES_ECOLE.filter((k) => infoFirestore[k] !== undefined).map((k) => [k, infoFirestore[k]]));
// La maternelle suivait le rythme du primaire (pas de réglage à elle alors).
reglagesFirestore.periodicitePrescolaire = infoFirestore.periodicitePrimaire || "trimestre";
const instantane = {
  ...figerReglages(reglagesFirestore, matieresParSection),
  source: "Firestore citadelle-school, état du 2026-07-07 (fin 2025-2026)",
};

console.log(EXECUTER ? "⚠️  MODE EXÉCUTION — la fiche école va être modifiée." : "🔎 DRY-RUN — aucune écriture. Ajoutez --executer pour appliquer.");
console.log(`${ecole.nom} : réglages ${ANNEE}`, JSON.stringify({ ...instantane.ecole, evaluationForms: "(formes de 2025-2026)" }));
for (const [section, liste] of Object.entries(instantane.matieres)) {
  console.log(`  ${section} (${liste.length}) : ${liste.map((m) => `${m.nom} ×${m.coefficient || 1}${m.classes.length ? ` [${m.classes.join(", ")}]` : ""}`).join(" · ") || "—"}`);
}

// Contrôle : chaque note 2025-2026 a-t-elle sa matière dans l'instantané,
// pour la section de la note et la classe d'archive de l'élève ?
const lireTout = async (table, cols, filtre) => {
  const out = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await filtre(sb.from(table).select(cols).eq("ecole_id", ecole.id)).order("id").range(de, de + 999);
    if (error) { console.error(`Lecture ${table} :`, error.message); process.exit(1); }
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
};
const eleves = await lireTout("eleves", "id, classe, extra", (q) => q);
const notes = await lireTout("notes", "id, eleve_id, section, matiere, periode", (q) => q.eq("annee", ANNEE));
const classeAnnee = new Map(eleves.map((e) => [e.id, e.extra?.historique?.[ANNEE]?.classe || e.classe]));
const orphelines = {};
for (const n of notes) {
  const classe = classeAnnee.get(n.eleve_id);
  const ok = (instantane.matieres[n.section] || []).some((m) => m.nom === n.matiere && (!m.classes.length || m.classes.includes(classe)));
  if (!ok) { const k = `${n.section} · ${n.matiere} · ${classe}`; orphelines[k] = (orphelines[k] || 0) + 1; }
}
const nbOrph = Object.values(orphelines).reduce((s, v) => s + v, 0);
console.log(`\nNotes ${ANNEE} : ${notes.length}, dont ${nbOrph} sans matière correspondante dans l'instantané.`);
for (const [k, v] of Object.entries(orphelines).sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(`  ${k} : ${v}`);

if (!EXECUTER) process.exit(0);

// Fusion atomique de la seule clé reglagesAnnees (les autres années figées,
// s'il y en avait, sont gardées).
const reglagesAnnees = { ...(ecole.extra?.reglagesAnnees || {}), [ANNEE]: instantane };
const { data: maj, error: eMaj } = await sb.rpc("fusionner_extra_ecole", { p_code: CODE, p_champs: { reglagesAnnees } });
if (eMaj || !maj) { console.error("Écriture refusée :", eMaj?.message || "aucune ligne modifiée"); process.exit(1); }
const { error: eJournal } = await sb.from("historique").insert({
  ecole_id: ecole.id,
  extra: {
    action: "Correction des archives",
    details: `Réglages ${ANNEE} (matières, coefficients, périodicité, formes, modèle de bulletin) reconstitués depuis l'ancienne base : l'année se consulte avec ses propres réglages`,
    auteur: "Maintenance EduGest",
    date: Date.now(),
  },
});
if (eJournal) console.log(`  (journal non écrit : ${eJournal.message})`);
console.log(`\n✅ Réglages ${ANNEE} figés sur la fiche école.`);
process.exit(0);
