// Pont DGECS → EduGest : le comptable colle, dans Comptabilité → Élèves →
// « 🇬🇳 Depuis DGECS », la liste d'une classe copiée sur dgecsecoles.com
// (bouton « copier » : titre de la page, ligne vide, en-tête, une ligne par
// élève). L'élève qu'EduGest connaît déjà reçoit son matricule DGECS, même
// si son nom y est écrit autrement (confirmé par la date de naissance) ;
// l'élève douteux (nom proche, rien pour confirmer) n'est pas déclaré absent :
// le comptable dit qui c'est ; la fiche de chacun est corrigée comme sur DGECS
// (nom, prénoms, naissance, filiation : référence officielle), sauf si le
// comptable décoche ; l'élève absent d'EduGest est inscrit dans la classe,
// avec son matricule DGECS, sa filiation et un matricule d'école.
// On vérifie l'écran ET la base.
//
// Noms, classe, dates et matricules tirés au hasard à chaque passage : le
// spec se relance sur la même base sans retrouver les élèves d'un passage
// précédent.
import { test, expect } from "@playwright/test";
import { toRow } from "../../src/backend/collection-map.js";
import { COMPTABLE, DIRECTION, SECTION, clientAdmin, clientConnecte, ecoleId } from "../donnees.js";
import { ouvrirModule, seConnecter } from "../parcours.js";

const SUFFIXE = String(Date.now()).slice(-5);
// Chiffres → lettres : un nom propre sans chiffres, différent à chaque passage.
const LETTRES = SUFFIXE.replace(/\d/g, (d) => "ABCDEFGHIJ"[d]);
const MOT = LETTRES[0] + LETTRES.slice(1).toLowerCase();
const N = Number(SUFFIXE);
const AN = 2010 + (N % 5);
const JOUR = String(1 + (N % 28)).padStart(2, "0");
const iso = (mois) => `${AN}-${mois}-${JOUR}`;
const fr = (mois) => `${JOUR}/${mois}/${AN}`;

const CLASSE_DGECS = `7ème P${SUFFIXE}`;
// Dans EduGest : un élève au même nom, un au nom écrit autrement (même date),
// un au prénom proche sans date de naissance.
const CONNU = { nom: "BARRY", prenom: `Aliou ${MOT}`, sexe: "M", matricule: `E2E-D${SUFFIXE}`, dateNaissance: iso("03") };
const PROCHE = { nom: "CAMARA", prenom: `Mamadu ${MOT}`, sexe: "M", matricule: `E2E-K${SUFFIXE}`, dateNaissance: iso("05") };
const DOUTE = { nom: "SOUMAH", prenom: `Ibrahim ${MOT}`, sexe: "M", matricule: `E2E-S${SUFFIXE}` };
const MATRICULE_CONNU = `MA${SUFFIXE}101`;
const MATRICULE_NOUVEAU = `MA${SUFFIXE}102`;
const MATRICULE_PROCHE = `MA${SUFFIXE}103`;
const MATRICULE_DOUTE = `MA${SUFFIXE}104`;

// Ce que donne le bouton « copier » de la page « Liste des élèves ».
const COPIE = [
  "MON ESPACE",
  "",
  "N°\tMatricule\tElève\tSexe\tDate de naissance\tLieu de naissance\tPère\tMère\tTéléphone\tActions",
  `1\t${MATRICULE_CONNU}\tALIOU ${LETTRES} BARRY\tM\t${fr("03")}\tLABE\tALPHA\tKADIATOU BALDE\t\tAfficher`,
  `2\t${MATRICULE_NOUVEAU}\tMOUSSA ${LETTRES} YANSANE\tM\t${fr("10")}\tBOKE\tSEKOU\tHAWA CONDE\t\tAfficher`,
  `3\t${MATRICULE_PROCHE}\tMAMADOU ${LETTRES} KAMARA\tM\t${fr("05")}\tKINDIA\tLANSANA\tMARIAMA SYLLA\t\tAfficher`,
  `4\t${MATRICULE_DOUTE}\tIBRAHIMA ${LETTRES} SOUMAH\tM\t${fr("07")}\tFRIA\tMOUSSA\tFANTA KEITA\t\tAfficher`,
].join("\n");

const admin = () => clientAdmin();
const eleveParIen = async (ien) => {
  const { data, error } = await admin().from("eleves")
    .select("nom, prenom, sexe, classe, ien, matricule, filiation, date_naissance, lieu_naissance, statut")
    .eq("ecole_id", await ecoleId()).eq("ien", ien).maybeSingle();
  if (error) throw error;
  return data;
};

