// Enseignant dans PLUSIEURS établissements (décision du 2026-11-18, étape 2) :
// un espace par établissement, reliés par comptes.personne_id ; il voit
// toutes ses classes ensemble (« Toutes mes classes ») et passe de l'un à
// l'autre sans mot de passe. On vérifie ici :
//  - les règles serveur de l'ajout d'un établissement (plafond, code) ;
//  - que le passage d'une école à une AUTRE reste fermé, sauf entre deux
//    espaces enseignants ;
//  - la migration (mes_espaces, mes_classes) ;
//  - la logique de l'écran (regroupement, module d'une classe, formulaire,
//    page à rouvrir après le changement d'espace).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import {
  MAX_ETABLISSEMENTS, baseCodeEnseignant, codeEtablissementSuivant,
  motDePasseInterne, refusAjoutEtablissement, validerNouvelEtablissement,
} from "../supabase/functions/account-manage/etablissements.ts";
import { passageEntreEcolesPermis } from "../supabase/functions/account-manage/rattachement.ts";
import { refusChangement } from "../supabase/functions/account-manage/espaces.ts";
import { codeReserveEnseignant } from "../supabase/functions/inscription/enseignant.ts";
import {
  PAGE_MES_CLASSES, erreurNouvelEtablissement, grouperParEtablissement, moduleDeSection, totauxMesClasses,
} from "../src/components/mes-classes/mes-classes.js";
import { prendreDestination, retenirDestination } from "../src/components/app/destination-espace.js";
import { libelleEspace } from "../src/espaces-comptes.js";

const source = (chemin) => readFileSync(new URL(`../${chemin}`, import.meta.url), "utf8");

// ── Serveur : ajout d'un établissement ──────────────────────────────────────

test("ajout : depuis l'espace d'un enseignant seulement, sous le plafond", () => {
  assert.equal(refusAjoutEtablissement("enseignant", "direction", 1), null);
  assert.equal(refusAjoutEtablissement("enseignant", "direction", MAX_ETABLISSEMENTS - 1), null);
  // Une école ne crée pas d'espaces enseignants pour ses professeurs.
  assert.equal(refusAjoutEtablissement("ecole", "direction", 1)?.status, 403);
  assert.equal(refusAjoutEtablissement(undefined, "direction", 1)?.status, 403);
  assert.equal(refusAjoutEtablissement("enseignant", "parent", 1)?.status, 403);
  const plafond = refusAjoutEtablissement("enseignant", "direction", MAX_ETABLISSEMENTS);
  assert.equal(plafond?.status, 409);
  assert.match(plafond.error, /maximum/);
});

test("ajout : nom, ville et au moins un niveau connu", () => {
  assert.deepEqual(
    validerNouvelEtablissement({ etablissement: "  Lycée 2 Octobre ", ville: " Kindia ", sections: ["lycee", "inconnu", "college"] }),
    { etablissement: "Lycée 2 Octobre", ville: "Kindia", sections: ["college", "lycee"] },
  );
  assert.equal(validerNouvelEtablissement({ ville: "Kindia", sections: ["college"] }).status, 400);
  assert.equal(validerNouvelEtablissement({ etablissement: "X", sections: ["college"] }).status, 400);
  assert.equal(validerNouvelEtablissement({ etablissement: "X", ville: "Y", sections: ["universite"] }).status, 400);
  assert.equal(validerNouvelEtablissement({ etablissement: "X", ville: "Y" }).status, 400);
});

test("ajout : code = numéro de l'enseignant suivi du premier rang libre", () => {
  assert.equal(baseCodeEnseignant("622000111"), "622000111");
  assert.equal(baseCodeEnseignant(" 622000111 "), "622000111");
  assert.equal(baseCodeEnseignant("directeur"), null);
  assert.equal(baseCodeEnseignant("622000111-2"), null);
  assert.equal(codeEtablissementSuivant("622000111", []), "622000111-2");
  assert.equal(codeEtablissementSuivant("622000111", ["622000111-2", "622000111-3"]), "622000111-4");
  // Un établissement retiré libère son rang.
  assert.equal(codeEtablissementSuivant("622000111", ["622000111-3"]), "622000111-2");
});

test("ajout : ces codes sont réservés, une école ne peut pas les prendre", () => {
  for (const code of ["622000111", "622000111-2", "622000111-12"]) assert.equal(codeReserveEnseignant(code), true, code);
  for (const code of ["college-de-kindia", "lycee-2", "2-octobre", "622000111-2-b"]) assert.equal(codeReserveEnseignant(code), false, code);
  assert.match(source("supabase/functions/inscription/index.ts"), /if \(codeReserveEnseignant\(code\)\)/);
});

