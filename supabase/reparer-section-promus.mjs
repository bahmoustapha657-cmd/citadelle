// ════════════════════════════════════════════════════════════════════════
//  Réparation : élèves promus dans une autre section mais restés rangés
//  dans l'ancienne
// ════════════════════════════════════════════════════════════════════════
// Jusqu'au correctif de la promotion (admin-promotion.js), un élève qui
// changeait de SECTION en changeant de classe recevait sa nouvelle classe
// mais gardait sa colonne `section` : chaque module ne lisant que la sienne,
// il restait affiché dans l'ancienne. Constaté à La Citadelle à la rentrée
// 2026 : 36 élèves de Grande Section passés en « 1ère Année A » et toujours
// visibles au préscolaire.
//
// Ce script range ces fiches dans leur nouvelle section. Il ne vise QUE l'état
// qu'une promotion a pu produire : un élève de la section S dont la classe est
// le PREMIER niveau de la section suivante (préscolaire → 1ère Année / CP,
// primaire → 7ème Année / 6ème, collège → 11ème Année / Seconde).
//
// Les notes, appréciations et absences des années passées RESTENT dans
// l'ancienne section : elles décrivent l'année vécue là-bas (programme,
// barème et périodicité de cette section). En revanche, si des lignes de
// l'année EN COURS y ont déjà été saisies, le script s'arrête sans rien
// écrire : elles appartiennent à la nouvelle classe et demandent un examen
// au cas par cas.
//
// Usage :
//   node supabase/reparer-section-promus.mjs                    → DRY-RUN (rien écrit)
//   node supabase/reparer-section-promus.mjs --ecole citadelle  → une seule école
//   node supabase/reparer-section-promus.mjs --executer --ecole citadelle
//   … --limite 1  → n'en déplace qu'UN (vérification avant la passe complète)
import cfg from "./config.local.mjs";
import { createClient } from "@supabase/supabase-js";
import { getNiveauxForSection, getSectionForClasse } from "../src/constants.js";

const sb = createClient(cfg.url, cfg.serviceRole);
const args = process.argv.slice(2);
const EXECUTER = args.includes("--executer");
const LIMITE = (() => {
  const i = args.indexOf("--limite");
  return i >= 0 ? Number(args[i + 1]) || 0 : 0;
})();
const codeEcole = (() => {
  const i = args.indexOf("--ecole");
  return i >= 0 ? args[i + 1] : null;
})();

const ORDRE = ["prescolaire", "primaire", "college", "lycee"];
// Premier niveau de chaque section, dans les deux systèmes : c'est là, et
// seulement là, qu'atterrit un élève promu depuis la section précédente.
const premiersNiveaux = (section) => ["guineen", "francophone"]
  .map((systeme) => getNiveauxForSection(section, systeme)[0].toLowerCase());
const estPremierNiveau = (classe, section) => {
  const c = String(classe || "").trim().toLowerCase();
  return premiersNiveaux(section).some((n) => c === n || c.startsWith(`${n} `));
};
// Section où la fiche aurait dû passer, ou null si elle est à sa place.
const sectionAttendue = (eleve) => {
  const suivante = ORDRE[ORDRE.indexOf(eleve.section) + 1];
  if (!suivante || !estPremierNiveau(eleve.classe, suivante)) return null;
  return getSectionForClasse(eleve.classe) === suivante ? suivante : null;
};

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

