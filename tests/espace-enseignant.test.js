// Espace d'un ENSEIGNANT INDÉPENDANT (décision du 2026-11-18) : un enseignant
// seul ouvre son espace gratuit, même si son école n'utilise pas EduGest.
// C'est une petite école (ecoles.type_espace = 'enseignant') dont il est
// l'unique compte. On vérifie ici :
//  - l'inscription côté serveur (numéro = code = identifiant, sections) ;
//  - le refus côté serveur de tout autre compte (parents, personnel) ;
//  - ce que l'écran montre et cache ;
//  - la limite d'élèves et le retrait automatique des « non réinscrits »,
//    qui videraient ses classes (personne n'y paie rien).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import {
  codeEspaceEnseignant, ligneCompteEnseignant, ligneEcoleEnseignant, validerInscriptionEnseignant,
} from "../supabase/functions/inscription/enseignant.ts";
import { refusEspaceEnseignant } from "../supabase/functions/account-manage/espace-enseignant.ts";
import {
  estEspaceEnseignant, ongletEcoleOuvert, ongletParametresOuvert, premierModuleEspaceEnseignant,
} from "../src/espace-enseignant.js";
import { getRoleLabelForSchool, isModuleOuvertPourEcole, MODULES } from "../src/constants.js";
import { codeEcoleSaisi } from "../src/components/connexion/code-ecole.js";
import { classeRetenue, lireLigneEleve, lireListeEleves } from "../src/components/ecole/eleves-tab/liste-eleves-collee.js";
import { corpsInscriptionEnseignant, erreurEnseignant } from "../src/inscription/inscription-validation.js";
import { computePlanInfo } from "../src/components/app/app-shell-plan.js";
import { regleEcartement } from "../src/ecartes-non-reinscrits.js";

const FORM = {
  nomEnseignant: "Mamadou Bah", telephone: "+224 622 12 34 56", email: "mamadou@example.com",
  etablissement: "Groupe scolaire Les Étoiles", ville: "Conakry", pays: "Guinée",
  sections: ["college", "lycee"], mdp: "motdepasse1",
};

// ── Inscription (serveur) ───────────────────────────────────────────────────

test("inscription : le numéro, écrit à sa façon, devient le code et l'identifiant", () => {
  for (const tel of ["622123456", "622 12 34 56", "+224 622 12 34 56", "00224622123456"]) {
    assert.equal(codeEspaceEnseignant(tel), "622123456", tel);
  }
  // Numéro étranger : ses seuls chiffres.
  assert.equal(codeEspaceEnseignant("+221 77 123 45 67"), "221771234567");
  assert.equal(codeEspaceEnseignant("12 34"), null);
  assert.equal(codeEspaceEnseignant(""), null);

  const f = validerInscriptionEnseignant(FORM);
  assert.ok(!("error" in f));
  assert.equal(f.code, "622123456");
  assert.equal(f.login, "622123456");
  assert.equal(f.telephone, "+224622123456");
});

test("inscription : champs requis et niveaux connus seulement", () => {
  const sans = (champ, valeur = "") => validerInscriptionEnseignant({ ...FORM, [champ]: valeur });
  assert.equal(sans("nomEnseignant").status, 400);
  assert.equal(sans("etablissement").status, 400);
  assert.equal(sans("ville").status, 400);
  assert.equal(sans("telephone", "12").status, 400);
  assert.equal(sans("email", "pas-un-email").status, 400);
  assert.equal(sans("mdp", "court").status, 400);
  assert.equal(sans("sections", []).status, 400);
  assert.equal(sans("sections", ["universite"]).status, 400);
  const f = validerInscriptionEnseignant({ ...FORM, sections: ["lycee", "inconnue", "primaire"] });
  assert.deepEqual(f.sections, ["primaire", "lycee"]);
});

