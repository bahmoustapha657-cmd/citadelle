// Accès direct à la plateforme DGECS depuis EduGest : chaque chef de section
// a, dans son menu latéral, un lien « 🇬🇳 Plateforme DGECS » qui ouvre
// dgecsecoles.com dans un nouvel onglet (il s'y connecte avec le compte DGECS
// de sa section). Le comptable, lui, a son lien dans la fenêtre « Depuis
// DGECS » : rien dans son menu.
import { test, expect } from "@playwright/test";
import { CHEF_PRIMAIRE, COMPTABLE, preparerChefPrimaire } from "../donnees.js";
import { seConnecter } from "../parcours.js";

test.beforeAll(async () => {
  await preparerChefPrimaire();
});

test("le chef de section a le lien direct vers DGECS dans son menu, le comptable non", async ({ browser }) => {
  const chef = await browser.newPage();
  await seConnecter(chef, CHEF_PRIMAIRE);
  const lien = chef.getByRole("link", { name: /Plateforme DGECS/ });
  await expect(lien).toHaveAttribute("href", "https://dgecsecoles.com/");
  await expect(lien).toHaveAttribute("target", "_blank");
  await chef.close();

  const comptable = await browser.newPage();
  await seConnecter(comptable, COMPTABLE);
  await expect(comptable.getByRole("link", { name: /Plateforme DGECS/ })).toHaveCount(0);
  await comptable.close();
});
