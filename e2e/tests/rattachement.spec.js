// Rattachement à l'école qui adopte EduGest (étape 3) : une enseignante qui
// tenait sa classe dans son espace personnel propose de la rattacher à son
// école (code de l'école) ; la direction relie ses élèves à ceux de l'école
// (un relié, un laissé de côté) et accepte. Ses notes passent chez l'école,
// son compte enseignant y est créé et relié au sien, son espace est fermé,
// et son numéro et son mot de passe habituels l'emmènent dans le portail
// enseignant de l'école. Le passage reste à sens unique.
//
// Données tirées au hasard à chaque passage (numéro, classe) : le spec se
// relance sur la même base sans tomber sur les élèves d'un passage précédent.
import { test, expect } from "@playwright/test";
import { toRow } from "../../src/backend/collection-map.js";
import {
  ANNEE, COMPTABLE, DIRECTION, ECOLE, appelerAccountManage, appelerInscription, clientAdmin, clientConnecte, ecoleId,
} from "../donnees.js";
import { seConnecter } from "../parcours.js";

const SUFFIXE = String(Date.now()).slice(-5);
const NUMERO = `6224${SUFFIXE}`;
const ENSEIGNANTE = {
  nom: "Mariama SOUMAH",
  telephone: `${NUMERO.slice(0, 3)} ${NUMERO.slice(3, 5)} ${NUMERO.slice(5, 7)} ${NUMERO.slice(7)}`,
  email: `mariama.${SUFFIXE}@example.com`,
  etablissement: "Ecole E2E — mes classes",
  ville: "Conakry",
  mdp: "E2e-Mariama-2026",
};
const COMPTE = { login: NUMERO, mdp: ENSEIGNANTE.mdp, code: NUMERO };
// Même nom de classe des deux côtés : la direction la retrouve d'elle-même.
const CLASSE = `8ème R${SUFFIXE}`;
// Chez l'enseignante : DIALLO est aussi élève de l'école (écrit autrement),
// BALDE ne l'est pas — il est laissé de côté.
const DIALLO = { nom: "DIALLO", prenom: "Aissatou", sexe: "F" };
const BALDE = { nom: "BALDE", prenom: "Thierno", sexe: "M" };
const DIALLO_ECOLE = { nom: "Diallo", prenom: "Aïssatou", sexe: "F", matricule: `E2E-R${SUFFIXE}-1` };
const SYLLA_ECOLE = { nom: "SYLLA", prenom: "Binta", sexe: "F", matricule: `E2E-R${SUFFIXE}-2` };
const MATHS = "Mathématiques";

test.describe.configure({ mode: "serial" });

const admin = () => clientAdmin();
const lireEspace = async () => {
  const { data, error } = await admin().from("ecoles")
    .select("id, actif, type_espace, extra").eq("code", NUMERO).maybeSingle();
  if (error) throw error;
  return data;
};
const compteDeLEspace = async () => {
  const { data, error } = await admin().from("comptes")
    .select("id, personne_id").eq("ecole_id", (await lireEspace()).id).single();
  if (error) throw error;
  return data;
};
const eleveEcole = async (matricule) => {
  const { data, error } = await admin().from("eleves").select("id")
    .eq("ecole_id", await ecoleId()).eq("matricule", matricule).single();
  if (error) throw error;
  return data.id;
};
const demandes = async () => {
  const { data, error } = await admin().from("rattachements")
    .select("id, statut, ecole_id, bilan").eq("espace_id", (await lireEspace()).id);
  if (error) throw error;
  return data;
};