test("inscription : espace enseignant gratuit, sans retrait des non réinscrits", () => {
  const f = validerInscriptionEnseignant(FORM);
  const ecole = ligneEcoleEnseignant(f, 1);
  assert.equal(ecole.type_espace, "enseignant");
  assert.equal(ecole.plan, "gratuit");
  assert.equal(ecole.actif, true);
  assert.equal(ecole.code, "622123456");
  assert.equal(ecole.nom, "Groupe scolaire Les Étoiles");
  assert.deepEqual(ecole.extra.sectionsActives, ["college", "lycee"]);
  assert.equal(ecole.extra.responsable, "Mamadou Bah");
  // Personne ne paie rien dans un espace enseignant : sans ce réglage, tous
  // ses élèves quitteraient leurs classes un mois après la rentrée.
  const info = { ...ecole.extra, anneeScolaire: "2026-2027", moisDebut: "Octobre" };
  const regle = regleEcartement(info, "2026-2027", new Date(2027, 5, 1));
  assert.equal(regle.toutes, false);
  assert.deepEqual(regle.classes, []);
  // Une école ordinaire, elle, retire ses non réinscrits.
  assert.equal(regleEcartement({ anneeScolaire: "2026-2027" }, "2026-2027", new Date(2027, 5, 1)).toutes, true);

  const compte = ligneCompteEnseignant(f, "u-1", "e-1");
  assert.equal(compte.role, "direction");
  assert.equal(compte.label, "Enseignant");
  assert.equal(compte.login, "622123456");
  assert.equal(compte.premiere_co, false);
  assert.equal(compte.email, "mamadou@example.com");
});

test("inscription : un code d'école ne peut pas être un simple numéro (réservé aux enseignants)", () => {
  const source = readFileSync(new URL("../supabase/functions/inscription/index.ts", import.meta.url), "utf8");
  assert.match(source, /if \(codeReserveEnseignant\(code\)\)/);
  assert.match(source, /corps\.typeEspace === "enseignant"/);
});

// ── Gestion des comptes (serveur) ───────────────────────────────────────────

test("comptes : un espace enseignant n'a que le compte de l'enseignant", () => {
  for (const action of ["create", "rattacher_parent", "fusionner_parents", "relier_comptes"]) {
    assert.equal(refusEspaceEnseignant("enseignant", action, "direction")?.status, 403, action);
  }
  // Son propre mot de passe, et le superadmin : toujours permis.
  assert.equal(refusEspaceEnseignant("enseignant", "reset_password", "direction"), null);
  assert.equal(refusEspaceEnseignant("enseignant", "create", "superadmin"), null);
  // Une école ordinaire ne change pas (ni avant la migration : undefined).
  assert.equal(refusEspaceEnseignant("ecole", "create", "direction"), null);
  assert.equal(refusEspaceEnseignant(undefined, "create", "direction"), null);
});

test("migration : le type d'espace ne se modifie pas depuis l'école", () => {
  const dossier = new URL("../supabase/migrations/", import.meta.url);
  const fichier = readdirSync(dossier).find((f) => f.endsWith("_espace_enseignant.sql"));
  assert.ok(fichier);
  const sql = readFileSync(new URL(fichier, dossier), "utf8");
  assert.match(sql, /add column if not exists type_espace text not null default 'ecole'/);
  assert.match(sql, /check \(type_espace in \('ecole', 'enseignant'\)\)/);
  assert.match(sql, /new\.type_espace is distinct from old\.type_espace/);
  // La garde garde ses autres règles (plan, réactivation, code immuable).
  for (const regle of ["new.plan is distinct from old.plan", "new.actif = true", "new.code is distinct from old.code"]) {
    assert.ok(sql.includes(regle), regle);
  }
});

// ── Écran ───────────────────────────────────────────────────────────────────

const ESPACE = { typeEspace: "enseignant", sectionsActives: ["college"] };

