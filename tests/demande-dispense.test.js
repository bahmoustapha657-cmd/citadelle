import assert from "node:assert/strict";
import test from "node:test";

import {
  STATUT_ATTENTE, STATUT_REFUSEE, compterDemandesParSection, demandeEnAttente, demandeRefusee,
  elevesDemandeEnAttente, elevesDemandeRefusee, exonerationDepuisDemande, getDemande,
  normaliserDemande, nouvelleDemande, refuserDemande,
} from "../src/demande-dispense.js";
import {
  accorderExoneration, demanderDispense, refuserDemandeDispense, retirerDemandeDispense,
} from "../src/components/comptabilite/exoneration-actions.js";

const ANNEE = "2026-2027";
const proposition = { mensualites: 100, inscription: 50, fraisAnnexes: 0, motif: "orphelin", precision: "" };
const enAttente = nouvelleDemande(proposition, { annee: ANNEE, auteur: "Mme Camara", date: "16/11/2026" });

// Dépendances des actions : on note ce qui est écrit, journalisé, notifié.
function deps(extra = {}) {
  const ecrit = [];
  const journal = [];
  const push = [];
  const toasts = [];
  return {
    ecrit, journal, push, toasts,
    modEleves: async (id, champs) => { ecrit.push({ id, champs }); },
    logAction: (action, detail) => journal.push({ action, detail }),
    envoyerPush: (cibles, titre, corps) => push.push({ cibles, titre, corps }),
    toast: (msg, ton) => toasts.push({ msg, ton }),
    auteur: "Mme Camara",
    annee: ANNEE,
    ...extra,
  };
}
const eleve = (demandeDispense, autres = {}) => ({
  _id: "e1", nom: "DIALLO", prenom: "Mamadou", classe: "6e A", matricule: "M-001", demandeDispense, ...autres,
});
const sansConfirmation = (fn) => async () => {
  const avant = globalThis.confirm;
  globalThis.confirm = () => true;
  try { await fn(); } finally { globalThis.confirm = avant; }
};

// ── Le modèle ─────────────────────────────────────────────────────────────

test("une demande porte la dispense proposée, son année et qui l'a demandée", () => {
  assert.deepEqual(enAttente, {
    mensualites: 100, inscription: 50, fraisAnnexes: 0, motif: "orphelin", precision: "",
    annee: ANNEE, demandeePar: "Mme Camara", demandeeLe: "16/11/2026",
    statut: STATUT_ATTENTE, refuseePar: "", refuseeLe: "", motifRefus: "",
  });
});

test("une demande qui ne dispense de rien n'en est pas une", () => {
  assert.equal(nouvelleDemande({ mensualites: 0, inscription: 0, fraisAnnexes: 0, motif: "social" }, { annee: ANNEE }), null);
  assert.equal(normaliserDemande(null), null);
  assert.equal(normaliserDemande("n'importe quoi"), null);
});

test("un statut inconnu vaut « en attente » ; seul un refus garde sa réponse", () => {
  const bizarre = normaliserDemande({ ...enAttente, statut: "acceptee", motifRefus: "trace" });
  assert.equal(bizarre.statut, STATUT_ATTENTE);
  assert.equal(bizarre.motifRefus, "");
});

test("refuser garde la demande et y ajoute la raison, qui et quand", () => {
  const refusee = refuserDemande(enAttente, { motifRefus: "La famille a payé l'an dernier", auteur: "M. Bah", date: "17/11/2026" });
  assert.equal(refusee.statut, STATUT_REFUSEE);
  assert.equal(refusee.motifRefus, "La famille a payé l'an dernier");
  assert.equal(refusee.refuseePar, "M. Bah");
  assert.equal(refusee.refuseeLe, "17/11/2026");
  assert.equal(refusee.mensualites, 100);
  assert.equal(refusee.demandeePar, "Mme Camara");
});

