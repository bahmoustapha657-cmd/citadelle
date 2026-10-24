// Comptabilité → Enseignants : les enseignants de maternelle (ensPrescolaire)
// étaient comptés dans le libellé de l'onglet mais absents de la liste, et la
// fiche « Nouvel enseignant » ne proposait pas le préscolaire.
import test from "node:test";
import assert from "node:assert/strict";
// useEnseignantsTab n'appelle aucun hook React : appelable hors composant.
import {
  estSectionForfait, sectionEnsParDefaut, useEnseignantsTab as logiqueOnglet,
} from "../src/components/comptabilite/enseignants-tab/use-enseignants-tab.js";

const CITADELLE = { sectionsActives: ["prescolaire", "primaire", "college"] };

const ecritures = () => {
  const appels = [];
  const fn = (nom) => async (payload) => { appels.push({ nom, payload }); };
  return {
    appels,
    ajEnsPresco: fn("ajEnsPresco"), ajEnsPrim: fn("ajEnsPrim"), ajEnsCol: fn("ajEnsCol"), ajEnsLyc: fn("ajEnsLyc"),
    modEnsPresco: fn("modEnsPresco"), modEnsPrim: fn("modEnsPrim"), modEnsCol: fn("modEnsCol"), modEnsLyc: fn("modEnsLyc"),
    supEnsPresco: fn("supEnsPresco"), supEnsPrim: fn("supEnsPrim"), supEnsCol: fn("supEnsCol"), supEnsLyc: fn("supEnsLyc"),
  };
};

const onglet = (form, extra = {}) => {
  const e = ecritures();
  const toasts = [];
  const tab = logiqueOnglet({
    form, setForm: () => {}, modal: "add_ens_compta", setModal: () => {},
    toast: (msg, type) => toasts.push({ msg, type }), logAction: () => {},
    ensPrimaire: [{ _id: "p1", prenom: "Mamadou", nom: "Bah" }],
    ensCollege: [{ _id: "c1", prenom: "Aminata", nom: "Diallo" }],
    ensLycee: [],
    ensPrescolaire: [{ _id: "m1", prenom: "Fatoumata", nom: "Camara", classeTitle: "Petite Section A" }],
    classesTitulaire: ["1ère Année A", "Petite Section A"],
    ...e, ...extra,
  });
  return { ...tab, appels: e.appels, toasts };
};

test("la liste des enseignants inclut la maternelle", () => {
  const { ensTous } = onglet({});
  const presco = ensTous.filter((e) => e._section === "Préscolaire");
  assert.equal(ensTous.length, 3);
  assert.deepEqual(presco.map((e) => e._id), ["m1"]);
});

test("créer un enseignant du préscolaire : collection ensPrescolaire, payé au forfait", async () => {
  const { saveEns, appels } = onglet({
    _section: "Préscolaire", prenom: "Kadiatou", nom: "Barry", montantForfait: "900000", classeTitle: "Petite Section A",
  });
  await saveEns();
  assert.equal(appels.length, 1);
  assert.equal(appels[0].nom, "ajEnsPresco");
  assert.equal(appels[0].payload.montantForfait, 900000);
  assert.equal(appels[0].payload.classeTitle, "Petite Section A");
  assert.equal("primeHoraire" in appels[0].payload, false);
});

test("supprimer vise la collection de la section (plus de repli vers le lycée)", async () => {
  const { supEnsForSection, appels } = onglet({});
  await supEnsForSection("Préscolaire")("m1");
  await supEnsForSection("Lycée")("l1");
  assert.deepEqual(appels.map((a) => [a.nom, a.payload]), [["supEnsPresco", "m1"], ["supEnsLyc", "l1"]]);
});

test("forfait : maternelle et primaire ; prime horaire : collège et lycée", () => {
  assert.equal(estSectionForfait("Préscolaire"), true);
  assert.equal(estSectionForfait("Primaire"), true);
  assert.equal(estSectionForfait("Collège"), false);
  assert.equal(estSectionForfait("Lycée"), false);
});

test("section cochée par défaut : primaire s'il est ouvert, sinon la première ouverte", () => {
  assert.equal(sectionEnsParDefaut(CITADELLE), "Primaire");
  assert.equal(sectionEnsParDefaut({ sectionsActives: ["prescolaire"] }), "Préscolaire");
  assert.equal(sectionEnsParDefaut({ sectionsActives: ["college", "lycee"] }), "Collège");
});