test("écran : un espace enseignant ne montre que sa classe et ses paramètres", () => {
  assert.equal(estEspaceEnseignant(ESPACE), true);
  assert.equal(estEspaceEnseignant({ typeEspace: "ecole" }), false);
  assert.equal(estEspaceEnseignant({}), false);
  const ouverts = MODULES.map((m) => m.id).filter((id) => isModuleOuvertPourEcole(id, ESPACE));
  assert.deepEqual(ouverts, ["parametres", "secondaire"]);
  // Une école ordinaire garde tous ses modules.
  for (const id of ["compta", "admin_panel", "fondation", "messages", "accueil"]) {
    assert.equal(isModuleOuvertPourEcole(id, { typeEspace: "ecole" }), true, id);
  }
  // On arrive sur sa classe, pas sur les paramètres.
  assert.equal(premierModuleEspaceEnseignant(["parametres", "secondaire"]), "secondaire");
  assert.equal(premierModuleEspaceEnseignant(["parametres"]), "parametres");
});

test("écran : onglets sans objet pour un enseignant seul", () => {
  for (const id of ["ens", "enseignements", "emploidutemps", "attestations"]) {
    assert.equal(ongletEcoleOuvert(ESPACE, id), false, id);
    assert.equal(ongletEcoleOuvert({}, id), true, id);
  }
  for (const id of ["classes", "eleves", "notes", "bulletins", "matieres", "discipline"]) {
    assert.equal(ongletEcoleOuvert(ESPACE, id), true, id);
  }
  for (const id of ["notifications", "paiement", "accueil", "officiel"]) {
    assert.equal(ongletParametresOuvert(ESPACE, id), false, id);
  }
  for (const id of ["identite", "evaluations", "affichage"]) {
    assert.equal(ongletParametresOuvert(ESPACE, id), true, id);
  }
});

test("écran : pas de limite d'élèves dans un espace enseignant", () => {
  const t = (cle, defaut) => defaut ?? cle;
  const espace = computePlanInfo({ schoolInfoState: { ...ESPACE, plan: "gratuit" }, nowTs: Date.now(), totalElevesActifs: 480, t });
  assert.equal(espace.eleveLimit, Infinity);
  assert.equal(espace.peutAjouterEleve, true);
  const ecole = computePlanInfo({ schoolInfoState: { plan: "gratuit" }, nowTs: Date.now(), totalElevesActifs: 480, t });
  assert.equal(ecole.eleveLimit, 50);
  assert.equal(ecole.peutAjouterEleve, false);
});

// ── Connexion ───────────────────────────────────────────────────────────────

test("connexion : le numéro tapé comme code école retrouve l'espace", () => {
  assert.equal(codeEcoleSaisi("622 12 34 56"), "622123456");
  assert.equal(codeEcoleSaisi(" +224 622 12 34 56 "), "622123456");
  assert.equal(codeEcoleSaisi("622123456"), "622123456");
  // Un code d'école ordinaire ne change pas.
  assert.equal(codeEcoleSaisi("  Ecole-E2E "), "ecole-e2e");
  assert.equal(codeEcoleSaisi("superadmin"), "superadmin");
  assert.equal(codeEcoleSaisi(""), "");
});

// ── Formulaire d'inscription (écran) ────────────────────────────────────────

test("formulaire : mêmes exigences que le serveur", () => {
  const form = { ...FORM, adminMdp: "motdepasse1", adminMdp2: "motdepasse1" };
  const t = (cle) => cle;
  assert.equal(erreurEnseignant(form, t), "");
  assert.notEqual(erreurEnseignant({ ...form, sections: [] }, t), "");
  assert.notEqual(erreurEnseignant({ ...form, adminMdp2: "autre" }, t), "");
  assert.notEqual(erreurEnseignant({ ...form, email: "x" }, t), "");
  assert.notEqual(erreurEnseignant({ ...form, etablissement: " " }, t), "");
  // Le corps envoyé passe la validation du serveur.
  const corps = corpsInscriptionEnseignant(form);
  assert.equal(corps.typeEspace, "enseignant");
  assert.ok(!("error" in validerInscriptionEnseignant(corps)));
});

