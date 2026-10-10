// Une ligne de journal de caisse qui échoue n'est plus perdue (constat du
// 2026-10-09 : 923 encaissements payés sur la fiche sans aucune ligne au
// journal). Cas le plus sournois : la base REÇOIT la ligne mais la réponse
// se perd en route — l'écran croit à un échec. La ligne est gardée sur
// l'appareil, puis renvoyée au retour du réseau ; le renvoi retombe sur la
// même ligne (id fixé à la saisie) au lieu d'en créer une seconde.
import { test, expect } from "@playwright/test";
import { COMPTABLE, ELEVE_JOURNAL, MENSUALITE, lireEleve, lirePaiements } from "../donnees.js";
import { ouvrirModule, seConnecter } from "../parcours.js";

// Hors ligne, le journal s'écrit dans le miroir local : le réseau ne peut pas
// refuser la ligne au moment de l'encaissement.
test.skip(process.env.E2E_MODE === "hors-ligne", "journal écrit dans le miroir local dans cette variante");

const JOURNAL = "**/rest/v1/paiements*";
const enAttente = (page) => page.evaluate(() => Object.keys(localStorage)
  .filter((k) => k.startsWith("LC_journal_attente_"))
  .reduce((n, k) => n + JSON.parse(localStorage.getItem(k) || "[]").length, 0));

test("ligne de journal sans réponse : gardée sur l'appareil, puis inscrite une seule fois", async ({ page }) => {
  const eleve = await lireEleve(ELEVE_JOURNAL.matricule);
  expect(await lirePaiements(eleve.id)).toHaveLength(0);

  await seConnecter(page, COMPTABLE);
  await ouvrirModule(page, "Comptabilité");
  await page.getByRole("button", { name: "Mensualités", exact: true }).click();
  const ligne = page.getByRole("row").filter({ hasText: ELEVE_JOURNAL.nom });
  await expect(ligne).toHaveCount(1);

  // L'écriture du journal arrive en base, mais sa réponse se perd.
  await page.route(JOURNAL, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fetch();
    return route.abort("failed");
  });

  await ligne.getByTitle(/Encaisser un montant/).click();
  page.once("dialog", (dialogue) => dialogue.accept());
  await page.getByRole("button", { name: /^Encaisser / }).click();
  // Le paiement est acquis ; l'écran dit que sa ligne attend sur l'appareil.
  await expect(page.getByText(/sa ligne de journal de caisse n'a pas pu s'écrire : elle est gardée sur cet appareil/)).toBeVisible();
  await expect(page.getByText(/✅ Versement de .* enregistré le/)).toBeVisible();
  await page.getByRole("button", { name: "Fermer", exact: true }).click();

  const payes = Object.values((await lireEleve(ELEVE_JOURNAL.matricule)).extra?.mens || {}).filter((v) => v === "Payé");
  expect(payes).toHaveLength(1);
  await expect.poll(async () => (await lirePaiements(eleve.id)).length).toBe(1);
  expect(await enAttente(page)).toBe(1);

  // Retour du réseau : la ligne gardée repart et retombe sur celle déjà reçue.
  await page.unroute(JOURNAL);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByText(/1 encaissement\(s\) gardé\(s\) sur cet appareil inscrit\(s\) au journal de caisse/)).toBeVisible();
  await expect.poll(() => enAttente(page)).toBe(0);

  await page.waitForTimeout(2_000);
  const lignes = await lirePaiements(eleve.id);
  expect(lignes).toHaveLength(1);
  expect(Number(lignes[0].montant)).toBe(MENSUALITE);
  expect(lignes[0].statut).toBe("encaisse");
});
