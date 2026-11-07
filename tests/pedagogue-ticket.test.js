// « Mes fiches » : l'autorisation signée pour Pédagogue, et le lien qu'ouvre le
// portail enseignant selon le réseau.
import test, { after, before, beforeEach, describe, mock } from "node:test";
import assert from "node:assert/strict";
import { creerTicket, DUREE_TICKET_S, enTeteDeLEcole, refusTicket, rolePedagogue } from "../supabase/functions/pedagogue-ticket/ticket.ts";
import { classesDeLEnseignant, sectionDuCompte } from "../supabase/functions/pedagogue-ticket/perimetre.ts";

const SECRET = "secret-commun-de-test";
const COMPTE = "7f3c1a52-4b1e-4c8a-9d21-3e6f0a9b1c44";
const JTI = "0c9e6b1a-52d4-4f7e-8a31-b7d2c4e5f601";
const IAT = 1_800_000_000;

// Même exemple dans tests/pont-edugest.test.ts de Pédagogue : il fixe le format.
const EXEMPLE_COMMUN =
  "eyJ2IjoxLCJpc3MiOiJlZHVnZXN0IiwiYXVkIjoicGVkYWdvZ3VlIiwic3ViIjoiN2YzYzFhNTItNGIxZS00YzhhLTlkMjEtM2U2ZjBhOWIxYzQ0Iiwibm9tIjoiTWFtYWRvdSBEaWFsbG8gQmFoIiwianRpIjoiMGM5ZTZiMWEtNTJkNC00ZjdlLThhMzEtYjdkMmM0ZTVmNjAxIiwiaWF0IjoxODAwMDAwMDAwLCJleHAiOjE4MDAwMDAxMjB9.UBI4VtOBjWWeB5gKgKDnYbkMJpi6wjpAfY5xoxpmLRY";

const compte = (extra = {}) => ({ id: COMPTE, role: "enseignant", statut: "Actif", nom: "A. Camara", extra: null, ...extra });
const ecole = { actif: true, supprime: false };
const lireDonnees = (ticket) => JSON.parse(Buffer.from(ticket.split(".")[0], "base64url").toString("utf8"));

test("ticket : identique à l'exemple que Pédagogue sait lire", async () => {
  const ticket = await creerTicket({ compteId: COMPTE, nom: "Mamadou Diallo Bah", jti: JTI, iat: IAT }, SECRET);
  assert.equal(ticket, EXEMPLE_COMMUN);
});

test("ticket : valable 2 minutes, identité = compte, jamais d'e-mail", async () => {
  const donnees = lireDonnees(await creerTicket({ compteId: COMPTE, nom: "A. Camara", jti: JTI, iat: IAT }, SECRET));
  assert.equal(DUREE_TICKET_S, 120);
  assert.equal(donnees.exp - donnees.iat, 120);
  assert.equal(donnees.sub, COMPTE);
  assert.deepEqual(Object.keys(donnees), ["v", "iss", "aud", "sub", "nom", "jti", "iat", "exp"]);
});

test("ticket : les noms accentués ou très longs passent", async () => {
  const accentue = lireDonnees(await creerTicket({ compteId: COMPTE, nom: "Aïssatou Baldé", jti: JTI, iat: IAT }, SECRET));
  assert.equal(accentue.nom, "Aïssatou Baldé");
  const long = lireDonnees(await creerTicket({ compteId: COMPTE, nom: "x".repeat(500), jti: JTI, iat: IAT }, SECRET));
  assert.equal(long.nom.length, 200);
});

test("ticket : un autre secret donne une autre signature", async () => {
  const entree = { compteId: COMPTE, nom: "A. Camara", jti: JTI, iat: IAT };
  assert.notEqual(await creerTicket(entree, SECRET), await creerTicket(entree, "autre-secret"));
});

test("ticket : l'école, le rôle et les classes voyagent signés", async () => {
  const contexte = {
    ecole: { id: "3b2f7a10-6f0e-4d6b-9a55-1c9e2d7f8a01", nom: "La Citadelle", couleur1: "#0A1628", couleur2: "#00C48C" },
    role: "enseignant",
    annee: "2026-2027",
    classes: [{ nom: "7ème A", section: "college", matieres: ["Maths"], creneaux: [] }],
  };
  const donnees = lireDonnees(await creerTicket({ compteId: COMPTE, nom: "A. Camara", jti: JTI, iat: IAT, ...contexte }, SECRET));
  assert.deepEqual({ ecole: donnees.ecole, role: donnees.role, annee: donnees.annee, classes: donnees.classes }, contexte);
});

