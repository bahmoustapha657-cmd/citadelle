import { test, expect } from "@playwright/test";
import { COMPTABLE, DIRECTION, ECOLE } from "../donnees.js";
import { seConnecter } from "../parcours.js";

test("la direction se connecte et retrouve son école", async ({ page }) => {
  await seConnecter(page, DIRECTION);
  await expect(page.getByRole("complementary").getByText(ECOLE.nom)).toBeVisible();
});

test("un mauvais mot de passe est refusé avec un message", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("Ex. : citadelle").fill(ECOLE.code);
  await expect(page.getByText(ECOLE.nom).first()).toBeVisible();
  await page.getByPlaceholder("Votre identifiant ou e-mail").fill(COMPTABLE.login);
  await page.getByPlaceholder("Votre mot de passe").fill("mauvais-mot-de-passe");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("button", { name: /Se déconnecter/ })).toHaveCount(0);
});
