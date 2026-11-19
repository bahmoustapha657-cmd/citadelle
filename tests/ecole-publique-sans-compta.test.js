// École publique SANS COMPTABILITÉ (lot A, décision du 2026-11-19) :
// primaire gratuit, enseignants payés par l'État, seule contribution des
// familles = cotisation APEAE gérée par les parents. On vérifie :
//  - les modules et onglets retirés (Fondation, paiement en ligne) et la
//    Comptabilité gardée pour les seules présences du personnel ;
//  - le retrait automatique des « non réinscrits » coupé (sinon toutes les
//    classes se vident au 1er novembre : personne n'y paie l'inscription),
//    dans l'app comme dans la tâche planifiée ;
//  - le rapport annuel imprimé sans finances, mensualités, salaires ni fondateur ;
//  - notes et bulletins jamais retenus « pour impayé » ;
//  - le type d'établissement par défaut, qui ne dit plus « privé ».
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isModuleOuvertPourEcole } from "../src/constants.js";
import {
  TYPE_ECOLE_PRIVEE, TYPE_ECOLE_PUBLIQUE, blocageImpayeActif, moduleOuvertEcolePublique, ongletParametresOuvertPublique,
  sansComptabilite, statutNormalise, typeApresChangementStatut, typeEtablissementParDefaut,
} from "../src/ecole-publique.js";
import { estBloquePourImpaye } from "../src/mensualite-utils.ts";
import { computeBlocage } from "../src/components/portail-parent/portail-parent-derive.js";
import {
  delaiRetraitEcole, retraitEnVigueur, sansNonReinscritsEcartes,
} from "../src/ecartes-non-reinscrits.js";
import { rappelNonReinscrits } from "../src/rappel-reinscriptions.js";
import { infoEcole } from "../supabase/functions/rappel-reinscriptions/cibles.ts";
import { computeRapportAnnuel } from "../src/reports/rapport-annuel/rapport-data.js";
import { buildRapportAnnuelHTML } from "../src/reports/rapport-annuel/rapport-html.js";
import { mergeSchoolInfo } from "../src/hooks/school-data-helpers.js";

const PUBLIQUE = { statutEtablissement: "public", anneeScolaire: "2026-2027", moisDebut: "Octobre" };
const PRIVEE = { statutEtablissement: "prive", anneeScolaire: "2026-2027", moisDebut: "Octobre" };
const ENSEIGNANT = { typeEspace: "enseignant", anneeScolaire: "2026-2027", moisDebut: "Octobre" };
// 19 novembre 2026 : la règle d'une école privée (1 mois) est en vigueur.
const APRES_RETRAIT = new Date(2026, 10, 19, 10);
// Élèves inscrits depuis l'onglet Élèves : aucun paiement, jamais.
const eleve = (_id, classe = "6ème Année A") => ({ _id, classe, statut: "Actif", inscriptionPayee: false, mens: {} });
const ELEVES = [eleve("a"), eleve("b"), eleve("c", "1ère Année A")];

test("sans comptabilité : l'école publique et l'espace d'un enseignant, pas l'école privée", () => {
  assert.equal(sansComptabilite(PUBLIQUE), true);
  assert.equal(sansComptabilite(ENSEIGNANT), true);
  assert.equal(sansComptabilite(PRIVEE), false);
  assert.equal(sansComptabilite({}), false);
  assert.equal(sansComptabilite(null), false);
});

test("menu d'une école publique : pas de Fondation, la Comptabilité reste pour les présences", () => {
  assert.equal(isModuleOuvertPourEcole("fondation", PUBLIQUE), false);
  assert.equal(isModuleOuvertPourEcole("compta", PUBLIQUE), true);
  assert.equal(isModuleOuvertPourEcole("parametres", PUBLIQUE), true);
  assert.equal(isModuleOuvertPourEcole("primaire", PUBLIQUE), true);
  // Une école privée garde tout.
  assert.equal(isModuleOuvertPourEcole("fondation", PRIVEE), true);
  assert.equal(moduleOuvertEcolePublique(PRIVEE, "fondation"), true);
});

test("Paramètres d'une école publique : pas d'onglet Paiement en ligne", () => {
  assert.equal(ongletParametresOuvertPublique(PUBLIQUE, "paiement"), false);
  assert.equal(ongletParametresOuvertPublique(PUBLIQUE, "identite"), true);
  assert.equal(ongletParametresOuvertPublique(PRIVEE, "paiement"), true);
});

test("retrait des non réinscrits : jamais dans une école publique ni chez un enseignant seul", () => {
  assert.equal(delaiRetraitEcole(PUBLIQUE), 0);
  assert.equal(delaiRetraitEcole(ENSEIGNANT), 0);
  // Même si un délai avait été réglé quand l'école se disait privée.
  assert.equal(delaiRetraitEcole({ ...PUBLIQUE, retraitNonReinscrits: 2 }), 0);
  assert.equal(retraitEnVigueur(PUBLIQUE, "2026-2027", APRES_RETRAIT), false);
  assert.deepEqual(sansNonReinscritsEcartes(ELEVES, PUBLIQUE, "2026-2027", APRES_RETRAIT).map((e) => e._id), ["a", "b", "c"]);
  assert.equal(rappelNonReinscrits(ELEVES, PUBLIQUE, { maintenant: APRES_RETRAIT }), null);
  // L'école privée, elle, garde sa règle : sans paiement, l'élève est écarté.
  assert.equal(delaiRetraitEcole(PRIVEE), 1);
  assert.equal(retraitEnVigueur(PRIVEE, "2026-2027", APRES_RETRAIT), true);
  assert.deepEqual(sansNonReinscritsEcartes(ELEVES, PRIVEE, "2026-2027", APRES_RETRAIT), []);
});

