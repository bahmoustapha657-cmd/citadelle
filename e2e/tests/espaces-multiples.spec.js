// Une personne, plusieurs espaces : Kadiatou SYLLA est parent d'élève ET
// enseignante. La Direction relie ses deux comptes ; elle se connecte comme
// parent, choisit son espace enseignant, y arrive sans mot de passe, puis
// revient. Et surtout, personne d'autre ne peut relier des comptes ni passer
// sur un compte qui ne lui est pas relié.
import { test, expect } from "@playwright/test";
import {
  COMPTABLE, DIRECTION, ECOLE, PERSONNE_PARENT, clientConnecte,
  appelerAccountManage, lireAudit, lireCompte, preparerPersonneDeuxEspaces,
} from "../donnees.js";

test.describe.configure({ mode: "serial" });

let ids;

test.beforeAll(async () => {
  ids = await preparerPersonneDeuxEspaces();
});

test("sécurité : seule la Direction relie, et personne ne se relie lui-même", async () => {
  // Le compte lui-même ne peut pas poser son lien en base (garde SQL).
  const parent = await clientConnecte(PERSONNE_PARENT);
  const { error } = await parent.from("comptes")
    .update({ personne_id: "00000000-0000-4000-8000-000000000001" }).eq("id", ids.parent);
  expect(error?.message || "").toMatch(/Comptes & Postes/);
  expect((await lireCompte(ids.parent)).personne_id).toBeNull();

  // Le personnel (comptable) ne peut pas relier.
  const parComptable = await appelerAccountManage(COMPTABLE, { action: "relier_comptes", compteIds: [ids.parent, ids.enseignant] });
  expect(parComptable.status).toBe(403);

  // Pas encore reliés : passer d'un compte à l'autre est refusé.
  const avant = await appelerAccountManage(PERSONNE_PARENT, { action: "changer_espace", compteId: ids.enseignant });
  expect(avant.status).toBe(403);
});

test("la Direction relie les deux comptes", async () => {
  const r = await appelerAccountManage(DIRECTION, { action: "relier_comptes", compteIds: [ids.parent, ids.enseignant] });
  expect(r.status).toBe(200);
  const [p, e] = [await lireCompte(ids.parent), await lireCompte(ids.enseignant)];
  expect(p.personne_id).toBeTruthy();
  expect(e.personne_id).toBe(p.personne_id);
  expect((await lireAudit("relier_comptes")).length).toBeGreaterThan(0);
});

test("sécurité : reliée, elle ne peut pas pour autant passer sur un autre compte", async () => {
  const admin = await clientConnecte(DIRECTION);
  const { data: direction } = await admin.from("comptes").select("id").eq("login", DIRECTION.login).single();
  const r = await appelerAccountManage(PERSONNE_PARENT, { action: "changer_espace", compteId: direction.id });
  expect(r.status).toBe(403);
});

test("connectée comme parent, elle choisit son espace enseignant puis revient", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("Ex. : citadelle").fill(ECOLE.code);
  await expect(page.getByText(ECOLE.nom).first()).toBeVisible();
  await page.getByPlaceholder("Identifiant, téléphone ou e-mail").fill("622 55 50 01");
  await page.getByPlaceholder("Votre mot de passe").fill(PERSONNE_PARENT.mdp);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page.getByRole("button", { name: "Deconnexion", exact: true })).toBeVisible({ timeout: 30_000 });

  // Choix proposé d'office après la connexion.
  const choix = page.getByRole("dialog", { name: "Choisir mon espace" });
  await expect(choix).toBeVisible({ timeout: 15_000 });
  await choix.getByRole("button", { name: /Enseignant/ }).click();

  // Rechargé sur le portail enseignant, sans mot de passe demandé.
  const bouton = page.getByTitle("Changer d'espace");
  await expect(bouton).toContainText("Enseignant", { timeout: 30_000 });
  // Portail enseignant : son bouton de sortie est « Se déconnecter », celui
  // du portail parent « Deconnexion ».
  await expect(page.getByRole("button", { name: "Se déconnecter", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Deconnexion", exact: true })).toHaveCount(0);
  await expect(page.getByText("Changer mon mot de passe")).toHaveCount(0);
  expect((await lireAudit("changer_espace")).some((a) => a.cible?.compteId === ids.enseignant)).toBe(true);

  // Retour à l'espace parent par le bouton « Espace ».
  await bouton.click();
  await page.getByRole("dialog", { name: "Choisir mon espace" }).getByRole("button", { name: /Parent d'élève/ }).click();
  await expect(page.getByRole("button", { name: "Deconnexion", exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTitle("Changer d'espace")).toContainText("Parent d'élève");
});