async function reparerEcole(ecole) {
  const eleves = await pagineTout("eleves", "id, nom, prenom, classe, section, statut", ecole.id);
  const toutes = eleves.map((e) => ({ ...e, vers: sectionAttendue(e) })).filter((e) => e.vers);
  const cibles = LIMITE ? toutes.slice(0, LIMITE) : toutes;
  if (!cibles.length) return null;

  const anneeCourante = ecole.extra?.anneeScolaire || "";
  console.log(`\n── ${ecole.nom || ecole.code} (${ecole.code}) — année en cours : ${anneeCourante || "?"} ──`);

  // Lignes liées restées dans l'ANCIENNE section.
  const ids = new Set(cibles.map((e) => e.id));
  const bloquantes = [];
  for (const table of ["notes", "appreciations", "absences"]) {
    const colonnes = table === "absences" ? "id, eleve_id, section, date" : "id, eleve_id, section, annee";
    const liees = (await pagineTout(table, colonnes, ecole.id))
      .filter((l) => ids.has(l.eleve_id) && l.section === cibles.find((e) => e.id === l.eleve_id).section);
    const parAnnee = liees.reduce((acc, l) => {
      const cle = l.annee || "(sans année)";
      acc[cle] = (acc[cle] || 0) + 1;
      return acc;
    }, {});
    if (liees.length) console.log(`   ${table} dans l'ancienne section : ${JSON.stringify(parAnnee)}`);
    // Absences : pas de colonne année — toute absence restée derrière est
    // suspecte. Notes/appréciations : seules celles de l'année en cours.
    const enCours = table === "absences" ? liees : liees.filter((l) => l.annee === anneeCourante);
    if (enCours.length) bloquantes.push(`${enCours.length} ${table}`);
  }

  const groupes = cibles.reduce((acc, e) => {
    const cle = `${e.section} → ${e.vers} | ${e.classe}`;
    (acc[cle] ||= []).push(e);
    return acc;
  }, {});
  for (const [cle, liste] of Object.entries(groupes)) {
    console.log(`   ${cle} : ${liste.length} élève(s)`);
    console.log(`     ${liste.map((e) => `${e.nom} ${e.prenom}${e.statut !== "Actif" ? ` [${e.statut}]` : ""}`).join(", ")}`);
  }

  if (bloquantes.length) {
    console.log(`   ⛔ Lignes de l'année en cours restées dans l'ancienne section (${bloquantes.join(", ")}) :`);
    console.log("      rien n'est écrit pour cette école — à examiner au cas par cas.");
    return { eleves: 0, bloquee: true };
  }
  if (!EXECUTER) return { eleves: cibles.length };

  // ── Écritures ─────────────────────────────────────────────────────────────
  // Filtré aussi sur l'ancienne section : relancer le script ne touche rien.
  let deplaces = 0;
  for (const [de, vers] of [...new Set(cibles.map((e) => `${e.section}|${e.vers}`))].map((s) => s.split("|"))) {
    const lot = cibles.filter((e) => e.section === de && e.vers === vers).map((e) => e.id);
    for (let i = 0; i < lot.length; i += 200) {
      const { data, error } = await sb.from("eleves").update({ section: vers })
        .eq("ecole_id", ecole.id).eq("section", de).in("id", lot.slice(i, i + 200)).select("id");
      if (error) throw new Error(`eleves(${de} → ${vers}): ${error.message}`);
      deplaces += data.length;
    }
  }
  // Trace dans le journal de l'école (module Historique).
  const { error: eJournal } = await sb.from("historique").insert({
    ecole_id: ecole.id,
    extra: {
      action: "Correction de la promotion",
      details: `${deplaces} élève(s) promu(s) rangé(s) dans leur nouvelle section (${Object.keys(groupes).join(" ; ")})`,
      auteur: "Maintenance EduGest",
      date: Date.now(),
    },
  });
  if (eJournal) console.log(`   (journal non écrit : ${eJournal.message})`);
  console.log(`   ✅ ${deplaces} fiche(s) déplacée(s)`);
  return { eleves: deplaces };
}

let q = sb.from("ecoles").select("id, code, nom, extra");
if (codeEcole) q = q.eq("code", codeEcole);
const { data: ecoles, error } = await q.order("code");
if (error) { console.error("Lecture des écoles impossible :", error.message); process.exit(1); }

console.log(EXECUTER
  ? "⚠️  MODE EXÉCUTION — les données vont être modifiées."
  : "🔎 DRY-RUN — aucune écriture. Ajoutez --executer pour appliquer.");

const total = { eleves: 0, ecoles: 0, bloquees: 0 };
for (const ecole of ecoles) {
  const res = await reparerEcole(ecole);
  if (!res) continue;
  total.ecoles++;
  total.eleves += res.eleves;
  if (res.bloquee) total.bloquees++;
}
console.log(`\n${EXECUTER ? "Déplacé" : "À déplacer"} : ${total.eleves} élève(s) dans ${total.ecoles - total.bloquees} école(s).`
  + (total.bloquees ? ` ${total.bloquees} école(s) bloquée(s), voir ci-dessus.` : ""));
if (!total.ecoles) console.log("(rien à faire — aucune fiche promue restée dans son ancienne section)");
process.exit(0);
