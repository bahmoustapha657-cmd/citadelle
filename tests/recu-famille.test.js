import assert from "node:assert/strict";
import test from "node:test";
import { getRecuTotals } from "../src/reports.js";
import { blocRecuFamille, blocTicketFamille, moisRegles, totauxFamille } from "../src/reports/recus/recu-famille.js";

const moisAnnee = ["Octobre", "Novembre", "Décembre"];
const aine = {
  nom: "Diallo", prenom: "Aïssatou", matricule: "M-042", classe: "8e A", tuteur: "Mamadou Diallo", contactTuteur: "620 00 00 01",
  mens: { Octobre: "Payé", Novembre: "Payé" }, mensDates: { Octobre: "05/10/2026", Novembre: "03/11/2026" },
  inscriptionPayee: true,
};
const cadet = {
  nom: "Diallo", prenom: "Ibrahima", matricule: "P-007", classe: "CP1", tuteur: "Mamadou Diallo",
  mens: { Octobre: "Payé" }, mensDates: { Octobre: "05/10/2026" },
  acomptes: { mois: { Novembre: 40000 } },
};
const enfants = [
  { eleve: aine, resteAPayer: 200000, totaux: getRecuTotals(aine, 200000, moisAnnee, { inscription: 50000 }) },
  { eleve: cadet, resteAPayer: 210000, totaux: getRecuTotals(cadet, 150000, moisAnnee, {}) },
];
const lisible = (html) => html.replace(/\p{Zs}/gu, " ");

test("les totaux du foyer additionnent ceux de chaque enfant", () => {
  const t = totauxFamille(enfants);
  assert.equal(t.totalMensualites, 400000 + enfants[1].totaux.totalMensualites);
  assert.equal(t.totalFrais, 50000);
  assert.equal(t.totalGeneral, enfants[0].totaux.totalGeneral + enfants[1].totaux.totalGeneral);
  assert.equal(t.resteAPayer, 410000);
});

test("les mois réglés s'abrègent, un mois entamé porte ◐", () => {
  assert.equal(moisRegles(enfants[0].totaux), "Oct, Nov");
  const cadetMois = moisRegles(enfants[1].totaux);
  assert.ok(cadetMois.startsWith("Oct"));
});

test("le reçu A4 liste chaque enfant, le tuteur et le total famille", () => {
  const html = lisible(blocRecuFamille("Exemplaire — Payant", {
    schoolInfo: { nom: "La Citadelle" }, lf: {}, enfants, moisAnnee, qr: "",
  }));
  for (const attendu of ["Aïssatou", "Ibrahima", "8e A", "CP1", "Mamadou Diallo", "620 00 00 01", "410 000"]) {
    assert.ok(html.includes(attendu), attendu);
  }
  assert.ok(html.includes(lisible(totauxFamille(enfants).totalGeneral.toLocaleString("fr-FR"))));
});

test("le ticket famille a un bloc par enfant puis les totaux", () => {
  const html = lisible(blocTicketFamille({ schoolInfo: { nom: "La Citadelle" }, enfants, moisAnnee, qr: "" }));
  assert.ok(html.indexOf("Aïssatou") < html.indexOf("Ibrahima"));
  assert.ok(html.includes("410 000"));
});