test("préparation : sa classe et ses notes dans son espace, la même classe à l'école", async () => {
  const r = await appelerInscription({
    typeEspace: "enseignant", nomEnseignant: ENSEIGNANTE.nom, telephone: ENSEIGNANTE.telephone,
    email: ENSEIGNANTE.email, etablissement: ENSEIGNANTE.etablissement, ville: ENSEIGNANTE.ville,
    sections: ["college"], mdp: ENSEIGNANTE.mdp,
  });
  expect(r.status).toBe(200);

  // Son espace : la classe, deux élèves, des notes (dont une d'une matière
  // que l'école n'a pas), une absence et une appréciation.
  const enseignante = await clientConnecte(COMPTE);
  const { id: espace } = await lireEspace();
  const ligne = (table, item) => ({ ...toRow(table, item).row, ecole_id: espace, section: "college" });
  const ecrire = async (table, lignes) => {
    const { data, error } = await enseignante.from(table).insert(lignes).select("id");
    if (error) throw new Error(`${table} : ${error.message}`);
    return data;
  };
  await ecrire("classes", [ligne("classes", { nom: CLASSE })]);
  const [diallo, balde] = await ecrire("eleves", [DIALLO, BALDE].map((e) => ligne("eleves", { ...e, classe: CLASSE, statut: "Actif" })));
  const note = (eleveId, matiere, type, valeur) => ligne("notes", { eleveId, matiere, type, periode: "T1", note: valeur, annee: ANNEE });
  await ecrire("notes", [
    note(diallo.id, MATHS, "Devoir", 14), note(diallo.id, MATHS, "Composition", 12),
    note(diallo.id, "Dessin", "Devoir", 16), note(balde.id, MATHS, "Devoir", 9),
  ]);
  await ecrire("absences", [ligne("absences", { eleveId: diallo.id, type: "absence", date: "2025-11-03", justifie: false, matiere: MATHS })]);
  await ecrire("appreciations", [ligne("appreciations", { eleveId: diallo.id, periode: "T1", texte: "Travail sérieux.", annee: ANNEE })]);

  // L'école : la même classe, avec DIALLO (écrite à sa façon) et une autre élève.
  const direction = await clientConnecte(DIRECTION);
  const id = await ecoleId();
  const ligneEcole = (table, item) => ({ ...toRow(table, item).row, ecole_id: id, section: "college" });
  const { error: eClasse } = await direction.from("classes").insert(ligneEcole("classes", { nom: CLASSE }));
  if (eClasse) throw new Error(`classes : ${eClasse.message}`);
  const { error: eEleves } = await direction.from("eleves").insert([DIALLO_ECOLE, SYLLA_ECOLE]
    .map((e) => ligneEcole("eleves", { ...e, classe: CLASSE, statut: "Actif", inscriptionPayee: true })));
  if (eEleves) throw new Error(`eleves : ${eEleves.message}`);
});

test("le serveur refuse une demande hors de son espace, ou vers un code qui n'est pas une école", async () => {
  const depuisEcole = await appelerAccountManage(DIRECTION, { action: "demander_rattachement", codeEcole: NUMERO });
  expect(depuisEcole.status).toBe(403);
  const versSonEspace = await appelerAccountManage(COMPTE, { action: "demander_rattachement", codeEcole: NUMERO });
  expect(versSonEspace.status).toBe(400);
  const inconnu = await appelerAccountManage(COMPTE, { action: "demander_rattachement", codeEcole: `inconnue-${SUFFIXE}` });
  expect(inconnu.status).toBe(404);
  expect(await demandes()).toEqual([]);
  // Aucune lecture directe des demandes par un compte.
  const { data } = await (await clientConnecte(DIRECTION)).from("rattachements").select("id");
  expect(data ?? []).toEqual([]);
});

test("elle propose de rattacher sa classe depuis « Toutes mes classes »", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("Ex. : citadelle").fill(ENSEIGNANTE.telephone);
  await expect(page.getByText(ENSEIGNANTE.etablissement).first()).toBeVisible();
  await page.getByPlaceholder("Identifiant, téléphone ou e-mail").fill(ENSEIGNANTE.telephone);
  await page.getByPlaceholder("Votre mot de passe").fill(ENSEIGNANTE.mdp);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page.getByRole("button", { name: /Se déconnecter/ })).toBeVisible({ timeout: 30_000 });

  const main = page.getByRole("main");
  await page.getByRole("navigation").getByRole("button", { name: /Toutes mes classes/ }).click();
  await expect(main.getByRole("button", { name: new RegExp(CLASSE) })).toBeVisible({ timeout: 30_000 });
  await main.getByRole("button", { name: "🏫 Mon établissement utilise EduGest" }).click();
  // Code tapé à sa façon : majuscules, espaces.
  await page.getByRole("textbox", { name: "Code de l'école" }).fill(` ${ECOLE.code.toUpperCase()} `);
  await page.getByRole("button", { name: "📨 Envoyer la demande" }).click();
  await expect(page.getByText(`Demande envoyée à ${ECOLE.nom} : la direction va l'examiner.`)).toBeVisible({ timeout: 30_000 });
  await expect(main.getByText(`⏳ Demande envoyée à ${ECOLE.nom}, en attente de la direction`)).toBeVisible({ timeout: 30_000 });

  const [demande] = await demandes();
  expect(demande).toMatchObject({ statut: "en_attente", ecole_id: await ecoleId() });

  // Une seule demande à la fois ; seule la direction de l'école la traite.
  expect((await appelerAccountManage(COMPTE, { action: "demander_rattachement", codeEcole: ECOLE.code })).status).toBe(409);
  expect((await appelerAccountManage(COMPTABLE, { action: "refuser_rattachement", demandeId: demande.id })).status).toBe(403);
  expect((await appelerAccountManage(COMPTE, { action: "accepter_rattachement", demandeId: demande.id })).status).toBe(403);
  expect((await demandes())[0].statut).toBe("en_attente");
});

