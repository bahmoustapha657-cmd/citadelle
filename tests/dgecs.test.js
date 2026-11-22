// Plateforme du ministère (DGECS, dgecsecoles.com), lot B du 2026-11-19 :
// fiche de notes à recopier (une note par matière et par élève, avant la
// « Clôture » qui interdit toute correction), statistiques de rentrée de la
// DPE/DSEE et candidats aux examens.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PERIODE_ANNEE, candidatsExamen, dateLisible, elevesDeClasse, estRedoublant, ficheNotesDgecs, formatNoteDgecs,
  matriculesEnDouble, niveauDeClasse, nomDgecs, normaliserMatricule, ongletDgecsOuvert, statistiquesRentree,
  URL_DGECS, lienDgecsOuvert,
} from "../src/dgecs.js";
import { ongletEcoleOuvert } from "../src/espace-enseignant.js";
import { buildFicheNotesDgecsHTML, buildStatistiquesRentreeHTML, buildCandidatsExamenHTML } from "../src/reports/dgecs-print.js";

const PUBLIQUE = { statutEtablissement: "public", nom: "EP Kaporo", anneeScolaire: "2026-2027" };
const ANNEE = "2026-2027";
const eleve = (_id, nom, prenom, sexe, classe = "1ère Année A", extra = {}) => ({ _id, nom, prenom, sexe, classe, statut: "Actif", ...extra });
const note = (eleveId, matiere, periode, valeur) => ({ eleveId, matiere, periode, type: "Composition", note: valeur });

const MATIERES = [{ nom: "Dictée et Questions", coefficient: 2 }, { nom: "Géographie", coefficient: 1 }];
const PERIODES = ["T1", "T2", "T3"];

test("l'onglet DGECS : système guinéen, primaire au lycée, jamais pour un enseignant seul", () => {
  assert.equal(ongletDgecsOuvert(PUBLIQUE, "primaire"), true);
  assert.equal(ongletDgecsOuvert(PUBLIQUE, "lycee"), true);
  // Les écoles privées utilisent aussi la plateforme.
  assert.equal(ongletDgecsOuvert({ statutEtablissement: "prive" }, "college"), true);
  assert.equal(ongletDgecsOuvert(PUBLIQUE, "prescolaire"), false);
  assert.equal(ongletDgecsOuvert({ systemeScolaire: "francophone" }, "primaire"), false);
  assert.equal(ongletDgecsOuvert({ typeEspace: "enseignant" }, "primaire"), false);
  assert.equal(ongletEcoleOuvert({ typeEspace: "enseignant" }, "dgecs"), false);
});

test("lien direct vers DGECS : chefs de section et Direction d'une école guinéenne", () => {
  assert.equal(URL_DGECS, "https://dgecsecoles.com/");
  const chefPrimaire = { role: "primaire", modules: ["primaire", "calendrier", "examens"] };
  const chefCollege = { role: "college", modules: ["secondaire", "calendrier"] };
  const direction = { role: "direction", modules: ["accueil", "compta", "primaire", "secondaire"] };
  // Poste flexible : un chef de section sous un autre nom de rôle.
  const poste = { role: "censeur", modules: ["secondaire"] };
  for (const compte of [chefPrimaire, chefCollege, direction, poste]) assert.equal(lienDgecsOuvert(PUBLIQUE, compte), true, compte.role);
  assert.equal(lienDgecsOuvert({ statutEtablissement: "prive" }, chefCollege), true);
  // Ni le comptable (son lien est dans « Depuis DGECS »), ni le surveillant.
  assert.equal(lienDgecsOuvert(PUBLIQUE, { role: "comptable", modules: ["compta"] }), false);
  assert.equal(lienDgecsOuvert(PUBLIQUE, { role: "surveillant", modules: ["primaire", "secondaire"] }), false);
  // Hors système guinéen, ou espace d'un enseignant seul : pas de lien.
  assert.equal(lienDgecsOuvert({ systemeScolaire: "francophone" }, chefPrimaire), false);
  assert.equal(lienDgecsOuvert({ typeEspace: "enseignant" }, chefPrimaire), false);
  assert.equal(lienDgecsOuvert(PUBLIQUE), false);
});

