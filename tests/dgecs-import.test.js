// Pont DGECS → EduGest (2026-11-20) : la liste des élèves copiée sur
// dgecsecoles.com (bouton « copier » : titre de la page, ligne vide, en-tête,
// puis une ligne par élève, cellules séparées par des tabulations) est lue,
// puis rapprochée des élèves d'EduGest. Noms fictifs ; colonnes et formats
// relevés sur un vrai compte d'école.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  FORMAT_MATRICULE_DGECS, absentsDeDgecs, champsDgecs, cleNomComplet, cleSonore, cocheParDefaut, dateIso, ecartsAvecDgecs, enNomPropre, ficheDepuisDgecs,
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
  assert.deepEqual(lignes[0].preuves, ["nomIdentique", "dateEgale"]);
  assert.equal(lignes[0].orthographe, false);
  assert.equal(lignes[4].sur, false);
  // Date de naissance différente : peut-être un homonyme, rien d'office.
  assert.deepEqual(lignes[3].candidats.map((c) => [c.eleve._id, c.preuves]), [["e4", ["nomIdentique", "dateDifferente"]]]);
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

test("absents de DGECS : ni retrouvés, ni porteurs d'un matricule de la liste, ni candidats d'une ligne à vérifier", () => {
  const { eleves } = lireListeDgecs(lireTexteTableau(COPIE));
  const lignes = rapprocherDgecs(eleves, EDUGEST);
  const classeA = EDUGEST.filter((e) => e.classe === "7ème Année A");
  // BAH Ibrahima (e4) est peut-être « IBRAHIMA BAH » de DGECS (autre date) :
  // on ne le déclare pas absent avant de l'avoir vérifié.
  assert.deepEqual(absentsDeDgecs(lignes, classeA).map((e) => e._id), ["e5"]);
});

// ── Orthographe différente : nom, date de naissance, filiation ──

const ligneDgecs = (matricule, nom, prenom, x = {}) => ({ matricule, nom, prenom, dateNaissance: "", pere: "", mere: "", erreurs: [], avertissements: [], ...x });
const etats = (lignes) => lignes.map((l) => [l.matricule, l.etat, l.eleve?._id ?? (l.candidats || []).map((c) => c.eleve._id).join("+")]);

test("graphies courantes ramenées à la même prononciation, sans confondre des prénoms différents", () => {
  for (const [a, b] of [["Mamadou", "Mamadu"], ["Camara", "Kamara"], ["Barry", "Bari"], ["Thierno", "Tierno"], ["Diallo", "Djallo"],
    ["Abdoulaye", "Abdoulaï"], ["Hawa", "Awa"], ["Fatoumata", "Fatoumatta"], ["Kadiatou", "Kadjatou"], ["Tidiane", "Tidjane"], ["Bah", "Ba"]]) {
    assert.equal(cleSonore(a), cleSonore(b), `${a} / ${b}`);
  }
  assert.notEqual(cleSonore("Fanta"), cleSonore("Fatou"));
  assert.notEqual(cleSonore("Sow"), cleSonore("Bah"));
});

test("nom écrit autrement : retrouvé grâce à la date de naissance ou à la filiation, pas déclaré absent", () => {
  const lignes = rapprocherDgecs([
    ligneDgecs("MA00000001", "BARRY", "Mamadou Aliou", { dateNaissance: "2012-03-04" }),
    ligneDgecs("MA00000002", "KAMARA", "Fanta", { pere: "Sekou", mere: "Hawa Conde" }),
    ligneDgecs("MA00000003", "SOUMAH", "Abdoulaye", { dateNaissance: "2012-01-01" }),
    ligneDgecs("MA00000004", "SYLLA", "Ibrahima"),
  ], [
    { _id: "a", nom: "BARY", prenom: "Mamadu", dateNaissance: "04/03/2012" },
    { _id: "b", nom: "CAMARA", prenom: "Fanta", filiation: "Fille de Sékou Kamara et de Awa Condé" },
    { _id: "c", nom: "SOUMAH", prenom: "Abdoulaï" },
    { _id: "d", nom: "SYLLA", prenom: "Ibrahim" },
  ]);
  assert.deepEqual(etats(lignes), [
    ["MA00000001", "rattacher", "a"], ["MA00000002", "rattacher", "b"], ["MA00000003", "rattacher", "c"], ["MA00000004", "aVerifier", "d"],
  ]);
  // 2e prénom absent d'EduGest, même date : sûr, coché d'office.
  assert.deepEqual([lignes[0].sur, lignes[0].orthographe, lignes[0].preuves], [true, true, ["nomProche", "dateEgale"]]);
  // Kamara / Camara, mêmes parents : sûr.
  assert.deepEqual([lignes[1].sur, lignes[1].preuves], [true, ["nomEcritAutrement", "filiationEgale"]]);
  // Même prononciation, rien pour confirmer : proposé, à vérifier à l'œil.
  assert.deepEqual([lignes[2].sur, lignes[2].orthographe], [false, true]);
  // Ibrahim / Ibrahima, rien pour confirmer : montré, rien d'office.
  assert.deepEqual(lignes[3].candidats[0].preuves, ["nomProche"]);
});

