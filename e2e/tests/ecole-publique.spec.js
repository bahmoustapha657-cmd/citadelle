// École publique (étape 4) : elle s'inscrit par son propre choix au premier
// écran, commence en gratuit comme toute école, puis demande depuis le
// tableau de bord son offre à prix fixe — choisie d'avance pour elle. Le
// plan reste attribué par EduGest : ni le corps d'inscription ni l'école
// elle-même ne peuvent le poser.
//
// Nom tiré au hasard à chaque passage : le spec se relance sur la même base.
import { test, expect } from "@playwright/test";
import { appelerInscription, clientAdmin, clientConnecte } from "../donnees.js";

const SUFFIXE = String(Date.now()).slice(-5);
const ECOLE = { nom: `Lycee public E2E ${SUFFIXE}`, code: `lycee-public-e2e-${SUFFIXE}`, ville: "Kindia" };
const DIRECTION = { login: "proviseur", mdp: "E2e-Proviseur-2026", code: ECOLE.code };

test.describe.configure({ mode: "serial" });

const lireEcole = async (code) => {
  const { data, error } = await clientAdmin().from("ecoles").select("id, plan, plan_expiry, extra").eq("code", code).maybeSingle();
  if (error) throw error;
  return data;
};

// Prix fixé le 2026-11-19 (src/ecole-publique.js) ; l'espace entre les
// milliers est insécable, d'où \s.
const PRIX_MOIS = /100\s000 GNF \/ mois/;

test("la page d'accueil affiche l'offre École publique et mène à son inscription", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "En savoir plus sur EduGest" }).click();
  const bande = page.locator("[data-offre=publique]");
  await expect(bande).toContainText(PRIX_MOIS);
  await expect(bande).toContainText("Un seul prix, quel que soit le nombre d'élèves");
  await bande.getByRole("button", { name: "Inscrire mon école publique" }).click();
  await expect(page.getByRole("button", { name: /Une école publique/ })).toContainText(PRIX_MOIS);
});

test("elle s'inscrit comme école publique : statut noté, plan gratuit", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Créer une école ou un espace enseignant" }).click();
  await page.getByRole("button", { name: /Une école publique/ }).click();
  await expect(page.getByRole("note")).toContainText("vous commencez avec l'offre gratuite");
  await expect(page.getByRole("note")).toContainText(/100\s000 GNF par mois/);
  await page.getByPlaceholder("Ex. : École La Citadelle").fill(ECOLE.nom);
  await page.getByPlaceholder("Ex. : Kindia").fill(ECOLE.ville);
  await page.getByPlaceholder("Nom et prénom du directeur / fondateur").fill("Mamadou CAMARA");
  await page.getByPlaceholder("Ex : 6XX XX XX XX").fill("620 00 05 55");
  await page.getByPlaceholder("contact@ecole.com").fill(`lycee.${SUFFIXE}@example.com`);
  await page.getByRole("button", { name: /Suivant/ }).click();
  await page.getByPlaceholder("Ex. : directeur").fill(DIRECTION.login);
  await page.getByPlaceholder("Minimum 8 caractères").fill(DIRECTION.mdp);
  await page.getByPlaceholder("Répétez le mot de passe").fill(DIRECTION.mdp);
  await page.getByRole("button", { name: "Créer mon école" }).click();
  await expect(page.getByText("École créée avec succès !")).toBeVisible({ timeout: 30_000 });

  const ecole = await lireEcole(ECOLE.code);
  expect(ecole).toMatchObject({ plan: "gratuit", plan_expiry: null });
  expect(ecole.extra.statutEtablissement).toBe("public");
});

test("ni le corps d'inscription ni l'école ne posent le plan", async () => {
  const code = `college-public-e2e-${SUFFIXE}`;
  const r = await appelerInscription({
    nomEcole: `College public E2E ${SUFFIXE}`, ville: "Labé", pays: "Guinée", responsable: "Aissatou BAH",
    telephone: "620000666", email: `college.${SUFFIXE}@example.com`, adminLogin: "principal", adminMdp: "E2e-Principal-2026",
    statutEtablissement: "public", plan: "publique", planExpiry: Date.now() + 365 * 86400000,
  });
  expect(r.status).toBe(200);
  expect(await lireEcole(code)).toMatchObject({ plan: "gratuit", plan_expiry: null, extra: expect.objectContaining({ statutEtablissement: "public" }) });

  // Valeur inconnue : école privée.
  const autre = await appelerInscription({
    nomEcole: `Ecole privee E2E ${SUFFIXE}`, ville: "Boké", pays: "Guinée", responsable: "Fanta KABA",
    telephone: "620000777", email: `privee.${SUFFIXE}@example.com`, adminLogin: "fondateur", adminMdp: "E2e-Fondateur-2026",
    statutEtablissement: "publique!",
  });
  expect(autre.status).toBe(200);
  expect((await lireEcole(`ecole-privee-e2e-${SUFFIXE}`)).extra.statutEtablissement).toBe("prive");

  // La direction ne s'attribue pas le plan elle-même (ecoles_guard).
  const { id } = await lireEcole(ECOLE.code);
  await clientAdmin().from("comptes").update({ premiere_co: false }).eq("ecole_id", id).eq("login", DIRECTION.login);
  const direction = await clientConnecte(DIRECTION);
  const { error } = await direction.from("ecoles").update({ plan: "publique" }).eq("id", id);
  expect(error?.message || "").toMatch(/plan d'abonnement est géré par EduGest/);
  expect((await lireEcole(ECOLE.code)).plan).toBe("gratuit");
});

test("depuis le tableau de bord, elle demande l'offre École publique, choisie d'avance", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("Ex. : citadelle").fill(ECOLE.code);
  await expect(page.getByText(ECOLE.nom).first()).toBeVisible();
  await page.getByPlaceholder("Identifiant, téléphone ou e-mail").fill(DIRECTION.login);
  await page.getByPlaceholder("Votre mot de passe").fill(DIRECTION.mdp);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page.getByRole("button", { name: /Se déconnecter/ })).toBeVisible({ timeout: 30_000 });

  await page.getByRole("navigation").getByRole("button", { name: /Tableau de bord/ }).click();
  await page.getByRole("button", { name: "📋 Demande formelle" }).click();
  const offre = page.getByRole("button", { name: /École publique/ });
  await expect(offre).toHaveAttribute("aria-pressed", "true");
  await expect(offre).toContainText(/100\s000 GNF \/ mois, élèves illimités/);
  await expect(page.getByText(/Réservé aux établissements publics/)).toBeVisible();
  await page.getByPlaceholder("Ex. : 621 00 00 00").fill("620 00 05 55");
  await page.getByPlaceholder("Ex. : TXN-20240418-001").fill(`OM-${SUFFIXE}`);
  await page.getByRole("button", { name: /Envoyer la demande/ }).click();
  await expect(page.getByText("Demande envoyée avec succès !")).toBeVisible({ timeout: 30_000 });

  const { id } = await lireEcole(ECOLE.code);
  const { data: demandes } = await clientAdmin().from("demandes_plan").select("plan_demande, statut").eq("ecole_id", id);
  expect(demandes).toEqual([{ plan_demande: "publique", statut: "en_attente" }]);
  // Rien n'est activé avant la vérification d'EduGest.
  expect((await lireEcole(ECOLE.code)).plan).toBe("gratuit");
});