test("matricule, nom et note au format de la plateforme", () => {
  assert.equal(normaliserMatricule(" ma 2503 2033 "), "MA25032033");
  assert.equal(nomDgecs({ nom: "Diallo", prenom: "Mariama  Ciré" }), "MARIAMA CIRÉ DIALLO");
  assert.equal(formatNoteDgecs(7.666666), "7.67");
  assert.equal(formatNoteDgecs(12.5), "12.5");
  assert.equal(formatNoteDgecs(14), "14");
  assert.equal(formatNoteDgecs(0), "0");
  assert.equal(formatNoteDgecs(null), "");
  assert.equal(formatNoteDgecs("abc"), "");
  assert.equal(dateLisible("2014-03-09"), "09/03/2014");
  assert.equal(dateLisible("9 mars 2014"), "9 mars 2014");
  assert.deepEqual(matriculesEnDouble([{ ien: "A1" }, { ien: "B2" }, { ien: " A1 " }, {}]), ["A1"]);
});

test("élèves de la classe : présents seulement, par ordre du nom", () => {
  const liste = [
    eleve("c", "Sow", "Ibrahima", "M"), eleve("a", "Bah", "Aïssatou", "F"),
    eleve("x", "Barry", "Alpha", "M", "1ère Année A", { statut: "Transféré" }), eleve("b", "Bah", "Abdoulaye", "M", "2ème Année A"),
  ];
  assert.deepEqual(elevesDeClasse(liste, "1ère Année A").map((e) => e._id), ["a", "c"]);
});

test("fiche de notes annuelle : moyenne de l'année par matière, manques et moyennes incomplètes signalés", () => {
  // École à deux périodes, toutes deux notées.
  const DEUX = ["T1", "T2"];
  const eleves = [
    eleve("a", "Bah", "Aïssatou", "F", "1ère Année A", { ien: "MA25032033" }),
    eleve("b", "Sow", "Ibrahima", "M", "1ère Année A"),
    eleve("c", "Camara", "Fanta", "F", "1ère Année A", { ien: "MA25032034" }),
  ];
  const notes = [
    note("a", "Dictée et Questions", "T1", 6), note("a", "Dictée et Questions", "T2", 7),
    note("a", "Géographie", "T1", 8), note("a", "Géographie", "T2", 9),
    // Ibrahima : rien en Géographie.
    note("b", "Dictée et Questions", "T1", 5), note("b", "Dictée et Questions", "T2", 6),
    // Fanta : pas de note au T2 en Dictée.
    note("c", "Dictée et Questions", "T1", 9), note("c", "Géographie", "T1", 5), note("c", "Géographie", "T2", 6),
  ];
  const fiche = ficheNotesDgecs({ eleves, notes, matieres: MATIERES, periodes: DEUX, periode: PERIODE_ANNEE, classe: "1ère Année A" });
  assert.deepEqual(fiche.matieres.map((m) => [m.titre, m.coefficient]), [["DICTÉE ET QUESTIONS", 2], ["GÉOGRAPHIE", 1]]);
  assert.deepEqual(fiche.lignes.map((l) => l.nom), ["AÏSSATOU BAH", "FANTA CAMARA", "IBRAHIMA SOW"]);
  const [aissatou, fanta, ibrahima] = fiche.lignes;
  assert.deepEqual(aissatou.cellules.map((c) => c.texte), ["6.5", "8.5"]);
  assert.equal(aissatou.matricule, "MA25032033");
  assert.equal(ibrahima.cellules[1].valeur, null);
  assert.equal(ibrahima.manquantes, 1);
  // Comme au bulletin, la période manquante compte pour 0 : 9 / 2.
  assert.equal(fanta.cellules[0].texte, "4.5");
  assert.equal(fanta.cellules[0].incomplete, true);
  assert.equal(fanta.cellules[1].incomplete, false);
  assert.equal(fiche.notesManquantes, 1);
  assert.equal(fiche.notesIncompletes, 1);
  assert.equal(fiche.sansMatricule, 1);
  assert.deepEqual(fiche.periodesVides, []);
  assert.equal(fiche.pret, false);
  // Trois trimestres, le troisième pas encore noté : rien n'est à recopier.
  const avantT3 = ficheNotesDgecs({ eleves, notes, matieres: MATIERES, periodes: PERIODES, periode: PERIODE_ANNEE, classe: "1ère Année A" });
  assert.deepEqual(avantT3.periodesVides, ["T3"]);
  assert.equal(avantT3.notesIncompletes, 5);
  // Moyenne de la matière saisie directement : elle vaut pour l'année.
  const directe = ficheNotesDgecs({
    eleves: [eleves[0]], notes: [{ eleveId: "a", matiere: "Géographie", periode: "T1", type: "Moyenne", note: 12 }],
    matieres: [MATIERES[1]], periodes: PERIODES, periode: PERIODE_ANNEE, classe: "1ère Année A",
  });
  assert.equal(directe.lignes[0].cellules[0].texte, "12");
  assert.equal(directe.notesIncompletes, 0);
});

