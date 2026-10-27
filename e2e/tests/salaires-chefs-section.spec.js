// Les chefs de section ne voient pas le salaire des enseignants. L'onglet
// Enseignants du module École affichait le forfait mensuel sur la carte de
// chaque enseignant du primaire, à quiconque ouvrait le module. Il est
// désormais réservé à qui lit la Comptabilité ; le chef de section voit la
// classe dont l'enseignant est titulaire.
import { test, expect } from "@playwright/test";
import { CHEF_PRIMAIRE, DIRECTION, ENSEIGNANT_PRIMAIRE, preparerChefPrimaire } from "../donnees.js";
import { ouvrirModule, seConnecter } from "../parcours.js";

const FORFAIT = /Forfait\s+1\s?500\s?000\s+GNF/;

test.beforeAll(async () => {
  await preparerChefPrimaire();
});

async function ouvrirEnseignantsPrimaire(page) {
  await ouvrirModule(page, "Primaire");
  await page.getByRole("button", { name: /^Enseignants \(\d+\)$/ }).click();
  await expect(page.getByText(`${ENSEIGNANT_PRIMAIRE.prenom} ${ENSEIGNANT_PRIMAIRE.nom}`)).toBeVisible();
}

test("le chef de section primaire voit la classe du titulaire, jamais son forfait", async ({ page }) => {
  await seConnecter(page, CHEF_PRIMAIRE);
  await ouvrirEnseignantsPrimaire(page);
  await expect(page.getByText(`Titulaire · ${ENSEIGNANT_PRIMAIRE.classeTitle}`)).toBeVisible();
  await expect(page.getByText(FORFAIT)).toHaveCount(0);
  await expect(page.getByText(/GNF/)).toHaveCount(0);
});

test("la Direction générale, qui lit la Comptabilité, garde le forfait sur la carte", async ({ page }) => {
  await seConnecter(page, DIRECTION);
  await ouvrirEnseignantsPrimaire(page);
  await expect(page.getByText(FORFAIT)).toBeVisible();
});
