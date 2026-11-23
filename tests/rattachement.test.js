// Rattachement d'un espace enseignant à l'école qui adopte EduGest
// (décisions du 2026-11-18, étape 3) : l'enseignant propose depuis son
// espace, la direction de l'école relie ses élèves et accepte ; ses notes
// passent chez l'école, son compte enseignant y est créé ou relié, et son
// espace pour cet établissement est fermé. On vérifie ici :
//  - les règles serveur (account-manage/rattachement.ts) ;
//  - la logique de l'écran de la direction (rapprochement, corps envoyé),
//    et son accord avec le serveur ;
//  - la migration (droits, sens unique entre écoles) ;
//  - l'Edge account-manage et la connexion par l'espace personnel.
// Le parcours complet tourne dans e2e/tests/rattachement.spec.js.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normaliserCodeEcole, passageEntreEcolesPermis, refusDemandeur, refusEcoleVisee,
  refusTraitement, statutErreurApplication, validerAcceptation,
} from "../supabase/functions/account-manage/rattachement.ts";
import {
  bilanPrevu, cleNomEleve, compteProbable, construireAcceptation, decouperNom, erreurAcceptation,
  normaliser, periodesEtrangeres, proposerClasse, proposerEleves, proposerMatiere, sectionPrincipale,
} from "../src/components/rattachement/rattachement.js";

const source = (chemin) => readFileSync(new URL(`../${chemin}`, import.meta.url), "utf8");
const uuid = (n) => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;
const t = (cle) => cle;

// ── Serveur : qui demande, quelle école, qui traite ─────────────────────────

test("demander : depuis l'espace ouvert d'un enseignant seulement", () => {
  assert.equal(refusDemandeur("enseignant", "direction"), null);
  assert.equal(refusDemandeur("enseignant", "direction", true), null);
  // Une école ne se rattache pas à une autre ; un compte autre que le sien non plus.
  assert.equal(refusDemandeur("ecole", "direction")?.status, 403);
  assert.equal(refusDemandeur("enseignant", "enseignant")?.status, 403);
  assert.equal(refusDemandeur(undefined, "direction")?.status, 403);
  // Espace déjà rattaché (fermé) : ses classes sont déjà chez l'école.
  assert.equal(refusDemandeur("enseignant", "direction", false)?.status, 409);
});

test("code saisi : une école en service, pas un espace enseignant", () => {
  const ecole = { id: "e1", type_espace: "ecole", actif: true, supprime: false };
  assert.equal(refusEcoleVisee(ecole, "moi"), null);
  assert.equal(refusEcoleVisee(null, "moi")?.status, 404);
  assert.match(refusEcoleVisee(undefined, "moi").error, /direction de votre école/);
  assert.equal(refusEcoleVisee({ ...ecole, id: "moi" }, "moi")?.status, 400);
  assert.equal(refusEcoleVisee({ ...ecole, type_espace: "enseignant" }, "moi")?.status, 400);
  assert.equal(refusEcoleVisee({ ...ecole, actif: false }, "moi")?.status, 409);
  assert.equal(refusEcoleVisee({ ...ecole, supprime: true }, "moi")?.status, 409);
  assert.equal(normaliserCodeEcole("  Ecole-E2E "), "ecole-e2e");
  assert.equal(normaliserCodeEcole(null), "");
});

test("traiter : la direction de l'école visée, une demande en attente", () => {
  const demande = { ecole_id: "e1", statut: "en_attente" };
  assert.equal(refusTraitement(demande, "e1", "direction", "ecole"), null);
  // Ni un autre rôle de l'école, ni l'enseignant depuis son espace.
  assert.equal(refusTraitement(demande, "e1", "comptable", "ecole")?.status, 403);
  assert.equal(refusTraitement(demande, "e1", "direction", "enseignant")?.status, 403);
  // La demande d'une autre école n'existe pas pour elle.
  assert.equal(refusTraitement(demande, "e2", "direction", "ecole")?.status, 404);
  assert.equal(refusTraitement(null, "e1", "direction", "ecole")?.status, 404);
  for (const statut of ["acceptee", "refusee", "annulee"]) {
    assert.equal(refusTraitement({ ...demande, statut }, "e1", "direction", "ecole")?.status, 409);
  }
});

