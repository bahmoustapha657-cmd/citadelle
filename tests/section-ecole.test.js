import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  getActiveNoteForms,
  getEvaluationLabel,
  getNoteFormsGroup,
  resolveCanonicalNoteType,
} from "../src/evaluation-forms.js";
import { getPeriodesForSection } from "../src/period-utils.ts";
import { normalizeSection, teacherAccountSection } from "../src/backend/teacher-scope.js";
import { buildAnneePreRemplie, buildNouveauLivret } from "../src/components/livrets-tab/livrets-logic.js";
import { imprimerLivret } from "../src/reports/livret.js";

// Le module École reçoit sa section en prop (« prescolaire » | « primaire » |
// « college » | « lycee »). Ses hooks la déduisaient du NOM de collection, et
// la maternelle tombait dans « college » : formes d'évaluation du collège,
// périodicité et moyennes du secondaire sur les livrets, comptes parents
// marqués « college ». Les hooks React n'ont pas de banc de test dans le
// dépôt : on couvre ici la logique pure qu'ils appellent avec cette section,
// plus un garde-fou sur le code source.

const valeurs = (forms) => forms.map((item) => item.value);

test("la maternelle utilise le groupe Primaire de Paramètres → Évaluations", () => {
  assert.equal(getNoteFormsGroup("prescolaire"), "primaire");
  assert.equal(getNoteFormsGroup("primaire"), "primaire");
  assert.equal(getNoteFormsGroup("college"), "secondaire");
  assert.equal(getNoteFormsGroup("lycee"), "secondaire");
  assert.equal(getNoteFormsGroup("secondaire"), "secondaire");
  assert.equal(getNoteFormsGroup(), "secondaire");
});

test("formes proposées en maternelle : celles du primaire, sans les rubriques du collège", () => {
  const maternelle = getActiveNoteForms({}, "prescolaire");
  assert.deepEqual(valeurs(maternelle), valeurs(getActiveNoteForms({}, "primaire")));
  assert.deepEqual(valeurs(maternelle), ["Devoir", "Interrogation", "Évaluation orale", "Évaluation écrite", "Moyenne"]);
  // Ce que la maternelle recevait quand sa section valait « college ».
  const avant = valeurs(getActiveNoteForms({}, "college"));
  for (const v of ["Dictée/Questions", "Rédaction", "Examen", "Composition"]) {
    assert.ok(avant.includes(v), `« college » proposait ${v}`);
    assert.ok(!valeurs(maternelle).includes(v), `la maternelle ne propose plus ${v}`);
  }
});

test("la maternelle suit les réglages Primaire de l'école, pas ceux du Secondaire", () => {
  const schoolInfo = {
    evaluationForms: {
      primaire: [
        { id: "composition", label: "Compo", active: true },
        { id: "interrogation", label: "Interro", active: false },
      ],
      secondaire: [
        { id: "devoir", label: "Devoir surveillé", active: false },
        { id: "examen", label: "Examen final", active: true },
      ],
    },
  };
  const labels = getActiveNoteForms(schoolInfo, "prescolaire").map((item) => item.label);
  assert.ok(labels.includes("Compo"), "forme activée dans le groupe Primaire");
  assert.ok(!labels.includes("Interro"), "forme désactivée dans le groupe Primaire");
  assert.ok(labels.includes("Devoir"), "le groupe Secondaire n'a plus d'effet sur la maternelle");
  assert.ok(!labels.includes("Examen final"));
});

test("maternelle : libellés affichés et types enregistrés suivent le même groupe que la liste proposée", () => {
  const schoolInfo = {
    evaluationForms: {
      primaire: [{ id: "devoir", label: "Contrôle continu", active: true }],
      secondaire: [{ id: "devoir", label: "Devoir sur table", active: true }],
    },
  };
  // Ce que font NotesListe/NotesToolbar (libellé) et AjoutNoteModal/
  // ImportNotesModal (type canonique) avec la section du module.
  for (const form of getActiveNoteForms(schoolInfo, "prescolaire")) {
    assert.equal(getEvaluationLabel(form.value, schoolInfo, { section: "prescolaire" }), form.label);
    assert.equal(resolveCanonicalNoteType(form.label, schoolInfo, "prescolaire"), form.value);
  }
  assert.equal(getEvaluationLabel("Devoir", schoolInfo, { section: "prescolaire" }), "Contrôle continu");
});

test("non-régression : Dictée/Questions et Rédaction restent réservées au collège", () => {
  const rubriques = ["Dictée/Questions", "Rédaction"];
  for (const r of rubriques) {
    assert.ok(valeurs(getActiveNoteForms({}, "college")).includes(r), `collège : ${r}`);
    assert.ok(!valeurs(getActiveNoteForms({}, "lycee")).includes(r), `lycée : ${r}`);
    assert.ok(!valeurs(getActiveNoteForms({}, "primaire")).includes(r), `primaire : ${r}`);
  }
});

test("livrets de maternelle : périodes du préscolaire, plus celles du secondaire", () => {
  const schoolInfo = { periodicitePrescolaire: "trimestre", periodicitePrimaire: "trimestre", periodiciteSecondaire: "semestre" };
  // Périodes que le module École calcule avec sa section et passe aux livrets.
  assert.deepEqual(getPeriodesForSection(schoolInfo, "prescolaire"), ["T1", "T2", "T3"]);
  // Ce que les livrets de maternelle recevaient (section « college »).
  assert.deepEqual(getPeriodesForSection(schoolInfo, "college"), ["S1", "S2"]);
});