test("une demande ne compte que pour son année scolaire", () => {
  const e = eleve(enAttente);
  assert.ok(demandeEnAttente(e, ANNEE));
  assert.equal(getDemande(e, "2027-2028"), null);
  assert.equal(demandeEnAttente(e, "2027-2028"), false);
  // Sans année : la demande, quelle qu'elle soit (accorder la retire toujours).
  assert.ok(getDemande(e));
});

test("en attente et refusées se séparent", () => {
  const refusee = refuserDemande(enAttente, { motifRefus: "Non", auteur: "DG" });
  const eleves = [eleve(enAttente), eleve(refusee, { _id: "e2" }), eleve(undefined, { _id: "e3" })];
  assert.deepEqual(elevesDemandeEnAttente(eleves, ANNEE).map((e) => e._id), ["e1"]);
  assert.deepEqual(elevesDemandeRefusee(eleves, ANNEE).map((e) => e._id), ["e2"]);
  assert.ok(demandeRefusee(eleves[1], ANNEE));
});

test("le compte par section ne garde que les sections qui ont des demandes, la plus chargée d'abord", () => {
  const refusee = refuserDemande(enAttente, { motifRefus: "Non" });
  const autreAnnee = { ...enAttente, annee: "2025-2026" };
  const compte = compterDemandesParSection({
    college: [eleve(enAttente), eleve(refusee)],
    primaire: [eleve(enAttente), eleve(enAttente), eleve(autreAnnee)],
    lycee: [],
    prescolaire: undefined,
  }, ANNEE);
  assert.deepEqual(compte, {
    total: 3,
    parSection: [{ section: "primaire", nombre: 2 }, { section: "college", nombre: 1 }],
  });
  assert.deepEqual(compterDemandesParSection({}, ANNEE), { total: 0, parSection: [] });
});

test("accepter telle quelle reprend exactement les taux et le motif demandés", () => {
  assert.deepEqual(exonerationDepuisDemande(enAttente), proposition);
  assert.equal(exonerationDepuisDemande(null), null);
});

// ── Les actions ───────────────────────────────────────────────────────────

test("la comptable demande : la fiche reçoit la demande, le journal et le DG sont prévenus", sansConfirmation(async () => {
  const d = deps();
  const ok = await demanderDispense(eleve(undefined), proposition, { ...d, estDirection: false });
  assert.equal(ok, true);
  assert.equal(d.ecrit.length, 1);
  const { demandeDispense } = d.ecrit[0].champs;
  assert.equal(demandeDispense.statut, STATUT_ATTENTE);
  assert.equal(demandeDispense.annee, ANNEE);
  assert.equal(demandeDispense.demandeePar, "Mme Camara");
  assert.equal(demandeDispense.mensualites, 100);
  // Rien n'est accordé : la dette n'est pas touchée.
  assert.equal("exoneration" in d.ecrit[0].champs, false);
  assert.equal(d.journal[0].action, "Dispense de paiement demandée à la Direction");
  assert.deepEqual(d.push[0].cibles, ["direction"]);
}));

test("une demande sans poste, ou « Autre » sans précision, n'est pas envoyée", sansConfirmation(async () => {
  const d = deps();
  assert.equal(await demanderDispense(eleve(), { mensualites: 0, inscription: 0, fraisAnnexes: 0, motif: "social" }, { ...d, estDirection: false }), false);
  assert.equal(await demanderDispense(eleve(), { ...proposition, motif: "autre", precision: " " }, { ...d, estDirection: false }), false);
  assert.equal(d.ecrit.length, 0);
  assert.equal(d.push.length, 0);
}));

test("la Direction n'envoie pas de demande : elle accorde", sansConfirmation(async () => {
  const d = deps();
  assert.equal(await demanderDispense(eleve(), proposition, { ...d, estDirection: true }), false);
  assert.equal(d.ecrit.length, 0);
}));