test("passage d'une école à l'autre : sens unique, depuis ses espaces enseignants", () => {
  assert.equal(passageEntreEcolesPermis("enseignant", "ecole", "enseignant"), true);
  assert.equal(passageEntreEcolesPermis("enseignant", "enseignant", "direction"), true);
  // Depuis le compte de l'école, jamais vers ses espaces personnels : la
  // direction tient le mot de passe et l'e-mail des comptes de son école.
  assert.equal(passageEntreEcolesPermis("ecole", "enseignant", "direction"), false);
  assert.equal(passageEntreEcolesPermis("enseignant", "ecole", "direction"), false);
  assert.equal(passageEntreEcolesPermis("enseignant", "ecole", "comptable"), false);
});

// ── Serveur : corps d'une acceptation ───────────────────────────────────────

const corpsValide = (plus = {}) => ({
  eleves: { [uuid(1)]: uuid(2), [uuid(3)]: "" },
  matieres: { "Maths": "Mathématiques", "Dessin": "" },
  classes: [{ section: "college", classe: "7ème A" }, { section: "college", classe: "7ème A" }],
  nouveau: { nom: " DIALLO ", prenom: "Ibrahima", section: "college", matiere: "Mathématiques" },
  ...plus,
});

test("acceptation : élèves non reliés et matières laissées de côté, classes sans doublon", () => {
  const r = validerAcceptation(corpsValide());
  assert.ok(!("error" in r));
  assert.deepEqual(r.eleves, { [uuid(1)]: uuid(2) });
  assert.deepEqual(r.matieres, { Maths: "Mathématiques" });
  assert.deepEqual(r.classes, [{ section: "college", classe: "7ème A" }]);
  assert.equal(r.compteId, null);
  assert.deepEqual(r.nouveau, { nom: "DIALLO", prenom: "Ibrahima", section: "college", matiere: "Mathématiques" });
  // Compte déjà ouvert dans l'école : on ne crée rien.
  const existant = validerAcceptation(corpsValide({ compteId: uuid(9), nouveau: null }));
  assert.equal(existant.compteId, uuid(9));
  assert.equal(existant.nouveau, null);
});

test("acceptation : refus si rien n'est relié, un élève reçu deux fois, une classe ou un compte invalides", () => {
  const statut = (corps) => validerAcceptation(corps).status;
  assert.equal(statut(corpsValide({ eleves: {} })), 400);
  assert.match(validerAcceptation(corpsValide({ eleves: { [uuid(1)]: "" } })).error, /refusez la demande/);
  assert.match(validerAcceptation(corpsValide({ eleves: { [uuid(1)]: uuid(2), [uuid(3)]: uuid(2) } })).error, /même élève/);
  assert.equal(statut(corpsValide({ eleves: { "pas-un-id": uuid(2) } })), 400);
  assert.equal(statut(corpsValide({ eleves: { [uuid(1)]: "pas-un-id" } })), 400);
  assert.equal(statut(corpsValide({ classes: [] })), 400);
  assert.equal(statut(corpsValide({ classes: [{ section: "universite", classe: "L1" }] })), 400);
  assert.equal(statut(corpsValide({ classes: [{ section: "college", classe: " " }] })), 400);
  assert.equal(statut(corpsValide({ compteId: "abc" })), 400);
  assert.match(validerAcceptation(corpsValide({ nouveau: { nom: "", section: "college" } })).error, /nom/);
  assert.match(validerAcceptation(corpsValide({ nouveau: { nom: "BAH", section: "" } })).error, /section/);
  assert.equal(statut(corpsValide({ nouveau: undefined })), 400);
});

