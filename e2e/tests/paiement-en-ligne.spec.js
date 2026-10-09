// Paiement en ligne (Mobile Money) par le fournisseur « simulation » : la
// direction l'active dans Paramètres, le parent de BAH paie une mensualité
// depuis son portail, le paiement est
// imputé AUTOMATIQUEMENT avec les règles de la caisse (fiche + journal), une
// seule fois, et le comptable le retrouve dans l'onglet « 💳 En ligne ».
// On vérifie l'écran ET la base, comme encaissement.spec.js.
import { test, expect } from "@playwright/test";
import {
  COMPTABLE, DIRECTION, ECOLE, ELEVES, FRAIS_POURCENT, MENSUALITE, PARENT,
  appelerPaiement, confirmerChezOperateurSansNotification, encaisserToutEnCaisse,
  lireEleve, lirePaiementConfig, lirePaiements, lirePaiementsEnLigne, preparerPaiementEnLigne,
} from "../donnees.js";
import { ouvrirModule, seConnecter } from "../parcours.js";

const montant = (n) => new RegExp(String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "[\\s\\u202f\\u00a0.]?"));
const moisPayes = (mens = {}) => Object.entries(mens).filter(([, v]) => v === "Payé").map(([m]) => m);
const FRAIS = Math.ceil((MENSUALITE * FRAIS_POURCENT) / 100);

// Même écran de connexion que le personnel ; le portail parent n'a pas de
// barre latérale, son bouton de sortie est « Deconnexion ».
async function connecterParent(page) {
  await page.goto("/");
  await page.getByPlaceholder("Ex. : citadelle").fill(ECOLE.code);
  await expect(page.getByText(ECOLE.nom).first()).toBeVisible();
  await page.getByPlaceholder("Votre identifiant ou e-mail").fill(PARENT.login);
  await page.getByPlaceholder("Votre mot de passe").fill(PARENT.mdp);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page.getByRole("button", { name: "Deconnexion", exact: true })).toBeVisible({ timeout: 30_000 });
}

// Du bouton « Payer en ligne » jusqu'à la page de l'opérateur (simulée).
async function lancerPaiement(page) {
  await page.getByRole("button", { name: "Mensualités", exact: true }).click();
  await page.getByRole("button", { name: "Payer en ligne", exact: true }).click();
  // Proposé comme à la caisse : une mensualité, frais de l'opérateur en plus.
  await expect(page.getByLabel("Montant")).toHaveValue(String(MENSUALITE));
  const payer = page.getByRole("button", { name: montant(MENSUALITE + FRAIS) });
  await expect(payer).toBeVisible();
  await payer.click();
  await expect(page.getByText("🧪 Page de paiement simulée")).toBeVisible({ timeout: 30_000 });
  return new URL(page.url()).searchParams.get("paiement-simule");
}

test.describe.configure({ mode: "serial" });

let eleve;
let journalAvant;

test.beforeAll(async () => {
  await preparerPaiementEnLigne();
  eleve = await lireEleve(ELEVES[1].matricule);
  expect(moisPayes(eleve.extra?.mens)).toEqual([]);
  journalAvant = (await lirePaiements(eleve.id)).length;
});

