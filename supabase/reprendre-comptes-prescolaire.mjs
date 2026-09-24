// ════════════════════════════════════════════════════════════════════════
//  Reprise : comptes enseignants de maternelle créés en section « primaire »
// ════════════════════════════════════════════════════════════════════════
// Jusqu'au 2026-09-24, le module École créait les comptes des enseignants de
// maternelle avec la section « primaire » (teacherAccountSection) : ni le
// portail enseignant, ni l'Edge Function account-manage, ni la RLS ne
// connaissaient « prescolaire ». Ces comptes lisent donc les collections du
// PRIMAIRE, où ne figurent ni leur fiche, ni leurs classes, ni leurs élèves :
// portail vide, et un périmètre d'écriture (enseignant_classes) vide ou faux.
//
// Ce script repère les comptes `enseignant` de section « primaire » dont la
// fiche (enseignant_id) est une fiche de MATERNELLE (enseignants.section =
// 'prescolaire'), leur donne la section « prescolaire » et réécrit leur
// périmètre à partir des collections de la maternelle (même calcul que
// populate-teacher-classes.mjs). Relancer ne touche rien : seuls les comptes
// encore « primaire » sont visés.
//
// PRÉREQUIS, dans cet ordre — sinon un compte repris lirait les collections du
// COLLÈGE (ancien front) ou verrait ses notes refusées (ancienne RLS) :
//   1. supabase/prescolaire-3-enseignants.sql appliqué ;
//   2. Edge Function déployée : supabase functions deploy account-manage ;
//   3. front déployé : npm run deploy:pages.
//
// Usage :
//   node supabase/reprendre-comptes-prescolaire.mjs                    → DRY-RUN (rien écrit)
//   node supabase/reprendre-comptes-prescolaire.mjs --ecole citadelle  → une seule école
//   node supabase/reprendre-comptes-prescolaire.mjs --executer --ecole citadelle --compte awa.camara
//                                                                       → UN compte (vérification)
//   node supabase/reprendre-comptes-prescolaire.mjs --executer --ecole citadelle
//   … --limite 1  → ne reprend que le PREMIER compte trouvé
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE } from "./_config.mjs";
import {
  toutesLesLignes, perimetrePourCompte, ecrirePerimetre, repriseMaternelle,
} from "./_comptes-enseignants.mjs";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error("Configuration Supabase absente (supabase/config.local.mjs ou variables d'environnement).");
  process.exit(1);
}
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });
const args = process.argv.slice(2);
const option = (nom) => {
  const i = args.indexOf(nom);
  return i >= 0 ? args[i + 1] : null;
};
const EXECUTER = args.includes("--executer");
const codeEcole = option("--ecole");
const loginCible = option("--compte")?.trim().toLowerCase() || null;
const LIMITE = Number(option("--limite")) || 0;

const listeClasses = (classes) => (classes.length ? classes.join(", ") : "(aucune classe)");