test("mêmes parents : jumeaux départagés par le prénom, frère d'une autre année jamais confondu", () => {
  const parents = { pere: "Alpha", mere: "Oumou Bah" };
  const filiation = "Pere: Alpha Sow / Mere: Oumou Bah";
  const lignes = rapprocherDgecs([
    ligneDgecs("MA00000011", "SOW", "Hassane", { dateNaissance: "2012-06-01", ...parents }),
    ligneDgecs("MA00000012", "SOW", "Housseine", { dateNaissance: "2012-06-01", ...parents }),
    ligneDgecs("MA00000013", "SOW", "Ibrahima", { dateNaissance: "2014-09-09", ...parents }),
  ], [
    { _id: "h1", nom: "SOW", prenom: "Housseine", dateNaissance: "2012-06-01", filiation },
    { _id: "h2", nom: "SOW", prenom: "Hassan", dateNaissance: "2012-06-01", filiation },
    { _id: "m", nom: "SOW", prenom: "Mamadou", dateNaissance: "2010-02-02", filiation },
  ]);
  assert.deepEqual(etats(lignes), [["MA00000011", "rattacher", "h2"], ["MA00000012", "rattacher", "h1"], ["MA00000013", "nouveau", ""]]);
});

test("mêmes date et parents sous un autre nom (surnom) : à vérifier ; même nom mais autres parents : à vérifier", () => {
  const lignes = rapprocherDgecs([
    ligneDgecs("MA00000021", "DIALLO", "Boubacar", { dateNaissance: "2011-11-11", pere: "Thierno", mere: "Kadiatou Barry" }),
    ligneDgecs("MA00000022", "CAMARA", "Fanta", { pere: "Sekou", mere: "Hawa Conde" }),
  ], [
    { _id: "bobo", nom: "DIALLO", prenom: "Bobo", dateNaissance: "2011-11-11", filiation: "Pere: Tierno Diallo / Mere: Kadiatou Bari" },
    { _id: "fanta", nom: "CAMARA", prenom: "Fanta", filiation: "Pere: Moussa Keita / Mere: Mariama Sylla" },
  ]);
  assert.deepEqual(etats(lignes), [["MA00000021", "aVerifier", "bobo"], ["MA00000022", "aVerifier", "fanta"]]);
  assert.deepEqual(lignes[0].candidats[0].preuves, ["nomPartiel", "dateEgale", "filiationEgale"]);
  assert.deepEqual(lignes[1].candidats[0].preuves, ["nomIdentique", "filiationDifferente"]);
  // Aucun des deux n'est coché d'office.
  assert.deepEqual(lignes.filter(cocheParDefaut), []);
});

test("le tuteur confirme la filiation mais ne la contredit jamais (ce peut être un oncle)", () => {
  const d = [ligneDgecs("MA00000031", "KABA", "Mariama", { pere: "Lansana", mere: "Fanta Conde" })];
  const avecPere = rapprocherDgecs(d, [{ _id: "k", nom: "KABA", prenom: "Mariama", tuteur: "Lansana Kaba", filiation: "" }]);
  assert.deepEqual(avecPere[0].preuves, ["nomIdentique", "filiationProche"]);
  const oncle = rapprocherDgecs(d, [{ _id: "k", nom: "KABA", prenom: "Mariama", tuteur: "Ousmane Kaba" }]);
  assert.deepEqual([oncle[0].etat, oncle[0].preuves], ["rattacher", ["nomIdentique"]]);
});

test("fiche EduGest d'un élève de DGECS : matricule DGECS dans ien, filiation, tuteur", () => {
  const { eleves } = lireListeDgecs(lireTexteTableau(COPIE));
  assert.deepEqual(ficheDepuisDgecs(eleves[2], { classe: "7ème Année C" }), {
    nom: "KEITA", prenom: "N'Faly", sexe: "M", classe: "7ème Année C",
    dateNaissance: "2012-01-01", lieuNaissance: "Conakry", ien: "MA25032035",
    filiation: "Pere: Sekou / Mere: Mamady Camara", tuteur: "Sekou", contactTuteur: "620000000", statut: "Actif",
  });
});

// ── Fiche conforme à DGECS (référence officielle) ──

