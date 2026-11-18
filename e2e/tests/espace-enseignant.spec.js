// Espace d'un enseignant indépendant : il s'inscrit seul, sans que son école
// utilise EduGest. Son numéro de téléphone est le code de l'espace et son
// identifiant. Il ne voit que ses classes (pas de Comptabilité, pas de
// comptes à créer) et inscrit lui-même ses élèves depuis l'onglet Élèves.
// Le serveur tient ces limites même hors de l'écran.
import { test, expect } from "@playwright/test";
import { toRow } from "../../src/backend/collection-map.js";
import { appelerAccountManage, appelerInscription, clientAdmin, clientConnecte } from "../donnees.js";

const ENSEIGNANT = {
  nom: "Mariama CONDE",
  // Tapé comme on l'écrit ; le code et l'identifiant sont les 9 chiffres.
  telephone: "622 00 01 11",
  code: "622000111",
  email: "enseignante.e2e@example.com",
  etablissement: "Lycée Privé E2E",
  ville: "Kindia",
  mdp: "E2e-Enseignante-2026",
};
const COMPTE = { login: ENSEIGNANT.code, mdp: ENSEIGNANT.mdp, code: ENSEIGNANT.code };
const CLASSE = "8ème A";
const ELEVES = [
  { nom: "BARRY", prenom: "Aissatou", sexe: "F" },
  { nom: "SYLLA", prenom: "Mohamed Lamine", sexe: "M" },
  { nom: "CAMARA", prenom: "Hawa", sexe: "F" },
];

test.describe.configure({ mode: "serial" });

const lireEspace = async () => {
  const { data, error } = await clientAdmin().from("ecoles")
    .select("id, nom, plan, actif, type_espace, extra").eq("code", ENSEIGNANT.code).maybeSingle();
  if (error) throw error;
  return data;
};

test("un enseignant crée son espace gratuit depuis l'écran d'inscription", async ({ page }) => {
  // Base réutilisée en local : l'espace existe déjà (la CI part d'une base vierge).
  test.skip(!!(await lireEspace()), "espace déjà créé par un passage précédent");

  await page.goto("/");
  await page.getByRole("button", { name: "Créer une école ou un espace enseignant" }).click();
  await page.getByRole("button", { name: /Un enseignant/ }).click();
  await page.getByPlaceholder("Ex : Mamadou Bah").fill(ENSEIGNANT.nom);
  await page.getByPlaceholder("Ex : 622 12 34 56").fill(ENSEIGNANT.telephone);
  await page.getByPlaceholder("vous@exemple.com").fill(ENSEIGNANT.email);
  await page.getByPlaceholder("Ex : Groupe scolaire Les Étoiles").fill(ENSEIGNANT.etablissement);
  await page.getByPlaceholder("Ex : Conakry").fill(ENSEIGNANT.ville);
  await page.getByRole("checkbox", { name: "Collège" }).check();
  await page.getByPlaceholder("8 caractères au moins").fill(ENSEIGNANT.mdp);
  await page.getByPlaceholder("Le même mot de passe").fill(ENSEIGNANT.mdp);
  await page.getByRole("button", { name: "Créer mon espace gratuit" }).click();

  await expect(page.getByText("Votre espace est prêt")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(ENSEIGNANT.code).first()).toBeVisible();

  // Base : un espace enseignant gratuit, actif, au nom de l'établissement,
  // sans retrait automatique des élèves (pas de paiements suivis ici).
  const espace = await lireEspace();
  expect(espace).toMatchObject({ nom: ENSEIGNANT.etablissement, plan: "gratuit", actif: true, type_espace: "enseignant" });
  expect(espace.extra.sectionsActives).toEqual(["college"]);
  expect(espace.extra.retraitNonReinscrits).toBe(0);
  const { data: comptes } = await clientAdmin().from("comptes")
    .select("login, role, label, premiere_co").eq("ecole_id", espace.id);
  expect(comptes).toEqual([{ login: ENSEIGNANT.code, role: "direction", label: "Enseignant", premiere_co: false }]);

  // Un second espace pour le même numéro est refusé.
  const doublon = await appelerInscription({
    typeEspace: "enseignant", nomEnseignant: "Autre", telephone: ENSEIGNANT.code, email: "autre@example.com",
    etablissement: "Autre", ville: "Labé", sections: ["college"], mdp: "E2e-Autre-2026",
  });
  expect(doublon.status).toBe(409);
});

test("une école ne peut pas prendre un numéro de téléphone pour code", async () => {
  const r = await appelerInscription({
    nomEcole: "622000222", ville: "Conakry", pays: "Guinée", responsable: "Responsable",
    telephone: "620000001", email: "numero@example.com", adminLogin: "direction", adminMdp: "E2e-Numero-2026",
  });
  expect(r.status).toBe(400);
  expect(r.data.error).toMatch(/simple numéro/);
  const { data } = await clientAdmin().from("ecoles").select("id").eq("code", "622000222").maybeSingle();
  expect(data).toBeNull();
});

