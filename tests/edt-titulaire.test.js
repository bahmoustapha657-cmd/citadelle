import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sectionATitulaire, memeEnseignant, titulaireDeClasse, enseignantParDefaut,
  creneauxHorsTitulaire, creneauxCopies,
} from "../src/components/ecole/edt/edt-titulaire.js";

const ens = [
  { _id: "1", prenom: "Aïssatou", nom: "Diallo", classeTitle: "3ème Année A" },
  { _id: "2", prenom: "Mamadou", nom: "Barry", classeTitle: "4ème Année A" },
  { _id: "3", prenom: "John", nom: "Smith", matiere: "Anglais" },
];

test("seuls le primaire et la maternelle fonctionnent par titulaire", () => {
  assert.equal(sectionATitulaire("primaire"), true);
  assert.equal(sectionATitulaire("prescolaire"), true);
  assert.equal(sectionATitulaire("college"), false);
  assert.equal(sectionATitulaire("lycee"), false);
  assert.equal(sectionATitulaire(undefined), false);
});

test("même enseignant malgré casse, accents et ancien suffixe (Matière)", () => {
  assert.equal(memeEnseignant("aissatou DIALLO", "Aïssatou Diallo"), true);
  assert.equal(memeEnseignant("Aïssatou Diallo (Calcul)", "Aïssatou Diallo"), true);
  assert.equal(memeEnseignant("Mamadou Barry", "Aïssatou Diallo"), false);
  assert.equal(memeEnseignant("", ""), false);
});

test("titulaire : la fiche enseignant « Classe titulaire » d'abord", () => {
  const classes = [{ nom: "3ème Année A", enseignant: "Quelqu'un d'autre" }];
  assert.equal(titulaireDeClasse("3ème Année A", ens, classes), "Aïssatou Diallo");
  assert.equal(titulaireDeClasse("3eme annee a", ens, classes), "Aïssatou Diallo");
});

test("titulaire : à défaut, l'enseignant principal saisi sur la classe", () => {
  const classes = [
    { nom: "5ème Année A", enseignant: "john smith" },
    { nom: "6ème Année A", enseignant: "Fatou Camara" },
  ];
  // Recalé sur la fiche existante…
  assert.equal(titulaireDeClasse("5ème Année A", ens, classes), "John Smith");
  // … ou repris tel quel s'il n'a pas de fiche.
  assert.equal(titulaireDeClasse("6ème Année A", ens, classes), "Fatou Camara");
  assert.equal(titulaireDeClasse("1ère Année A", ens, classes), "");
  assert.equal(titulaireDeClasse("", ens, classes), "");
});

test("enseignant par défaut : celui qui assure déjà la matière, sinon le titulaire", () => {
  const emploisClasse = [
    { _id: "a", matiere: "Anglais", enseignant: "John Smith" },
    { _id: "b", matiere: "Anglais", enseignant: "John Smith" },
    { _id: "c", matiere: "Calcul", enseignant: "Aïssatou Diallo" },
    { _id: "d", type: "recreation", matiere: "Anglais", enseignant: "X" },
  ];
  const titulaire = "Aïssatou Diallo";
  assert.equal(enseignantParDefaut({ emploisClasse, matiere: "Anglais", titulaire }), "John Smith");
  assert.equal(enseignantParDefaut({ emploisClasse, matiere: "Lecture", titulaire }), titulaire);
  assert.equal(enseignantParDefaut({ emploisClasse, matiere: "", titulaire }), titulaire);
  // Le créneau en cours de modification ne compte pas pour lui-même.
  assert.equal(enseignantParDefaut({ emploisClasse: [emploisClasse[0]], matiere: "Anglais", titulaire, exclureId: "a" }), titulaire);
  assert.equal(enseignantParDefaut({ emploisClasse, matiere: "Lecture", titulaire: "" }), "");
});

test("créneaux hors titulaire : regroupés, sans enseignant d'abord, récréations ignorées", () => {
  const emploisClasse = [
    { _id: "1", matiere: "Calcul", enseignant: "Aïssatou Diallo" },
    { _id: "2", matiere: "Lecture", enseignant: "aissatou diallo (Lecture)" },
    { _id: "3", matiere: "Anglais", enseignant: "John Smith" },
    { _id: "4", matiere: "Calcul", enseignant: "Ancien Titulaire" },
    { _id: "5", matiere: "Lecture", enseignant: "Ancien Titulaire" },
    { _id: "6", matiere: "Dessin", enseignant: "" },
    { _id: "7", type: "recreation", matiere: "Récréation", enseignant: "" },
  ];
  const groupes = creneauxHorsTitulaire(emploisClasse, "Aïssatou Diallo");
  assert.deepEqual(groupes.map((g) => [g.enseignant, g.creneaux.map((c) => c._id)]), [
    ["", ["6"]],
    ["Ancien Titulaire", ["4", "5"]],
    ["John Smith", ["3"]],
  ]);
});

test("copie vers une autre classe : le titulaire source cède la place au titulaire cible", () => {
  const source = [
    { _id: "1", classe: "3ème Année A", matiere: "Calcul", enseignant: "Aïssatou Diallo", jour: "Lundi" },
    { _id: "2", classe: "3ème Année A", matiere: "Anglais", enseignant: "John Smith", jour: "Lundi" },
    { _id: "3", classe: "3ème Année A", type: "recreation", matiere: "Récréation", enseignant: "", jour: "Lundi" },
  ];
  const copies = creneauxCopies(source, { dest: "4ème Année A", titulaireSource: "Aïssatou Diallo", titulaireDest: "Mamadou Barry" });
  assert.deepEqual(copies.map((c) => [c.classe, c.enseignant, "_id" in c]), [
    ["4ème Année A", "Mamadou Barry", false],
    ["4ème Année A", "John Smith", false],
    ["4ème Année A", "", false],
  ]);
  // Classe cible sans titulaire : créneaux laissés sans enseignant (à
  // confier ensuite), plutôt qu'au maître de la classe source.
  const sansTitulaire = creneauxCopies(source, { dest: "5ème Année A", titulaireSource: "Aïssatou Diallo", titulaireDest: "" });
  assert.equal(sansTitulaire[0].enseignant, "");
});
