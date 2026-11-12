// Inscription refusée par le serveur après coup (incident FFD du 19/10/2026) :
// la saisie ne doit plus disparaître sans laisser de trace.
import test from "node:test";
import assert from "node:assert/strict";
import {
  EVENEMENT_A_REGULARISER, ajouterARegulariser, definirAuteurJournal, doitTracerAuJournal,
  grouperParEleve, libellePaiement, ligneJournalRefus, lireARegulariser, motifRefus,
  resumeRefus, retirerARegulariser,
} from "../src/backend/refus-ecriture.js";
import { _reinitialiserGardeRefus, garderRefus } from "../src/backend/powersync/garde-refus.js";
import { envoyerOperation } from "../src/backend/powersync/envoi-operation.js";

const stockageMemoire = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) };
};

const ECOLE = "68a33e7a-0000-0000-0000-000000000000";
const ASMAOU = {
  id: "e-asmaou", ecole_id: ECOLE, section: "prescolaire", nom: "ASMAOU", prenom: "DIALLO",
  classe: "Petite Section A", matricule: "M26/111", photo: "data:image/png;base64,xxxx",
  extra: JSON.stringify({ mens: { Oct: "Impayé" } }),
};
const REFUS_HOMONYME = Object.assign(new Error("Élève déjà inscrit : ASMAOU DIALLO (5ème Année A, matricule P26/164)."), {
  code: "23505", hint: "S'il s'agit d'un autre enfant, renseignez la date de naissance sur les deux fiches.",
});
const REFUS_FICHE_ABSENTE = Object.assign(new Error("insert or update on table \"paiements\" violates foreign key constraint \"paiements_eleve_id_fkey\""), { code: "23503" });

// Base PowerSync factice : lignes du miroir + requêtes exécutées.
function baseFactice(lignes = {}) {
  const executees = [];
  return {
    executees,
    async getOptional(sql, params) {
      if (/FROM ecoles/.test(sql)) return lignes.ecoles?.[0] || null;
      const table = sql.match(/FROM (\w+)/)?.[1];
      return lignes[table]?.find((l) => l.id === params[0]) || null;
    },
    async execute(sql, params) { executees.push({ sql, params }); },
  };
}

test("motif : message du serveur + indice ; contrainte technique traduite ; indice technique ignoré", () => {
  assert.equal(motifRefus(REFUS_HOMONYME, "eleves"),
    "Élève déjà inscrit : ASMAOU DIALLO (5ème Année A, matricule P26/164). S'il s'agit d'un autre enfant, renseignez la date de naissance sur les deux fiches.");
  assert.match(motifRefus(REFUS_FICHE_ABSENTE, "paiements"), /fiche de l'élève n'existe pas sur le serveur/);
  assert.equal(motifRefus({ message: "Suppression refusée.", hint: "eleve_avec_encaissements" }, "eleves"), "Suppression refusée.");
  assert.equal(doitTracerAuJournal("historique"), false);
  assert.equal(doitTracerAuJournal("msg_messages"), false);
  assert.equal(doitTracerAuJournal("eleves"), true);
});

test("ligne du journal : l'inscription refusée dit qui, où, pourquoi, et quoi faire — sans la photo", () => {
  const ligne = ligneJournalRefus({ table: "eleves", operation: "PUT", id: "e-asmaou", donnees: ASMAOU, motif: "Élève déjà inscrit." });
  assert.equal(ligne.action, "Inscription refusée par le serveur");
  assert.match(ligne.details, /^ASMAOU DIALLO \(Petite Section A, M26\/111\) — Élève déjà inscrit\./);
  assert.match(ligne.details, /réinscrire puis réencaisser/);
  assert.equal(ligne.refus.table, "eleves");
  assert.equal(ligne.refus.donnees.photo, undefined);
  assert.equal(ligne.refus.donnees.classe, "Petite Section A");

  const paiement = { id: "p1", ecole_id: ECOLE, eleve_id: "e-asmaou", eleve_nom: "ASMAOU DIALLO", classe: "Petite Section A", type: "mensualite", mois: "Oct", libelle: "Mensualité", montant: 100000 };
  const l2 = ligneJournalRefus({ table: "paiements", operation: "PUT", id: "p1", donnees: paiement, motif: "fiche absente." });
  assert.equal(l2.action, "Encaissement refusé par le serveur");
  assert.equal(l2.details, "ASMAOU DIALLO · Oct · 100 000 GNF — fiche absente.");
  assert.equal(libellePaiement({ type: "inscription", mois: "inscription", libelle: "Inscription" }), "Inscription");
  assert.deepEqual(resumeRefus({ table: "notes", operation: "PUT", donnees: {} }), { genre: "autre" });
});

