// Les chefs de section ne voient pas le salaire des enseignants. L'onglet
// Enseignants du module École affichait le forfait mensuel sur la carte de
// chaque enseignant du primaire, à quiconque ouvrait le module. Il est
// désormais réservé à qui lit la Comptabilité ; le chef de section voit la
// classe dont l'enseignant est titulaire.
//
// Et pas seulement à l'écran : la paie vit dans la table paie_enseignants,
// que la base ne livre qu'à la Comptabilité (RLS), y compris par l'API.
import { test, expect } from "@playwright/test";
import {
  CHEF_PRIMAIRE, COMPTABLE, DIRECTION, ENSEIGNANT_PRIMAIRE, ENSEIGNANT_PRIMAIRE_2, FORFAIT_2,
  clientAdmin, clientConnecte, lireFicheEnseignant, lirePaie, preparerChefPrimaire,
} from "../donnees.js";
import { ouvrirModule, seConnecter } from "../parcours.js";

const FORFAIT = /Forfait\s+1\s?500\s?000\s+GNF/;
const FORFAIT_TABLE = /Forfait\s+1\s?250\s?000\s+GNF/;

test.describe.configure({ mode: "serial" });

let ids;

test.beforeAll(async () => {
  ids = await preparerChefPrimaire();
});

async function ouvrirEnseignantsPrimaire(page) {
  await ouvrirModule(page, "Primaire");
  await page.getByRole("button", { name: /^Enseignants \(\d+\)$/ }).click();
  await expect(page.getByText(`${ENSEIGNANT_PRIMAIRE.prenom} ${ENSEIGNANT_PRIMAIRE.nom}`)).toBeVisible();
}

test("la paie saisie sur la fiche par la Comptabilité est rangée dans la table réservée", async () => {
  const paie = await lirePaie(ids.ens1);
  expect(paie?.extra).toEqual({ montantForfait: ENSEIGNANT_PRIMAIRE.montantForfait });
  expect(paie.ecole_id).toBe(ids.ecoleId);

  // Nouvelle saisie du comptable, comme l'écran Comptabilité → Enseignants.
  const comptable = await clientConnecte(COMPTABLE);
  const fiche = await lireFicheEnseignant(ENSEIGNANT_PRIMAIRE.nom);
  const { error } = await comptable.from("enseignants")
    .update({ extra: { ...fiche.extra, montantForfait: 1600000 } }).eq("id", ids.ens1);
  expect(error).toBeNull();
  expect((await lirePaie(ids.ens1)).extra.montantForfait).toBe(1600000);

  // Retour à la valeur de départ (le serveur range aussi ses propres écritures).
  await clientAdmin().from("enseignants").update({ extra: fiche.extra }).eq("id", ids.ens1);
  expect((await lirePaie(ids.ens1)).extra.montantForfait).toBe(ENSEIGNANT_PRIMAIRE.montantForfait);
});

test("API : le chef de section ne lit aucune paie, la Comptabilité si", async () => {
  const chef = await clientConnecte(CHEF_PRIMAIRE);
  const lu = await chef.from("paie_enseignants").select("*");
  expect(lu.error).toBeNull();
  expect(lu.data).toEqual([]);

  const comptable = await clientConnecte(COMPTABLE);
  const { data } = await comptable.from("paie_enseignants").select("id, extra").in("id", [ids.ens1, ids.ens2]);
  expect(Object.fromEntries(data.map((l) => [l.id, l.extra.montantForfait]))).toEqual({
    [ids.ens1]: ENSEIGNANT_PRIMAIRE.montantForfait, [ids.ens2]: FORFAIT_2,
  });
});

test("API : le chef de section ne peut pas fixer une paie, ni par la table ni par la fiche", async () => {
  const chef = await clientConnecte(CHEF_PRIMAIRE);
  const parTable = await chef.from("paie_enseignants")
    .upsert({ id: ids.ens2, ecole_id: ids.ecoleId, extra: { montantForfait: 1 } }, { onConflict: "id" });
  expect(parTable.error).not.toBeNull();
  const modif = await chef.from("paie_enseignants").update({ extra: { montantForfait: 1 } }).eq("id", ids.ens1).select("id");
  expect(modif.data ?? []).toEqual([]);

  // Il peut réenregistrer la fiche (c'est son module) : la paie qu'il y
  // glisserait n'atteint pas la table.
  const fiche = await lireFicheEnseignant(ENSEIGNANT_PRIMAIRE_2.nom);
  const { error } = await chef.from("enseignants")
    .update({ extra: { ...fiche.extra, montantForfait: 1 } }).eq("id", ids.ens2);
  expect(error).toBeNull();
  expect((await lirePaie(ids.ens2)).extra).toEqual({ montantForfait: FORFAIT_2 });
  await clientAdmin().from("enseignants").update({ extra: fiche.extra }).eq("id", ids.ens2);
  expect((await lirePaie(ids.ens2)).extra).toEqual({ montantForfait: FORFAIT_2 });
});

test("le chef de section primaire voit la classe du titulaire, jamais son forfait", async ({ page }) => {
  await seConnecter(page, CHEF_PRIMAIRE);
  await ouvrirEnseignantsPrimaire(page);
  await expect(page.getByText(`Titulaire · ${ENSEIGNANT_PRIMAIRE.classeTitle}`)).toBeVisible();
  await expect(page.getByText(`Titulaire · ${ENSEIGNANT_PRIMAIRE_2.classeTitle}`)).toBeVisible();
  await expect(page.getByText(/GNF/)).toHaveCount(0);
});

test("la Direction générale, qui lit la Comptabilité, garde le forfait — lu dans la table de paie", async ({ page }) => {
  await seConnecter(page, DIRECTION);
  await ouvrirEnseignantsPrimaire(page);
  await expect(page.getByText(FORFAIT)).toBeVisible();
  // Forfait absent de la fiche, présent dans la seule table : il s'affiche.
  await expect(page.getByText(FORFAIT_TABLE)).toBeVisible();
});
