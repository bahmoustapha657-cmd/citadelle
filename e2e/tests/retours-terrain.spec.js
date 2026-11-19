// Canal de retours terrain (feuille de route, étape 1) : depuis le centre
// d'aide, un compte d'école signale un problème à EduGest ; le message part
// avec son contexte (écran, version, langue), seul son auteur le relit, et
// la réponse du super-admin s'affiche chez lui. Écriture uniquement par la
// fonction retour_envoyer (nom, rôle et école pris en base).
//
// Texte tiré au hasard à chaque passage : le spec se relance sur la même base.
import { test, expect } from "@playwright/test";
import { superadminEmailFor } from "../../supabase/_brand.mjs";
import { COMPTABLE, DIRECTION, SUPABASE_URL, clientAdmin, clientConnecte, ecoleId, preparerEcole } from "../donnees.js";
import { seConnecter } from "../parcours.js";
import { createClient } from "@supabase/supabase-js";

const SUFFIXE = String(Date.now()).slice(-6);
const MESSAGE = `Le bulletin de 7ème A ne s'imprime pas (e2e ${SUFFIXE})`;
const REPONSE = `Corrigé dans la version de ce soir (e2e ${SUFFIXE}).`;
const SUPERADMIN = { login: "e2e-superadmin", mdp: "E2e-Superadmin-2026" };

test.describe.configure({ mode: "serial" });

// Compte super-admin de test (transversal, sans école), créé une fois.
async function preparerSuperadmin() {
  const admin = clientAdmin();
  const { data: existe } = await admin.from("comptes").select("id")
    .eq("role", "superadmin").eq("login", SUPERADMIN.login).maybeSingle();
  if (existe) return;
  const { data, error } = await admin.auth.admin.createUser({
    email: superadminEmailFor(SUPERADMIN.login), password: SUPERADMIN.mdp, email_confirm: true,
  });
  if (error) throw error;
  const { error: e2 } = await admin.from("comptes").insert({
    user_id: data.user.id, login: SUPERADMIN.login, nom: "EduGest E2E", role: "superadmin",
    ecole_id: null, statut: "Actif", premiere_co: false,
  });
  if (e2) throw e2;
}

async function clientSuperadmin() {
  const sb = createClient(SUPABASE_URL, process.env.E2E_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await sb.auth.signInWithPassword({ email: superadminEmailFor(SUPERADMIN.login), password: SUPERADMIN.mdp });
  if (error) throw new Error(`Connexion super-admin impossible : ${error.message}`);
  return sb;
}

const lireRetour = async (message = MESSAGE) => {
  const { data, error } = await clientAdmin().from("retours_terrain").select("*").eq("message", message).maybeSingle();
  if (error) throw error;
  return data;
};

const ouvrirRetours = async (page) => {
  await page.getByTitle("Centre d'aide").click();
  await page.getByRole("button", { name: "💡 Signaler un problème ou proposer une idée" }).click();
};

test.beforeAll(async () => {
  await preparerEcole();
  await preparerSuperadmin();
});

test("la direction signale un problème depuis le centre d'aide : il part avec son contexte", async ({ page }) => {
  await seConnecter(page, DIRECTION);
  await ouvrirRetours(page);
  await page.getByRole("radio", { name: /Un problème/ }).click();
  await page.getByLabel("Votre message").fill(MESSAGE);
  await page.getByRole("button", { name: "Envoyer à EduGest" }).click();
  await expect(page.getByText("Votre message est bien arrivé chez EduGest")).toBeVisible();
  const carte = page.getByTestId("mon-retour").filter({ hasText: MESSAGE });
  await expect(carte).toContainText("Envoyé");
  await expect(page.getByLabel("Votre message")).toHaveValue("");

  // En base : école, auteur et rôle viennent du compte, pas du navigateur.
  const r = await lireRetour();
  expect(r.ecole_id).toBe(await ecoleId());
  expect(r.genre).toBe("probleme");
  expect(r.statut).toBe("nouveau");
  expect(r.auteur).not.toBe("");
  expect(r.role).not.toBe("");
  expect(r.contexte.langue).toBe("fr");
  expect(r.contexte.ecran).toBeTruthy();
  expect(r.contexte.version).toBeTruthy();
});

test("seul l'auteur relit son retour ; aucune écriture directe dans la table", async () => {
  const r = await lireRetour();
  // Un collègue de la même école ne le voit pas.
  const comptable = await clientConnecte(COMPTABLE);
  const { data: vus } = await comptable.from("retours_terrain").select("id").eq("id", r.id);
  expect(vus).toEqual([]);

  const direction = await clientConnecte(DIRECTION);
  // Insertion directe refusée (pas de policy d'insertion).
  const { error: insertion } = await direction.from("retours_terrain").insert({
    ecole_id: r.ecole_id, genre: "idee", message: "Écrit sans passer par la fonction",
  });
  expect(insertion).not.toBeNull();
  // Modification de son propre retour : aucune ligne touchée.
  const { data: modifiees } = await direction.from("retours_terrain")
    .update({ statut: "traite", reponse: "Je me réponds moi-même" }).eq("id", r.id).select("id");
  expect(modifiees ?? []).toEqual([]);
  expect((await lireRetour()).statut).toBe("nouveau");
  // Les contraintes de la table tiennent aussi par la fonction.
  const { error: genreInconnu } = await direction.rpc("retour_envoyer", { p_genre: "spam", p_message: "Bonjour EduGest" });
  expect(genreInconnu).not.toBeNull();
  const { error: tropCourt } = await direction.rpc("retour_envoyer", { p_genre: "idee", p_message: "  a " });
  expect(tropCourt).not.toBeNull();
});

test("le super-admin lit et répond ; l'auteur voit la réponse dans son centre d'aide", async ({ page }) => {
  const r = await lireRetour();
  const sa = await clientSuperadmin();
  const { data: tous, error } = await sa.from("retours_terrain").select("id, message, ecoles(nom)").eq("id", r.id);
  expect(error).toBeNull();
  expect(tous).toHaveLength(1);
  expect(tous[0].ecoles.nom).toBeTruthy();
  const { data: maj, error: e2 } = await sa.from("retours_terrain")
    .update({ statut: "traite", reponse: REPONSE, repondu_le: new Date().toISOString() }).eq("id", r.id).select("id");
  expect(e2).toBeNull();
  expect(maj).toHaveLength(1);

  await seConnecter(page, DIRECTION);
  await ouvrirRetours(page);
  const carte = page.getByTestId("mon-retour").filter({ hasText: MESSAGE });
  await expect(carte).toContainText("Traité");
  await expect(carte).toContainText("Réponse d'EduGest");
  await expect(carte).toContainText(REPONSE);
});
