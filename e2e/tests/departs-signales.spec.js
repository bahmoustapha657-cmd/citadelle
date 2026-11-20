// Départs signalés : un élève part (transfert accordé par le directeur,
// abandon…) sans que la comptabilité le sache — il continuait de devoir ses
// mensualités. Le chef de section le signale depuis son module (onglet
// « 📤 Départs ») ; la comptable le voit en entrant dans la Comptabilité,
// confirme (la fiche devient un départ) ou refuse en disant pourquoi ; le
// chef de section lit le refus. On vérifie l'écran ET la base.
//
// Noms, classe et matricules tirés au hasard à chaque passage : le spec se
// relance sur la même base sans retrouver les élèves d'un passage précédent.
import { test, expect } from "@playwright/test";
import { toRow } from "../../src/backend/collection-map.js";
import { CHEF_PRIMAIRE, COMPTABLE, DIRECTION, clientAdmin, clientConnecte, ecoleId, preparerChefPrimaire } from "../donnees.js";
import { ouvrirModule, seConnecter } from "../parcours.js";

const SUFFIXE = String(Date.now()).slice(-5);
// Chiffres → lettres : un nom propre sans chiffres, différent à chaque passage.
const LETTRES = SUFFIXE.replace(/\d/g, (d) => "ABCDEFGHIJ"[d]);
const MOT = LETTRES[0] + LETTRES.slice(1).toLowerCase();
const CLASSE = `CM1 D${SUFFIXE}`;
const PART = { nom: "SYLLA", prenom: `Aissatou ${MOT}`, sexe: "F", matricule: `E2E-P${SUFFIXE}` };
const RESTE = { nom: "CONDE", prenom: `Ibrahima ${MOT}`, sexe: "M", matricule: `E2E-R${SUFFIXE}` };
const DATE = "2025-11-12";
const ECOLE_ACCUEIL = "GS Les Pionniers";
const RAISON = "Il a payé toute l'année";

test.describe.configure({ mode: "serial" });

const fiche = async (matricule) => {
  const { data, error } = await clientAdmin().from("eleves").select("statut, extra")
    .eq("ecole_id", await ecoleId()).eq("matricule", matricule).single();
  if (error) throw error;
  return data;
};

test.beforeAll(async () => {
  await preparerChefPrimaire();
  // La classe et deux élèves du primaire, écrits par la direction (RLS)
  // sous la forme exacte que l'app produit. Inscription payée : un élève sans
  // aucun paiement est un non réinscrit, retiré des listes des chefs de
  // section passé le 1er novembre (ecartes-non-reinscrits.js).
  const direction = await clientConnecte(DIRECTION);
  const id = await ecoleId();
  const ligne = (table, item) => ({ ...toRow(table, item).row, ecole_id: id, section: "primaire" });
  for (const [table, lignes] of [
    ["classes", [ligne("classes", { nom: CLASSE })]],
    ["eleves", [PART, RESTE].map((e) => ligne("eleves", { ...e, classe: CLASSE, statut: "Actif", inscriptionPayee: true }))],
  ]) {
    const { error } = await direction.from(table).insert(lignes);
    if (error) throw new Error(`${table} : ${error.message}`);
  }
});

test("le chef de section signale deux départs à la comptabilité", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await seConnecter(page, CHEF_PRIMAIRE);
  await ouvrirModule(page, "Primaire");
  await page.getByRole("button", { name: "📤 Départs", exact: true }).click();

  // Un transfert, avec l'école d'accueil.
  await page.getByRole("combobox", { name: "Classe", exact: true }).selectOption(CLASSE);
  await page.getByRole("combobox", { name: "Élève qui part" }).selectOption({ label: `${PART.nom} ${PART.prenom}` });
  await page.getByLabel("Date de départ").fill(DATE);
  await page.getByLabel("École de destination").fill(ECOLE_ACCUEIL);
  await page.getByLabel("Motif du départ").fill("Transfert accordé par le directeur");
  await page.getByRole("button", { name: /Signaler à la comptabilité/ }).click();
  await expect(page.getByText(`Départ de ${PART.nom} ${PART.prenom} signalé à la comptabilité.`)).toBeVisible();
  await expect(page.getByTestId("depart-en-attente").filter({ hasText: PART.prenom })).toContainText(ECOLE_ACCUEIL);

  // Un abandon : la classe reste choisie, l'élève déjà signalé n'est plus proposé.
  const eleves = page.getByRole("combobox", { name: "Élève qui part" });
  await expect(eleves.getByRole("option", { name: `${PART.nom} ${PART.prenom}` })).toHaveCount(0);
  await eleves.selectOption({ label: `${RESTE.nom} ${RESTE.prenom}` });
  await page.getByRole("combobox", { name: "Type de départ" }).selectOption("Abandonné");
  await expect(page.getByLabel("École de destination")).toHaveCount(0);
  await page.getByLabel("Date de départ").fill(DATE);
  await page.getByRole("button", { name: /Signaler à la comptabilité/ }).click();
  await expect(page.getByText(`Départ de ${RESTE.nom} ${RESTE.prenom} signalé à la comptabilité.`)).toBeVisible();
  await expect(page.getByTestId("depart-en-attente").filter({ hasText: MOT })).toHaveCount(2);

  // Base : signalés, en attente, toujours inscrits.
  for (const [eleve, statut] of [[PART, "Transféré"], [RESTE, "Abandonné"]]) {
    await expect.poll(async () => (await fiche(eleve.matricule)).extra?.departSignale?.etat, { timeout: 30_000 }).toBe("attente");
    const f = await fiche(eleve.matricule);
    expect(f.statut).toBe("Actif");
    expect(f.extra.departSignale).toMatchObject({ statut, dateDepart: DATE, signalePar: CHEF_PRIMAIRE.nom, signaleParRole: "primaire" });
  }
});