test("fiche de notes d'une période, et fiche prête à recopier", () => {
  const eleves = [eleve("a", "Bah", "Aïssatou", "F", "1ère Année A", { ien: "MA1" }), eleve("b", "Sow", "Ibrahima", "M", "1ère Année A", { ien: "MA2" })];
  const notes = [
    note("a", "Dictée et Questions", "T1", 6), note("a", "Dictée et Questions", "T1", 8), note("a", "Géographie", "T1", 7),
    note("b", "Dictée et Questions", "T1", 5), note("b", "Géographie", "T1", 4), note("b", "Géographie", "T2", 9),
  ];
  const t1 = ficheNotesDgecs({ eleves, notes, matieres: MATIERES, periodes: PERIODES, periode: "T1", classe: "1ère Année A" });
  assert.deepEqual(t1.lignes[0].cellules.map((c) => c.texte), ["7", "7"]);
  assert.equal(t1.pret, true);
  const t2 = ficheNotesDgecs({ eleves, notes, matieres: MATIERES, periodes: PERIODES, periode: "T2", classe: "1ère Année A" });
  assert.equal(t2.notesManquantes, 3);
  assert.equal(t2.pret, false);
  // Deux élèves sous le même matricule : la plateforme en refuserait un.
  const doublon = ficheNotesDgecs({ eleves: [eleves[0], { ...eleves[1], ien: "MA1" }], notes, matieres: MATIERES, periodes: PERIODES, periode: "T1", classe: "1ère Année A" });
  assert.deepEqual(doublon.doublons, ["MA1"]);
  assert.equal(doublon.pret, false);
  // Classe sans matière : rien à recopier, la fiche n'est pas « prête ».
  assert.equal(ficheNotesDgecs({ eleves, notes, matieres: [], periodes: PERIODES, periode: "T1", classe: "1ère Année A" }).pret, false);
});

test("niveau d'une classe, divisions et options fondues", () => {
  assert.equal(niveauDeClasse("7ème Année B"), "7ème Année");
  assert.equal(niveauDeClasse("10ème Année A"), "10ème Année");
  assert.equal(niveauDeClasse("1ère Année"), "1ère Année");
  assert.equal(niveauDeClasse("Terminale SM"), "Terminale");
  assert.equal(niveauDeClasse("Classe passerelle"), "Classe passerelle");
});

test("statistiques de rentrée : effectifs par niveau et par sexe, redoublants de l'année, enseignants", () => {
  const eleves = [
    eleve("a", "Bah", "Aïssatou", "F", "1ère Année A"), eleve("b", "Sow", "Ibrahima", "M", "1ère Année B", { redoublantAnnee: ANNEE }),
    eleve("c", "Camara", "Fanta", "F", "1ère Année B", { redoublantAnnee: "2025-2026" }), eleve("d", "Diallo", "Oumar", "M", "3ème Année A"),
    eleve("e", "Barry", "Alpha", "M", "3ème Année A", { statut: "Transféré" }),
  ];
  const classes = [{ nom: "1ère Année A" }, { nom: "1ère Année B" }, { nom: "3ème Année A" }, { nom: "6ème Année A" }];
  const enseignants = [{ civilite: "M" }, { civilite: "Mme" }, { civilite: "Mme" }, {}];
  const stats = statistiquesRentree({ eleves, classes, enseignants, section: "primaire", schoolInfo: PUBLIQUE, annee: ANNEE });
  assert.deepEqual(stats.lignes.map((l) => [l.niveau, l.classes, l.garcons, l.filles, l.total, l.redoublants.total]), [
    ["1ère Année", 2, 1, 2, 3, 1],
    ["3ème Année", 1, 1, 0, 1, 0],
    // Classe ouverte mais vide : elle compte dans le nombre de classes.
    ["6ème Année", 1, 0, 0, 0, 0],
  ]);
  assert.deepEqual(stats.total, { classes: 4, garcons: 2, filles: 2, total: 4, sansSexe: 0, redoublants: { garcons: 1, filles: 0, total: 1 } });
  assert.deepEqual(stats.enseignants, { hommes: 1, femmes: 2, total: 4, sansCivilite: 1 });
  assert.equal(estRedoublant(eleves[1], ANNEE), true);
  assert.equal(estRedoublant(eleves[2], ANNEE), false);
  assert.equal(estRedoublant(eleves[1], ""), false);
});

