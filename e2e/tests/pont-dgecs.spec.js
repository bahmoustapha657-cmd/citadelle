// Pont DGECS → EduGest : le comptable colle, dans Comptabilité → Élèves →
// « 🇬🇳 Depuis DGECS », la liste d'une classe copiée sur dgecsecoles.com
// (bouton « copier » : titre de la page, ligne vide, en-tête, une ligne par
// élève). L'élève qu'EduGest connaît déjà reçoit son matricule DGECS ;
// l'élève absent d'EduGest est inscrit dans la classe, avec son matricule
// DGECS, sa filiation et un matricule d'école. On vérifie l'écran ET la base.
//
// Noms, classe et matricules tirés au hasard à chaque passage : le spec se
// relance sur la même base sans retrouver les élèves d'un passage précédent.
import { test, expect } from "@playwright/test";
import { toRow } from "../../src/backend/collection-map.js";
import { COMPTABLE, DIRECTION, SECTION, clientAdmin, clientConnecte, ecoleId } from "../donnees.js";
import { ouvrirModule, seConnecter } from "../parcours.js";

const SUFFIXE = String(Date.now()).slice(-5);
// Chiffres → lettres : un nom propre sans chiffres, différent à chaque passage.
const LETTRES = SUFFIXE.replace(/\d/g, (d) => "ABCDEFGHIJ"[d]);
const MOT = LETTRES[0] + LETTRES.slice(1).toLowerCase();
const CLASSE_DGECS = `7ème P${SUFFIXE}`;
const CONNU = { nom: "BARRY", prenom: `Aliou ${MOT}`, sexe: "M", matricule: `E2E-D${SUFFIXE}`, dateNaissance: "2012-03-04" };
const MATRICULE_CONNU = `MA${SUFFIXE}101`;
const MATRICULE_NOUVEAU = `MA${SUFFIXE}102`;

// Ce que donne le bouton « copier » de la page « Liste des élèves ».
const COPIE = [
  "MON ESPACE",
  "",
  "N°\tMatricule\tElève\tSexe\tDate de naissance\tLieu de naissance\tPère\tMère\tTéléphone\tActions",
  `1\t${MATRICULE_CONNU}\tALIOU ${LETTRES} BARRY\tM\t04/03/2012\tLABE\tALPHA\tKADIATOU BALDE\t\tAfficher`,
  `2\t${MATRICULE_NOUVEAU}\tMOUSSA ${LETTRES} YANSANE\tM\t09/10/2011\tBOKE\tSEKOU\tHAWA CONDE\t\tAfficher`,
].join("\n");

const eleveParIen = async (ien) => {
  const admin = clientAdmin();
  const { data, error } = await admin.from("eleves")
    .select("nom, prenom, sexe, classe, ien, matricule, filiation, date_naissance, lieu_naissance, statut")
    .eq("ecole_id", await ecoleId(admin)).eq("ien", ien).maybeSingle();
  if (error) throw error;
  return data;
};

test("le comptable recopie une classe de DGECS : matricule posé sur l'élève connu, élève manquant inscrit", async ({ page }) => {
  // Préparation : la classe et un élève sans matricule DGECS, écrits par la
  // direction (RLS) sous la forme exacte que l'app produit.
  const direction = await clientConnecte(DIRECTION);
  const id = await ecoleId();
  const ligne = (table, item) => ({ ...toRow(table, item).row, ecole_id: id, section: SECTION });
  for (const [table, lignes] of [
    ["classes", [ligne("classes", { nom: CLASSE_DGECS })]],
    ["eleves", [ligne("eleves", { ...CONNU, classe: CLASSE_DGECS, statut: "Actif" })]],
  ]) {
    const { error } = await direction.from(table).insert(lignes);
    if (error) throw new Error(`${table} : ${error.message}`);
  }

  await seConnecter(page, COMPTABLE);
  await ouvrirModule(page, "Comptabilité");
  await page.getByRole("button", { name: /^Élèves \(\d+\)$/ }).click();
  // La classe choisie dans la liste est reprise par la fenêtre DGECS.
  await page.getByRole("combobox")
    .filter({ has: page.getByRole("option", { name: CLASSE_DGECS, exact: true }) })
    .selectOption(CLASSE_DGECS);
  await expect(page.getByRole("row").filter({ hasText: CONNU.prenom })).toHaveCount(1);

  await page.getByRole("button", { name: /Depuis DGECS/ }).click();
  await page.getByLabel("Liste copiée sur DGECS").fill(COPIE);

  // Aperçu : l'élève connu retrouvé (même date de naissance), l'autre absent.
  const lignes = page.getByTestId("ligne-dgecs");
  await expect(lignes).toHaveCount(2);
  const connu = lignes.filter({ hasText: MATRICULE_CONNU });
  await expect(connu).toHaveAttribute("data-etat", "rattacher");
  await expect(connu).toContainText("même date de naissance");
  await expect(lignes.filter({ hasText: MATRICULE_NOUVEAU })).toHaveAttribute("data-etat", "nouveau");
  await expect(page.getByLabel("Classe des nouveaux élèves")).toHaveValue(CLASSE_DGECS);

  await page.getByRole("button", { name: "Appliquer : 1 matricule(s), 1 inscription(s)" }).click();
  await expect(page.getByText("DGECS : 1 matricule(s) posé(s), 1 élève(s) inscrit(s).")).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "YANSANE" })).toHaveCount(1);

  // Base : le matricule DGECS sur la fiche existante (rien d'autre ne change)…
  await expect.poll(async () => (await eleveParIen(MATRICULE_CONNU))?.matricule, { timeout: 30_000 }).toBe(CONNU.matricule);
  const connuEnBase = await eleveParIen(MATRICULE_CONNU);
  expect(connuEnBase).toMatchObject({ nom: CONNU.nom, prenom: CONNU.prenom, classe: CLASSE_DGECS });

  // … et l'élève manquant inscrit dans la classe, avec ce que DGECS savait.
  await expect.poll(async () => !!(await eleveParIen(MATRICULE_NOUVEAU)), { timeout: 30_000 }).toBe(true);
  const nouveau = await eleveParIen(MATRICULE_NOUVEAU);
  expect(nouveau).toMatchObject({
    nom: "YANSANE", prenom: `Moussa ${MOT}`, sexe: "M", classe: CLASSE_DGECS,
    date_naissance: "2011-10-09", lieu_naissance: "Boke", statut: "Actif",
    filiation: "Pere: Sekou / Mere: Hawa Conde",
  });
  expect(nouveau.matricule).toBeTruthy();
  expect(nouveau.matricule).not.toBe(MATRICULE_NOUVEAU);
});