test("erreur de rattachement_appliquer → statut HTTP", () => {
  for (const hint of ["deja_traitee", "espace_ferme", "ecole_hors_service"]) {
    assert.equal(statutErreurApplication(hint, "P0001"), 409);
  }
  assert.equal(statutErreurApplication("eleve_cible", "P0001"), 400);
  assert.equal(statutErreurApplication(undefined, "P0002"), 400);
  assert.equal(statutErreurApplication(undefined, "42P01"), 500);
  assert.equal(statutErreurApplication(null, undefined), 500);
});

// ── Écran de la direction : rapprochement ───────────────────────────────────

test("noms comparables : accents, casse, ordre nom/prénom", () => {
  assert.equal(normaliser("  Aïssatou  DIALLO-Bah "), "aissatou diallo bah");
  assert.equal(cleNomEleve({ nom: "DIALLO", prenom: "Aïssatou" }), cleNomEleve({ nom: "aissatou", prenom: "Diallo" }));
  assert.notEqual(cleNomEleve({ nom: "DIALLO", prenom: "Aïssatou" }), cleNomEleve({ nom: "DIALLO", prenom: "Mariama" }));
  assert.equal(cleNomEleve({}), "");
});

test("classe proposée : même section et même nom, sinon la direction choisit", () => {
  const ecole = [{ section: "college", nom: "7ème A" }, { section: "primaire", nom: "CM2" }];
  assert.equal(proposerClasse({ section: "college", nom: "7EME a" }, ecole), "7ème A");
  assert.equal(proposerClasse({ section: "lycee", nom: "7ème A" }, ecole), "");
  assert.equal(proposerClasse({ section: "primaire", nom: "CM1" }, ecole), "");
  assert.equal(proposerClasse({ section: "primaire", nom: "CM2" }), "");
});

test("élèves proposés : seulement sans ambiguïté, des deux côtés", () => {
  const ens = [
    { id: "a", nom: "DIALLO", prenom: "Aïssatou" },
    { id: "b", nom: "BAH", prenom: "Mamadou" },
    { id: "c", nom: "SOW", prenom: "Fatou" },
    { id: "d", nom: "CAMARA", prenom: "Sekou" },
    { id: "e", nom: "Camara", prenom: "Sékou" },
  ];
  const ecole = [
    { id: "1", nom: "Aissatou", prenom: "Diallo" },
    { id: "2", nom: "BAH", prenom: "Mamadou" },
    { id: "3", nom: "BAH", prenom: "Mamadou" },
    { id: "4", nom: "CAMARA", prenom: "Sekou" },
  ];
  assert.deepEqual(proposerEleves(ens, ecole), {
    a: "1", // même identité, ordre et accents différents
    b: "", // deux homonymes dans l'école
    c: "", // introuvable : relié à la main ou laissé de côté
    d: "", e: "", // deux homonymes chez l'enseignant
  });
});

test("matière proposée, compte enseignant probable, nom découpé", () => {
  assert.equal(proposerMatiere("mathematiques", ["Français", "Mathématiques"]), "Mathématiques");
  assert.equal(proposerMatiere("Maths", ["Mathématiques"]), "");

  const comptes = [
    { id: "x", role: "enseignant", login: "ens.622000001", nom: "Ibrahima DIALLO" },
    { id: "y", role: "enseignant", login: "kaba", nom: "Fanta KABA" },
    { id: "z", role: "comptable", login: "622000009", nom: "Alpha BARRY" },
    { id: "w", role: "enseignant", login: "barry1", nom: "Alpha BARRY" },
    { id: "v", role: "enseignant", login: "barry2", nom: "BARRY Alpha" },
  ];
  assert.equal(compteProbable(comptes, { login: "622000001", nom: "" })?.id, "x");
  assert.equal(compteProbable(comptes, { login: "622000002", nom: "kaba fanta" })?.id, "y");
  // Le comptable au même numéro n'est pas son compte ; deux homonymes non plus.
  assert.equal(compteProbable(comptes, { login: "622000009", nom: "Alpha Barry" }), null);
  assert.equal(compteProbable(comptes, { login: "", nom: "" }), null);
  assert.equal(compteProbable(undefined, undefined), null);

  assert.deepEqual(decouperNom("Ibrahima DIALLO"), { nom: "DIALLO", prenom: "Ibrahima" });
  assert.deepEqual(decouperNom("DIALLO Mamadou Saliou"), { nom: "DIALLO", prenom: "Mamadou Saliou" });
  assert.deepEqual(decouperNom("Fanta Kaba"), { nom: "Kaba", prenom: "Fanta" });
  assert.deepEqual(decouperNom("KABA"), { nom: "KABA", prenom: "" });
  assert.deepEqual(decouperNom("  "), { nom: "", prenom: "" });

  assert.equal(sectionPrincipale([{ section: "college" }, { section: "lycee", poids: 3 }, { section: "college" }]), "lycee");
  assert.equal(sectionPrincipale([], "primaire"), "primaire");
});