test("candidats aux examens : classe d'examen de la section et pièces manquantes", () => {
  const eleves = [
    eleve("a", "Bah", "Aïssatou", "F", "6ème Année B", { ien: "MA1", dateNaissance: "2014-03-09", lieuNaissance: "Conakry" }),
    eleve("b", "Sow", "Ibrahima", "M", "6ème Année A"),
    eleve("c", "Camara", "Fanta", "F", "5ème Année A", { ien: "MA3" }),
    eleve("d", "Diallo", "Oumar", "M", "6ème Année A", { statut: "Transféré" }),
  ];
  const cee = candidatsExamen({ eleves, section: "primaire", schoolInfo: PUBLIQUE });
  assert.equal(cee.examen, "CEE");
  assert.equal(cee.niveau, "6ème Année");
  assert.deepEqual(cee.lignes.map((l) => l.eleve._id), ["b", "a"]);
  assert.deepEqual(cee.lignes[0].manque, ["matricule", "dateNaissance", "lieuNaissance"]);
  assert.deepEqual(cee.lignes[1].manque, []);
  assert.equal(cee.incomplets, 1);
  assert.equal(candidatsExamen({ eleves: [], section: "college", schoolInfo: PUBLIQUE }).examen, "BEPC");
  assert.equal(candidatsExamen({ eleves: [], section: "lycee", schoolInfo: PUBLIQUE }).niveau, "Terminale");
});

test("documents imprimés : noms échappés, colonnes de la plateforme, cases vides à remplir", () => {
  const eleves = [eleve("a", "Bah<script>", "Aïssatou", "F", "1ère Année A", { ien: "MA1" }), eleve("b", "Sow", "Ibrahima", "M", "1ère Année A")];
  const fiche = ficheNotesDgecs({ eleves, notes: [note("a", "Géographie", "T1", 7)], matieres: MATIERES, periodes: PERIODES, periode: "T1", classe: "1ère Année A" });
  const html = buildFicheNotesDgecsHTML(fiche, { schoolInfo: PUBLIQUE, annee: ANNEE, periodeLibelle: "T1" });
  assert.equal(html.includes("<script>alert") || html.includes("Bah<script>"), false);
  assert.match(html, /BAH&lt;SCRIPT&gt;/);
  assert.match(html, /DICTÉE ET QUESTIONS/);
  assert.match(html, /MA1/);
  const stats = buildStatistiquesRentreeHTML(statistiquesRentree({ eleves, classes: [], section: "primaire", schoolInfo: PUBLIQUE, annee: ANNEE }), { schoolInfo: PUBLIQUE, annee: ANNEE });
  assert.match(stats, /1ère Année/);
  const candidats = buildCandidatsExamenHTML(candidatsExamen({ eleves: [eleve("z", "Sow", "Awa", "F", "6ème Année A")], section: "primaire", schoolInfo: PUBLIQUE }), { schoolInfo: PUBLIQUE, annee: ANNEE });
  assert.match(candidats, /CEE/);
  assert.match(candidats, /AWA|Awa/);
});

test("textes de l'onglet DGECS présents en français, anglais et arabe", () => {
  const fr = JSON.parse(readFileSync(new URL("../src/i18n/locales/fr.json", import.meta.url), "utf8")).dgecs;
  const cles = (objet, prefixe = "") => Object.entries(objet).flatMap(([cle, valeur]) => (
    valeur && typeof valeur === "object" ? cles(valeur, `${prefixe}${cle}.`) : [`${prefixe}${cle}`]));
  const attendues = cles(fr);
  assert.ok(attendues.length > 20);
  for (const langue of ["en", "ar"]) {
    const textes = JSON.parse(readFileSync(new URL(`../src/i18n/locales/${langue}.json`, import.meta.url), "utf8")).dgecs || {};
    assert.deepEqual(cles(textes).sort(), [...attendues].sort(), `${langue} : mêmes clés que le français`);
  }
});
