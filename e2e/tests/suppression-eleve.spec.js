// Supprimer une fiche élève effaçait aussi, par cascade, toutes ses lignes du
// journal de caisse : l'argent encaissé disparaissait des bilans. Une fiche
// qui porte de l'argent ne se supprime donc plus — l'écran propose de
// déclarer le départ, et la base refuse elle aussi (garde SQL + clé étrangère
// sans cascade). Une fiche sans argent, créée par erreur, se supprime encore.
import { test, expect } from "@playwright/test";
import {
  COMPTABLE, DIRECTION, ECOLE, ELEVE_ENCAISSE, ELEVE_SANS_ENCAISSEMENT, INSCRIPTION,
  clientAdmin, clientConnecte, ecoleId, lireEleve, lirePaiements,
} from "../donnees.js";
import { ouvrirModule, seConnecter } from "../parcours.js";

const nomComplet = (e) => `${e.nom} ${e.prenom}`;

// « Modifier / Suppr. » n'apparaissent au comptable que verrou de correction
// ouvert (Administration → Verrous), comme en production. La direction
// l'ouvre par le même chemin que l'écran, puis le referme : les autres
// scénarios gardent un comptable sans droit de correction.
async function verrouComptable(ouvert) {
  const direction = await clientConnecte(DIRECTION);
  const { data, error } = await direction.rpc("fusionner_extra_ecole", {
    p_code: ECOLE.code, p_champs: { verrous: { comptable: ouvert } },
  });
  if (error || !data) throw new Error(`Verrou comptable : ${error?.message || "rien modifié"}`);
}
test.beforeAll(() => verrouComptable(true));
test.afterAll(() => verrouComptable(false));

async function ficheExiste(matricule) {
  const admin = clientAdmin();
  const { count, error } = await admin.from("eleves").select("id", { count: "exact", head: true })
    .eq("ecole_id", await ecoleId(admin)).eq("matricule", matricule);
  if (error) throw error;
  return count > 0;
}

test("fiche avec encaissement : suppression refusée à l'écran et en base, départ proposé ; fiche sans argent : supprimée", async ({ page }) => {
  const encaisse = await lireEleve(ELEVE_ENCAISSE.matricule);
  const [ligneCaisse] = await lirePaiements(encaisse.id);
  expect(Number(ligneCaisse?.montant)).toBe(INSCRIPTION);

  await seConnecter(page, COMPTABLE);
  await ouvrirModule(page, "Comptabilité");
  await page.getByRole("button", { name: /^Élèves \(\d+\)$/ }).click();

  // ── 1. Écran : « Suppr. » refuse et propose le départ ──
  const ligne = page.getByRole("row").filter({ hasText: nomComplet(ELEVE_ENCAISSE) });
  await expect(ligne).toHaveCount(1, { timeout: 30_000 });

  let question = "";
  page.once("dialog", (d) => { question = d.message(); d.dismiss(); });
  await ligne.getByRole("button", { name: "Suppr.", exact: true }).click();
  await expect.poll(() => question).toContain(`${nomComplet(ELEVE_ENCAISSE)} a des encaissements`);
  expect(question).toContain("Déclarer son départ maintenant ?");
  await expect(page.getByText("Modifier l'élève")).toHaveCount(0); // « Annuler » : rien n'est ouvert

  // Accepter ouvre la fiche, prête pour un départ (statut « Transféré »).
  page.once("dialog", (d) => d.accept());
  await ligne.getByRole("button", { name: "Suppr.", exact: true }).click();
  await expect(page.getByText("Modifier l'élève")).toBeVisible();
  await expect(page.getByText("École de destination")).toBeVisible();
  await page.getByRole("button", { name: "Annuler", exact: true }).click();

  // ── 2. Base : même un appel direct est refusé, journal intact ──
  const comptable = await clientConnecte(COMPTABLE);
  const refus = await comptable.from("eleves").delete().eq("id", encaisse.id);
  expect(refus.error?.hint).toBe("eleve_avec_encaissements");
  // service_role (scripts, SQL) : le journal protège encore sa fiche.
  const refusAdmin = await clientAdmin().from("eleves").delete().eq("id", encaisse.id);
  expect(refusAdmin.error?.hint).toBe("eleve_avec_encaissements");
  expect(await ficheExiste(ELEVE_ENCAISSE.matricule)).toBe(true);
  expect((await lirePaiements(encaisse.id)).map((p) => p.id)).toEqual([ligneCaisse.id]);

  // ── 3. Fiche sans argent : confirmation qui annonce les conséquences, puis suppression ──
  const ligneLibre = page.getByRole("row").filter({ hasText: nomComplet(ELEVE_SANS_ENCAISSEMENT) });
  await expect(ligneLibre).toHaveCount(1);
  let confirmation = "";
  page.once("dialog", (d) => { confirmation = d.message(); d.accept(); });
  await ligneLibre.getByRole("button", { name: "Suppr.", exact: true }).click();
  await expect.poll(() => confirmation).toContain(`Supprimer définitivement la fiche de ${nomComplet(ELEVE_SANS_ENCAISSEMENT)}`);
  expect(confirmation).toContain("notes, absences et appréciations");
  await expect(ligneLibre).toHaveCount(0);
  // Hors ligne, la suppression part de l'appareil : on attend la base.
  await expect.poll(() => ficheExiste(ELEVE_SANS_ENCAISSEMENT.matricule), { timeout: 45_000 }).toBe(false);

  // La fiche avec encaissement n'a pas bougé.
  expect(await ficheExiste(ELEVE_ENCAISSE.matricule)).toBe(true);
  await expect(ligne).toHaveCount(1);
});