// ── Liste d'élèves tapée ou collée ──────────────────────────────────────────

test("liste d'élèves : NOM Prénom, sexe facultatif à la fin", () => {
  assert.deepEqual(
    lireLigneEleve("BAH Aminata F"),
    { nom: "BAH", prenom: "Aminata", sexe: "F", sexeIndique: true, ligne: "BAH Aminata F" },
  );
  const l = lireLigneEleve("DIALLO Mamadou Saliou");
  assert.equal(l.nom, "DIALLO");
  assert.equal(l.prenom, "Mamadou Saliou");
  assert.equal(l.sexe, "M");
  assert.equal(l.sexeIndique, false);
  // Numéro d'ordre en tête.
  assert.equal(lireLigneEleve("12. CAMARA Fatoumata fille").prenom, "Fatoumata");
  assert.equal(lireLigneEleve("3) SOW Ibrahima G").sexe, "M");
  // Prénom d'abord.
  const p = lireLigneEleve("Aminata BAH F", { prenomDabord: true });
  assert.equal(p.nom, "BAH");
  assert.equal(p.prenom, "Aminata");
  // Ligne vide ignorée, mot seul refusé.
  assert.equal(lireLigneEleve("   "), null);
  assert.ok(lireLigneEleve("BAH").erreur);
});

test("liste d'élèves : colonnes collées depuis Excel", () => {
  const l = lireLigneEleve("1\tBAH\tAminata Binta\tF");
  assert.equal(l.nom, "BAH");
  assert.equal(l.prenom, "Aminata Binta");
  assert.equal(l.sexe, "F");
  const sansSexe = lireLigneEleve("BAH\tAminata");
  assert.equal(sansSexe.nom, "BAH");
  assert.equal(sansSexe.prenom, "Aminata");
});

test("liste d'élèves : un élève déjà dans la classe est écarté (liste collée deux fois)", () => {
  const existants = [{ nom: "Bah", prenom: "Aminata", classe: "7ème A" }];
  const lignes = lireListeEleves("BAH Aminata F\n\nDIALLO Ousmane M\nBAH", { classe: "7ème A", existants });
  assert.equal(lignes.length, 3);
  assert.equal(lignes[0].erreur, "dejaLa");
  assert.equal(lignes[1].erreur, undefined);
  assert.ok(lignes[2].erreur);
  // Même élève dans une AUTRE classe : rien à signaler.
  assert.equal(lireListeEleves("BAH Aminata", { classe: "8ème A", existants })[0].erreur, undefined);
});

test("liste d'élèves : la classe arrivée après l'ouverture de la fenêtre est retenue", () => {
  // Hors ligne, la fenêtre s'ouvre avant que la synchro n'apporte la classe :
  // le bouton d'inscription doit marcher dès qu'elle arrive.
  assert.equal(classeRetenue("", []), "");
  assert.equal(classeRetenue("", ["8ème A"]), "8ème A");
  assert.equal(classeRetenue("8ème B", ["8ème A", "8ème B"]), "8ème B");
  // Classe supprimée ou renommée entre-temps : la première qui existe.
  assert.equal(classeRetenue("7ème A", ["8ème A"]), "8ème A");
});

test("écran : libellés d'enseignant, pas ceux d'une direction d'école", () => {
  assert.equal(getRoleLabelForSchool("direction", ESPACE), "Enseignant");
  assert.equal(getRoleLabelForSchool("college", ESPACE), "Secondaire");
  assert.equal(getRoleLabelForSchool("primaire", ESPACE), "Primaire");
  // Une école garde ses libellés, réglés ou par défaut.
  assert.equal(getRoleLabelForSchool("direction", {}), "Direction Generale");
  assert.equal(getRoleLabelForSchool("college", { roleSettings: { college: { label: "Censeur" } } }), "Censeur");
});