test("la direction relie ses élèves et accepte : notes reçues, compte créé, espace fermé", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await seConnecter(page, DIRECTION);
  const bandeau = page.getByRole("status").filter({ hasText: `${ENSEIGNANTE.nom} propose de rattacher` });
  await expect(bandeau).toBeVisible({ timeout: 30_000 });
  await bandeau.getByRole("button", { name: "Examiner" }).click();

  // Rapprochement proposé : la classe et DIALLO retrouvées, BALDE laissé de
  // côté, la matière inconnue de l'école aussi ; son compte à créer.
  const idDiallo = await eleveEcole(DIALLO_ECOLE.matricule);
  await expect(page.getByLabel(`Classe de l'école pour ${CLASSE}`)).toHaveValue(CLASSE, { timeout: 30_000 });
  await expect(page.getByLabel("Élève de l'école pour DIALLO Aissatou")).toHaveValue(idDiallo);
  await expect(page.getByLabel("Élève de l'école pour BALDE Thierno")).toHaveValue("");
  await expect(page.getByLabel(`Matière de l'école pour ${MATHS}`)).toHaveValue(MATHS);
  await expect(page.getByLabel("Matière de l'école pour Dessin")).toHaveValue("");
  await expect(page.getByLabel(`Créer son compte enseignant (identifiant : ${NUMERO})`)).toBeChecked();
  await expect(page.getByRole("textbox", { name: "Nom", exact: true })).toHaveValue("SOUMAH");
  await expect(page.getByRole("textbox", { name: "Prénom", exact: true })).toHaveValue("Mariama");
  await page.getByLabel("Matière enseignée", { exact: true }).selectOption(MATHS);

  await page.getByRole("button", { name: "✅ Rattacher" }).click();
  await expect(page.getByText(`Les classes de ${ENSEIGNANTE.nom} sont rattachées à l'école.`)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Notes reçues : 2 /)).toBeVisible();

  // Base : la demande, les notes de DIALLO en Mathématiques seulement.
  const [demande] = await demandes();
  expect(demande.statut).toBe("acceptee");
  expect(demande.bilan).toMatchObject({ eleves: { relies: 1, total: 2 }, notes: { copiees: 2, dejaPresentes: 0, total: 4 }, absences: 1, appreciations: 1 });
  const { data: notes } = await admin().from("notes").select("matiere, type, periode, note, section, enseignant_nom").eq("eleve_id", idDiallo);
  expect(notes.map((n) => `${n.matiere}|${n.type}|${n.periode}|${Number(n.note)}`).sort())
    .toEqual([`${MATHS}|Composition|T1|12`, `${MATHS}|Devoir|T1|14`]);
  expect(notes.every((n) => n.section === "college" && n.enseignant_nom === ENSEIGNANTE.nom)).toBe(true);
  const { data: notesSylla } = await admin().from("notes").select("id").eq("eleve_id", await eleveEcole(SYLLA_ECOLE.matricule));
  expect(notesSylla).toEqual([]);
  const { data: absences } = await admin().from("absences").select("type, date").eq("eleve_id", idDiallo);
  expect(absences).toHaveLength(1);
  const { data: appreciations } = await admin().from("appreciations").select("texte").eq("eleve_id", idDiallo);
  expect(appreciations.map((a) => a.texte)).toEqual(["Travail sérieux."]);

  // Son compte enseignant dans l'école, relié au sien ; ses classes attribuées.
  const { data: compte } = await admin().from("comptes")
    .select("id, role, personne_id, user_id, premiere_co, sections, extra")
    .eq("ecole_id", await ecoleId()).eq("login", NUMERO).single();
  expect(compte).toMatchObject({ role: "enseignant", premiere_co: false, sections: ["college"] });
  expect(compte.extra.classesRattachees).toEqual([CLASSE]);
  const sien = await compteDeLEspace();
  expect(sien.personne_id).toBeTruthy();
  expect(compte.personne_id).toBe(sien.personne_id);
  const { data: attribuees } = await admin().from("enseignant_classes").select("section, classe").eq("compte_id", compte.id);
  expect(attribuees).toEqual([{ section: "college", classe: CLASSE }]);

  // Son espace : fermé, rien d'effacé.
  const espace = await lireEspace();
  expect(espace.actif).toBe(false);
  expect(espace.extra.rattachement).toMatchObject({ ecoleCode: ECOLE.code, ecoleNom: ECOLE.nom, demandeId: demande.id });
  const { count } = await admin().from("notes").select("id", { count: "exact", head: true }).eq("ecole_id", espace.id);
  expect(count).toBe(4);

  // Le bandeau disparaît une fois la demande traitée.
  await page.getByRole("button", { name: "Fermer", exact: true }).click();
  await expect(bandeau).toHaveCount(0);
});

