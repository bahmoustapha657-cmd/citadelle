// École publique (étape 4) : elle s'inscrit par son propre choix au premier
// écran, commence en gratuit comme toute école, puis demande depuis le
// tableau de bord son offre à prix fixe — choisie d'avance pour elle. Le
// plan reste attribué par EduGest : ni le corps d'inscription ni l'école
// elle-même ne peuvent le poser.
//
// Nom tiré au hasard à chaque passage : le spec se relance sur la même base.
import { test, expect } from "@playwright/test";
import { toRow } from "../../src/backend/collection-map.js";
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

const seConnecter = async (page) => {
  await page.goto("/");
  await page.getByPlaceholder("Ex. : citadelle").fill(ECOLE.code);
  await expect(page.getByText(ECOLE.nom).first()).toBeVisible();
  await page.getByPlaceholder("Identifiant, téléphone ou e-mail").fill(DIRECTION.login);
  await page.getByPlaceholder("Votre mot de passe").fill(DIRECTION.mdp);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page.getByRole("button", { name: /Se déconnecter/ })).toBeVisible({ timeout: 30_000 });
};

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

// ── Lot A (2026-11-19) : une école publique n'a PAS de comptabilité ──
// Primaire gratuit, enseignants payés par l'État : ni mensualités, ni caisse,
// ni paie, ni fondation. Elle garde les présences du personnel et inscrit ses
// élèves depuis l'onglet Élèves.
const CLASSE = "7ème Année A";
const ELEVES = [
  { nom: "DIALLO", prenom: "Mariama", sexe: "F" },
  { nom: "SOW", prenom: "Ibrahima", sexe: "M" },
];

