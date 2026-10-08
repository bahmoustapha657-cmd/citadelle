// Gestes communs aux scénarios, par les libellés que voit l'utilisateur
// (pas de sélecteurs CSS : un test qui casse doit signaler un vrai
// changement d'écran, pas un renommage de classe).
import { expect } from "@playwright/test";
import { ECOLE } from "./donnees.js";

export async function seConnecter(page, { login, mdp }) {
  await page.goto("/");
  await page.getByPlaceholder("Ex. : citadelle").fill(ECOLE.code);
  // La fiche de l'école est cherchée 600 ms après la frappe : on attend que
  // son nom s'affiche, comme l'utilisateur le voit.
  await expect(page.getByText(ECOLE.nom).first()).toBeVisible();
  await page.getByPlaceholder("Votre identifiant ou e-mail").fill(login);
  await page.getByPlaceholder("Votre mot de passe").fill(mdp);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  // Connecté = le bouton de déconnexion de la barre latérale est là.
  await expect(page.getByRole("button", { name: /Se déconnecter/ })).toBeVisible({ timeout: 30_000 });
}

export async function ouvrirModule(page, libelle) {
  await page.getByRole("navigation").getByRole("button", { name: new RegExp(libelle) }).click();
}