test("sens unique : de son espace au compte de l'école, jamais l'inverse", async () => {
  // Son espace fermé ne redemande pas.
  expect((await appelerAccountManage(COMPTE, { action: "demander_rattachement", codeEcole: ECOLE.code })).status).toBe(409);

  // Depuis son espace (fermé) : le compte de l'école est dans ses espaces.
  const { data: depuisEspace, error } = await (await clientConnecte(COMPTE)).rpc("mes_espaces");
  expect(error).toBeNull();
  const versEcole = depuisEspace.find((e) => e.ecole_code === ECOLE.code);
  expect(versEcole).toMatchObject({ role: "enseignant" });

  // Depuis le compte de l'école (mot de passe posé ici pour le test) : ni son
  // espace dans mes_espaces, ni le passage vers lui.
  const { data: compteEcole } = await admin().from("comptes").select("user_id").eq("id", versEcole.id).single();
  const mdpEcole = `E2e-Ecole-${SUFFIXE}`;
  const { error: eMdp } = await admin().auth.admin.updateUserById(compteEcole.user_id, { password: mdpEcole });
  expect(eMdp).toBeNull();
  const DANS_ECOLE = { login: NUMERO, mdp: mdpEcole, code: ECOLE.code };
  const { data: depuisEcole } = await (await clientConnecte(DANS_ECOLE)).rpc("mes_espaces");
  expect(depuisEcole.map((e) => e.ecole_code)).toEqual([ECOLE.code]);
  const sien = await compteDeLEspace();
  expect((await appelerAccountManage(DANS_ECOLE, { action: "changer_espace", compteId: sien.id })).status).toBe(403);
});

test("son numéro et son mot de passe habituels l'emmènent dans le portail enseignant de l'école", async ({ page }) => {
  // Par le code de son espace (fermé) : aucune fiche affichée, la connexion
  // passe quand même.
  await page.goto("/");
  await page.getByPlaceholder("Ex. : citadelle").fill(ENSEIGNANTE.telephone);
  await page.getByPlaceholder("Identifiant, téléphone ou e-mail").fill(ENSEIGNANTE.telephone);
  await page.getByPlaceholder("Votre mot de passe").fill(ENSEIGNANTE.mdp);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page.getByText("Portail enseignant —")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(ECOLE.nom, { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: /Mes élèves/ }).first().click();
  await expect(page.getByText(/Aïssatou/).first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Se déconnecter", exact: true }).click();
  await expect(page.getByPlaceholder("Votre mot de passe")).toBeVisible({ timeout: 30_000 });

  // Par le code de l'école : même arrivée.
  await page.getByPlaceholder("Ex. : citadelle").fill(ECOLE.code);
  await expect(page.getByText(ECOLE.nom).first()).toBeVisible();
  await page.getByPlaceholder("Identifiant, téléphone ou e-mail").fill(ENSEIGNANTE.telephone);
  await page.getByPlaceholder("Votre mot de passe").fill(ENSEIGNANTE.mdp);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page.getByText("Portail enseignant —")).toBeVisible({ timeout: 30_000 });
});
