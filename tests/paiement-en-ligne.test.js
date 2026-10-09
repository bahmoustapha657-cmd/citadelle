// Paiement en ligne : règles pures de l'Edge Function `paiement`
// (supabase/functions/_shared/paiement/regles.ts) — frais payés par le parent,
// référence, contrôle du montant encaissé, et surtout le PLAN D'IMPUTATION,
// calculé avec les mêmes règles que la caisse à partir des lignes de la base.
import assert from "node:assert/strict";
import test from "node:test";
import {
  calculerFrais, ciblesPayables, contexteEleve, dateFr, montantConforme, nouvelleReference,
  origineAutorisee, planImputation,
} from "../supabase/functions/_shared/paiement/regles.ts";

const ECOLE = { id: "ec1", code: "ecole-test", extra: { anneeScolaire: "2026-2027", moisDebut: "Octobre" } };
const TARIFS = [{ id: "t1", ecole_id: "ec1", section: "college", classe: "7ème A", montant: 100000, extra: { inscription: 50000 } }];
const eleveRow = (extra = {}) => ({
  id: "e1", ecole_id: "ec1", section: "college", nom: "BAH", prenom: "Aïssatou", classe: "7ème A",
  statut: "Actif", extra: { inscriptionPayee: true, mens: {}, ...extra }, updated_at: "2026-10-09T10:00:00.123456+00:00",
});
const paiement = (champs = {}) => ({
  id: "p1", ecole_id: "ec1", eleve_id: "e1", reference: "EDUTEST123", fournisseur: "simulation",
  annee: "2026-2027", cible: { cle: "mois", label: "Mensualités" }, montant: 100000, frais: 3000,
  devise: "GNF", statut: "en_attente", detail: {}, ...champs,
});

test("frais de l'opérateur : arrondis au franc supérieur, payés en plus", () => {
  assert.equal(calculerFrais(100000, 3), 3000);
  assert.equal(calculerFrais(75000, 3.5), 2625);
  assert.equal(calculerFrais(33333, 3), 1000); // 999,99 → 1 000
  assert.equal(calculerFrais(100000, 0), 0);
  assert.equal(calculerFrais(0, 3), 0);
});

test("référence : unique, lettres capitales et chiffres seulement", () => {
  const a = nouvelleReference(1_790_000_000_000, () => 0);
  assert.match(a, /^EDU[0-9A-Z]+$/);
  assert.notEqual(nouvelleReference(), nouvelleReference());
});

test("date au format des fiches", () => {
  assert.equal(dateFr(new Date(Date.UTC(2026, 9, 9, 23, 30))), "09/10/2026");
});

test("retour après paiement : EduGest ou un poste de développement, rien d'autre", () => {
  const def = "https://edugest-gn.pages.dev";
  assert.equal(origineAutorisee("https://edugest-gn.pages.dev/", def), "https://edugest-gn.pages.dev");
  assert.equal(origineAutorisee("http://localhost:4173", def), "http://localhost:4173");
  assert.equal(origineAutorisee("https://pirate.example", def), def);
  assert.equal(origineAutorisee(null, def), def);
});

test("montant encaissé par l'opérateur : exactement scolarité + frais, dans la devise", () => {
  const p = paiement();
  assert.equal(montantConforme(p, { statut: "reussi", montant: 103000, devise: "GNF" }), true);
  assert.equal(montantConforme(p, { statut: "reussi", montant: 100000, devise: "GNF" }), false);
  assert.equal(montantConforme(p, { statut: "reussi", montant: 103000, devise: "XOF" }), false);
});

test("cibles proposées : celles qui ont un reste, avec le montant que proposerait la caisse", () => {
  const ctx = contexteEleve({ ecole: ECOLE, eleveRow: eleveRow(), tarifsRows: TARIFS });
  const cibles = ciblesPayables(ctx);
  assert.deepEqual(cibles.map((c) => [c.cle, c.reste, c.propose]), [["mois", 900000, 100000]]);
});

test("plan d'imputation : le dernier mois soldé, journal et historique, clés de extra seulement", () => {
  const ctx = contexteEleve({ ecole: ECOLE, eleveRow: eleveRow(), tarifsRows: TARIFS });
  const plan = planImputation(ctx, paiement(), { date: "09/10/2026", operateur: "Orange Money" });
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.extra.mens, { Jun: "Payé" });
  assert.deepEqual(plan.extra.mensMontants, { Jun: 100000 });
  assert.deepEqual(plan.lignes, [{ libelle: "Jun", montant: 100000 }]);
  assert.equal(plan.journal.length, 1);
  const ligne = plan.journal[0];
  assert.equal(ligne.type, "mensualite");
  assert.equal(ligne.mois, "Jun");
  assert.equal(ligne.montant, 100000);
  assert.equal(ligne.auteur, "Paiement en ligne (Orange Money)");
  assert.equal(ligne.eleve_nom, "BAH Aïssatou");
  assert.deepEqual(ligne.extra, { reference: "EDUTEST123", fournisseur: "simulation", enLigne: true });
  assert.equal(plan.historique.action, "Paiement en ligne imputé");
  assert.match(plan.historique.details, /réf\. EDUTEST123/);
});

test("plan d'imputation refusé : la caisse a encaissé entre-temps, l'année ou la cible a changé", () => {
  const tout = Object.fromEntries(["Oct", "Nov", "Déc", "Jan", "Fév", "Mar", "Avr", "Mai", "Jun"]
    .map((m) => [m, "Payé"]));
  const solde = contexteEleve({ ecole: ECOLE, eleveRow: eleveRow({ mens: tout }), tarifsRows: TARIFS });
  assert.equal(planImputation(solde, paiement(), { date: "09/10/2026" }).ok, false);

  const ctx = contexteEleve({ ecole: ECOLE, eleveRow: eleveRow(), tarifsRows: TARIFS });
  assert.deepEqual(planImputation(ctx, paiement({ annee: "2025-2026" }), { date: "x" }), { ok: false, raison: "annee" });
  assert.deepEqual(planImputation(ctx, paiement({ cible: { cle: "frais-cantine" } }), { date: "x" }), { ok: false, raison: "cible" });
  assert.deepEqual(planImputation(ctx, paiement({ montant: 2_000_000 }), { date: "x" }), { ok: false, raison: "depasse" });
});