test("ajout : accès de connexion interne, jamais saisi, long et varié", () => {
  let n = 0;
  const mdp = motDePasseInterne(() => `00000000-0000-4000-8000-00000000000${n++}`);
  assert.ok(mdp.length >= 60);
  for (const famille of [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/]) assert.match(mdp, famille);
  assert.notEqual(motDePasseInterne(), motDePasseInterne());
});

test("ajout : l'Edge lie le nouvel espace à la personne et contrôle avant de créer", () => {
  const index = source("supabase/functions/account-manage/index.ts");
  const bloc = index.slice(index.indexOf('action === "ajouter_etablissement"'), index.indexOf('action === "changer_espace"'));
  assert.ok(bloc.length > 0);
  // Contrôles AVANT toute création.
  assert.ok(bloc.indexOf("refusAjoutEtablissement(") < bloc.indexOf(".insert(ligneEcoleEnseignant(fiche))"));
  assert.ok(bloc.indexOf("validerNouvelEtablissement(") < bloc.indexOf("createUser("));
  // Même personne : le nouveau compte, et l'appelant s'il ne l'était pas.
  assert.match(bloc, /personne_id: personneId/);
  assert.match(bloc, /update\(\{ personne_id: personneId \}\)\.eq\("id", caller\.id\)/);
  // Échec en route : rien ne reste à moitié créé.
  assert.match(bloc, /await annuler\(/);
});

// ── Serveur : changer d'établissement ───────────────────────────────────────

test("changer d'espace : d'une école à une autre, seulement depuis un espace enseignant", () => {
  // Entre ses établissements (deux espaces enseignants).
  assert.equal(passageEntreEcolesPermis("enseignant", "enseignant", "direction"), true);
  // Vers son compte ENSEIGNANT d'une école où ses classes ont été rattachées.
  assert.equal(passageEntreEcolesPermis("enseignant", "ecole", "enseignant"), true);
  // Jamais vers un autre compte de l'école, ni depuis un compte d'école.
  assert.equal(passageEntreEcolesPermis("enseignant", "ecole", "direction"), false);
  assert.equal(passageEntreEcolesPermis("ecole", "enseignant", "direction"), false);
  assert.equal(passageEntreEcolesPermis("ecole", "ecole", "enseignant"), false);
  assert.equal(passageEntreEcolesPermis(undefined, undefined, undefined), false);

  const moi = { id: "a", ecole_id: "e1", user_id: "u-a", role: "direction", personne_id: "p1" };
  const ailleurs = { id: "b", ecole_id: "e2", user_id: "u-b", role: "direction", personne_id: "p1" };
  assert.equal(refusChangement(moi, ailleurs)?.status, 403, "écoles différentes, sans espaces enseignants");
  assert.equal(refusChangement(moi, ailleurs, true), null, "ses deux établissements");
  // Même entre établissements : uniquement vers un compte de la MÊME personne.
  assert.equal(refusChangement(moi, { ...ailleurs, personne_id: "p2" }, true)?.status, 403);
  assert.equal(refusChangement({ ...moi, personne_id: null }, { ...ailleurs, personne_id: null }, true)?.status, 403);
  assert.equal(refusChangement(moi, { ...ailleurs, user_id: null }, true)?.status, 409);

  const index = source("supabase/functions/account-manage/index.ts");
  assert.match(index, /passageEntreEcolesPermis\(typeEspace, ecCible\.type_espace, cible\.role\)/);
  assert.match(index, /refusChangement\(caller, cible, entreEtablissements\)/);
});

// ── Migration ───────────────────────────────────────────────────────────────

test("migration : les espaces d'une autre école ne sont visibles qu'entre espaces enseignants", () => {
  const dossier = new URL("../supabase/migrations/", import.meta.url);
  const fichier = readdirSync(dossier).find((f) => f.endsWith("_enseignant_plusieurs_etablissements.sql"));
  assert.ok(fichier);
  const sql = readFileSync(new URL(fichier, dossier), "utf8");
  // mes_espaces : même école, ou deux espaces enseignants actifs.
  assert.match(sql, /c\.ecole_id = moi\.ecole_id\s+or \(moi\.type_espace = 'enseignant' and e\.type_espace = 'enseignant'/);
  // Anciennes colonnes gardées (le front encore en ligne les lit).
  assert.match(sql, /id uuid, role public\.role_compte, label text, nom text, login text, actuel boolean,/);
  // mes_classes : rien pour un compte d'école.
  assert.match(sql, /where c\.user_id = auth\.uid\(\) and e\.type_espace = 'enseignant'/);
  // Fermées aux visiteurs non connectés.
  assert.match(sql, /revoke all on function public\.mes_espaces\(\) from public, anon;/);
  assert.match(sql, /revoke all on function public\.mes_classes\(\) from public, anon;/);
});

// ── Écran ───────────────────────────────────────────────────────────────────

const LIGNES = [
  { compte_id: "b", ecole_code: "622000111-2", ecole_nom: "Lycée 2 Octobre", actuel: false, classe_id: "c3", section: "lycee", classe: "11ème SS", effectif: 40 },
  { compte_id: "a", ecole_code: "622000111", ecole_nom: "Collège Les Étoiles", actuel: true, classe_id: "c1", section: "college", classe: "7ème A", effectif: 32 },
  { compte_id: "a", ecole_code: "622000111", ecole_nom: "Collège Les Étoiles", actuel: true, classe_id: "c2", section: "college", classe: "8ème A", effectif: "28" },
  { compte_id: "c", ecole_code: "622000111-3", ecole_nom: "École Kaporo", actuel: false, classe_id: null, section: null, classe: null, effectif: null },
];

test("toutes mes classes : un groupe par établissement, le sien d'abord", () => {
  const groupes = grouperParEtablissement(LIGNES);
  assert.deepEqual(groupes.map((g) => g.nom), ["Collège Les Étoiles", "École Kaporo", "Lycée 2 Octobre"]);
  assert.equal(groupes[0].actuel, true);
  assert.deepEqual(groupes[0].classes.map((c) => [c.nom, c.effectif]), [["7ème A", 32], ["8ème A", 28]]);
  // Établissement sans classe : présent, liste vide.
  assert.deepEqual(groupes[1].classes, []);
  assert.equal(groupes[2].code, "622000111-2");
  assert.deepEqual(totauxMesClasses(groupes), { etablissements: 3, classes: 3, eleves: 100 });
  assert.deepEqual(grouperParEtablissement([]), []);
});

test("toutes mes classes : une classe s'ouvre dans le module de sa section", () => {
  assert.equal(moduleDeSection("prescolaire"), "primaire");
  assert.equal(moduleDeSection("primaire"), "primaire");
  assert.equal(moduleDeSection("college"), "secondaire");
  assert.equal(moduleDeSection("lycee"), "secondaire");
  assert.equal(PAGE_MES_CLASSES, "mesclasses");
});

test("ajout d'un établissement : mêmes exigences que le serveur", () => {
  const t = (cle) => cle;
  assert.equal(erreurNouvelEtablissement({ etablissement: "X", ville: "Y", sections: ["college"] }, t), "");
  assert.equal(erreurNouvelEtablissement({ etablissement: " ", ville: "Y", sections: ["college"] }, t), "register.teacher.errors.schoolRequired");
  assert.equal(erreurNouvelEtablissement({ etablissement: "X", ville: "", sections: ["college"] }, t), "register.errors.cityRequired");
  assert.equal(erreurNouvelEtablissement({ etablissement: "X", ville: "Y", sections: [] }, t), "register.teacher.errors.levelRequired");
});

test("changement d'établissement : la page retenue est rouverte une fois, dans les 2 minutes", () => {
  const memoire = new Map();
  const stockage = {
    getItem: (k) => (memoire.has(k) ? memoire.get(k) : null),
    setItem: (k, v) => memoire.set(k, v),
    removeItem: (k) => memoire.delete(k),
  };
  retenirDestination("secondaire", { stockage, maintenant: 1000 });
  // Module pas (encore) présent : gardée pour plus tard.
  assert.equal(prendreDestination(["primaire"], { stockage, maintenant: 2000 }), null);
  assert.equal(prendreDestination(["primaire", "secondaire"], { stockage, maintenant: 3000 }), "secondaire");
  // Rendue une seule fois.
  assert.equal(prendreDestination(["secondaire"], { stockage, maintenant: 4000 }), null);
  // Périmée : oubliée.
  retenirDestination("secondaire", { stockage, maintenant: 0 });
  assert.equal(prendreDestination(["secondaire"], { stockage, maintenant: 3 * 60 * 1000 }), null);
  assert.equal(memoire.size, 0);
  // Sans stockage (navigation privée bloquée) : rien ne casse.
  retenirDestination("secondaire", { stockage: null });
  assert.equal(prendreDestination(["secondaire"], { stockage: null }), null);
});

test("choix d'espace : un établissement s'affiche sous son nom", () => {
  assert.deepEqual(libelleEspace({ type_espace: "enseignant", ecole_nom: "Lycée 2 Octobre", role: "direction" }),
    { icone: "🏫", titre: "Lycée 2 Octobre" });
  // Les comptes d'une école gardent leur libellé de rôle.
  assert.equal(libelleEspace({ type_espace: "ecole", ecole_nom: "École X", role: "direction", label: "Direction" }).titre, "Direction");
});
