import assert from "node:assert/strict";
import test from "node:test";

import {
  SIGNALE_ATTENTE, SIGNALE_REFUSE, STATUTS_SIGNALABLES, champsConfirmation, compterSignalementsParSection,
  elevesSignalementRefuse, elevesSignalesEnAttente, getSignalement, normaliserSignalement, nouveauSignalement,
  refuserSignalement, signalementEnAttente, signalementRefuse,
} from "../src/depart-signale.js";
import {
  confirmerDepartSignale, refuserDepartSignale, retirerSignalement, signalerDepart,
} from "../src/components/departs-signales/depart-signale-actions.js";

const ANNEE = "2026-2027";
const eleve = (departSignale, autres = {}) => ({
  _id: "e1", nom: "DIALLO", prenom: "Mamadou", classe: "CM2 A", matricule: "M-001", statut: "Actif", departSignale, ...autres,
});
const saisie = { statut: "Transféré", dateDepart: "2026-11-12", motifDepart: "accordé par le directeur", destinationDepart: "GS Les Pionniers" };
const { signalement: enAttente } = nouveauSignalement(eleve(), saisie, {
  annee: ANNEE, auteur: "M. Bah", role: "primaire", date: "12/11/2026",
});

// Dépendances des actions : on note ce qui est écrit, journalisé, notifié.
function deps(extra = {}) {
  const ecrit = [];
  const journal = [];
  const push = [];
  const toasts = [];
  return {
    ecrit, journal, push, toasts,
    modChamp: async (id, champs) => { ecrit.push({ id, champs }); },
    logAction: (action, detail) => journal.push({ action, detail }),
    envoyerPush: (cibles, titre, corps) => push.push({ cibles, titre, corps }),
    toast: (msg, ton) => toasts.push({ msg, ton }),
    auteur: "Mme Camara",
    annee: ANNEE,
    ...extra,
  };
}
const sansConfirmation = (fn) => async () => {
  const avant = globalThis.confirm;
  globalThis.confirm = () => true;
  try { await fn(); } finally { globalThis.confirm = avant; }
};

// ── Le modèle ─────────────────────────────────────────────────────────────

test("un signalement porte le départ proposé, son année et qui l'a signalé", () => {
  assert.deepEqual(enAttente, {
    statut: "Transféré", dateDepart: "2026-11-12", motifDepart: "accordé par le directeur",
    destinationDepart: "GS Les Pionniers", annee: ANNEE,
    signalePar: "M. Bah", signaleParRole: "primaire", signaleLe: "12/11/2026",
    etat: SIGNALE_ATTENTE, refusePar: "", refuseLe: "", motifRefus: "",
  });
});

test("on signale un transfert, un abandon, une exclusion ou un décès — pas un diplôme", () => {
  assert.deepEqual(STATUTS_SIGNALABLES, ["Transféré", "Exclu", "Abandonné", "Décédé"]);
  assert.equal(normaliserSignalement({ ...saisie, statut: "Diplômé" }), null);
  assert.equal(normaliserSignalement({ ...saisie, statut: "Actif" }), null);
});

test("sans élève, élève déjà parti, type ou date manquants : refusé, avec la raison", () => {
  const opts = { annee: ANNEE };
  assert.deepEqual(nouveauSignalement(null, saisie, opts), { erreur: "eleve" });
  assert.deepEqual(nouveauSignalement(eleve(undefined, { statut: "Abandonné" }), saisie, opts), { erreur: "dejaParti" });
  assert.deepEqual(nouveauSignalement(eleve(), { ...saisie, statut: "" }, opts), { erreur: "statut" });
  assert.deepEqual(nouveauSignalement(eleve(), { ...saisie, dateDepart: "" }, opts), { erreur: "date" });
  assert.deepEqual(nouveauSignalement(eleve(), { ...saisie, dateDepart: "2026-02-31" }, opts), { erreur: "date" });
});

test("l'école d'accueil n'est gardée que pour un transfert", () => {
  const { signalement } = nouveauSignalement(eleve(), { ...saisie, statut: "Abandonné" }, { annee: ANNEE });
  assert.equal(signalement.destinationDepart, "");
  assert.equal(signalement.statut, "Abandonné");
});