test("fiche conforme à DGECS : nom, prénoms, naissance et filiation recopiés quand ils diffèrent vraiment", () => {
  const d = ligneDgecs("MA00000041", "BARRY", "Mamadou Aliou", {
    dateNaissance: "2012-03-04", lieuNaissance: "Labe", pere: "Alpha", mere: "Fatoumata Diallo", filiation: "Pere: Alpha / Mere: Fatoumata Diallo",
  });
  assert.deepEqual(ecartsAvecDgecs(d, { nom: "BARY", prenom: "Mamadu", dateNaissance: "14/03/2012", lieuNaissance: "Pita", filiation: "Fils de Alpha et de Kadiatou Sow" }), {
    nom: ["BARY", "BARRY"], prenom: ["Mamadu", "Mamadou Aliou"], dateNaissance: ["14/03/2012", "2012-03-04"],
    lieuNaissance: ["Pita", "Labe"], filiation: ["Fils de Alpha et de Kadiatou Sow", "Pere: Alpha / Mere: Fatoumata Diallo"],
  });
  // Accents et casse d'EduGest, date en jj/mm/aaaa, filiation plus complète : rien à corriger.
  assert.deepEqual(ecartsAvecDgecs(d, {
    nom: "Barry", prenom: "Mamadou Aliou", dateNaissance: "04/03/2012", lieuNaissance: "Labé", filiation: "Pere: Alpha BARRY / Mere: Fatoumata DIALLO",
  }), {});
  // DGECS sans date ni lieu : EduGest garde les siens ; filiation vide : remplie.
  assert.deepEqual(ecartsAvecDgecs({ ...d, dateNaissance: "", lieuNaissance: "" }, { nom: "BARRY", prenom: "Mamadou Aliou", dateNaissance: "2012-03-05" }),
    { filiation: ["", "Pere: Alpha / Mere: Fatoumata Diallo"] });
  assert.deepEqual(champsDgecs({ nom: ["BARY", "BARRY"], filiation: ["", "Pere: Alpha"] }), { nom: "BARRY", filiation: "Pere: Alpha" });
});

test("écarts portés par les lignes : rattachement, candidat à vérifier, déjà à jour de la section seulement", () => {
  const section = [
    { _id: "a", nom: "BARY", prenom: "Mamadou", dateNaissance: "2012-03-04" },
    { _id: "b", nom: "SOWE", prenom: "Aïssatou", ien: "MA00000052" },
    { _id: "d", nom: "SYLLA", prenom: "Ibrahim" },
  ];
  const lignes = rapprocherDgecs([
    ligneDgecs("MA00000051", "BARRY", "Mamadou", { dateNaissance: "2012-03-04" }),
    ligneDgecs("MA00000052", "SOW", "Aissatou"),
    ligneDgecs("MA00000053", "KEITA", "Sekou"),
    ligneDgecs("MA00000054", "SYLLA", "Ibrahima"),
  ], section, { tous: [...section, { _id: "c", nom: "KEYTA", prenom: "Sékou", ien: "MA00000053" }] });
  assert.deepEqual(lignes.map((l) => l.etat), ["rattacher", "deja", "deja", "aVerifier"]);
  assert.deepEqual(lignes[0].ecarts, { nom: ["BARY", "BARRY"] });
  assert.deepEqual(lignes[1].ecarts, { nom: ["SOWE", "SOW"] });
  // Fiche d'une autre section : corrigée depuis sa section, pas d'ici.
  assert.deepEqual(lignes[2].ecarts, {});
  assert.deepEqual(lignes[3].candidats[0].ecarts, { prenom: ["Ibrahim", "Ibrahima"] });
});

test("chaque état, colonne et problème a son libellé en français", () => {
  const fr = JSON.parse(readFileSync(new URL("../src/i18n/locales/fr.json", import.meta.url), "utf8")).dgecs.import;
  for (const etat of ["deja", "rattacher", "conflit", "aVerifier", "nouveau", "invalide"]) assert.ok(fr.states[etat], etat);
  for (const code of ["sansMatricule", "matriculeInhabituel", "sansNom", "sansSexe", "matriculeEnDouble"]) assert.ok(fr.issues[code], code);
  for (const e of ["entete", "vide"]) assert.ok(fr.readError[e], e);
  for (const p of ["nomIdentique", "nomEcritAutrement", "nomProche", "nomPartiel", "dateEgale", "dateProche", "dateDifferente",
    "filiationEgale", "filiationProche", "filiationDifferente"]) assert.ok(fr.evidence[p], p);
  for (const d of ["rattacher", "rattacherSur", "rattacherProche", "rattacherSonore", "conflit", "aVerifier", "nouveau"]) assert.ok(fr.detail[d], d);
  for (const c of ["nom", "prenom", "dateNaissance", "lieuNaissance", "filiation"]) assert.ok(fr.fields[c], c);
});