test("le serveur tient les limites de l'espace : un seul compte, type figé", async () => {
  // Ni compte pour une autre personne, ni compte parent.
  const creation = await appelerAccountManage(COMPTE, {
    action: "create", login: "collegue", mdp: "E2e-Collegue-2026", role: "enseignant", nom: "Collègue", statut: "Actif",
  });
  // Le refus propre à l'espace, pas un autre contrôle de droits.
  expect(creation.status).toBe(403);
  expect(creation.data.error).toMatch(/espace enseignant/);
  const parent = await appelerAccountManage(COMPTE, { action: "rattacher_parent", login: "parent.x" });
  expect(parent.status).toBe(403);
  expect(parent.data.error).toMatch(/espace enseignant/);
  const { data: comptes } = await clientAdmin().from("comptes").select("login").eq("ecole_id", (await lireEspace()).id);
  expect(comptes.map((c) => c.login)).toEqual([ENSEIGNANT.code]);

  // L'enseignant ne peut pas changer son espace en école (garde SQL).
  const enseignant = await clientConnecte(COMPTE);
  const { id } = await lireEspace();
  const { error } = await enseignant.from("ecoles").update({ type_espace: "ecole" }).eq("id", id);
  expect(error?.message || "").toMatch(/type d'espace/);
  expect((await lireEspace()).type_espace).toBe("enseignant");
});

test("connecté par son numéro, il ne voit que ses classes et y inscrit ses élèves", async ({ page }) => {
  // Sa classe, écrite par lui-même (RLS), sous la forme que produit l'app.
  const enseignant = await clientConnecte(COMPTE);
  const { id: ecole_id } = await lireEspace();
  const { data: dejaLa } = await enseignant.from("classes").select("id").eq("nom", CLASSE);
  if (!dejaLa?.length) {
    const { error } = await enseignant.from("classes")
      .insert({ ...toRow("classes", { nom: CLASSE }).row, ecole_id, section: "college" });
    if (error) throw new Error(`classes : ${error.message}`);
  }

  // Connexion : le numéro, écrit à sa façon, sert de code et d'identifiant.
  await page.goto("/");
  await page.getByPlaceholder("Ex. : citadelle").fill(ENSEIGNANT.telephone);
  await expect(page.getByText(ENSEIGNANT.etablissement).first()).toBeVisible();
  await page.getByPlaceholder("Identifiant, téléphone ou e-mail").fill(ENSEIGNANT.telephone);
  await page.getByPlaceholder("Votre mot de passe").fill(ENSEIGNANT.mdp);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page.getByRole("button", { name: /Se déconnecter/ })).toBeVisible({ timeout: 30_000 });

  // Menu : ses classes et ses réglages, rien de la gestion d'une école.
  const menu = page.getByRole("navigation");
  await expect(menu.getByRole("button", { name: /Secondaire/ })).toBeVisible();
  await expect(menu.getByRole("button", { name: /Paramètres/ })).toBeVisible();
  for (const absent of [/Comptabilité/, /Comptes & Postes/, /Dir\. Primaire/]) {
    await expect(menu.getByRole("button", { name: absent })).toHaveCount(0);
  }

  // Onglet Élèves : il colle sa liste, un élève par ligne.
  await menu.getByRole("button", { name: /Secondaire/ }).click();
  await page.getByRole("button", { name: /^Élèves \(\d+\)$/ }).click();
  await page.getByRole("button", { name: "➕ Ajouter des élèves" }).click();
  await page.getByLabel("Élèves — un par ligne")
    .fill(ELEVES.map((e, i) => `${i + 1}. ${e.nom} ${e.prenom} ${e.sexe}`).join("\n"));
  await page.getByRole("button", { name: `✅ Inscrire (${ELEVES.length})` }).click();
  await expect(page.getByText(`Élèves inscrits en ${CLASSE} : ${ELEVES.length}.`)).toBeVisible({ timeout: 30_000 });

  // Base : les trois élèves, dans sa classe, au collège, avec un matricule
  // chacun (hors ligne, l'envoi peut suivre de quelques secondes).
  await expect.poll(async () => {
    const { data } = await clientAdmin().from("eleves")
      .select("nom, prenom, sexe, classe, section").eq("ecole_id", ecole_id).order("nom");
    return data;
  }, { timeout: 30_000 }).toEqual([...ELEVES]
    .sort((a, b) => a.nom.localeCompare(b.nom))
    .map((e) => ({ ...e, classe: CLASSE, section: "college" })));
  const { data: matricules } = await clientAdmin().from("eleves").select("matricule").eq("ecole_id", ecole_id);
  expect(new Set(matricules.map((m) => m.matricule).filter(Boolean)).size).toBe(ELEVES.length);
});
