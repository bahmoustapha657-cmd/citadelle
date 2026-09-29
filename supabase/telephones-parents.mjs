// ════════════════════════════════════════════════════════════════════════
//  Reprise : téléphone des comptes parents existants (comptes.telephone)
// ════════════════════════════════════════════════════════════════════════
// Depuis comptes-parents.sql, un compte parent porte le numéro de son
// titulaire (comptes.telephone), rempli à la création par l'Edge Function
// account-manage. Ce script le remplit pour les comptes créés AVANT : numéro
// du profil (extra.contactTuteur), sinon celui — unique — des fiches de ses
// enfants. Il ne remplace jamais un numéro déjà présent ; relancer ne touche
// que les comptes encore sans numéro.
//
// Il liste aussi les numéros portés par plusieurs comptes parents : doublons
// probables (un parent, plusieurs comptes), à examiner et fusionner dans
// Comptes & Postes → Doublons parents, ou numéro vraiment partagé (celui de
// l'école pour des internes). À lancer AVANT la recherche de doublons : un
// compte qui porte son numéro est rapproché plus sûrement.
//
// PRÉREQUIS : supabase/comptes-parents.sql appliqué (colonne telephone).
//
// Usage :
//   node supabase/telephones-parents.mjs                               → DRY-RUN (rien écrit)
//   node supabase/telephones-parents.mjs --ecole citadelle             → une seule école
//   node supabase/telephones-parents.mjs --executer --ecole citadelle  → écrit
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE } from "./_config.mjs";
import { numerosPartages, telephoneDuCompte } from "./_comptes-parents.mjs";

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

// PostgREST plafonne chaque réponse à 1000 lignes : lecture par pages.
async function toutes(construire) {
  const lignes = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await construire().range(de, de + 999);
    if (error) throw new Error(error.message);
    lignes.push(...data);
    if (data.length < 1000) return lignes;
  }
}

async function traiterEcole(ecole) {
  const comptes = await toutes(() => sb.from("comptes")
    .select("id, login, nom, telephone, extra").eq("ecole_id", ecole.id).eq("role", "parent").order("id"));
  if (!comptes.length) return;
  const liens = await toutes(() => sb.from("parent_eleves")
    .select("compte_id, eleve_id, eleves!inner(ecole_id, contact_tuteur)")
    .eq("eleves.ecole_id", ecole.id).order("compte_id").order("eleve_id"));
  const contacts = new Map();
  for (const l of liens) contacts.set(l.compte_id, [...(contacts.get(l.compte_id) || []), l.eleves?.contact_tuteur]);

  console.log(`\n── ${ecole.nom || ecole.code} (${ecole.code}) : ${comptes.length} compte(s) parent(s) ──`);
  const bilan = { deja: 0, profil: 0, enfants: 0, ambigu: 0, aucun: 0 };
  for (const compte of comptes) {
    if (compte.telephone) { bilan.deja++; continue; }
    const { telephone, source } = telephoneDuCompte(compte, contacts.get(compte.id) || []);
    bilan[source]++;
    if (!telephone) {
      if (source === "ambigu") console.log(`   ⚠️  ${compte.login} : enfants aux numéros différents — à renseigner à la main.`);
      continue;
    }
    compte.telephone = telephone;
    if (EXECUTER) {
      const { error } = await sb.from("comptes").update({ telephone }).eq("id", compte.id).is("telephone", null);
      if (error) throw new Error(`${compte.login} : ${error.message}`);
    }
  }
  console.log(`   déjà renseignés : ${bilan.deja} · ${EXECUTER ? "remplis" : "à remplir"} : ${bilan.profil + bilan.enfants}`
    + ` (profil ${bilan.profil}, enfants ${bilan.enfants}) · ambigus : ${bilan.ambigu} · sans numéro : ${bilan.aucun}`);

  const partages = numerosPartages(comptes);
  if (partages.length) {
    console.log(`   Numéros portés par plusieurs comptes (${partages.length}) — doublons probables, ou numéro partagé :`);
    for (const { telephone, comptes: liste } of partages) {
      console.log(`     ${telephone} → ${liste.map((c) => `${c.login}${c.nom ? ` (${c.nom})` : ""}`).join(", ")}`);
    }
  }
}

let requete = sb.from("ecoles").select("id, code, nom").order("code");
if (codeEcole) requete = requete.eq("code", codeEcole.trim().toLowerCase());
const { data: ecoles, error } = await requete;
if (error) {
  console.error("❌", error.message);
  process.exit(1);
}
if (!ecoles.length) {
  console.error(`❌ Aucune école${codeEcole ? ` avec le code « ${codeEcole} »` : ""}.`);
  process.exit(1);
}
console.log(EXECUTER ? "Mode EXÉCUTION : les numéros sont écrits." : "DRY-RUN : rien n'est écrit (ajoutez --executer).");
try {
  for (const ecole of ecoles) await traiterEcole(ecole);
} catch (e) {
  const colonneAbsente = /telephone/.test(e.message) && /column|colonne/i.test(e.message);
  console.error(`❌ ${e.message}${colonneAbsente ? "\n   → Appliquez d'abord supabase/comptes-parents.sql." : ""}`);
  process.exit(1);
}
process.exit(0);