// ── Écran de la direction : corps envoyé, d'accord avec le serveur ──────────

const apercu = {
  classes: [
    { section: "college", nom: "7A", eleves: [{ id: uuid(1), notes: 4 }, { id: uuid(3), notes: 2 }] },
    { section: "college", nom: "7B", eleves: [{ id: uuid(5), notes: "3" }] },
    { section: "lycee", nom: "11e", eleves: [{ id: uuid(6), notes: 1 }] },
  ],
  matieres: [{ nom: "Maths", notes: 6 }, { nom: "Dessin", notes: 1 }],
};

test("corps d'acceptation : classes réunies, choix vides retirés", () => {
  const corps = construireAcceptation({
    apercu,
    choixClasses: { "college|7A": "7ème A", "college|7B": "7ème A", "lycee|11e": "" },
    choixEleves: { [uuid(1)]: uuid(2), [uuid(3)]: "", [uuid(5)]: uuid(4) },
    choixMatieres: { Maths: "Mathématiques", Dessin: "" },
    compte: { nom: " DIALLO ", prenom: "Ibrahima ", section: "college", matiere: "" },
  });
  assert.deepEqual(corps, {
    eleves: { [uuid(1)]: uuid(2), [uuid(5)]: uuid(4) },
    matieres: { Maths: "Mathématiques" },
    classes: [{ section: "college", classe: "7ème A" }],
    nouveau: { nom: "DIALLO", prenom: "Ibrahima", section: "college", matiere: "" },
  });
  assert.equal(erreurAcceptation(corps, t), "");
  const serveur = validerAcceptation(corps);
  assert.ok(!("error" in serveur));
  assert.deepEqual(serveur.eleves, corps.eleves);

  const existant = construireAcceptation({ apercu, choixClasses: { "college|7A": "7ème A" }, choixEleves: { [uuid(1)]: uuid(2) }, compte: { compteId: uuid(9) } });
  assert.equal(existant.compteId, uuid(9));
  assert.equal(existant.nouveau, undefined);
  assert.equal(erreurAcceptation(existant, t), "");
  assert.equal(validerAcceptation(existant).compteId, uuid(9));
});

test("l'écran refuse ce que le serveur refuserait", () => {
  const base = { eleves: { [uuid(1)]: uuid(2) }, classes: [{ section: "college", classe: "7ème A" }], nouveau: { nom: "BAH", section: "college" } };
  const cas = [
    [{ ...base, eleves: {} }, "rattachement.errNoStudent"],
    [{ ...base, eleves: { [uuid(1)]: uuid(2), [uuid(3)]: uuid(2) } }, "rattachement.errSameStudent"],
    [{ ...base, classes: [] }, "rattachement.errNoClass"],
    [{ ...base, nouveau: { nom: "", section: "college" } }, "rattachement.errName"],
    [{ ...base, nouveau: { nom: "BAH", section: "" } }, "rattachement.errSection"],
  ];
  for (const [corps, cle] of cas) {
    assert.equal(erreurAcceptation(corps, t), cle);
    assert.ok("error" in validerAcceptation(corps), `le serveur refuse aussi (${cle})`);
  }
  assert.equal(erreurAcceptation(base, t), "");
  assert.ok(!("error" in validerAcceptation(base)));
});

