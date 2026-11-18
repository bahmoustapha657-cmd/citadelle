// Enseignant dans PLUSIEURS établissements (étape 2) : il ajoute lui-même un
// établissement où il enseigne aussi, voit toutes ses classes ensemble
// (« Toutes mes classes ») et passe de l'un à l'autre sans mot de passe.
// Chaque établissement reste un espace à part (ses élèves, ses notes). Le
// serveur réserve l'ajout et ce passage aux espaces enseignants.
import { test, expect } from "@playwright/test";
import { toRow } from "../../src/backend/collection-map.js";
import { DIRECTION, appelerAccountManage, appelerInscription, clientAdmin, clientConnecte, ecoleId } from "../donnees.js";

const ENSEIGNANT = {
  nom: "Ibrahima DIALLO",
  telephone: "622 00 03 33",
  code: "622000333",
  email: "ibrahima.e2e@example.com",
  etablissement: "Collège E2E Les Manguiers",
  ville: "Conakry",
  mdp: "E2e-Ibrahima-2026",
};
const COMPTE = { login: ENSEIGNANT.code, mdp: ENSEIGNANT.mdp, code: ENSEIGNANT.code };
const CLASSE = "9ème A";
// Son deuxième établissement : code = son numéro suivi du rang.
const AUTRE = { etablissement: "Lycée E2E Kaloum", ville: "Conakry", code: `${ENSEIGNANT.code}-2` };

test.describe.configure({ mode: "serial" });

const lireEcole = async (code) => {
  const { data, error } = await clientAdmin().from("ecoles")
    .select("id, nom, plan, type_espace, extra").eq("code", code).maybeSingle();
  if (error) throw error;
  return data;
};
const comptesDe = async (idEcole) => {
  const { data, error } = await clientAdmin().from("comptes")
    .select("id, login, role, label, personne_id, premiere_co").eq("ecole_id", idEcole);
  if (error) throw error;
  return data;
};

test("préparation : son premier espace, avec une classe", async () => {
  if (!(await lireEcole(ENSEIGNANT.code))) {
    const r = await appelerInscription({
      typeEspace: "enseignant", nomEnseignant: ENSEIGNANT.nom, telephone: ENSEIGNANT.telephone,
      email: ENSEIGNANT.email, etablissement: ENSEIGNANT.etablissement, ville: ENSEIGNANT.ville,
      sections: ["college"], mdp: ENSEIGNANT.mdp,
    });
    expect(r.status).toBe(200);
  }
  const enseignant = await clientConnecte(COMPTE);
  const { id: ecole_id } = await lireEcole(ENSEIGNANT.code);
  const { data: dejaLa } = await enseignant.from("classes").select("id").eq("nom", CLASSE);
  if (!dejaLa?.length) {
    const { error } = await enseignant.from("classes")
      .insert({ ...toRow("classes", { nom: CLASSE }).row, ecole_id, section: "college" });
    if (error) throw new Error(`classes : ${error.message}`);
  }
});

