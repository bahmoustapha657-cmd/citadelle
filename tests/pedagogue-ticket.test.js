// « Mes fiches » : l'autorisation signée pour Pédagogue, et le lien qu'ouvre le
// portail enseignant selon le réseau.
import test, { after, before, beforeEach, describe, mock } from "node:test";
import assert from "node:assert/strict";
import { creerTicket, DUREE_TICKET_S, refusTicket } from "../supabase/functions/pedagogue-ticket/ticket.ts";

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

test("refus : enseignant en poste seulement", () => {
  assert.equal(refusTicket(compte(), ecole), null);
  assert.equal(refusTicket(compte({ statut: null }), ecole), null);
  assert.equal(refusTicket(null, ecole).status, 403);
  for (const role of ["parent", "direction", "comptable", "surveillant", "superadmin", "staff"]) {
    assert.equal(refusTicket(compte({ role }), ecole).status, 403, role);
  }
  assert.equal(refusTicket(compte({ statut: "Inactif" }), ecole).status, 403);
  assert.equal(refusTicket(compte({ extra: { fusionneDans: "autre" } }), ecole).status, 403);
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