test("à régulariser : ajout sans doublon, regroupement par élève avec le total, retrait", () => {
  const stockage = stockageMemoire();
  const cible = new EventTarget();
  let annonces = 0;
  cible.addEventListener(EVENEMENT_A_REGULARISER, () => { annonces += 1; });
  const opts = { stockage, cible };
  ajouterARegulariser({ id: "e1", genre: "inscription", eleveId: "e1", nom: "ASMAOU DIALLO", classe: "Petite Section A", motif: "homonyme", le: "2026-10-19T14:50:00Z" }, opts);
  ajouterARegulariser({ id: "p1", genre: "encaissement", eleveId: "e1", nom: "ASMAOU DIALLO", libelle: "Inscription", montant: 60000, motif: "fiche absente", le: "2026-10-19T14:50:01Z" }, opts);
  ajouterARegulariser({ id: "p2", genre: "encaissement", eleveId: "e1", nom: "ASMAOU DIALLO", libelle: "Oct", montant: 100000, motif: "fiche absente", le: "2026-10-19T14:50:02Z" }, opts);
  ajouterARegulariser({ id: "p2", genre: "encaissement", eleveId: "e1", nom: "ASMAOU DIALLO", libelle: "Oct", montant: 100000, le: "2026-10-19T14:50:02Z" }, opts);
  ajouterARegulariser({ id: "p9", genre: "encaissement", eleveId: "e9", nom: "CISSE SEKOU", libelle: "Jun", montant: 110000, motif: "x", le: "2026-10-26T15:53:00Z" }, opts);
  assert.equal(lireARegulariser(stockage).length, 4);
  assert.equal(annonces, 5);

  const groupes = grouperParEleve(lireARegulariser(stockage));
  assert.equal(groupes.length, 2);
  assert.equal(groupes[0].nom, "CISSE SEKOU"); // le plus récent d'abord
  const asmaou = groupes[1];
  assert.equal(asmaou.inscription, true);
  assert.equal(asmaou.motif, "homonyme"); // le motif de la fiche prime
  assert.equal(asmaou.total, 160000);
  assert.deepEqual(asmaou.encaissements.map((e) => e.libelle), ["Inscription", "Oct"]); // ordre de saisie
  assert.deepEqual(asmaou.ids.sort(), ["e1", "p1", "p2"]);

  retirerARegulariser(asmaou.ids, opts);
  assert.deepEqual(lireARegulariser(stockage).map((e) => e.id), ["p9"]);
});