test("un état inconnu vaut « en attente » ; seul un refus garde sa réponse", () => {
  const brut = { ...enAttente, etat: "n'importe quoi", refusePar: "X", motifRefus: "Y" };
  const lu = normaliserSignalement(brut);
  assert.equal(lu.etat, SIGNALE_ATTENTE);
  assert.equal(lu.refusePar, "");
  assert.equal(lu.motifRefus, "");
});

test("refusé : la raison, qui et quand ; le départ proposé reste lisible", () => {
  const refuse = refuserSignalement(enAttente, { motifRefus: "Il a payé l'année", auteur: "Mme Camara", date: "13/11/2026" });
  assert.equal(refuse.etat, SIGNALE_REFUSE);
  assert.equal(refuse.motifRefus, "Il a payé l'année");
  assert.equal(refuse.refusePar, "Mme Camara");
  assert.equal(refuse.statut, "Transféré");
  assert.equal(refuse.signalePar, "M. Bah");
});

test("un signalement ne compte que pour son année ; un élève déjà parti n'attend plus rien", () => {
  const e = eleve(enAttente);
  assert.ok(getSignalement(e, ANNEE));
  assert.equal(getSignalement(e, "2025-2026"), null);
  assert.ok(getSignalement(e));
  assert.equal(signalementEnAttente(e, ANNEE), true);
  assert.equal(signalementEnAttente(e, "2025-2026"), false);
  // Départ déclaré entre-temps par la comptabilité elle-même.
  assert.equal(signalementEnAttente({ ...e, statut: "Transféré" }, ANNEE), false);
  const refuse = eleve(refuserSignalement(enAttente, { motifRefus: "non" }));
  assert.equal(signalementRefuse(refuse, ANNEE), true);
  assert.equal(signalementEnAttente(refuse, ANNEE), false);
  assert.deepEqual(elevesSignalesEnAttente([e, refuse, eleve()], ANNEE).map((x) => x._id), ["e1"]);
  assert.equal(elevesSignalementRefuse([e, refuse], ANNEE).length, 1);
});

test("compte par section : seules les sections qui en ont, la plus chargée d'abord", () => {
  const a = (id) => eleve(enAttente, { _id: id });
  const compte = compterSignalementsParSection({
    college: [a("c1")], primaire: [a("p1"), a("p2"), eleve()], lycee: [], prescolaire: undefined,
  }, ANNEE);
  assert.deepEqual(compte, { total: 3, parSection: [{ section: "primaire", nombre: 2 }, { section: "college", nombre: 1 }] });
});

test("confirmer écrit le départ comme le formulaire de l'élève, et retire le signalement", () => {
  assert.deepEqual(champsConfirmation(enAttente), {
    statut: "Transféré", dateDepart: "2026-11-12", motifDepart: "accordé par le directeur",
    destinationDepart: "GS Les Pionniers", departSignale: null,
  });
  const abandon = nouveauSignalement(eleve(), { statut: "Abandonné", dateDepart: "2026-11-12" }, { annee: ANNEE }).signalement;
  assert.deepEqual(champsConfirmation(abandon), {
    statut: "Abandonné", dateDepart: "2026-11-12", motifDepart: null, destinationDepart: null, departSignale: null,
  });
  assert.equal(champsConfirmation(null), null);
});

// ── Les actions ───────────────────────────────────────────────────────────

test("signaler : la fiche porte le signalement, la comptabilité est prévenue, le journal le garde", sansConfirmation(async () => {
  const d = deps({ auteur: "M. Bah", role: "primaire" });
  assert.equal(await signalerDepart(eleve(), saisie, d), true);
  assert.equal(d.ecrit.length, 1);
  assert.equal(d.ecrit[0].id, "e1");
  assert.equal(d.ecrit[0].champs.departSignale.etat, SIGNALE_ATTENTE);
  assert.equal(d.ecrit[0].champs.departSignale.signaleParRole, "primaire");
  assert.equal(d.ecrit[0].champs.departSignale.annee, ANNEE);
  assert.deepEqual(d.push.map((p) => p.cibles), [["comptable"]]);
  assert.match(d.journal[0].action, /signalé à la comptabilité/);
  assert.match(d.journal[0].detail, /DIALLO Mamadou · CM2 A · M-001/);
  assert.match(d.journal[0].detail, /Transféré le 12\/11\/2026 · vers GS Les Pionniers/);
}));

