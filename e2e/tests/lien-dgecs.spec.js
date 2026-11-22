// Accès direct aux plateformes DGECS depuis EduGest : chaque chef de section
// a, dans son menu latéral, un groupe « 🇬🇳 Plateformes DGECS » de quatre
// liens (classes intermédiaires, inscription aux examens, surveillants
// d'examen, résultats), chacun dans un nouvel onglet. Le comptable, lui, a
// son lien dans la fenêtre « Depuis DGECS » : rien dans son menu.
import { test, expect } from "@playwright/test";
import { CHEF_PRIMAIRE, COMPTABLE, preparerChefPrimaire } from "../donnees.js";
import { seConnecter } from "../parcours.js";

test.beforeAll(async () => {
  await preparerChefPrimaire();
});

const PLATEFORMES = [
  ["Classes intermédiaires", "https://dgecsecoles.com/"],
  ["Inscription aux examens", "https://dgecs.com/"],
  ["Surveillants d'examen", "https://dgecscommissions.com/"],
  ["Résultats des examens", "https://dgecsresultats.com/"],
];

test("le chef de section a les liens directs vers les plateformes DGECS dans son menu, le comptable non", async ({ browser }) => {
  const chef = await browser.newPage();
  await seConnecter(chef, CHEF_PRIMAIRE);
  const groupe = chef.locator("aside").getByRole("group", { name: "Plateformes DGECS" });
  // Repliés sous une ligne au départ : un appui les déplie.
  const deplier = groupe.getByRole("button", { name: /Plateformes DGECS/ });
  await expect(deplier).toHaveAttribute("aria-expanded", "false");
  await deplier.click();
  await expect(groupe.getByRole("link")).toHaveCount(PLATEFORMES.length);
  for (const [nom, url] of PLATEFORMES) {
    const lien = groupe.getByRole("link", { name: nom });
    await expect(lien).toHaveAttribute("href", url);
    await expect(lien).toHaveAttribute("target", "_blank");
  }
  await chef.close();

  const comptable = await browser.newPage();
  await seConnecter(comptable, COMPTABLE);
  await expect(comptable.getByRole("group", { name: "Plateformes DGECS" })).toHaveCount(0);
  await comptable.close();
});
