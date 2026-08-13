import assert from "node:assert/strict";
import test from "node:test";
import { getRecuTotals } from "../src/reports.js";
import { blocTicket, documentTicket, normaliserLargeur } from "../src/reports/recus/recu-ticket.js";

const eleve = {
  nom: "Diallo", prenom: "Aïssatou", matricule: "M-042", classe: "6e A", tuteur: "Mamadou Diallo",
  mens: { Octobre: "Payé", Novembre: "Payé", Décembre: "Impayé" },
  mensMontants: { Octobre: 150000 }, // encaissé à l'ancien tarif
  mensDates: { Octobre: "05/10/2026", Novembre: "03/11/2026" },
  inscriptionPayee: true,
  autrePayee: false,
};
const moisAnnee = ["Octobre", "Novembre", "Décembre"];
const fraisAnnexes = { inscription: 50000, autre: 15000 };

// `toLocaleString("fr-FR")` sépare les milliers par une espace fine insécable :
// on la normalise pour écrire les attentes en espaces ordinaires.
const lisible = (html) => html.replace(/\p{Zs}/gu, " ");

const contexte = (largeurMm = 58) => ({
  schoolInfo: { nom: "La Citadelle", telephone: "+224 620 00 00 00" },
  eleve, moisAnnee, mensDates: eleve.mensDates, montantUnit: 200000,
  ...getRecuTotals(eleve, 200000, moisAnnee, fraisAnnexes),
  qr: "<img src=\"data:image/png;base64,xxx\"/>", largeurMm,
});

test("le ticket ne détaille que les mois réglés, au montant figé à l'encaissement", () => {
  const html = lisible(blocTicket(contexte()));

  assert.ok(html.includes("Octobre"));
  assert.ok(html.includes("150 000"));    // tarif figé d'octobre
  assert.ok(html.includes("200 000"));    // novembre au tarif courant
  assert.ok(!html.includes("Décembre"));  // impayé : pas de ligne sur le rouleau
  // Le solde restant tient en une ligne plutôt qu'en liste d'impayés.
  assert.ok(html.includes("Reste à régler : 1"));
});

test("le ticket totalise mensualités et frais réglés, et ignore les frais impayés", () => {
  const html = lisible(blocTicket(contexte()));

  assert.ok(html.includes("Inscription"));
  assert.ok(html.includes("50 000"));
  assert.ok(!html.includes("15 000"));   // « autre frais » non réglé
  assert.ok(html.includes("400 000"));   // total général : 150k + 200k + 50k
});

test("le document ticket fixe le format rouleau et retombe sur 58 mm si largeur inconnue", () => {
  const doc58 = documentTicket(contexte(58), "", "fr", "ltr");
  const doc80 = documentTicket(contexte(80), "", "fr", "ltr");

  assert.ok(doc58.includes("@page{size:58mm auto;margin:0}"));
  assert.ok(doc58.includes("width:58mm"));
  assert.ok(doc80.includes("@page{size:80mm auto;margin:0}"));

  assert.equal(normaliserLargeur(80), 80);
  assert.equal(normaliserLargeur(57), 58);
  assert.equal(normaliserLargeur(undefined), 58);
  assert.ok(documentTicket({ ...contexte(), largeurMm: 999 }, "", "fr", "ltr").includes("size:58mm auto"));
});

test("le ticket reste monochrome : aucun aplat de couleur pour la tête thermique", () => {
  const doc = documentTicket(contexte(), "", "fr", "ltr");
  const styles = doc.slice(doc.indexOf("<style>"), doc.indexOf("</style>"));

  // Les seules couleurs admises sont le noir du texte et le blanc du papier.
  const couleurs = styles.match(/#[0-9a-f]{3,6}/gi) || [];
  assert.deepEqual([...new Set(couleurs.map((c) => c.toLowerCase()))].sort(), ["#000", "#fff"]);
  assert.ok(!/background:\s*(?!#fff|none)/.test(blocTicket(contexte())));
});
