// Ce qu'un versement peut payer : la liste commune à la caisse et au
// paiement en ligne (src/versements.js).
import assert from "node:assert/strict";
import test from "node:test";
import { ciblesVersement, montantPropose } from "../src/versements.js";
import { planVersement } from "../src/paiements-scolarite.js";

const MOIS = ["Oct", "Nov", "Déc", "Jan", "Fév", "Mar", "Avr", "Mai", "Jun"];
const TARIFS = [{ classe: "7ème Année A", montant: 100000, inscription: 50000, fraisDivers: { cantine: 150000 } }];
const TRANCHES = [{ nom: "1re tranche", mois: ["Oct", "Nov", "Déc"] }];
const eleve = (champs = {}) => ({ _id: "e1", classe: "7ème Année A", mens: {}, ...champs });

test("cibles : mensualités (inscription d'abord), tranches, inscription, frais non soldés", () => {
  const { cibles, mensualite } = ciblesVersement({
    eleve: eleve(), moisAnnee: MOIS, annee: "2026-2027", tarifsClasses: TARIFS, tranches: TRANCHES,
  });
  assert.equal(mensualite, 100000);
  assert.deepEqual(cibles.map((c) => [c.cle, c.reste]), [
    ["mois", 9 * 100000 + 50000],
    ["tranche-0", 3 * 100000],
    ["inscription", 50000],
    ["frais-cantine", 150000],
  ]);
  const mois = cibles[0];
  assert.equal(mois.mois[0], "Jun", "le dernier mois de l'année se paie d'abord");
  assert.deepEqual(mois.inscription, { label: "Inscription", duNet: 50000, reste: 50000 });
});

test("cibles : inscription payée et frais soldé n'apparaissent plus", () => {
  const { cibles } = ciblesVersement({
    eleve: eleve({ inscriptionPayee: true, fraisPayes: { cantine: true } }),
    moisAnnee: MOIS, annee: "2026-2027", tarifsClasses: TARIFS,
  });
  assert.deepEqual(cibles.map((c) => c.cle), ["mois"]);
  assert.equal(cibles[0].inscription, null);
});

test("montant proposé : inscription + un mois pour les mensualités, tout le reste ailleurs", () => {
  const { cibles, etats } = ciblesVersement({
    eleve: eleve(), moisAnnee: MOIS, annee: "2026-2027", tarifsClasses: TARIFS, tranches: TRANCHES,
  });
  assert.equal(montantPropose(cibles[0], etats), "150000");
  assert.equal(montantPropose(cibles[1], etats), "300000");
  assert.equal(montantPropose(cibles[3], etats), "150000");
  assert.equal(montantPropose(null, etats), "");
});

test("la cible alimente planVersement : 150 000 soldent l'inscription puis le dernier mois", () => {
  const { cibles, mensualite } = ciblesVersement({
    eleve: eleve(), moisAnnee: MOIS, annee: "2026-2027", tarifsClasses: TARIFS,
  });
  const plan = planVersement({ eleve: eleve(), cible: cibles[0], montant: 150000, date: "09/10/2026", mensualite, annee: "2026-2027" });
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.lignes.map((l) => [l.libelle, l.montant]), [["Inscription", 50000], ["Jun", 100000]]);
  assert.deepEqual(plan.moisSoldes, ["Jun"]);
});