test("le serveur réserve l'ajout d'établissement et le passage d'une école à l'autre aux enseignants", async () => {
  // Une école ne crée pas d'espaces enseignants.
  const ecole = await appelerAccountManage(DIRECTION, {
    action: "ajouter_etablissement", etablissement: "Annexe", ville: "Kindia", sections: ["college"],
  });
  expect(ecole.status).toBe(403);
  expect(ecole.data.error).toMatch(/espace d'un enseignant/);

  // Formulaire incomplet : refusé, rien de créé.
  const incomplet = await appelerAccountManage(COMPTE, { action: "ajouter_etablissement", etablissement: "X", ville: "Y" });
  expect(incomplet.status).toBe(400);
  expect(incomplet.data.error).toMatch(/niveau/);
  expect(await lireEcole(AUTRE.code)).toBeNull();

  // Ni l'école vers l'enseignant, ni l'enseignant vers l'école.
  const { id: idEspace } = await lireEcole(ENSEIGNANT.code);
  const [compteEnseignant] = await comptesDe(idEspace);
  const { data: direction } = await clientAdmin().from("comptes").select("id")
    .eq("ecole_id", await ecoleId()).eq("login", DIRECTION.login).single();
  expect((await appelerAccountManage(DIRECTION, { action: "changer_espace", compteId: compteEnseignant.id })).status).toBe(403);
  expect((await appelerAccountManage(COMPTE, { action: "changer_espace", compteId: direction.id })).status).toBe(403);

  // « Toutes mes classes » : rien pour un compte d'école, ses classes pour l'enseignant.
  const { data: vuesEcole, error: eEcole } = await (await clientConnecte(DIRECTION)).rpc("mes_classes");
  expect(eEcole).toBeNull();
  expect(vuesEcole).toEqual([]);
  const { data: vues } = await (await clientConnecte(COMPTE)).rpc("mes_classes");
  expect(vues.map((v) => v.classe)).toEqual([CLASSE]);
});

test("il ajoute un établissement, voit toutes ses classes et passe de l'un à l'autre sans mot de passe", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("Ex. : citadelle").fill(ENSEIGNANT.telephone);
  await expect(page.getByText(ENSEIGNANT.etablissement).first()).toBeVisible();
  await page.getByPlaceholder("Identifiant, téléphone ou e-mail").fill(ENSEIGNANT.telephone);
  await page.getByPlaceholder("Votre mot de passe").fill(ENSEIGNANT.mdp);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page.getByRole("button", { name: /Se déconnecter/ })).toBeVisible({ timeout: 30_000 });

  // « Toutes mes classes », en tête du menu.
  const menu = page.getByRole("navigation");
  const main = page.getByRole("main");
  await menu.getByRole("button", { name: /Toutes mes classes/ }).click();
  await expect(main.getByText(`🏫 ${ENSEIGNANT.etablissement}`)).toBeVisible({ timeout: 30_000 });
  await expect(main.getByRole("button", { name: new RegExp(CLASSE) })).toBeVisible();

  // Il ajoute l'établissement où il enseigne aussi.
  await main.getByRole("button", { name: "➕ Ajouter un établissement" }).click();
  await page.getByRole("textbox", { name: "Nom de l'établissement" }).fill(AUTRE.etablissement);
  await page.getByRole("textbox", { name: "Ville" }).fill(AUTRE.ville);
  await page.getByLabel("Lycée", { exact: true }).check();
  await page.getByRole("button", { name: "✅ Ajouter l'établissement" }).click();
  await expect(page.getByText(`Établissement ajouté : ${AUTRE.etablissement}.`)).toBeVisible({ timeout: 30_000 });
  await expect(main.getByText(`🏫 ${AUTRE.etablissement}`)).toBeVisible({ timeout: 30_000 });

  // Base : un espace enseignant à part, gratuit, relié au sien.
  const autre = await lireEcole(AUTRE.code);
  expect(autre).toMatchObject({ nom: AUTRE.etablissement, type_espace: "enseignant", plan: "gratuit" });
  expect(autre.extra.sectionsActives).toEqual(["lycee"]);
  expect(autre.extra.retraitNonReinscrits).toBe(0);
  const comptesAutre = await comptesDe(autre.id);
  expect(comptesAutre).toHaveLength(1);
  expect(comptesAutre[0]).toMatchObject({ login: ENSEIGNANT.code, role: "direction", label: "Enseignant", premiere_co: false });
  const [premier] = await comptesDe((await lireEcole(ENSEIGNANT.code)).id);
  expect(comptesAutre[0].personne_id).toBeTruthy();
  expect(premier.personne_id).toBe(comptesAutre[0].personne_id);

  // Il ouvre l'autre établissement : aucun mot de passe demandé.
  await main.getByRole("button", { name: "Ouvrir cet établissement" }).click();
  const espace = page.getByTitle("Changer d'espace");
  await expect(espace).toContainText(AUTRE.etablissement, { timeout: 30_000 });
  await expect(page.getByRole("button", { name: /Se déconnecter/ })).toBeVisible();
  const { data: audit } = await clientAdmin().from("audit").select("cible").eq("action", "changer_espace");
  expect(audit.some((a) => a.cible?.compteId === comptesAutre[0].id)).toBe(true);

  // Depuis l'autre établissement, il rouvre sa classe du premier : retour
  // dans le premier, droit sur le module de la classe.
  await page.getByRole("navigation").getByRole("button", { name: /Toutes mes classes/ }).click();
  await expect(main.getByText(`🏫 ${AUTRE.etablissement}`)).toBeVisible({ timeout: 30_000 });
  await main.getByRole("button", { name: new RegExp(CLASSE) }).click();
  await expect(espace).toContainText(ENSEIGNANT.etablissement, { timeout: 30_000 });
  await expect(page.getByRole("button", { name: /^Classes \(\d+\)$/ })).toBeVisible({ timeout: 30_000 });
});