test("signaler sans date : rien n'est écrit, personne n'est prévenu", sansConfirmation(async () => {
  const d = deps();
  assert.equal(await signalerDepart(eleve(), { ...saisie, dateDepart: "" }, d), false);
  assert.equal(d.ecrit.length, 0);
  assert.equal(d.push.length, 0);
  assert.equal(d.toasts[0].ton, "warning");
}));

test("annuler la confirmation n'écrit rien et ne prévient personne", async () => {
  const avant = globalThis.confirm;
  globalThis.confirm = () => false;
  try {
    const d = deps();
    assert.equal(await signalerDepart(eleve(), saisie, d), false);
    assert.equal(await confirmerDepartSignale(eleve(enAttente), d), false);
    assert.equal(d.ecrit.length + d.push.length + d.journal.length, 0);
  } finally { globalThis.confirm = avant; }
});

test("confirmer : la fiche devient un départ, l'auteur du signalement est prévenu", sansConfirmation(async () => {
  const d = deps();
  assert.equal(await confirmerDepartSignale(eleve(enAttente), d), true);
  assert.deepEqual(d.ecrit[0].champs, champsConfirmation(enAttente));
  assert.deepEqual(d.push.map((p) => p.cibles), [["primaire"]]);
  assert.match(d.journal[0].action, /confirmé/);
  assert.match(d.journal[0].detail, /signalé par M\. Bah le 12\/11\/2026/);
}));

test("confirmer un signalement d'une autre année ou déjà refusé : rien", sansConfirmation(async () => {
  const d = deps();
  assert.equal(await confirmerDepartSignale(eleve(enAttente), { ...d, annee: "2027-2028" }), false);
  assert.equal(await confirmerDepartSignale(eleve(refuserSignalement(enAttente, { motifRefus: "non" })), d), false);
  assert.equal(d.ecrit.length, 0);
}));

test("refuser exige une raison ; refusé, le signalement reste lisible par son auteur", sansConfirmation(async () => {
  const d = deps();
  assert.equal(await refuserDepartSignale(eleve(enAttente), "  ", d), false);
  assert.equal(d.ecrit.length, 0);
  assert.equal(await refuserDepartSignale(eleve(enAttente), "Il a payé toute l'année", d), true);
  const ecrit = d.ecrit[0].champs.departSignale;
  assert.equal(ecrit.etat, SIGNALE_REFUSE);
  assert.equal(ecrit.motifRefus, "Il a payé toute l'année");
  assert.equal(ecrit.refusePar, "Mme Camara");
  assert.equal(d.ecrit[0].champs.statut, undefined);
  assert.deepEqual(d.push.map((p) => p.cibles), [["primaire"]]);
  assert.match(d.journal[0].detail, /raison du refus : Il a payé toute l'année/);
}));

test("retirer : en attente (confirmé par l'auteur) ou refusé et lu (sans question)", async () => {
  const avant = globalThis.confirm;
  let questions = 0;
  globalThis.confirm = () => { questions += 1; return true; };
  try {
    const d = deps();
    assert.equal(await retirerSignalement(eleve(enAttente), d), true);
    assert.equal(questions, 1);
    assert.equal(d.journal.length, 1);
    assert.equal(await retirerSignalement(eleve(refuserSignalement(enAttente, { motifRefus: "non" })), d), true);
    assert.equal(questions, 1);
    assert.deepEqual(d.ecrit.map((x) => x.champs), [{ departSignale: null }, { departSignale: null }]);
    assert.equal(await retirerSignalement(eleve(), d), false);
  } finally { globalThis.confirm = avant; }
});
