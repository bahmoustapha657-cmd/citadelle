// Poste partagé (PowerSync) : une saisie pas encore envoyée ne disparaît plus
// quand un AUTRE compte se connecte sur l'appareil. Elle est mise de côté au
// nom de son auteur, jamais envoyée avec la session de l'autre compte, puis
// arrive en base quand son auteur se reconnecte ici.
//
// Note en Français pour CAMARA : hors-ligne.spec.js (qui passe avant) ne
// compte que ses notes de Mathématiques.
import { test, expect } from "@playwright/test";
import { CLASSE_HORS_LIGNE, COMPTABLE, DIRECTION, ELEVE_HORS_LIGNE, MATIERES, lireEleve, lireNotes } from "../donnees.js";
import { ouvrirModule, seConnecter } from "../parcours.js";

test.skip(process.env.E2E_MODE !== "hors-ligne", "PowerSync désactivé dans cette variante (mode en ligne)");

const MATIERE = MATIERES[1].nom;

// Écritures de notes vers le serveur (PostgREST), pas les lectures.
const ecritureNotes = (url) => url.pathname.endsWith("/rest/v1/notes");

// Saisies mises de côté sur l'appareil, tous comptes confondus.
const saisiesDeCote = (page) => page.evaluate(() => {
  const tout = JSON.parse(localStorage.getItem("LC_saisies_de_cote") || "{}");
  return Object.values(tout).flat();
});

// La déconnexion laisse d'abord partir la file (quelques secondes), puis
// révoque la session : attendre qu'elle soit finie avant de recharger.
async function seDeconnecter(page) {
  await page.getByRole("button", { name: /Se déconnecter/ }).click();
  await expect.poll(() => page.evaluate(() => Object.keys(localStorage).some((k) => /^sb-.*-auth-token$/.test(k))),
    { timeout: 20_000 }).toBe(false);
}

test("saisie non envoyée sur un poste partagé : mise de côté, puis envoyée par son auteur", async ({ page, context }) => {
  const { id } = await lireEleve(ELEVE_HORS_LIGNE.matricule);
  const notesMatiere = async () => (await lireNotes(id)).filter((n) => n.matiere === MATIERE);
  expect(await notesMatiere()).toHaveLength(0);

  await seConnecter(page, DIRECTION);
  await ouvrirModule(page, "Secondaire");
  await page.getByRole("button", { name: /^Notes \(\d+\)$/ }).click();
  await page.getByRole("button", { name: "⊞", exact: true }).click();
  await page.locator("select").filter({ has: page.locator("option", { hasText: /^Toutes$/ }) }).selectOption(CLASSE_HORS_LIGNE);
  const ligne = page.getByRole("row").filter({ hasText: ELEVE_HORS_LIGNE.nom });
  await expect(ligne).toHaveCount(1, { timeout: 30_000 });
  const colonnes = await page.getByRole("columnheader").allTextContents();
  const colonne = colonnes.findIndex((t) => t.includes(MATIERE));

  // ── Le serveur reste injoignable pour les notes : la saisie reste en file ──
  await context.route(ecritureNotes, (route) => (route.request().method() === "GET" ? route.continue() : route.abort()));
  await ligne.getByRole("cell").nth(colonne).getByRole("spinbutton").fill("14");
  await page.getByRole("button", { name: "💾 Enregistrer (1 modif.)" }).click();
  await expect(page.getByText(/1 note\(s\) enregistrée\(s\)/)).toBeVisible();
  await page.waitForTimeout(3_000);
  expect(await notesMatiere()).toHaveLength(0);

  // ── La direction s'en va, le comptable se connecte sur le même poste ──
  await seDeconnecter(page);
  await context.unroute(ecritureNotes);
  await seConnecter(page, COMPTABLE);

  // La saisie de la direction est gardée à part (avec, derrière elle, ce qui
  // attendait dans la même file : lignes du journal…)…
  const gardees = await saisiesDeCote(page);
  expect(gardees.filter((e) => e.table === "notes").map((e) => e.op)).toEqual(["PUT"]);
  // …et la session du comptable ne l'envoie jamais.
  await page.waitForTimeout(5_000);
  expect(await notesMatiere()).toHaveLength(0);

  // ── La direction revient sur ce poste : sa saisie part ──
  await seDeconnecter(page);
  await seConnecter(page, DIRECTION);
  await expect.poll(async () => (await notesMatiere()).map((n) => Number(n.note)), { timeout: 60_000 }).toEqual([14]);
  await expect.poll(() => saisiesDeCote(page), { timeout: 15_000 }).toEqual([]);

  // Une seule note : rien n'est reparti en double.
  await page.waitForTimeout(3_000);
  expect(await notesMatiere()).toHaveLength(1);
});
