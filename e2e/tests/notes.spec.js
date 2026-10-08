// Saisie de notes dans la grille du collège. L'écran annonce « n note(s)
// enregistrée(s) » AVANT la confirmation du serveur (écritures non
// attendues, pour le hors-ligne) : seule la base dit si elles sont passées.
import { test, expect } from "@playwright/test";
import { CLASSE, DIRECTION, ELEVES, MATIERES, lireEleve, lireNotes } from "../donnees.js";
import { ouvrirModule, seConnecter } from "../parcours.js";

// Note saisie par (élève, matière) : distinctes pour détecter une inversion.
const SAISIES = [
  { eleve: ELEVES[0], matiere: MATIERES[0].nom, note: 14.5 },
  { eleve: ELEVES[0], matiere: MATIERES[1].nom, note: 12 },
  { eleve: ELEVES[1], matiere: MATIERES[0].nom, note: 9.75 },
  { eleve: ELEVES[1], matiere: MATIERES[1].nom, note: 16 },
];

test("la direction saisit des notes dans la grille : chacune en base, pour le bon élève et la bonne matière", async ({ page }) => {
  await seConnecter(page, DIRECTION);
  await ouvrirModule(page, "Secondaire");
  await page.getByRole("button", { name: /^Notes \(\d+\)$/ }).click();
  await page.getByRole("button", { name: "⊞", exact: true }).click();

  // Grille « Par période » (mode par défaut) de la classe : lignes = élèves,
  // colonnes = matières.
  await page.locator("select").filter({ has: page.locator("option", { hasText: /^Toutes$/ }) }).selectOption(CLASSE);
  const enTetes = page.getByRole("columnheader");
  for (const m of MATIERES) await expect(enTetes.filter({ hasText: m.nom })).toHaveCount(1);
  // Texte brut (les en-têtes sont mis en majuscules par le CSS).
  const colonnes = await enTetes.allTextContents();

  for (const s of SAISIES) {
    const ligne = page.getByRole("row").filter({ hasText: s.eleve.nom });
    const colonne = colonnes.findIndex((t) => t.includes(s.matiere));
    // La 1re colonne porte le nom de l'élève : les champs suivent l'ordre des matières.
    await ligne.getByRole("cell").nth(colonne).getByRole("spinbutton").fill(String(s.note));
  }
  await page.getByRole("button", { name: `💾 Enregistrer (${SAISIES.length} modif.)` }).click();
  await expect(page.getByText(`${SAISIES.length} note(s) enregistrée(s)`)).toBeVisible();

  // Base : exactement les notes saisies, rattachées au bon élève.
  for (const eleve of ELEVES) {
    const { id } = await lireEleve(eleve.matricule);
    const attendues = SAISIES.filter((s) => s.eleve === eleve)
      .map((s) => `${s.matiere}=${s.note}`).sort();
    await expect.poll(async () => (await lireNotes(id)).map((n) => `${n.matiere}=${Number(n.note)}`).sort())
      .toEqual(attendues);
    for (const n of await lireNotes(id)) {
      expect(n.section).toBe("college");
      expect(n.periode).toBeTruthy();
      expect(n.annee).toMatch(/^\d{4}-\d{4}$/);
    }
  }
});