test("garde : inscription refusée → à régulariser + ligne au journal ; ses suites ne sont pas annoncées deux fois", async () => {
  _reinitialiserGardeRefus();
  definirAuteurJournal("Comptable");
  const stockage = stockageMemoire();
  const db = baseFactice({ eleves: [{ ...ASMAOU }] });
  const opts = { stockage, cible: new EventTarget() };

  const motif = await garderRefus(db, { table: "eleves", op: "PUT", id: "e-asmaou", opData: { ...ASMAOU } }, REFUS_HOMONYME, opts);
  assert.match(motif, /Élève déjà inscrit/);
  assert.equal(db.executees.length, 1);
  const [id, ecole, extra] = db.executees[0].params;
  assert.match(db.executees[0].sql, /^INSERT INTO historique \(id, ecole_id, extra\)/);
  assert.ok(id);
  assert.equal(ecole, ECOLE);
  const ligne = JSON.parse(extra);
  assert.equal(ligne.action, "Inscription refusée par le serveur");
  assert.equal(ligne.auteur, "Comptable");
  assert.equal(typeof ligne.date, "number");
  assert.equal(ligne.refus.donnees.extra.mens.Oct, "Impayé"); // jsonb relu, pas une chaîne

  // Mois cochés sur la fiche refusée : refusés par voie de conséquence, rien de plus.
  await garderRefus(db, { table: "eleves", op: "PATCH", id: "e-asmaou", opData: { extra: "{}" } }, new Error("0 ligne"), opts);
  assert.equal(db.executees.length, 1);

  // Ses encaissements, eux, sont gardés un par un.
  const paiement = { ecole_id: ECOLE, eleve_id: "e-asmaou", eleve_nom: "ASMAOU DIALLO", classe: "Petite Section A", type: "mensualite", mois: "Oct", montant: 100000, extra: "{}" };
  const m2 = await garderRefus(db, { table: "paiements", op: "PUT", id: "p-oct", opData: paiement }, REFUS_FICHE_ABSENTE, opts);
  assert.match(m2, /n'existe pas sur le serveur/);
  assert.equal(db.executees.length, 2);
  assert.equal(JSON.parse(db.executees[1].params[2]).action, "Encaissement refusé par le serveur");

  const groupes = grouperParEleve(lireARegulariser(stockage));
  assert.equal(groupes.length, 1);
  assert.equal(groupes[0].inscription, true);
  assert.equal(groupes[0].total, 100000);
});

test("garde : modification refusée lue dans le miroir ; journal et messagerie jamais tracés ; jamais d'exception", async () => {
  _reinitialiserGardeRefus();
  const stockage = stockageMemoire();
  const opts = { stockage, cible: new EventTarget() };
  const db = baseFactice({ eleves: [{ id: "e2", ecole_id: ECOLE, nom: "BAH", prenom: "AWA", classe: "CP" }] });
  await garderRefus(db, { table: "eleves", op: "PATCH", id: "e2", opData: { classe: "CE1" } }, new Error("Classe obligatoire"), opts);
  assert.equal(db.executees.length, 1);
  const ligne = JSON.parse(db.executees[0].params[2]);
  assert.equal(ligne.action, "Modification refusée par le serveur");
  assert.match(ligne.details, /^BAH AWA \(CE1\)/);
  assert.equal(lireARegulariser(stockage).length, 0); // ni inscription ni encaissement

  await garderRefus(db, { table: "historique", op: "PUT", id: "h1", opData: { ecole_id: ECOLE, extra: "{}" } }, new Error("RLS"), opts);
  await garderRefus(db, { table: "msg_messages", op: "PUT", id: "m1", opData: { ecole_id: ECOLE } }, new Error("RLS"), opts);
  assert.equal(db.executees.length, 1);

  // Suppression : la ligne n'est plus dans le miroir → école lue dans `ecoles`.
  const db2 = baseFactice({ ecoles: [{ id: ECOLE }] });
  await garderRefus(db2, { table: "eleves", op: "DELETE", id: "e3" }, { message: "Suppression refusée.", hint: "eleve_avec_encaissements" }, opts);
  assert.equal(db2.executees[0].params[1], ECOLE);
  assert.equal(JSON.parse(db2.executees[0].params[2]).action, "Suppression refusée par le serveur");

  // Base locale en panne : le motif est rendu, aucune exception.
  const enPanne = { getOptional: async () => { throw new Error("db"); }, execute: async () => { throw new Error("db"); } };
  const motif = await garderRefus(enPanne, { table: "eleves", op: "PUT", id: "e4", opData: { ecole_id: ECOLE, nom: "X", prenom: "Y" } }, new Error("refus"), opts);
  assert.equal(motif, "refus");
});

test("envoi : le refus d'un ajout garde l'indice du serveur", async () => {
  const sb = {
    from: () => ({
      upsert: async () => ({ error: { message: "Élève déjà inscrit.", code: "23505", hint: "Renseignez la date de naissance." }, status: 409 }),
    }),
  };
  await assert.rejects(
    envoyerOperation(sb, { op: "PUT", table: "eleves", id: "e1" }, { record: { id: "e1" } }),
    (e) => e.code === "23505" && e.hint === "Renseignez la date de naissance." && e.status === 409,
  );
});
