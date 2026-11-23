// Code court d'une école (migration 20261123184655_codes_ecole_courts.sql) :
// un mot de son nom, accepté partout où un code est saisi, EN PLUS du code
// d'origine — qui reste l'identifiant interne (e-mails de connexion, QR).
// Posé par EduGest (ici : clé de service), jamais par l'école elle-même ;
// unique avec TOUS les codes, sans tenir compte des majuscules ni des accents.
import { test, expect } from "@playwright/test";
import { DIRECTION, ECOLE, appelerInscription, clientAdmin, clientConnecte } from "../donnees.js";

const CODE_COURT = "ecolecourte";
const SUFFIXE = String(Date.now()).slice(-5);

test.describe.configure({ mode: "serial" });

const admin = () => clientAdmin();
const poserCodeCourt = (valeur) => admin().from("ecoles")
  .update({ code_court: valeur }).eq("code", ECOLE.code).select("code_court").single();

test.beforeAll(async () => {
  // Saisi avec majuscules, accent et espaces : la base le range normalisé.
  const { data, error } = await poserCodeCourt(" ÉcoleCourte ");
  if (error) throw new Error(`Pose du code court : ${error.message}`);
  expect(data.code_court).toBe(CODE_COURT);
});

test.afterAll(async () => {
  await poserCodeCourt(null);
});

test("la direction se connecte avec le code court de son école", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("Ex. : citadelle").fill("ÉcoleCourte");
  // L'école est reconnue, et son code court rappelé sous son nom.
  await expect(page.getByText(ECOLE.nom).first()).toBeVisible();
  await expect(page.getByText(CODE_COURT, { exact: true })).toBeVisible();
  await page.getByPlaceholder("Identifiant, téléphone ou e-mail").fill(DIRECTION.login);
  await page.getByPlaceholder("Votre mot de passe").fill(DIRECTION.mdp);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page.getByRole("button", { name: /Se déconnecter/ })).toBeVisible({ timeout: 30_000 });
  // La session tourne sur le code d'origine (e-mails, chemins, QR).
  expect(await page.evaluate(() => localStorage.getItem("LC_schoolId"))).toBe(ECOLE.code);
});

test("la base : code court accepté, réservé à EduGest, unique avec tous les codes", async () => {
  const { data: ecole } = await admin().from("ecoles").select("id").eq("code", ECOLE.code).single();
  await admin().from("comptes").update({ premiere_co: false }).eq("ecole_id", ecole.id).eq("login", DIRECTION.login);
  const direction = await clientConnecte(DIRECTION);

  // État public par le code court (accents, majuscules) : le code d'origine.
  const { data: etat, error: eEtat } = await direction.rpc("etat_ecole", { p_code: " ÉCOLECOURTE " });
  expect(eEtat).toBeNull();
  expect(etat?.[0]).toMatchObject({ code: ECOLE.code, code_court: CODE_COURT });
  // Le code d'origine marche toujours.
  const { data: parOrigine } = await direction.rpc("etat_ecole", { p_code: ECOLE.code });
  expect(parOrigine?.[0]?.code).toBe(ECOLE.code);
  const { error: eAnnonces } = await direction.rpc("annonces_publiques", { p_code: CODE_COURT });
  expect(eAnnonces).toBeNull();
  // La résolution interne ne s'appelle pas directement.
  const { error: eDirect } = await direction.rpc("ecole_id_par_code", { p_code: CODE_COURT });
  expect(eDirect).not.toBeNull();

  // L'école ne pose ni ne change son code court elle-même.
  const { error: eGarde } = await direction.from("ecoles").update({ code_court: "autremot" }).eq("id", ecole.id);
  expect(eGarde?.message).toMatch(/code court de l'école est géré par EduGest/);

  // Deux écoles jetables : l'une au code d'un seul mot.
  const codeUnMot = `unmot${SUFFIXE}`;
  const { data: jetables, error: eIns } = await admin().from("ecoles").insert([
    { code: `autre-ecole-e2e-${SUFFIXE}`, nom: "Autre ecole E2E", actif: false },
    { code: codeUnMot, nom: "Ecole Unmot E2E", actif: false },
  ]).select("id, code");
  if (eIns) throw new Error(`Écoles jetables : ${eIns.message}`);
  const autre = jetables.find((e) => e.code !== codeUnMot);
  try {
    // Le code court d'une école ne se donne pas à une autre (même écrit autrement)…
    const { error: e1 } = await admin().from("ecoles").update({ code_court: "ÉCOLECOURTE" }).eq("id", autre.id);
    expect(e1?.code).toBe("23505");
    // … ni le code d'origine d'une autre école…
    const { error: e2 } = await admin().from("ecoles").update({ code_court: codeUnMot }).eq("id", autre.id);
    expect(e2?.code).toBe("23505");
    // … et une nouvelle école ne prend pas pour code le code court d'une autre.
    const { error: e3 } = await admin().from("ecoles").insert({ code: CODE_COURT, nom: "Usurpatrice E2E", actif: false });
    expect(e3?.code).toBe("23505");
    // Un seul mot, une lettre d'abord : ni numéro (espace enseignant), ni mot réservé.
    for (const refuse of ["622123456", "deux-mots", "superadmin", "x"]) {
      const { error } = await admin().from("ecoles").update({ code_court: refuse }).eq("id", autre.id);
      expect(error?.code, refuse).toBe("23514");
    }
    // Un mot libre passe.
    const { data: libre, error: e4 } = await admin().from("ecoles")
      .update({ code_court: `Libre${SUFFIXE}` }).eq("id", autre.id).select("code_court").single();
    expect(e4).toBeNull();
    expect(libre.code_court).toBe(`libre${SUFFIXE}`);
  } finally {
    await admin().from("ecoles").delete().in("id", jetables.map((e) => e.id));
  }
});

test("inscription d'une école dont le nom donne le code court d'une autre : refusée", async () => {
  const r = await appelerInscription({
    nomEcole: "EcoleCourte", ville: "Kindia", pays: "Guinée", responsable: "Responsable Test",
    telephone: "620000888", email: `courte.${SUFFIXE}@example.com`, adminLogin: "fondateur", adminMdp: "E2e-Fondateur-2026",
  });
  expect(r.status).toBeGreaterThanOrEqual(400);
  const { data } = await admin().from("ecoles").select("id").eq("code", CODE_COURT);
  expect(data).toEqual([]);
});