async function reprendreEcole(ecole) {
  const comptes = await toutesLesLignes(() => sb.from("comptes").select("*")
    .eq("ecole_id", ecole.id).eq("role", "enseignant").eq("section", "primaire"));
  const fichesMaternelle = new Map((await toutesLesLignes(() => sb.from("enseignants")
    .select("id, nom, prenom, section").eq("ecole_id", ecole.id).eq("section", "prescolaire")))
    .map((f) => [f.id, f]));

  let cibles = comptes
    .map((compte) => {
      const fiche = fichesMaternelle.get(compte.enseignant_id) || null;
      return { compte, fiche, reprise: repriseMaternelle(compte, fiche) };
    })
    .filter((c) => c.reprise)
    .sort((a, b) => a.compte.login.localeCompare(b.compte.login));
  if (loginCible) cibles = cibles.filter((c) => c.compte.login === loginCible);
  if (LIMITE) cibles = cibles.slice(0, LIMITE);
  if (!cibles.length) return null;

  console.log(`\n── ${ecole.nom || ecole.code} (${ecole.code}) ──`);
  const cache = new Map();
  const repris = [];
  let aExaminer = 0;
  for (const { compte, fiche, reprise } of cibles) {
    const nomFiche = `${fiche.nom || ""} ${fiche.prenom || ""}`.trim();
    if (reprise.aExaminer) {
      aExaminer++;
      console.log(`   ⚠️  ${compte.login} (${nomFiche}) — à examiner, rien écrit : ${reprise.aExaminer}`);
      continue;
    }
    const { data: actuel, error: eActuel } = await sb.from("enseignant_classes")
      .select("section, classe").eq("compte_id", compte.id);
    if (eActuel) throw new Error(`enseignant_classes (${compte.login}) : ${eActuel.message}`);
    const perimetre = await perimetrePourCompte(sb, ecole.id, { ...compte, ...reprise }, cache);

    console.log(`   • ${compte.login} — fiche de maternelle : ${nomFiche}`);
    console.log(`       section du compte : primaire → prescolaire`);
    console.log(`       périmètre actuel  : ${actuel.length ? actuel.map((l) => `${l.classe} (${l.section})`).join(", ") : "(vide)"}`);
    console.log(`       nouveau périmètre : ${listeClasses(perimetre.classes)}`);
    if (!perimetre.classes.length) {
      console.log("       ⚠️  aucune classe trouvée (fiche titulaire, emploi du temps, cahier de textes) :");
      console.log("          le portail restera vide jusqu'à l'affectation, puis populate-teacher-classes.mjs.");
    }
    if (!EXECUTER) {
      repris.push(compte.login);
      continue;
    }

    // ── Écritures : le compte (garde sur l'ancienne section), puis le périmètre.
    const { data: maj, error: eMaj } = await sb.from("comptes").update(reprise)
      .eq("id", compte.id).eq("section", "primaire").select("id");
    if (eMaj) throw new Error(`comptes (${compte.login}) : ${eMaj.message}`);
    if (!maj.length) {
      console.log("       (déjà repris entre-temps — ignoré)");
      continue;
    }
    await ecrirePerimetre(sb, ecole.id, compte, perimetre);
    repris.push(compte.login);
    console.log("       ✅ repris");
  }

  if (EXECUTER && repris.length) {
    // Trace dans le journal de l'école (module Historique).
    const { error: eJournal } = await sb.from("historique").insert({
      ecole_id: ecole.id,
      extra: {
        action: "Reprise des comptes enseignants de maternelle",
        details: `${repris.length} compte(s) passé(s) de la section « primaire » à « prescolaire » : ${repris.join(", ")}`,
        auteur: "Maintenance EduGest",
        date: Date.now(),
      },
    });
    if (eJournal) console.log(`   (journal non écrit : ${eJournal.message})`);
  }
  return { comptes: repris.length, aExaminer };
}

let q = sb.from("ecoles").select("id, code, nom");
if (codeEcole) q = q.eq("code", codeEcole);
const { data: ecoles, error } = await q.order("code");
if (error) { console.error("Lecture des écoles impossible :", error.message); process.exit(1); }

console.log(EXECUTER
  ? "⚠️  MODE EXÉCUTION — les comptes vont être modifiés (prérequis : SQL, Edge Function et front déployés)."
  : "🔎 DRY-RUN — aucune écriture. Ajoutez --executer pour appliquer.");
if (loginCible) console.log(`Compte visé : ${loginCible}`);

const total = { comptes: 0, ecoles: 0, aExaminer: 0 };
for (const ecole of ecoles) {
  const res = await reprendreEcole(ecole);
  if (!res) continue;
  total.ecoles++;
  total.comptes += res.comptes;
  total.aExaminer += res.aExaminer;
}
console.log(`\n${EXECUTER ? "Repris" : "À reprendre"} : ${total.comptes} compte(s) dans ${total.ecoles} école(s).`
  + (total.aExaminer ? ` ${total.aExaminer} compte(s) à examiner, voir ci-dessus.` : ""));
if (!total.ecoles) {
  console.log(loginCible
    ? `(aucun compte à reprendre ne correspond à « ${loginCible} »)`
    : "(rien à faire — aucun compte de maternelle en section primaire)");
}
process.exit(0);
