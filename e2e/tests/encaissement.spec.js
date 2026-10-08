// Parcours qui coûte de l'argent s'il casse : un comptable encaisse une
// mensualité. On vérifie l'écran ET la base (fiche élève + journal de
// caisse), car une écriture refusée en silence par la RLS ne se voit pas à
// l'écran (cf. « RLS refusée = 0 ligne sans erreur »).
import { test, expect } from "@playwright/test";
import { COMPTABLE, ELEVES, MENSUALITE, lireEleve, lirePaiements } from "../donnees.js";
import { ouvrirModule, seConnecter } from "../parcours.js";

const montant = (n) => new RegExp(String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "[\\s\\u202f\\u00a0.]?"));

test("le comptable encaisse une mensualité : mois payé et ligne de caisse en base", async ({ page }) => {
  const eleve = ELEVES[0];
  const avant = await lireEleve(eleve.matricule);
  expect(await lirePaiements(avant.id)).toHaveLength(0);

  await seConnecter(page, COMPTABLE);
  await ouvrirModule(page, "Comptabilité");
  await page.getByRole("button", { name: "Mensualités", exact: true }).click();

  const ligne = page.getByRole("row").filter({ hasText: eleve.nom });
  await expect(ligne).toHaveCount(1);
  await ligne.getByTitle(/Encaisser un montant/).click();

  // Fenêtre d'encaissement : le montant proposé est une mensualité.
  await expect(page.getByText(`💰 Encaisser — `, { exact: false })).toBeVisible();
  const bouton = page.getByRole("button", { name: /^Encaisser / });
  await expect(bouton).toHaveText(montant(MENSUALITE));

  // L'app demande confirmation (boîte native) : le caissier lit le montant
  // et le nom de l'élève, puis valide.
  let confirmation = "";
  page.once("dialog", (dialogue) => { confirmation = dialogue.message(); dialogue.accept(); });
  await bouton.click();
  await expect.poll(() => confirmation).toMatch(montant(MENSUALITE));
  expect(confirmation).toContain(`${eleve.nom} ${eleve.prenom}`);
  await expect(page.getByText(/✅ Versement de .* enregistré le/)).toBeVisible();
  await page.getByRole("button", { name: "Fermer", exact: true }).click();

  // Écran : exactement un mois affiché « payé » sur la ligne de l'élève.
  await expect(ligne.getByTitle(/— payé /)).toHaveCount(1);

  // Base : un mois « Payé » sur la fiche, une ligne au journal de caisse.
  await expect.poll(async () => (await lirePaiements(avant.id)).length).toBe(1);
  const [paiement] = await lirePaiements(avant.id);
  expect(Number(paiement.montant)).toBe(MENSUALITE);
  const apres = await lireEleve(eleve.matricule);
  const payes = Object.entries(apres.extra?.mens || {}).filter(([, v]) => v === "Payé");
  expect(payes).toHaveLength(1);
  expect(payes[0][0]).toBe(paiement.mois);

  // L'autre élève n'a pas bougé.
  const autre = await lireEleve(ELEVES[1].matricule);
  expect(await lirePaiements(autre.id)).toHaveLength(0);
});
