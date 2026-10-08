// Mode hors ligne (PowerSync), le cas pour lequel il existe : une saisie
// faite SANS réseau est gardée sur l'appareil, puis arrive en base au retour
// du réseau — sans rien perdre ni rien dupliquer.
import { test, expect } from "@playwright/test";
import { CLASSE_HORS_LIGNE, DIRECTION, ELEVE_HORS_LIGNE, MATIERES, lireEleve, lireNotes } from "../donnees.js";
import { ouvrirModule, seConnecter } from "../parcours.js";

test.skip(process.env.E2E_MODE !== "hors-ligne", "PowerSync désactivé dans cette variante (mode en ligne)");

test("une note saisie sans réseau est gardée, puis arrive en base au retour du réseau", async ({ page, context }) => {
  const { id } = await lireEleve(ELEVE_HORS_LIGNE.matricule);
  expect(await lireNotes(id)).toHaveLength(0);

  await seConnecter(page, DIRECTION);
  await ouvrirModule(page, "Secondaire");
  await page.getByRole("button", { name: /^Notes \(\d+\)$/ }).click();
  await page.getByRole("button", { name: "⊞", exact: true }).click();
  await page.locator("select").filter({ has: page.locator("option", { hasText: /^Toutes$/ }) }).selectOption(CLASSE_HORS_LIGNE);

  // L'élève vient du miroir local (synchro initiale terminée).
  const ligne = page.getByRole("row").filter({ hasText: ELEVE_HORS_LIGNE.nom });
  await expect(ligne).toHaveCount(1, { timeout: 30_000 });
  const colonnes = await page.getByRole("columnheader").allTextContents();
  const colonne = colonnes.findIndex((t) => t.includes(MATIERES[0].nom));

  // ── Coupure réseau ──
  await context.setOffline(true);
  await ligne.getByRole("cell").nth(colonne).getByRole("spinbutton").fill("17.5");
  await page.getByRole("button", { name: "💾 Enregistrer (1 modif.)" }).click();
  await expect(page.getByText(/1 note\(s\) enregistrée\(s\) \(hors ligne/)).toBeVisible();
  // L'écran garde la note (miroir local)…
  await expect(ligne.getByRole("cell").nth(colonne).getByRole("spinbutton")).toHaveValue("17.5");
  // …mais rien n'a encore pu partir vers le serveur.
  await page.waitForTimeout(3_000);
  expect(await lireNotes(id)).toHaveLength(0);

  // ── Retour du réseau : la file d'envoi se vide ──
  await context.setOffline(false);
  await expect.poll(async () => (await lireNotes(id)).map((n) => `${n.matiere}=${Number(n.note)}`),
    { timeout: 60_000 }).toEqual([`${MATIERES[0].nom}=17.5`]);

  // Une seule note : pas de doublon au renvoi.
  await page.waitForTimeout(3_000);
  expect(await lireNotes(id)).toHaveLength(1);
});
