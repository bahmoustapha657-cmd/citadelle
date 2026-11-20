// Pont DGECS → EduGest (2026-11-20) : la liste des élèves copiée sur
// dgecsecoles.com (bouton « copier » : titre de la page, ligne vide, en-tête,
// puis une ligne par élève, cellules séparées par des tabulations) est lue,
// puis rapprochée des élèves d'EduGest. Noms fictifs ; colonnes et formats
// relevés sur un vrai compte d'école.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  FORMAT_MATRICULE_DGECS, absentsDeDgecs, cleNomComplet, cocheParDefaut, dateIso, enNomPropre, ficheDepuisDgecs,
  lireListeDgecs, lireTexteTableau, rapprocherDgecs, resumeRapprochement,
} from "../src/dgecs-import.js";

const COPIE = [
  "MON ESPACE",
  "",
  "N°\tMatricule\tElève\tSexe\tDate de naissance\tLieu de naissance\tPère\tMère\tTéléphone\tActions",
  "1\tMA25032033\tMAMADOU ALIOU BARRY\tM\t04/03/2012\tLABE\tALPHA\tFATOUMATA DIALLO\t\tAfficher",
  "2\tMA25032034\tAISSATOU SOW\tF\t15/11/2011\tPITA\tTHIERNO OUMAR\tMARIAMA BAH\t\tAfficher",
  "3\tMA25032035\tN'FALY KEITA\tM\t01/01/2012\tCONAKRY\tSEKOU\tMAMADY CAMARA\t620000000\tAfficher",
  "4\tMA25032036\tIBRAHIMA BAH\tM\t09/09/2012\tMAMOU\tBOUBACAR\tKADIATOU SOW\t\tAfficher",
  "5\tMA25032037\tFATOUMATA BINTA DIALLO\tF\t02/02/2012\tLABE\tAMADOU\tHAWA BARRY\t\tAfficher",
].join("\r\n");

test("lecture du bouton « copier » : titre sauté, colonnes reconnues, PRÉNOMS NOM séparés", () => {
  const { eleves, erreur } = lireListeDgecs(lireTexteTableau(COPIE));
  assert.equal(erreur, null);
  assert.equal(eleves.length, 5);
  assert.deepEqual(eleves[0], {
    ligne: 4, matricule: "MA25032033", nom: "BARRY", prenom: "Mamadou Aliou", sexe: "M",
    dateNaissance: "2012-03-04", lieuNaissance: "Labe", pere: "Alpha", mere: "Fatoumata Diallo",
    filiation: "Pere: Alpha / Mere: Fatoumata Diallo", telephone: "", classeDgecs: "", erreurs: [], avertissements: [],
  });
  assert.equal(eleves[2].prenom, "N'Faly");
  assert.equal(eleves[2].telephone, "620000000");
  assert.equal(eleves[4].nom, "DIALLO");
  assert.equal(eleves[4].prenom, "Fatoumata Binta");
});

test("lecture : fichier Excel exporté (titre en 1re ligne), point-virgule, en-tête absent, liste vide", () => {
  const excel = [["MON ESPACE"], ["N°", "Matricule", "Elève", "Sexe", "Date de naissance"], [1, "ma 2503 2040", "SEKOU CONDE", "M", "2012-05-06"]];
  const { eleves } = lireListeDgecs(excel);
  assert.equal(eleves[0].matricule, "MA25032040");
  assert.equal(eleves[0].dateNaissance, "2012-05-06");
  assert.deepEqual(lireListeDgecs(lireTexteTableau("Matricule;Nom;Prénom;Sexe\nMA25032041;SYLLA;Kadiatou;F")).eleves.map((e) => [e.nom, e.prenom, e.sexe]), [["SYLLA", "Kadiatou", "F"]]);
  assert.equal(lireListeDgecs(lireTexteTableau("BARRY Mamadou\nSOW Aissatou")).erreur, "entete");
  assert.equal(lireListeDgecs(lireTexteTableau("Matricule\tElève\n")).erreur, "vide");
  assert.equal(lireListeDgecs([]).erreur, "entete");
});

test("lecture : lignes défectueuses signalées par des codes", () => {
  const { eleves } = lireListeDgecs(lireTexteTableau([
    "Matricule\tElève\tSexe",
    "\tAMINATA CAMARA\tF",
    "MA25032050\tKABA\tF",
    "X12\tSEKOU TOURE\t",
    "MA25032051\tOUMOU SALL\tF",
    "MA25032051\tOUMOU SALL\tF",
  ].join("\n")));
  assert.deepEqual(eleves.map((e) => e.erreurs), [["sansMatricule"], ["sansNom"], [], [], ["matriculeEnDouble"]]);
  assert.deepEqual(eleves[2].avertissements, ["matriculeInhabituel", "sansSexe"]);
  assert.ok(FORMAT_MATRICULE_DGECS.test("MA25032033"));
});

test("dateIso, enNomPropre, cleNomComplet", () => {
  assert.equal(dateIso("4/3/2012"), "2012-03-04");
  assert.equal(dateIso("04-03-2012"), "2012-03-04");
  assert.equal(dateIso("2012-03-04"), "2012-03-04");
  assert.equal(dateIso("vers 2012"), "vers 2012");
  assert.equal(enNomPropre("ABDOUL-KARIM  N'DIAYE"), "Abdoul-Karim N'Diaye");
  assert.equal(cleNomComplet("BARRY", "Mamadou Aliou"), cleNomComplet("Mamadou", "Aliou BARRY"));
  assert.equal(cleNomComplet("Bâ", "Élise"), cleNomComplet("BA", "ELISE"));
});