test("bilan annoncé et périodes inconnues de l'école", () => {
  assert.deepEqual(bilanPrevu(apercu, { [uuid(1)]: uuid(2), [uuid(5)]: uuid(4) }, { Maths: "Mathématiques" }), {
    elevesRelies: 2, elevesLaisses: 2, notesElevesRelies: 7, matieresLaissees: ["Dessin"],
  });
  assert.deepEqual(bilanPrevu(null), { elevesRelies: 0, elevesLaisses: 0, notesElevesRelies: 0, matieresLaissees: [] });
  assert.deepEqual(periodesEtrangeres(["T1", "T2", "", "S1"], ["S1", "S2"]), ["T1", "T2"]);
  assert.deepEqual(periodesEtrangeres(undefined, ["S1"]), []);
});

// ── Migration ───────────────────────────────────────────────────────────────

const MIGRATION = "supabase/migrations/20261118180200_rattachement_espace_enseignant.sql";

test("migration : demandes invisibles des comptes, une seule en attente par espace", () => {
  const sql = source(MIGRATION);
  assert.match(sql, /alter table public\.rattachements enable row level security;/);
  assert.match(sql, /revoke all on table public\.rattachements from public, anon, authenticated;/);
  assert.match(sql, /create unique index if not exists rattachements_une_en_attente\s+on public\.rattachements \(espace_id\) where statut = 'en_attente';/);
  assert.match(sql, /check \(statut in \('en_attente', 'acceptee', 'refusee', 'annulee'\)\)/);
});

test("migration : chaque fonction a ses droits, l'application est réservée au serveur", () => {
  const sql = source(MIGRATION);
  const fonctions = [...sql.matchAll(/create (?:or replace )?function public\.(\w+)\(/g)].map((m) => m[1]);
  assert.deepEqual(fonctions.sort(), [
    "etat_ecole", "mes_classes", "mes_espaces", "rattachement_apercu", "rattachement_appliquer", "rattachements_recus",
  ]);
  // Toutes en security definer avec un search_path fixé.
  const definers = sql.match(/security definer\s+set search_path to 'public'/g) || [];
  assert.equal(definers.length, fonctions.length);
  // Aucune fonction nouvelle ouverte à anon, sauf etat_ecole (écran de connexion).
  for (const f of ["mes_classes", "rattachements_recus", "rattachement_apercu"]) {
    assert.match(sql, new RegExp(`revoke all on function public\\.${f}\\([^)]*\\) from public, anon;`), f);
  }
  assert.match(sql, /revoke all on function public\.rattachement_appliquer\(uuid, jsonb\) from public, anon, authenticated;/);
  assert.match(sql, /grant execute on function public\.rattachement_appliquer\(uuid, jsonb\) to service_role;/);
  // L'aperçu : direction de l'école visée, connectée sur cette école.
  assert.match(sql, /c\.role = 'direction' and c\.ecole_id = v_ecole\s*\) or auth_ecole_id\(\) is distinct from v_ecole then/);
  // L'école de destination n'est pas exposée par la fonction publique.
  const etat = sql.slice(sql.indexOf("create function public.etat_ecole"), sql.indexOf("grant execute on function public.etat_ecole"));
  assert.match(etat, /extra \? 'rattachement'/);
  assert.doesNotMatch(etat, /ecoleNom|ecoleCode|ecoleId/);
});