test("tâche planifiée : le statut public de la fiche coupe aussi le rappel du matin", () => {
  const info = infoEcole({ statutEtablissement: "public", anneeScolaire: "2026-2027" }, APRES_RETRAIT);
  assert.equal(info.statutEtablissement, "public");
  assert.equal(retraitEnVigueur(info, info.anneeScolaire, APRES_RETRAIT), false);
  const privee = infoEcole({ anneeScolaire: "2026-2027" }, APRES_RETRAIT);
  assert.equal(retraitEnVigueur(privee, privee.anneeScolaire, APRES_RETRAIT), true);
});

test("rapport annuel d'une école publique : ni finances, ni mensualités, ni salaires, ni fondateur", () => {
  const modele = computeRapportAnnuel({
    annee: "2026-2027", eleves: ELEVES, absences: [], notes: [], recettes: [], depenses: [], salaires: [],
    ensC: [{ nom: "Professeur" }], ensP: [{ nom: "Instituteur" }], ensL: [], ensPre: [],
  });
  const publique = buildRapportAnnuelHTML(modele, PUBLIQUE);
  for (const argent of ["Recettes", "Solde annuel", "Recouvrement", "Dépenses+Salaires", "Fondateur"]) {
    assert.equal(publique.includes(argent), false, `« ${argent} » ne doit pas figurer`);
  }
  assert.match(publique, /Élèves actifs/);
  assert.match(publique, /Enseignants/);
  // L'école privée garde son rapport complet.
  const privee = buildRapportAnnuelHTML(modele, PRIVEE);
  for (const argent of ["Recettes", "Solde annuel", "Recouvrement", "Fondateur"]) {
    assert.equal(privee.includes(argent), true, `« ${argent} » doit figurer`);
  }
});

test("type d'établissement : « École publique » par défaut, jamais « Privé » pour une école publique", () => {
  assert.equal(typeEtablissementParDefaut(PUBLIQUE), TYPE_ECOLE_PUBLIQUE);
  assert.equal(typeEtablissementParDefaut(PRIVEE), TYPE_ECOLE_PRIVEE);
  assert.equal(mergeSchoolInfo({ statutEtablissement: "public" }).type, TYPE_ECOLE_PUBLIQUE);
  assert.equal(mergeSchoolInfo({}).type, TYPE_ECOLE_PRIVEE);
  assert.equal(mergeSchoolInfo({ statutEtablissement: "public", type: "Lycée 2 Octobre" }).type, "Lycée 2 Octobre");
  // Changement de statut dans Paramètres : un type par défaut suit, un type saisi reste.
  assert.equal(typeApresChangementStatut(TYPE_ECOLE_PRIVEE, "public"), TYPE_ECOLE_PUBLIQUE);
  assert.equal(typeApresChangementStatut(TYPE_ECOLE_PUBLIQUE, "prive"), TYPE_ECOLE_PRIVEE);
  assert.equal(typeApresChangementStatut("", "public"), TYPE_ECOLE_PUBLIQUE);
  assert.equal(typeApresChangementStatut("Lycée 2 Octobre", "prive"), "Lycée 2 Octobre");
  assert.equal(statutNormalise("public"), "public");
  assert.equal(statutNormalise("PUBLIC"), "prive");
  assert.equal(statutNormalise(undefined), "prive");
});

test("notes et bulletins jamais retenus pour impayé dans une école publique", () => {
  // Réglage resté actif d'avant le passage au statut public.
  const publique = { ...PUBLIQUE, blocageParentImpaye: true };
  assert.equal(blocageImpayeActif(publique), false);
  assert.equal(blocageImpayeActif({ ...PRIVEE, blocageParentImpaye: true }), true);
  assert.equal(blocageImpayeActif(PRIVEE), false);
  const MOIS = ["Octobre", "Novembre", "Décembre"];
  assert.equal(estBloquePourImpaye(publique, eleve("a"), MOIS, "2026-2027"), false);
  assert.equal(computeBlocage(publique, eleve("a"), MOIS, "2026-2027").accesBloqueParPaiement, false);
});

test("textes de l'école publique présents en français, anglais et arabe", () => {
  const CLES = ["attendanceMenuDesc", "attendanceSubtitle", "attendanceRule", "statusLabel", "statusPrivate", "statusPublic", "statusHint"];
  for (const langue of ["fr", "en", "ar"]) {
    const textes = JSON.parse(readFileSync(new URL(`../src/i18n/locales/${langue}.json`, import.meta.url), "utf8")).publicSchool || {};
    for (const cle of CLES) assert.ok(textes[cle], `${langue}: publicSchool.${cle}`);
    // La règle des présences ne parle pas de paie : aucun salaire en jeu.
    assert.equal(/\{\{days\}\}/.test(textes.attendanceRule), false, `${langue}: pas de calcul de retenue`);
  }
});