test("sans comptabilité : présences du personnel au menu, aucun chiffre d'argent", async ({ page }) => {
  await seConnecter(page);
  const menu = page.getByRole("navigation");
  await expect(menu.getByRole("button", { name: /Présences du personnel/ })).toBeVisible();
  for (const absent of [/Comptabilité/, /Fondation/]) {
    await expect(menu.getByRole("button", { name: absent })).toHaveCount(0);
  }

  // Tableau de bord : effectifs et absences, aucune tuile ni alerte d'argent.
  await menu.getByRole("button", { name: /Tableau de bord/ }).click();
  await expect(page.getByText("Absences saisies").first()).toBeVisible();
  for (const argent of ["Taux paiement", "Solde tréso.", "Mensualités payées", "Alertes & rappels"]) {
    await expect(page.getByText(argent, { exact: true })).toHaveCount(0);
  }

  // Le module garde un seul écran : les présences, sans onglet d'argent.
  await menu.getByRole("button", { name: /Présences du personnel/ }).click();
  await expect(page.getByRole("heading", { name: "Présences du personnel" })).toBeVisible();
  await expect(page.getByText("Absences, retards et permissions des enseignants et du personnel")).toBeVisible();
  await expect(page.getByText(/^Recettes \(/)).toHaveCount(0);
  await expect(page.getByText(/^Salaires/)).toHaveCount(0);

  // Paramètres : le statut se lit (et se change) dans Identité ; pas de
  // paiement en ligne des familles.
  await menu.getByRole("button", { name: /Paramètres/ }).click();
  await expect(page.getByLabel("Statut de l'établissement")).toHaveValue("public");
  await expect(page.getByText(/Paiement en ligne/)).toHaveCount(0);
});

test("elle inscrit ses élèves depuis l'onglet Élèves, sans passer par une comptabilité", async ({ page }) => {
  // Sa classe, écrite par la direction (RLS), sous la forme que produit l'app.
  const direction = await clientConnecte(DIRECTION);
  const { id: ecole_id } = await lireEcole(ECOLE.code);
  const { data: dejaLa } = await direction.from("classes").select("id").eq("nom", CLASSE);
  if (!dejaLa?.length) {
    const { error } = await direction.from("classes")
      .insert({ ...toRow("classes", { nom: CLASSE }).row, ecole_id, section: "college" });
    if (error) throw new Error(`classes : ${error.message}`);
  }

  await seConnecter(page);
  const menu = page.getByRole("navigation");
  await menu.getByRole("button", { name: /Secondaire/ }).click();
  // Plus de renvoi vers une Comptabilité → Élèves qu'elle n'a pas.
  await expect(page.getByText(/Comptabilité → Élèves/)).toHaveCount(0);
  await page.getByRole("button", { name: /^Élèves \(\d+\)$/ }).click();
  await page.getByRole("button", { name: "➕ Ajouter des élèves" }).click();
  await page.getByLabel("Élèves — un par ligne")
    .fill(ELEVES.map((e) => `${e.nom} ${e.prenom} ${e.sexe}`).join("\n"));
  await page.getByRole("button", { name: `✅ Inscrire (${ELEVES.length})` }).click();
  await expect(page.getByText(`Élèves inscrits en ${CLASSE} : ${ELEVES.length}.`)).toBeVisible({ timeout: 30_000 });

  await expect.poll(async () => {
    const { data } = await clientAdmin().from("eleves")
      .select("nom, prenom, sexe, classe, section").eq("ecole_id", ecole_id).order("nom");
    return data;
  }, { timeout: 30_000 }).toEqual(ELEVES.map((e) => ({ ...e, classe: CLASSE, section: "college" })));

  // Toujours là après le 1er novembre : sans paiement, un élève d'école
  // publique n'est pas un « non réinscrit » (le retrait automatique est coupé).
  await page.reload();
  await expect(page.getByRole("button", { name: /Se déconnecter/ })).toBeVisible({ timeout: 30_000 });
  await menu.getByRole("button", { name: /Secondaire/ }).click();
  await expect(page.getByRole("button", { name: `Élèves (${ELEVES.length})` })).toBeVisible();
});

// ── Lot B (2026-11-19) : ce que la plateforme DGECS demande ──
// Matricule saisi dans la fiche de notes (rangé dans l'IEN de l'élève),
// notes manquantes signalées avant la « Clôture », redoublants de l'année
// cochés pour les statistiques de rentrée.
test("onglet DGECS : matricules, notes manquantes et redoublants", async ({ page }) => {
  const direction = await clientConnecte(DIRECTION);
  const { id: ecole_id } = await lireEcole(ECOLE.code);
  const { data: matieres } = await direction.from("matieres").select("id").eq("nom", "Mathématiques");
  if (!matieres?.length) {
    const { error } = await direction.from("matieres")
      .insert({ ...toRow("matieres", { nom: "Mathématiques", coefficient: 2 }).row, ecole_id, section: "college" });
    if (error) throw new Error(`matieres : ${error.message}`);
  }

  await seConnecter(page);
  const menu = page.getByRole("navigation");
  await menu.getByRole("button", { name: /Secondaire/ }).click();
  // Nom exact : le menu latéral a aussi un bouton « 🇬🇳 Plateformes DGECS ».
  await page.getByRole("button", { name: "🇬🇳 DGECS", exact: true }).click();

  // Fiche de notes de la classe : une colonne par matière, aucune note encore.
  await expect(page.getByRole("columnheader", { name: /MATHÉMATIQUES/ })).toBeVisible();
  await expect(page.getByText("MARIAMA DIALLO")).toBeVisible();
  await expect(page.getByText("IBRAHIMA SOW")).toBeVisible();
  await expect(page.getByText("2 note(s) manquante(s)")).toBeVisible();
  await expect(page.getByText("2 sans matricule")).toBeVisible();
  await expect(page.getByText(/À compléter avant de « Clôturer »/)).toBeVisible();

  // Matricule de la plateforme : majuscules, sans espaces, sur la fiche (IEN).
  const matricule = page.getByRole("textbox", { name: "Matricule" }).first();
  await matricule.fill("ma 2503 2033");
  await matricule.press("Enter");
  await expect(page.getByText("1 sans matricule")).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => {
    const { data } = await clientAdmin().from("eleves").select("ien").eq("ecole_id", ecole_id).eq("nom", "DIALLO");
    return data?.[0]?.ien;
  }, { timeout: 30_000 }).toBe("MA25032033");

  // Statistiques de rentrée : Ibrahima coché redoublant de l'année.
  await page.getByRole("button", { name: "📊 Statistiques de rentrée" }).click();
  await page.getByRole("button", { name: "🔁 Marquer les redoublants" }).click();
  await page.getByLabel("SOW Ibrahima").check();
  await expect.poll(async () => {
    const { data } = await clientAdmin().from("eleves").select("extra").eq("ecole_id", ecole_id).eq("nom", "SOW");
    return data?.[0]?.extra?.redoublantAnnee || "";
  }, { timeout: 30_000 }).toMatch(/^\d{4}-\d{4}$/);
  // Niveau, classes, effectifs G/F/T, redoublants G/F/T.
  await expect(page.getByRole("row", { name: /^7ème Année/ }).locator("td"))
    .toHaveText(["7ème Année", "1", "1", "1", "2", "1", "0", "1"]);

  // Candidats : la 7ème Année n'est pas une classe d'examen (BEPC = 10ème Année).
  await page.getByRole("button", { name: "🎓 Candidats aux examens" }).click();
  await expect(page.getByText("Aucun élève en 10ème Année dans cette section.")).toBeVisible();
});

test("redevenue privée dans Paramètres, elle retrouve sa comptabilité", async ({ page }) => {
  await seConnecter(page);
  const menu = page.getByRole("navigation");
  await menu.getByRole("button", { name: /Paramètres/ }).click();
  await page.getByLabel("Statut de l'établissement").selectOption("prive");
  await page.getByRole("button", { name: "💾 Enregistrer les paramètres" }).click();
  await expect(page.getByText("Paramètres enregistrés avec succès.")).toBeVisible({ timeout: 30_000 });
  await expect(menu.getByRole("button", { name: /Comptabilité/ })).toBeVisible();
  await expect(menu.getByRole("button", { name: /Présences du personnel/ })).toHaveCount(0);

  const { extra } = await lireEcole(ECOLE.code);
  expect(extra.statutEtablissement).toBe("prive");
  // Le type par défaut a suivi le statut ; le plan, lui, n'a pas bougé.
  expect(extra.type).toBe("Groupe Scolaire Privé");
  expect((await lireEcole(ECOLE.code)).plan).toBe("gratuit");
});
