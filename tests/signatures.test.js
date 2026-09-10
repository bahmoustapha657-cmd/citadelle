import assert from "node:assert/strict";
import test from "node:test";
import {
  SECTION, blocsSignatures, compacterMatrice, normaliserMatrice, signatairesDocument,
} from "../src/reports/signatures.js";
import { blocRecu } from "../src/reports/recus/recu-blocs.js";

const ecole = {
  nom: "La Citadelle",
  responsables: {
    direction: "Mamadou Lamarana Diallo", comptable: "Aïssatou Bah",
    college: "Djiba Oury Diallo", "censeur-des-etudes": "Ibrahima Sow",
  },
};
const signataires = (schoolInfo, doc, section = "college") =>
  signatairesDocument(schoolInfo, doc, { section }).map(({ role, cle, titre, nom }) => ({ role, cle, titre, nom }));

// ── Sans réglage : les signataires d'avant la matrice ─────────────────────
test("sans réglage, chaque document garde son signataire et son titre d'origine", () => {
  assert.deepEqual(signataires(ecole, "recu"),
    [{ role: "principal", cle: "comptable", titre: "Comptable", nom: "Aïssatou Bah" }]);
  assert.deepEqual(signataires(ecole, "etatSalaires"), [
    { role: "principal", cle: "comptable", titre: "Le Comptable", nom: "Aïssatou Bah" },
    { role: "visa", cle: "direction", titre: "Le Directeur", nom: "Mamadou Lamarana Diallo" },
  ]);
  assert.equal(signataires(ecole, "livret")[0].titre, "Le/La Directeur(rice)");
  assert.equal(signataires(ecole, "rapportAnnuel")[0].titre, "Directeur Général");
  // Documents de section : le chef de la section de l'élève.
  assert.equal(signataires(ecole, "bulletin", "college")[0].nom, "Djiba Oury Diallo");
  assert.equal(signataires(ecole, "bulletin", "lycee")[0].cle, "college");
  // Seuls les états de salaires ont un visa d'origine.
  for (const doc of ["recu", "bulletin", "ficheCompositions", "livret", "attestation", "ordreMutation", "radiation", "rapportAnnuel"]) {
    assert.equal(signataires(ecole, doc).length, 1, doc);
  }
});

// ── Ce que la matrice rend possible ───────────────────────────────────────
test("un poste créé par l'école peut signer, sous son nom et avec son responsable", () => {
  const info = {
    ...ecole,
    libellesPostes: { "censeur-des-etudes": "Censeur des études" },
    signatures: { bulletin: { principal: "censeur-des-etudes", visa: null } },
  };

  assert.deepEqual(signataires(info, "bulletin"),
    [{ role: "principal", cle: "censeur-des-etudes", titre: "Censeur des études", nom: "Ibrahima Sow" }]);
});

test("un poste renommé dans Comptes & Postes porte son nouveau nom sur les documents", () => {
  const info = { ...ecole, libellesPostes: { comptable: "L'Intendant" } };
  assert.equal(signataires(info, "recu")[0].titre, "L'Intendant");
});

test("un libellé d'origine jamais renommé ne remplace pas le titre habituel", () => {
  // « Comptabilite » nomme un bureau, pas une personne : le reçu garde « Comptable ».
  const info = { ...ecole, libellesPostes: { comptable: "Comptabilite", direction: "Direction Generale" } };
  assert.equal(signataires(info, "recu")[0].titre, "Comptable");
  assert.equal(signataires(info, "rapportAnnuel")[0].titre, "Directeur Général");
});

test("un poste confié à un autre document ne garde pas le titre de l'ancien signataire", () => {
  // Reçu confié à la direction : il ne peut plus s'intituler « Comptable ».
  const info = { ...ecole, signatures: { recu: { principal: "direction", visa: null } } };
  assert.deepEqual(signataires(info, "recu"),
    [{ role: "principal", cle: "direction", titre: "Direction Générale", nom: "Mamadou Lamarana Diallo" }]);
});

test("second signataire : le visa s'ajoute après le signataire principal", () => {
  const info = { ...ecole, signatures: { bulletin: { principal: SECTION, visa: "direction" } } };
  assert.deepEqual(signataires(info, "bulletin", "college").map((s) => [s.role, s.cle]),
    [["principal", "college"], ["visa", "direction"]]);
});

test("visa et signataire principal confondus : un seul bloc", () => {
  // Section primaire sans responsable → repli direction, déjà en visa.
  const info = { ...ecole, signatures: { bulletin: { principal: SECTION, visa: "direction" } } };
  assert.equal(signataires(info, "bulletin", "primaire").length, 1);
});

test("le visa d'origine peut être retiré", () => {
  const info = { ...ecole, signatures: { etatSalaires: { principal: "comptable", visa: null } } };
  assert.equal(signataires(info, "etatSalaires").length, 1);
});

// ── Garde-fous ────────────────────────────────────────────────────────────
test("un poste supprimé retombe sur le signataire d'origine, pas sur un fantôme", () => {
  const info = { ...ecole, signatures: { recu: { principal: "poste-supprime", visa: "autre-fantome" } } };
  assert.deepEqual(signataires(info, "recu").map((s) => s.cle), ["comptable"]);
});

test("« chef de section » sur un document sans élève retombe sur l'origine", () => {
  const info = { ...ecole, signatures: { rapportAnnuel: { principal: SECTION, visa: null } } };
  assert.equal(signataires(info, "rapportAnnuel")[0].titre, "Directeur Général");
});

test("un document inconnu est une erreur de programmation, pas un bloc vide", () => {
  assert.throws(() => signatairesDocument(ecole, "facture"), /Document inconnu/);
});

// ── Stockage ──────────────────────────────────────────────────────────────
test("seules les lignes modifiées sont stockées, le reste suit les valeurs d'origine", () => {
  assert.deepEqual(compacterMatrice(normaliserMatrice({})), {});

  const reglage = { recu: { principal: "direction", visa: null }, etatSalaires: { principal: "comptable", visa: null } };
  const stocke = compacterMatrice(normaliserMatrice(reglage));
  // Le retrait du visa d'origine est un choix : il est conservé.
  assert.deepEqual(stocke, reglage);
  assert.deepEqual(normaliserMatrice(stocke).bulletin, { principal: SECTION, visa: null });
});

// ── Rendu dans un vrai document ───────────────────────────────────────────
test("le reçu imprime le visa à côté du comptable, le cachet reste au signataire principal", () => {
  const info = { ...ecole, signatures: { recu: { principal: "comptable", visa: "direction" } } };
  const html = blocRecu("Exemplaire — Payant", {
    schoolInfo: info, lf: {}, eleve: { nom: "DIALLO", prenom: "Aïssatou", classe: "6ème A" },
    moisAnnee: ["Octobre"], mens: { Octobre: "Payé" }, mensDates: {},
    fraisIns: 0, fraisAutre: 0, fraisDiversPayes: [], totalMensualites: 150000,
    moisPayes: ["Octobre"], totalGeneral: 150000, qr: "",
  });

  assert.ok(html.includes("Aïssatou Bah"));
  assert.ok(html.includes("Mamadou Lamarana Diallo"));
  assert.equal(html.split("&amp; Cachet").length - 1, 1);
});

test("blocsSignatures confie au gabarit le rendu de chaque bloc", () => {
  const html = blocsSignatures(ecole, "etatSalaires", (identite, s) => `[${s.role}:${identite}]`);
  assert.ok(html.startsWith("[principal:Le Comptable<br/>"));
  assert.ok(html.includes("[visa:Le Directeur<br/>"));
});