test("annuler la confirmation n'écrit rien et ne prévient personne", async () => {
  const avant = globalThis.confirm;
  globalThis.confirm = () => false;
  try {
    const d = deps();
    assert.equal(await demanderDispense(eleve(), proposition, { ...d, estDirection: false }), false);
    assert.equal(d.ecrit.length + d.push.length + d.journal.length, 0);
  } finally { globalThis.confirm = avant; }
});

test("accorder une dispense demandée retire la demande et garde au journal qui l'avait demandée", sansConfirmation(async () => {
  const d = deps({ auteur: "M. Bah" });
  const ok = await accorderExoneration(eleve(enAttente), exonerationDepuisDemande(enAttente), { ...d, estDirection: true });
  assert.equal(ok, true);
  assert.equal(d.ecrit[0].champs.demandeDispense, null);
  assert.equal(d.ecrit[0].champs.exoneration.mensualites, 100);
  assert.equal(d.ecrit[0].champs.exoneration.accordeePar, "M. Bah");
  assert.match(d.journal[0].detail, /demandée par Mme Camara/);
}));

test("accorder sans demande n'écrit que la dispense, comme avant", sansConfirmation(async () => {
  const d = deps();
  await accorderExoneration(eleve(undefined), proposition, { ...d, estDirection: true });
  assert.deepEqual(Object.keys(d.ecrit[0].champs), ["exoneration"]);
}));

test("la comptable ne peut pas accorder elle-même, même avec une demande", sansConfirmation(async () => {
  const d = deps();
  assert.equal(await accorderExoneration(eleve(enAttente), proposition, { ...d, estDirection: false }), false);
  assert.equal(d.ecrit.length, 0);
}));

test("refuser exige une raison et la laisse sur la fiche pour la comptable", async () => {
  const d = deps({ auteur: "M. Bah" });
  assert.equal(await refuserDemandeDispense(eleve(enAttente), "  ", { ...d, estDirection: true }), false);
  assert.equal(d.ecrit.length, 0);

  assert.equal(await refuserDemandeDispense(eleve(enAttente), "Famille solvable", { ...d, estDirection: true }), true);
  const { demandeDispense } = d.ecrit[0].champs;
  assert.equal(demandeDispense.statut, STATUT_REFUSEE);
  assert.equal(demandeDispense.motifRefus, "Famille solvable");
  assert.equal(demandeDispense.refuseePar, "M. Bah");
  assert.equal(d.journal[0].action, "Demande de dispense refusée");
  assert.match(d.journal[0].detail, /raison du refus : Famille solvable/);
});

test("seule la Direction refuse, et seulement une demande en attente de l'année", async () => {
  const d = deps();
  assert.equal(await refuserDemandeDispense(eleve(enAttente), "Non", { ...d, estDirection: false }), false);
  const dejaRefusee = refuserDemande(enAttente, { motifRefus: "Non" });
  assert.equal(await refuserDemandeDispense(eleve(dejaRefusee), "Encore non", { ...d, estDirection: true }), false);
  assert.equal(await refuserDemandeDispense(eleve({ ...enAttente, annee: "2025-2026" }), "Non", { ...d, estDirection: true }), false);
  assert.equal(d.ecrit.length, 0);
});

test("retirer une demande en attente est confirmé et journalisé ; classer un refus lu ne l'est pas", sansConfirmation(async () => {
  const d = deps();
  assert.equal(await retirerDemandeDispense(eleve(enAttente), d), true);
  assert.equal(d.ecrit[0].champs.demandeDispense, null);
  assert.equal(d.journal[0].action, "Demande de dispense retirée");

  const lu = deps();
  const avant = globalThis.confirm;
  globalThis.confirm = () => { throw new Error("aucune confirmation attendue"); };
  try {
    assert.equal(await retirerDemandeDispense(eleve(refuserDemande(enAttente, { motifRefus: "Non" })), lu), true);
  } finally { globalThis.confirm = avant; }
  assert.equal(lu.ecrit[0].champs.demandeDispense, null);
  assert.equal(lu.journal.length, 0);
}));