test("livret de maternelle : moyenne simple comme au bulletin, plus la formule du secondaire", () => {
  const eleve = { _id: "e1", nom: "Camara", prenom: "Awa", classe: "Grande Section A" };
  const matieres = [{ nom: "Langage", coefficient: 1 }, { nom: "Graphisme", coefficient: 1 }];
  const notes = [
    { eleveId: "e1", matiere: "Langage", periode: "T1", type: "Devoir", note: 8 },
    { eleveId: "e1", matiere: "Langage", periode: "T1", type: "Composition", note: 5 },
    // Rubriques du collège : proposées à tort à la maternelle depuis juillet.
    { eleveId: "e1", matiere: "Graphisme", periode: "T1", type: "Dictée/Questions", note: 9 },
    { eleveId: "e1", matiere: "Graphisme", periode: "T1", type: "Rédaction", note: 3 },
  ];
  const opts = { notes, matieres, periodes: ["T1", "T2", "T3"], maxNote: 10, eleves: [eleve], annee: "2026-2027" };
  const moyenneT1 = (section, matiere) =>
    buildAnneePreRemplie(eleve, { ...opts, section }).notes.find((n) => n.matiere === matiere).T1;

  assert.equal(moyenneT1("prescolaire", "Langage"), 6.5); // (8 + 5) / 2
  assert.equal(moyenneT1("prescolaire", "Graphisme"), 6); // (9 + 3) / 2
  // Avec la section « college » : (cours + 2 × composition) / 3 et rubriques pondérées 2:1.
  assert.equal(moyenneT1("college", "Langage"), 6); // (8 + 2 × 5) / 3
  assert.equal(moyenneT1("college", "Graphisme"), 7); // (2 × 9 + 3) / 3

  const livret = buildNouveauLivret(eleve, { section: "prescolaire", numeroLivret: "LIV-26-0001", annee: "2026-2027" });
  assert.equal(livret.section, "prescolaire");
});

test("livret imprimé de maternelle : ses périodes et son libellé, plus ceux du secondaire", () => {
  // imprimerLivret écrit dans une fenêtre : on en simule une le temps de
  // l'impression (simulée dès l'import, elle ferait abonner firestore-safe).
  let html = "";
  globalThis.window = { open: () => ({ document: { write: (s) => { html += s; }, close: () => {} } }) };
  try {
    const schoolInfo = { nom: "École test", periodicitePrescolaire: "trimestre", periodiciteSecondaire: "semestre" };
    imprimerLivret({
      eleveNom: "Camara Awa", section: "prescolaire", numeroLivret: "LIV-26-0001",
      annees: [{
        anneeScolaire: "2026-2027", classe: "Grande Section A",
        // Entrée pré-remplie avec les périodes de la maternelle (use-livrets-tab).
        notes: [{ matiere: "Langage", coef: 1, maxNote: 10, T1: 6.5, T2: 7, T3: 8, annuelle: 7.17 }],
      }],
    }, schoolInfo);
  } finally {
    delete globalThis.window;
  }

  assert.ok(html.includes("<th>T1</th><th>T2</th><th>T3</th>"), "colonnes du préscolaire");
  assert.ok(!html.includes("<th>S1</th>"), "pas les semestres du secondaire");
  assert.ok(html.includes(">6.5</td>"), "les notes pré-remplies s'impriment");
  assert.ok(html.includes("Enseignement Préscolaire"));
});

test("compte enseignant créé depuis la maternelle : reste « primaire » tant que le portail ignore le préscolaire", () => {
  assert.equal(teacherAccountSection("prescolaire"), "primaire");
  for (const s of ["primaire", "college", "lycee"]) assert.equal(teacherAccountSection(s), s);
  // Raison du repli : le portail enverrait un compte « prescolaire » sur les
  // collections du collège. Si ce test casse, le portail a appris le
  // préscolaire — revoir alors teacherAccountSection (et l'Edge Function
  // account-manage, et la RLS teacher_can_write_note).
  assert.equal(normalizeSection("prescolaire"), "college");
});

test("garde-fou : aucun fichier du module École ne déduit la section d'un nom de collection", () => {
  const racine = fileURLToPath(new URL("../src/components/", import.meta.url));
  const fichiers = [
    "Ecole.jsx",
    "LivretsTab.jsx",
    ...readdirSync(join(racine, "ecole"), { recursive: true }).map((f) => join("ecole", f)),
    ...readdirSync(join(racine, "livrets-tab"), { recursive: true }).map((f) => join("livrets-tab", f)),
  ].filter((f) => /\.jsx?$/.test(f));
  assert.ok(fichiers.length > 20, "le module École est bien parcouru");

  // cleEns === "ensPrimaire", cleEleves.includes("Lycee")… Charger une
  // collection (useFirestore(cleEleves + "_absences")) reste permis.
  const derivation = /\bcle(?:Classes|Ens|Notes|Eleves)\b\s*(?:[!=]==?|\.(?:includes|startsWith|endsWith|indexOf|match)\()/;
  const fautifs = [];
  for (const f of fichiers) {
    readFileSync(join(racine, f), "utf8").split("\n").forEach((ligne, i) => {
      if (derivation.test(ligne)) fautifs.push(`${f}:${i + 1}: ${ligne.trim()}`);
    });
  }
  assert.deepEqual(fautifs, [], "utiliser la prop `section` d'Ecole");
});