test("le comptable recopie une classe de DGECS : noms écrits autrement retrouvés et corrigés, élève manquant inscrit", async ({ page }) => {
  // Préparation : la classe et trois élèves sans matricule DGECS, écrits par
  // la direction (RLS) sous la forme exacte que l'app produit.
  const direction = await clientConnecte(DIRECTION);
  const id = await ecoleId();
  const ligne = (table, item) => ({ ...toRow(table, item).row, ecole_id: id, section: SECTION });
  for (const [table, lignes] of [
    ["classes", [ligne("classes", { nom: CLASSE_DGECS })]],
    ["eleves", [CONNU, PROCHE, DOUTE].map((e) => ligne("eleves", { ...e, classe: CLASSE_DGECS, statut: "Actif" }))],
  ]) {
    const { error } = await direction.from(table).insert(lignes);
    if (error) throw new Error(`${table} : ${error.message}`);
  }
  const { data: doute, error } = await admin().from("eleves").select("id")
    .eq("ecole_id", id).eq("matricule", DOUTE.matricule).single();
  if (error) throw error;

  await seConnecter(page, COMPTABLE);
  await ouvrirModule(page, "Comptabilité");
  await page.getByRole("button", { name: /^Élèves \(\d+\)$/ }).click();
  // La classe choisie dans la liste est reprise par la fenêtre DGECS.
  await page.getByRole("combobox")
    .filter({ has: page.getByRole("option", { name: CLASSE_DGECS, exact: true }) })
    .selectOption(CLASSE_DGECS);
  await expect(page.getByRole("row").filter({ hasText: DOUTE.prenom })).toHaveCount(1);

  await page.getByRole("button", { name: /Depuis DGECS/ }).click();
  await page.getByLabel("Liste copiée sur DGECS").fill(COPIE);

  // Aperçu : le même nom (même date), le nom écrit autrement (même date), le
  // douteux (à vérifier, pas déclaré absent), le seul vraiment absent.
  const lignes = page.getByTestId("ligne-dgecs");
  await expect(lignes).toHaveCount(4);
  const connu = lignes.filter({ hasText: MATRICULE_CONNU });
  await expect(connu).toHaveAttribute("data-etat", "rattacher");
  await expect(connu).toContainText("même date de naissance");
  const proche = lignes.filter({ hasText: MATRICULE_PROCHE });
  await expect(proche).toHaveAttribute("data-etat", "rattacher");
  await expect(proche).toContainText("nom écrit autrement dans EduGest");
  await expect(lignes.filter({ hasText: MATRICULE_DOUTE })).toHaveAttribute("data-etat", "aVerifier");
  await expect(lignes.filter({ hasText: MATRICULE_NOUVEAU })).toHaveAttribute("data-etat", "nouveau");
  await expect(page.getByLabel("Classe des nouveaux élèves")).toHaveValue(CLASSE_DGECS);
  // Personne de la classe n'est déclaré absent de DGECS.
  await expect(page.getByText(/ne sont pas dans cette liste DGECS/)).toHaveCount(0);

  // Fiches corrigées comme sur DGECS, cochées d'office : le comptable garde
  // celle de BARRY telle quelle.
  await expect(proche).toContainText(`Nom : CAMARA → KAMARA`);
  await expect(page.getByRole("button", { name: "Appliquer : 2 matricule(s), 2 fiche(s) corrigée(s), 1 inscription(s)" })).toBeVisible();
  await page.getByLabel(`Corriger la fiche de BARRY Aliou ${MOT} comme sur DGECS`).uncheck();

  // Le douteux : rien d'office ; le comptable dit que c'est bien lui.
  await expect(page.getByRole("button", { name: "Appliquer : 2 matricule(s), 1 fiche(s) corrigée(s), 1 inscription(s)" })).toBeVisible();
  await page.getByLabel(`Que faire de SOUMAH Ibrahima ${MOT} ?`).selectOption(doute.id);
  await page.getByRole("button", { name: "Appliquer : 3 matricule(s), 2 fiche(s) corrigée(s), 1 inscription(s)" }).click();
  await expect(page.getByText("DGECS : 3 matricule(s) posé(s), 2 fiche(s) corrigée(s), 1 élève(s) inscrit(s).")).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "YANSANE" })).toHaveCount(1);

  // Base : le matricule DGECS sur les trois fiches existantes ; BARRY gardée
  // telle quelle (case décochée), les deux autres corrigées comme sur DGECS…
  for (const [ien, eleve] of [[MATRICULE_CONNU, CONNU], [MATRICULE_PROCHE, PROCHE], [MATRICULE_DOUTE, DOUTE]]) {
    await expect.poll(async () => (await eleveParIen(ien))?.matricule, { timeout: 30_000 }).toBe(eleve.matricule);
  }
  const connuEnBase = await eleveParIen(MATRICULE_CONNU);
  expect(connuEnBase).toMatchObject({ nom: CONNU.nom, prenom: CONNU.prenom, classe: CLASSE_DGECS });
  expect(connuEnBase.lieu_naissance || "").toBe("");
  expect(connuEnBase.filiation || "").toBe("");
  expect(await eleveParIen(MATRICULE_PROCHE)).toMatchObject({
    nom: "KAMARA", prenom: `Mamadou ${MOT}`, classe: CLASSE_DGECS, date_naissance: iso("05"),
    lieu_naissance: "Kindia", filiation: "Pere: Lansana / Mere: Mariama Sylla",
  });
  expect(await eleveParIen(MATRICULE_DOUTE)).toMatchObject({
    nom: "SOUMAH", prenom: `Ibrahima ${MOT}`, classe: CLASSE_DGECS, date_naissance: iso("07"),
    lieu_naissance: "Fria", filiation: "Pere: Moussa / Mere: Fanta Keita",
  });

  // … et l'élève manquant inscrit dans la classe, avec ce que DGECS savait.
  await expect.poll(async () => !!(await eleveParIen(MATRICULE_NOUVEAU)), { timeout: 30_000 }).toBe(true);
  const nouveau = await eleveParIen(MATRICULE_NOUVEAU);
  expect(nouveau).toMatchObject({
    nom: "YANSANE", prenom: `Moussa ${MOT}`, sexe: "M", classe: CLASSE_DGECS,
    date_naissance: iso("10"), lieu_naissance: "Boke", statut: "Actif",
    filiation: "Pere: Sekou / Mere: Hawa Conde",
  });
  expect(nouveau.matricule).toBeTruthy();
  expect(nouveau.matricule).not.toBe(MATRICULE_NOUVEAU);
});
