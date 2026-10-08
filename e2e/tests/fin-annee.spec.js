// Fin d'année : la clôture archive la scolarité de chaque élève (dont
// l'argent encaissé) puis remet les compteurs à zéro ; l'annulation rend
// tout. Passe après encaissement.spec.js : DIALLO a un mois payé.
// Se termine en ANNULANT la clôture, pour laisser l'école telle quelle aux
// scénarios suivants.
import { test, expect } from "@playwright/test";
import {
  ANNEE, ANNEE_SUIVANTE, CLASSE, DIRECTION, ELEVES, lireEcole, lireEleve, lirePaiements,
} from "../donnees.js";
import { ouvrirModule, seConnecter } from "../parcours.js";

const moisPayes = (mens = {}) => Object.entries(mens).filter(([, v]) => v === "Payé").map(([m]) => m);

test("clôture : l'argent encaissé est archivé puis rendu à l'annulation ; la simulation de promotion ne modifie rien", async ({ page }) => {
  const eleve = ELEVES[0];
  const avant = await lireEleve(eleve.matricule);
  const payesAvant = moisPayes(avant.extra?.mens);
  expect(payesAvant).toHaveLength(1); // le mois encaissé par encaissement.spec.js
  const journalAvant = (await lirePaiements(avant.id)).length;

  // Chaque étape de fin d'année demande confirmation : on lit, on valide.
  const confirmations = [];
  page.on("dialog", (d) => { confirmations.push(d.message()); d.accept(); });

  await seConnecter(page, DIRECTION);
  await ouvrirModule(page, "Comptes & Postes");
  await expect(page.getByText(`Année active : ${ANNEE}`)).toBeVisible();

  // ── Clôture ──
  await page.getByRole("button", { name: `▶ Clôturer ${ANNEE}` }).click();
  await expect(page.getByText(`✅ Année ${ANNEE} clôturée — année active : ${ANNEE_SUIVANTE}`)).toBeVisible({ timeout: 30_000 });
  expect(confirmations.at(-1)).toContain(`Clôturer l'année ${ANNEE} et passer en ${ANNEE_SUIVANTE}`);
  // Toutes les fiches archivées — jamais « 0 sur 0 » (lecture d'un miroir
  // local pas encore synchronisé, bug corrigé le 2026-10-08).
  const bilan = await page.getByText(/fiche\(s\) archivée\(s\) sur/).first().innerText();
  const [, archivees, total] = bilan.match(/(\d+) fiche\(s\) archivée\(s\) sur (\d+)/);
  expect(Number(total)).toBeGreaterThan(0);
  expect(archivees).toBe(total);

  await expect.poll(async () => (await lireEcole()).extra?.anneeScolaire, { timeout: 30_000 }).toBe(ANNEE_SUIVANTE);
  await expect.poll(async () => moisPayes((await lireEleve(eleve.matricule)).extra?.mens), { timeout: 30_000 }).toEqual([]);
  const cloture = await lireEleve(eleve.matricule);
  // Archive de l'année : le mois payé y est, avec la classe de l'année.
  expect(moisPayes(cloture.extra?.historique?.[ANNEE]?.mens)).toEqual(payesAvant);
  expect(cloture.extra?.historique?.[ANNEE]?.classe).toBe(CLASSE);
  // Le journal de caisse n'est jamais touché par la clôture.
  expect(await lirePaiements(avant.id)).toHaveLength(journalAvant);

  // ── Promotion : simulation seulement ──
  await page.getByRole("button", { name: "🎓 Lancer la promotion" }).click();
  await page.getByRole("button", { name: "🔍 Simuler (aucune modification)" }).click();
  await expect(page.getByText(/Simulation — aucune modification n'a été appliquée/)).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(2_000);
  for (const e of ELEVES) {
    const fiche = await lireEleve(e.matricule);
    expect(fiche.extra?.historique?.[ANNEE]?.classe).toBe(CLASSE);
  }
  const { extra: ecoleApresSimulation } = await lireEcole();
  expect(ecoleApresSimulation?.promotions?.[ANNEE]).toBeUndefined();

  // ── Annulation de la clôture : tout revient ──
  await page.getByRole("button", { name: "↩️ Annuler la clôture" }).click();
  await expect(page.getByText(/Clôture annulée — \d+ fiche\(s\) restaurée\(s\)/).first()).toBeVisible({ timeout: 30_000 });
  expect(confirmations.at(-1)).toContain(`Restaurer l'année ${ANNEE}`);

  await expect.poll(async () => (await lireEcole()).extra?.anneeScolaire, { timeout: 30_000 }).toBe(ANNEE);
  await expect.poll(async () => moisPayes((await lireEleve(eleve.matricule)).extra?.mens), { timeout: 30_000 }).toEqual(payesAvant);
  const restaure = await lireEleve(eleve.matricule);
  expect(restaure.extra?.historique?.[ANNEE]).toBeUndefined();
  expect(await lirePaiements(avant.id)).toHaveLength(journalAvant);
});
