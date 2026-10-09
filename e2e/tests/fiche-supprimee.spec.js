// Chantier 4 : une écriture sans effet ne passe plus pour un succès.
// Cas réel : la fiche d'un élève est supprimée sur un autre poste pendant que
// le caissier l'encaisse. Le serveur ne lève AUCUNE erreur (0 ligne modifiée)
// — avant le correctif, l'écran annonçait le versement enregistré alors que
// rien ne l'était. Désormais, un avertissement s'affiche.
//   • en ligne : refus immédiat, pas de « ✅ Versement » ;
//   • hors ligne : la saisie part de l'appareil au retour du réseau, est
//     refusée, et l'avertissement le dit.
import { test, expect } from "@playwright/test";
import { COMPTABLE, ELEVE_SUPPRIME, ecoleId, clientAdmin, supprimerEleve } from "../donnees.js";
import { ouvrirModule, seConnecter } from "../parcours.js";

const HORS_LIGNE = process.env.E2E_MODE === "hors-ligne";
const avertissement = /n'(a|ont) pas été enregistrée?s?/;

test("encaisser un élève supprimé entre-temps : l'utilisateur est averti, rien n'est encaissé", async ({ page, context }) => {
  await seConnecter(page, COMPTABLE);
  await ouvrirModule(page, "Comptabilité");
  await page.getByRole("button", { name: "Mensualités", exact: true }).click();
  const ligne = page.getByRole("row").filter({ hasText: ELEVE_SUPPRIME.nom });
  await expect(ligne).toHaveCount(1, { timeout: 30_000 });

  // Hors ligne : l'appareil ne verra pas la suppression avant de se reconnecter.
  if (HORS_LIGNE) await context.setOffline(true);
  await supprimerEleve(ELEVE_SUPPRIME.matricule);

  page.once("dialog", (d) => d.accept());
  await ligne.getByTitle(/Encaisser un montant/).click();
  await page.getByRole("button", { name: /^Encaisser / }).click();

  if (HORS_LIGNE) {
    // Saisie gardée sur l'appareil… puis refusée au retour du réseau.
    await context.setOffline(false);
    await expect(page.getByText(avertissement).first()).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText(/hors ligne, refusée/).first()).toBeVisible();
  } else {
    await expect(page.getByText(avertissement).first()).toBeVisible();
    await expect(page.getByText(/✅ Versement de .* enregistré/)).toHaveCount(0);
  }

  // Base : aucune ligne de caisse pour cet élève.
  const admin = clientAdmin();
  const { data } = await admin.from("paiements").select("id").eq("ecole_id", await ecoleId(admin))
    .ilike("eleve_nom", `%${ELEVE_SUPPRIME.nom}%`);
  expect(data).toHaveLength(0);
});