const EDUGEST = [
  { _id: "e1", nom: "BARRY", prenom: "Mamadou Aliou", classe: "7ème Année A", dateNaissance: "2012-03-04" },
  { _id: "e2", nom: "SOW", prenom: "Aissatou", classe: "7ème Année A", ien: "MA25032034" },
  { _id: "e3", nom: "KEITA", prenom: "N'Faly", classe: "7ème Année B", ien: "MA99999999" },
  { _id: "e4", nom: "BAH", prenom: "Ibrahima", classe: "7ème Année A", dateNaissance: "2011-01-01" },
  { _id: "e5", nom: "CAMARA", prenom: "Fanta", classe: "7ème Année A" },
  { _id: "e6", nom: "DIALLO", prenom: "Fatoumata Binta", classe: "7ème Année B" },
];

test("rapprochement : déjà à jour, matricule à poser, conflit, à vérifier, absent d'EduGest", () => {
  const { eleves } = lireListeDgecs(lireTexteTableau(COPIE));
  const lignes = rapprocherDgecs(eleves, EDUGEST);
  assert.deepEqual(lignes.map((l) => [l.matricule, l.etat, l.eleve?._id ?? null]), [
    ["MA25032033", "rattacher", "e1"],
    ["MA25032034", "deja", "e2"],
    ["MA25032035", "conflit", "e3"],
    ["MA25032036", "aVerifier", null],
    ["MA25032037", "rattacher", "e6"],
  ]);
  // Même date de naissance : rattachement sûr ; nom seul : à vérifier à l'œil.
  assert.equal(lignes[0].sur, true);
  assert.equal(lignes[4].sur, false);
  // Date de naissance différente : peut-être un homonyme, rien d'office.
  assert.deepEqual(lignes[3].candidats.map((e) => e._id), ["e4"]);
  assert.deepEqual(resumeRapprochement(lignes), { deja: 1, rattacher: 2, conflit: 1, aVerifier: 1, nouveau: 0, invalide: 0 });
  assert.deepEqual(lignes.filter(cocheParDefaut).map((l) => l.matricule), ["MA25032033", "MA25032037"]);
});

test("rapprochement : matricule déjà porté dans une autre section, homonymes, nouveaux, lignes illisibles", () => {
  const { eleves } = lireListeDgecs(lireTexteTableau([
    "Matricule\tElève\tSexe\tDate de naissance",
    "MA25032060\tSEKOU CONDE\tM\t01/02/2012",
    "MA25032061\tAMINATA SYLLA\tF\t03/04/2012",
    "MA25032062\tMOUSSA SOUMAH\tM\t05/06/2012",
    "\tSANS MATRICULE\tM\t",
  ].join("\n")));
  const section = [
    { _id: "a", nom: "SYLLA", prenom: "Aminata", classe: "7ème Année A" },
    { _id: "b", nom: "SYLLA", prenom: "Aminata", classe: "7ème Année B" },
  ];
  const autreSection = { _id: "z", nom: "CONDE", prenom: "Sekou", classe: "11ème Année A", ien: "MA25032060" };
  const lignes = rapprocherDgecs(eleves, section, { tous: [...section, autreSection] });
  assert.deepEqual(lignes.map((l) => l.etat), ["deja", "aVerifier", "nouveau", "invalide"]);
  assert.equal(lignes[0].eleve._id, "z");
  assert.equal(lignes[1].candidats.length, 2);
  // Une fiche ne sert qu'une fois : deux lignes DGECS au même nom ne posent
  // pas deux matricules sur le même élève.
  const doubles = rapprocherDgecs(lireListeDgecs(lireTexteTableau("Matricule\tElève\nMA25032070\tFANTA CAMARA\nMA25032071\tFANTA CAMARA")).eleves, [EDUGEST[4]]);
  assert.deepEqual(doubles.map((l) => l.etat), ["rattacher", "nouveau"]);
});

test("absents de DGECS : élèves de la classe ni retrouvés ni porteurs d'un matricule de la liste", () => {
  const { eleves } = lireListeDgecs(lireTexteTableau(COPIE));
  const lignes = rapprocherDgecs(eleves, EDUGEST);
  const classeA = EDUGEST.filter((e) => e.classe === "7ème Année A");
  assert.deepEqual(absentsDeDgecs(lignes, classeA).map((e) => e._id), ["e4", "e5"]);
});

test("fiche EduGest d'un élève de DGECS : matricule DGECS dans ien, filiation, tuteur", () => {
  const { eleves } = lireListeDgecs(lireTexteTableau(COPIE));
  assert.deepEqual(ficheDepuisDgecs(eleves[2], { classe: "7ème Année C" }), {
    nom: "KEITA", prenom: "N'Faly", sexe: "M", classe: "7ème Année C",
    dateNaissance: "2012-01-01", lieuNaissance: "Conakry", ien: "MA25032035",
    filiation: "Pere: Sekou / Mere: Mamady Camara", tuteur: "Sekou", contactTuteur: "620000000", statut: "Actif",
  });
});

test("chaque état, colonne et problème a son libellé en français", () => {
  const fr = JSON.parse(readFileSync(new URL("../src/i18n/locales/fr.json", import.meta.url), "utf8")).dgecs.import;
  for (const etat of ["deja", "rattacher", "conflit", "aVerifier", "nouveau", "invalide"]) assert.ok(fr.states[etat], etat);
  for (const code of ["sansMatricule", "matriculeInhabituel", "sansNom", "sansSexe", "matriculeEnDouble"]) assert.ok(fr.issues[code], code);
  for (const e of ["entete", "vide"]) assert.ok(fr.readError[e], e);
});