test("la direction active le paiement en ligne dans Paramètres (identifiants incohérents refusés)", async ({ page }) => {
  expect(await lirePaiementConfig()).toBeNull();
  await seConnecter(page, DIRECTION);
  await ouvrirModule(page, "Paramètres");
  await page.getByRole("button", { name: /Paiement en ligne/ }).click();

  // CinetPay en production avec une clé de TEST : refusé avant tout appel
  // à l'opérateur, rien n'est enregistré.
  const operateur = page.getByLabel("Opérateur", { exact: true });
  await operateur.selectOption("cinetpay");
  await page.getByLabel("Production (encaissements réels)").check();
  await page.getByLabel("Clé API").fill("sk_test_e2e_factice_0000");
  await page.getByLabel("Mot de passe API").fill("factice");
  await page.getByLabel("Activer le paiement en ligne pour les parents").check();
  const enregistrer = page.getByRole("button", { name: "💾 Enregistrer le paiement en ligne" });
  await enregistrer.click();
  await expect(page.getByText(/utilisez la clé sk_live_/)).toBeVisible();
  expect(await lirePaiementConfig()).toBeNull();

  // Fournisseur « simulation » (proposé seulement si PAIEMENT_SIMULATION
  // est posée sur la pile), frais à la charge du parent : activé.
  await operateur.selectOption("simulation");
  await page.getByLabel("Test (aucun argent réel)").check();
  await page.getByLabel(/Frais de l'opérateur/).fill(String(FRAIS_POURCENT));
  await enregistrer.click();
  await expect(page.getByText(/Paiement en ligne activé/)).toBeVisible();
  const config = await lirePaiementConfig();
  expect(config).toMatchObject({ fournisseur: "simulation", mode: "test", actif: true, identifiants: {} });
  expect(Number(config.frais_pourcent)).toBe(FRAIS_POURCENT);
});

test("le parent paie une mensualité en ligne : imputée sur la fiche et au journal, une seule fois", async ({ page }) => {
  await connecterParent(page);
  const reference = await lancerPaiement(page);
  expect(reference).toMatch(/^EDU[0-9A-Z]+$/);

  await page.getByRole("button", { name: "Confirmer le paiement", exact: true }).click();
  await expect(page.getByText("✅ Paiement reçu et enregistré.")).toBeVisible({ timeout: 30_000 });

  // Base : le paiement en ligne est imputé, frais à part.
  const [enLigne] = (await lirePaiementsEnLigne(eleve.id)).filter((p) => p.reference === reference);
  expect(enLigne.statut).toBe("impute");
  expect(Number(enLigne.montant)).toBe(MENSUALITE);
  expect(Number(enLigne.frais)).toBe(FRAIS);

  // Fiche : un mois « Payé » ; journal : UNE ligne de la scolarité seule
  // (jamais les frais), rattachée à la référence de l'opérateur.
  const apres = await lireEleve(ELEVES[1].matricule);
  const payes = moisPayes(apres.extra?.mens);
  expect(payes).toHaveLength(1);
  const journal = await lirePaiements(eleve.id);
  expect(journal).toHaveLength(journalAvant + 1);
  const ligne = journal.find((l) => l.extra?.reference === reference);
  expect(Number(ligne.montant)).toBe(MENSUALITE);
  expect(ligne.mois).toBe(payes[0]);
  expect(ligne.auteur).toBe("Paiement en ligne (Simulation)");
  expect(ligne.extra?.enLigne).toBe(true);

  // Confirmation rejouée (notification en double de l'opérateur, double
  // clic…) : rien n'est imputé deux fois.
  const rejoue = await appelerPaiement(PARENT, { action: "simuler", reference, resultat: "reussi" });
  expect(rejoue.status).toBe(200);
  expect(rejoue.data.paiement.statut).toBe("impute");
  expect(await lirePaiements(eleve.id)).toHaveLength(journalAvant + 1);
  expect(moisPayes((await lireEleve(ELEVES[1].matricule)).extra?.mens)).toEqual(payes);

  // Fermer rend le portail, adresse nettoyée (un rechargement ne rouvre pas la page de paiement).
  await page.getByRole("button", { name: "Fermer", exact: true }).click();
  await expect(page).not.toHaveURL(/paiement-simule/);
});

test("un paiement refusé par l'opérateur ne touche ni la fiche ni le journal", async ({ page }) => {
  const mensAvant = (await lireEleve(ELEVES[1].matricule)).extra?.mens;
  const journal = (await lirePaiements(eleve.id)).length;

  await connecterParent(page);
  const reference = await lancerPaiement(page);
  await page.getByRole("button", { name: "Refuser le paiement", exact: true }).click();
  await expect(page.getByText(/❌ Paiement non abouti/)).toBeVisible({ timeout: 30_000 });

  const [enLigne] = (await lirePaiementsEnLigne(eleve.id)).filter((p) => p.reference === reference);
  expect(enLigne.statut).toBe("echoue");
  expect(await lirePaiements(eleve.id)).toHaveLength(journal);
  expect((await lireEleve(ELEVES[1].matricule)).extra?.mens).toEqual(mensAvant);
});

test("le serveur refuse un montant au-delà du reste dû et l'élève d'une autre famille", async () => {
  const { data: { cibles } } = await appelerPaiement(PARENT, { action: "cibles", eleveId: eleve.id });
  const mois = cibles.find((c) => c.cle === "mois");
  const trop = await appelerPaiement(PARENT, { action: "initier", eleveId: eleve.id, cle: "mois", montant: mois.reste + 1 });
  expect(trop.status).toBe(400);
  expect(trop.data.error).toMatch(/Montant trop élevé/);

  // DIALLO n'est pas l'enfant de ce parent : la RLS le lui cache.
  const autre = await lireEleve(ELEVES[0].matricule);
  const intrus = await appelerPaiement(PARENT, { action: "initier", eleveId: autre.id, cle: "mois", montant: MENSUALITE });
  expect(intrus.status).toBe(403);
  expect(await lirePaiementsEnLigne(autre.id)).toHaveLength(0);
});

async function ouvrirEnLigne(page) {
  await seConnecter(page, COMPTABLE);
  await ouvrirModule(page, "Comptabilité");
  await page.getByRole("button", { name: "💳 En ligne", exact: true }).click();
}

test("confirmé chez l'opérateur mais notification perdue : rapproché à l'ouverture de l'onglet comptable", async ({ page }) => {
  const { data } = await appelerPaiement(PARENT, { action: "initier", eleveId: eleve.id, cle: "mois", montant: MENSUALITE });
  const { reference } = data;
  await confirmerChezOperateurSansNotification(reference);
  const payesAvant = moisPayes((await lireEleve(ELEVES[1].matricule)).extra?.mens).length;

  await ouvrirEnLigne(page);
  const ligne = page.getByRole("row").filter({ hasText: reference });
  await expect(ligne).toContainText("Encaissé");
  const [p] = (await lirePaiementsEnLigne(eleve.id)).filter((x) => x.reference === reference);
  expect(p.statut).toBe("impute");
  expect(moisPayes((await lireEleve(ELEVES[1].matricule)).extra?.mens)).toHaveLength(payesAvant + 1);
});

test("la caisse encaisse pendant que le parent paie : « à vérifier », rien d'imputé deux fois", async ({ page }) => {
  await connecterParent(page);
  const reference = await lancerPaiement(page);
  // Pendant ce temps, au guichet : tous les mois sont encaissés en espèces.
  await encaisserToutEnCaisse(ELEVES[1].matricule);
  const journal = (await lirePaiements(eleve.id)).length;

  await page.getByRole("button", { name: "Confirmer le paiement", exact: true }).click();
  await expect(page.getByText(/Paiement reçu, mais il n'a pas pu être enregistré automatiquement/)).toBeVisible({ timeout: 30_000 });
  const [p] = (await lirePaiementsEnLigne(eleve.id)).filter((x) => x.reference === reference);
  expect(p.statut).toBe("a_verifier");
  expect(await lirePaiements(eleve.id)).toHaveLength(journal);
});

test("le comptable retrouve les paiements et régularise celui « à vérifier »", async ({ page }) => {
  const enLigne = await lirePaiementsEnLigne(eleve.id);
  const [encaisse] = enLigne.filter((p) => p.statut === "impute");
  const [aVerifier] = enLigne.filter((p) => p.statut === "a_verifier");

  await ouvrirEnLigne(page);
  const ligne = page.getByRole("row").filter({ hasText: encaisse.reference });
  await expect(ligne).toHaveCount(1);
  await expect(ligne).toContainText(ELEVES[1].nom);
  await expect(ligne).toContainText("Encaissé");
  await expect(ligne).toContainText(montant(MENSUALITE));
  // Le paiement refusé figure aussi, sans rien encaisser.
  await expect(page.getByRole("row").filter({ hasText: "Non abouti" })).toHaveCount(1);

  // « À vérifier » : signalé, puis régularisé avec une note.
  await expect(page.getByText("1 paiement(s) à vérifier")).toBeVisible();
  const ligneAVerifier = page.getByRole("row").filter({ hasText: aVerifier.reference });
  await expect(ligneAVerifier).toContainText("déjà encaissé en caisse entre-temps");
  await ligneAVerifier.getByRole("button", { name: "Régulariser", exact: true }).click();
  await page.getByLabel("Qu'avez-vous fait de ce paiement ?").fill("Remboursé au parent en espèces");
  await page.getByRole("button", { name: "Marquer régularisé", exact: true }).click();
  await expect(ligneAVerifier).toContainText("Régularisé");
  await expect(ligneAVerifier).toContainText("Remboursé au parent en espèces");
  await expect(page.getByText(/paiement\(s\) à vérifier/)).toHaveCount(0);

  const [regularise] = (await lirePaiementsEnLigne(eleve.id)).filter((p) => p.reference === aVerifier.reference);
  expect(regularise.statut).toBe("regularise");
  expect(regularise.detail.regularisation.note).toBe("Remboursé au parent en espèces");
});