test("en-tête : le même que les documents de l'école, profil légal compris", () => {
  const enTete = enTeteDeLEcole({
    pays: "République de Guinée",
    logo: "https://exemple.supabase.co/storage/v1/object/public/photos/logo.png",
    legal: { etablissement: { ministereTutelle: "Ministère de test", ire: "IRE de Kindia", dpe: "DPE de Kindia" }, arreteOuverture: { numero: "A-12" } },
  });
  assert.deepEqual(enTete, {
    pays: "République de Guinée",
    devise: "Travail - Justice - Solidarité",
    ministere: "Ministère de test",
    ire: "IRE de Kindia",
    dpe: "DPE de Kindia",
    agrement: "A-12",
    logo: "https://exemple.supabase.co/storage/v1/object/public/photos/logo.png",
  });
});

test("en-tête : école sans profil → mêmes défauts que les bulletins, anciens champs lus dans extra", () => {
  const vide = enTeteDeLEcole({ pays: null, logo: null, legal: null, extra: null });
  assert.equal(vide.pays, "République de Guinée");
  assert.equal(vide.devise, "Travail - Justice - Solidarité");
  assert.match(vide.ministere, /^Ministère de l'Éducation Nationale/);
  assert.equal(vide.logo, null);
  assert.equal(enTeteDeLEcole({ pays: "Sénégal", legal: {}, extra: { ire: "IA de Dakar" } }).devise, "Un Peuple - Un But - Une Foi");
  assert.equal(enTeteDeLEcole({ legal: {}, extra: { ire: "IA de Dakar" } }).ire, "IA de Dakar");
});

test("en-tête : un logo qui n'est pas une adresse ne voyage pas", () => {
  assert.equal(enTeteDeLEcole({ logo: "data:image/png;base64,AAAA" }).logo, null);
  assert.equal(enTeteDeLEcole({ logo: "http://exemple.com/logo.png" }).logo, null);
});

test("ticket : trop de classes pour l'adresse → connexion quand même, sans les classes", async () => {
  const creneaux = Array.from({ length: 80 }, () => ({ jour: 1, debut: "08:00", fin: "10:00", matiere: "Mathématiques" }));
  const classes = Array.from({ length: 40 }, (_, i) => ({ nom: `Classe ${i}`, section: "college", matieres: [], creneaux }));
  const ticket = await creerTicket({ compteId: COMPTE, nom: "A. Camara", jti: JTI, iat: IAT, role: "enseignant", classes }, SECRET);
  assert.ok(ticket.length <= 32_768);
  const donnees = lireDonnees(ticket);
  assert.equal(donnees.classes, undefined);
  assert.equal(donnees.role, "enseignant");
});

test("refus : enseignant ou encadrement en poste seulement", () => {
  assert.equal(refusTicket(compte(), ecole), null);
  assert.equal(refusTicket(compte({ statut: null }), ecole), null);
  assert.equal(refusTicket(null, ecole).status, 403);
  for (const role of ["admin", "primaire", "college"]) {
    assert.equal(refusTicket(compte({ role }), ecole), null, role);
  }
  for (const role of ["direction", "parent", "comptable", "surveillant", "superadmin", "staff"]) {
    assert.equal(refusTicket(compte({ role }), ecole).status, 403, role);
  }
  assert.equal(refusTicket(compte({ statut: "Inactif" }), ecole).status, 403);
  assert.equal(refusTicket(compte({ role: "college", statut: "Inactif" }), ecole).status, 403);
  assert.equal(refusTicket(compte({ extra: { fusionneDans: "autre" } }), ecole).status, 403);
});

test("rôle dans Pédagogue : chefs de section et Administrateur, jamais la Direction générale", () => {
  assert.equal(rolePedagogue("enseignant"), "enseignant");
  for (const role of ["admin", "primaire", "college"]) assert.equal(rolePedagogue(role), "responsable_pedagogique", role);
  for (const role of ["direction", "parent", "comptable", "constructor"]) assert.equal(rolePedagogue(role), undefined, role);
});

const enseignant = (partiel = {}) => ({ nom: "Camara Aïssatou", section: "college", matiere: "Mathématiques", extra: {}, ...partiel });
const perimetre = (partiel = {}) => classesDeLEnseignant({
  compte: enseignant(), emplois: [], enseignements: [], fiches: [], classes: [], matieres: [], ...partiel,
});

test("périmètre : ses séances, pas celles des collègues", () => {
  const emplois = [
    { classe: "7ème A", jour: "Lundi", heure_debut: "08:00", heure_fin: "10:00", matiere: "Mathématiques", enseignant: "camara  aissatou" },
    { classe: "7ème A", jour: "Mardi", heure_debut: "08:00:00", heure_fin: "09:00", matiere: "Algèbre", enseignant: "Camara Aïssatou (titulaire)" },
    { classe: "8ème B", jour: "Lundi", heure_debut: "10:00", heure_fin: "12:00", matiere: "Français", enseignant: "Diallo Mamadou" },
  ];
  assert.deepEqual(perimetre({ emplois }), [{
    nom: "7ème A",
    section: "college",
    matieres: ["Mathématiques", "Algèbre"],
    creneaux: [
      { jour: 1, debut: "08:00", fin: "10:00", matiere: "Mathématiques" },
      { jour: 2, debut: "08:00", fin: "09:00", matiere: "Algèbre" },
    ],
  }]);
});

test("périmètre : heures et jours écrits à la main", () => {
  const ligne = (partiel) => ({ classe: "7ème A", jour: "Lundi", matiere: "Maths", enseignant: "Camara Aïssatou", ...partiel });
  const emplois = [
    ligne({ heure_debut: "8h", heure_fin: "10h30" }),
    ligne({ jour: "MERCREDI", extra: { heure: "08:00 - 10:00" } }),
    ligne({ jour: "Dimanche", heure_debut: "08:00" }),
    ligne({ jour: "Mardi", heure_debut: "plus tard" }),
    ligne({ jour: "Jeudi", heure_debut: "08:00", matiere: "" }),
  ];
  assert.deepEqual(perimetre({ emplois })[0].creneaux, [
    { jour: 1, debut: "08:00", fin: "10:30", matiere: "Maths" },
    { jour: 3, debut: "08:00", fin: "10:00", matiere: "Maths" },
  ]);
});

test("périmètre : la classe d'un titulaire sans emploi du temps", () => {
  const compte = enseignant({ section: "primaire", enseignant_id: "f1", nom: "A. Camara" });
  const matieres = [
    { nom: "Lecture", classes: [] },
    { nom: "Calcul", classes: ["4ème Année"] },
    { nom: "Dictée", classes: [], extra: { nature: "epreuve" } },
    { nom: "Sciences", classes: ["6ème Année"] },
  ];
  assert.deepEqual(perimetre({ compte, fiches: [{ id: "f1", extra: { classeTitle: "4ème Année A" } }], matieres }), [
    { nom: "4ème Année A", section: "primaire", matieres: ["Lecture", "Calcul"], creneaux: [] },
  ]);
});

test("périmètre : toutes les sources de classes, sans doublon", () => {
  const compte = enseignant({ enseignant_id: "f1", extra: { classeTitre: "9ème C", classesTitulaire: ["10ème D", "7ème A"] } });
  const noms = perimetre({
    compte,
    emplois: [{ classe: "7ème A", enseignant: "Camara Aïssatou" }],
    enseignements: [{ classe: "8ème B", enseignant_nom: "Camara Aïssatou" }, { classe: "8ème Z", enseignant_nom: "Autre" }],
    fiches: [{ id: "autre", nom: "Autre", classe_title: "11ème" }],
    classes: [{ nom: "7ÈME A", enseignant_id: "f1" }, { nom: "9ème X", enseignant_id: "autre" }],
  }).map((c) => c.nom);
  assert.deepEqual(noms.sort(), ["10ème D", "8ème B", "9ème C", "7ème A"].sort());
});

test("périmètre : un enseignant sans classe n'envoie rien", () => {
  assert.deepEqual(perimetre({ emplois: [{ classe: "7ème A", enseignant: "Autre" }] }), []);
});

test("périmètre : aucune donnée d'élève ni de salaire ne sort", () => {
  const classes = perimetre({
    compte: enseignant({ extra: { classeTitre: "7ème A", salaire: 500000 } }),
    emplois: [{ classe: "7ème A", jour: "Lundi", heure_debut: "08:00", matiere: "Maths", enseignant: "Camara Aïssatou", salle: "B2", extra: { eleves: ["Bah"] } }],
  });
  assert.deepEqual(Object.keys(classes[0]), ["nom", "section", "matieres", "creneaux"]);
  assert.deepEqual(Object.keys(classes[0].creneaux[0]), ["jour", "debut", "fin", "matiere"]);
});

test("section : comme le portail enseignant", () => {
  assert.equal(sectionDuCompte({ section: "prescolaire" }), "prescolaire");
  assert.equal(sectionDuCompte({ sections: ["lycee"] }), "lycee");
  assert.equal(sectionDuCompte({ section: "secondaire" }), "college");
  assert.equal(sectionDuCompte({}), "college");
});

test("refus : école hors service", () => {
  assert.equal(refusTicket(compte(), null).status, 403);
  assert.equal(refusTicket(compte(), { actif: false }).status, 403);
  assert.equal(refusTicket(compte(), { actif: true, supprime: true }).status, 403);
});

const ignore = typeof mock.module !== "function"
  ? "mocks de modules absents : lancer avec --experimental-test-module-mocks"
  : false;

describe("lien du portail", { skip: ignore }, () => {
  const stockage = new Map();
  const etat = { reponse: null, appels: 0, enLigne: true };
  const navigateurReel = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  let lienMesFiches;

  before(async () => {
    mock.module(new URL("../src/supabaseClient.js", import.meta.url).href, {
      namedExports: {
        getSupabase: () => ({
          functions: {
            invoke: async (nom) => {
              etat.appels += 1;
              assert.equal(nom, "pedagogue-ticket");
              return etat.reponse;
            },
          },
        }),
      },
    });
    globalThis.localStorage = {
      getItem: (k) => stockage.get(k) ?? null,
      setItem: (k, v) => stockage.set(k, v),
    };
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: { get onLine() { return etat.enLigne; } } });
    ({ lienMesFiches } = await import("../src/backend/pedagogue-supabase.js"));
  });
  beforeEach(() => {
    stockage.clear();
    Object.assign(etat, { reponse: { data: { ok: true, ticket: "abc.def" }, error: null }, appels: 0, enLigne: true });
  });
  after(() => {
    delete globalThis.localStorage;
    if (navigateurReel) Object.defineProperty(globalThis, "navigator", navigateurReel);
    else delete globalThis.navigator;
  });

  test("en ligne : l'autorisation voyage dans le fragment, que le serveur ne reçoit pas", async () => {
    assert.equal(await lienMesFiches("u1"), "https://guinee-education.pages.dev/edugest#ticket=abc.def");
  });

  test("hors ligne, déjà ouvert par ce compte : ses fiches, sans appel", async () => {
    await lienMesFiches("u1");
    etat.enLigne = false;
    etat.appels = 0;
    assert.equal(await lienMesFiches("u1"), "https://guinee-education.pages.dev/fiches");
    assert.equal(etat.appels, 0);
  });

  test("hors ligne, jamais ouvert ici : message, pas de page vide", async () => {
    etat.enLigne = false;
    await assert.rejects(lienMesFiches("u1"), /connexion internet/);
  });

  test("hors ligne sur un appareil partagé : pas les fiches d'un collègue", async () => {
    await lienMesFiches("u1");
    etat.enLigne = false;
    await assert.rejects(lienMesFiches("u2"), /connexion internet/);
  });

  test("réseau faible : même repli que hors ligne", async () => {
    await lienMesFiches("u1");
    etat.reponse = { data: null, error: Object.assign(new Error("x"), { name: "FunctionsFetchError" }) };
    assert.equal(await lienMesFiches("u1"), "https://guinee-education.pages.dev/fiches");
    await assert.rejects(lienMesFiches("u2"), /connexion internet/);
  });

  test("refus du serveur : son message s'affiche, tel quel", async () => {
    etat.reponse = { data: null, error: { name: "FunctionsHttpError", context: { json: async () => ({ error: "Ce compte n'est plus actif." }) } } };
    await assert.rejects(lienMesFiches("u1"), /Ce compte n'est plus actif./);
  });

  test("refus illisible : message de repli", async () => {
    etat.reponse = { data: null, error: { name: "FunctionsRelayError" } };
    await assert.rejects(lienMesFiches("u1"), /Ouverture de vos fiches impossible/);
  });
});