test("la comptable confirme l'un, refuse l'autre en disant pourquoi", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await seConnecter(page, COMPTABLE);
  await ouvrirModule(page, "Comptabilité");

  // Prévenue dès l'entrée dans la Comptabilité.
  const alerte = page.getByTestId("alerte-departs-signales");
  await expect(alerte).toContainText(/départ\(s\) d'élève signalé\(s\) à confirmer/);
  await expect(alerte).toContainText("Primaire");
  await alerte.getByRole("button", { name: "Voir les départs signalés" }).click();

  const part = page.getByTestId("depart-signale").filter({ hasText: PART.prenom });
  const reste = page.getByTestId("depart-signale").filter({ hasText: RESTE.prenom });
  await expect(part).toContainText(`Transféré le 12/11/2025 · vers ${ECOLE_ACCUEIL}`);
  await expect(part).toContainText(`Signalé par ${CHEF_PRIMAIRE.nom}`);
  await expect(reste).toContainText("Abandonné le 12/11/2025");

  await part.getByRole("button", { name: /Confirmer le départ/ }).click();
  await expect(page.getByText(`Départ de ${PART.nom} ${PART.prenom} confirmé.`)).toBeVisible();
  await expect(part).toHaveCount(0);

  await reste.getByRole("button", { name: "Refuser", exact: true }).click();
  await page.getByLabel("Raison du refus (l'auteur du signalement la lira)").fill(RAISON);
  await reste.getByRole("button", { name: "Refuser le signalement" }).click();
  await expect(page.getByText(`Signalement refusé pour ${RESTE.nom} ${RESTE.prenom}.`)).toBeVisible();
  await expect(reste).toHaveCount(0);

  // Base : le premier est parti (date, école d'accueil, plus de signalement) ;
  // le second reste inscrit, son signalement porte le refus. Hors ligne, la
  // colonne statut et les champs d'extra remontent séparément : on attend
  // les deux.
  await expect.poll(async () => {
    const f = await fiche(PART.matricule);
    return [f.statut, f.extra?.dateDepart, f.extra?.departSignale ?? null];
  }, { timeout: 30_000 }).toEqual(["Transféré", DATE, null]);
  const parti = await fiche(PART.matricule);
  expect(parti.extra).toMatchObject({ dateDepart: DATE, destinationDepart: ECOLE_ACCUEIL, motifDepart: "Transfert accordé par le directeur" });
  await expect.poll(async () => (await fiche(RESTE.matricule)).extra?.departSignale?.etat, { timeout: 30_000 }).toBe("refuse");
  const reste2 = await fiche(RESTE.matricule);
  expect(reste2.statut).toBe("Actif");
  expect(reste2.extra.departSignale).toMatchObject({ motifRefus: RAISON, refusePar: COMPTABLE.nom });
});

test("le chef de section lit le refus et le retire ; l'élève parti n'est plus proposé", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await seConnecter(page, CHEF_PRIMAIRE);
  await ouvrirModule(page, "Primaire");
  await page.getByRole("button", { name: "📤 Départs", exact: true }).click();

  await expect(page.getByTestId("depart-en-attente").filter({ hasText: MOT })).toHaveCount(0);
  const refus = page.getByTestId("depart-refuse").filter({ hasText: RESTE.prenom });
  await expect(refus).toContainText(`Refusé par ${COMPTABLE.nom}`);
  await expect(refus).toContainText(RAISON);
  await page.getByRole("combobox", { name: "Classe", exact: true }).selectOption(CLASSE);
  const eleves = page.getByRole("combobox", { name: "Élève qui part" });
  await expect(eleves.getByRole("option", { name: `${PART.nom} ${PART.prenom}` })).toHaveCount(0);
  await expect(eleves.getByRole("option", { name: `${RESTE.nom} ${RESTE.prenom}` })).toHaveCount(1);

  await refus.getByRole("button", { name: "Lu, retirer" }).click();
  await expect(refus).toHaveCount(0);
  await expect.poll(async () => (await fiche(RESTE.matricule)).extra?.departSignale ?? null, { timeout: 30_000 }).toBeNull();
});