test("migration : sens unique entre écoles dans mes_espaces", () => {
  const sql = source(MIGRATION);
  const f = sql.slice(sql.indexOf("create or replace function public.mes_espaces"), sql.indexOf("$$;", sql.indexOf("create or replace function public.mes_espaces")));
  // Hors de sa propre école : seulement depuis un espace enseignant, et
  // seulement vers ses espaces enseignants ou son compte ENSEIGNANT d'école.
  assert.match(f, /c\.ecole_id = moi\.ecole_id\s+or \(moi\.type_espace = 'enseignant'/);
  assert.match(f, /and \(e\.type_espace = 'enseignant' or c\.role = 'enseignant'\)\)/);
  assert.match(f, /e\.actif is not false and e\.supprime is not true/);
});

test("migration : l'acceptation ferme l'espace et contrôle chaque correspondance", () => {
  const sql = source(MIGRATION);
  const f = sql.slice(sql.indexOf("create or replace function public.rattachement_appliquer"));
  assert.match(f, /from rattachements where id = p_demande for update;/);
  for (const hint of ["deja_traitee", "espace_ferme", "ecole_hors_service", "eleve_source", "eleve_cible", "eleve_double"]) {
    assert.match(f, new RegExp(`hint = '${hint}'`), hint);
  }
  assert.match(f, /update ecoles set actif = false,/);
  assert.match(f, /insert into enseignant_classes/);
  assert.match(f, /classesRattachees/);
});

// ── Edge account-manage et connexion ────────────────────────────────────────

test("account-manage : chaque action de rattachement passe par sa règle", () => {
  const index = source("supabase/functions/account-manage/index.ts");
  const bloc = (action) => index.slice(index.indexOf(`action === "${action}"`));
  assert.match(bloc("demander_rattachement"), /^[^]*?refusDemandeur\(typeEspace, caller\.role, ecoleActive\)[^]*?refusEcoleVisee\(visee, ecoleId\)/);
  assert.match(bloc("annuler_rattachement"), /^[^]*?refusDemandeur\(typeEspace, caller\.role\)/);
  assert.match(bloc("refuser_rattachement"), /^[^]*?refusTraitement\(demande, ecoleId, caller\.role, typeEspace\)/);
  assert.match(index, /const corps = validerAcceptation\(body\);/);
  // Accès créé pour le nouveau compte : retiré si l'application échoue.
  assert.match(index, /if \(accesCree\) await admin\.auth\.admin\.deleteUser\(accesCree\)/);
  assert.match(index, /statutErreurApplication\(pErr\.hint, pErr\.code\)/);
  assert.match(index, /passageEntreEcolesPermis\(typeEspace, ecCible\.type_espace, cible\.role\)/);
  // Le mot de passe du nouveau compte n'est jamais celui de l'enseignant.
  assert.match(index, /password: motDePasseInterne\(\), email_confirm: true/);
});

test("connexion par l'espace personnel : client jetable, refermé dans tous les cas", () => {
  const auth = source("src/backend/auth-supabase.js");
  const f = auth.slice(auth.indexOf("async function connexionParEspacePersonnel"), auth.indexOf("async function chargerCompte"));
  assert.match(f, /const jetable = creerClientEphemere\(\);/);
  assert.match(f, /jetable\.auth\.signInWithPassword\(/);
  assert.match(f, /jetable\.functions\.invoke\("account-manage"/);
  assert.match(f, /finally \{\s+await fermer\(\);/);
  // La session de l'application ne s'ouvre que par le jeton du compte visé.
  assert.doesNotMatch(f, /getSupabase\(\)/);
  assert.match(f, /return ouvrirSessionParJeton\(data\.tokenHash, cible\.ecole_code\);/);
  // Espace fermé : etat_ecole le dit, et la connexion l'emmène ailleurs.
  assert.match(auth, /if \(e\.rattache === true\) return \{ info: null, statut: "", rattache: true, typeEspace: "enseignant", code \};/);
});

test("portail enseignant : les classes rattachées comptent dans son périmètre", () => {
  assert.match(source("src/backend/auth-supabase.js"), /classesRattachees: Array\.isArray\(x\.classesRattachees\) \? x\.classesRattachees : \[\]/);
  assert.match(source("src/backend/teacher-portal-supabase.js"), /utilisateur\.classesRattachees/);
});
