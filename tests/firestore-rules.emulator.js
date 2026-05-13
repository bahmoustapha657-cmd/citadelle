// Tests des règles firestore.rules contre l'émulateur Firestore.
// Démarré via `npm run test:rules` (qui lance l'émulateur puis ce fichier).
//
// Couvre 15 invariants :
//   1. Isolation multi-tenant
//   2. Admin lecture seule (pas d'écriture client sur recettes/depenses/salaires/notes)
//   3. Comptes intouchables côté client
//   4. Catch-all : collections non whitelistées refusées
//   5. Cloisonnement pédagogique primaire / collège / lycée
//   6. Parent restreint à messageParentValide
//   7. Champs plan protégés (seul superadmin)
//   8. Lecture anonyme limitée aux collections publiques
//   9. audit_securite — lecture direction, jamais d'écriture client
//  10. pushSubs — un user ne touche que son propre doc, payload validé
//  11. paiements — lecture restreinte, jamais d'écriture client
//  12. demandes_plan — création direction/comptable, modif superadmin
//  13. Top-level (/users, /superadmins, /config, /transferts)
//  14. /superadmin_messages + sous-collection lectures + collection group demandes_plan
//  15. Archive multi-années : lecture cross-année autorisée (isolation par schoolId, pas par annee)

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { after, before, beforeEach, describe, test } from "node:test";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  deleteDoc,
  where,
} from "firebase/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RULES = readFileSync(join(__dirname, "..", "firestore.rules"), "utf8");

const SCHOOL_A = "ecole-a";
const SCHOOL_B = "ecole-b";

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "edugest-rules-test",
    firestore: {
      rules: RULES,
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

after(async () => {
  if (testEnv) await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

function asUser({ uid = "u1", schoolId, role }) {
  return testEnv.authenticatedContext(uid, { schoolId, role }).firestore();
}

function asAnon() {
  return testEnv.unauthenticatedContext().firestore();
}

async function seed(work) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await work(ctx.firestore());
  });
}

// ───────────────────────────────────────────────────────────
// 1. Isolation multi-tenant
// ───────────────────────────────────────────────────────────
describe("1. Isolation multi-tenant", () => {
  beforeEach(async () => {
    await seed(async (db) => {
      await setDoc(doc(db, `ecoles/${SCHOOL_B}/recettes/r1`), { montant: 100 });
      await setDoc(doc(db, `ecoles/${SCHOOL_B}/salaires/s1`), { montant: 500 });
      await setDoc(doc(db, `ecoles/${SCHOOL_B}/notesCollege/n1`), { val: 12 });
    });
  });

  test("direction de A ne lit pas une recette de B", async () => {
    const db = asUser({ schoolId: SCHOOL_A, role: "direction" });
    await assertFails(getDoc(doc(db, `ecoles/${SCHOOL_B}/recettes/r1`)));
  });

  test("direction de A ne crée pas dans les recettes de B", async () => {
    const db = asUser({ schoolId: SCHOOL_A, role: "direction" });
    await assertFails(
      setDoc(doc(db, `ecoles/${SCHOOL_B}/recettes/r2`), { montant: 50 }),
    );
  });

  test("comptable de A ne lit pas un salaire de B", async () => {
    const db = asUser({ schoolId: SCHOOL_A, role: "comptable" });
    await assertFails(getDoc(doc(db, `ecoles/${SCHOOL_B}/salaires/s1`)));
  });

  test("primaire de A ne lit pas notesCollege de B", async () => {
    const db = asUser({ schoolId: SCHOOL_A, role: "college" });
    await assertFails(getDoc(doc(db, `ecoles/${SCHOOL_B}/notesCollege/n1`)));
  });

  test("direction de A peut lire ses propres recettes", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, `ecoles/${SCHOOL_A}/recettes/r1`), { montant: 100 });
    });
    const db = asUser({ schoolId: SCHOOL_A, role: "direction" });
    await assertSucceeds(getDoc(doc(db, `ecoles/${SCHOOL_A}/recettes/r1`)));
  });
});

// ───────────────────────────────────────────────────────────
// 2. Admin = lecture seule sur les collections back-office
// ───────────────────────────────────────────────────────────
describe("2. Admin lecture seule", () => {
  test("admin peut LIRE recettes / depenses / salaires", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, `ecoles/${SCHOOL_A}/recettes/r1`), { montant: 100 });
      await setDoc(doc(db, `ecoles/${SCHOOL_A}/depenses/d1`), { montant: 50 });
      await setDoc(doc(db, `ecoles/${SCHOOL_A}/salaires/s1`), { montant: 800 });
    });
    const db = asUser({ schoolId: SCHOOL_A, role: "admin" });
    await assertSucceeds(getDoc(doc(db, `ecoles/${SCHOOL_A}/recettes/r1`)));
    await assertSucceeds(getDoc(doc(db, `ecoles/${SCHOOL_A}/depenses/d1`)));
    await assertSucceeds(getDoc(doc(db, `ecoles/${SCHOOL_A}/salaires/s1`)));
  });

  test("admin NE PEUT PAS créer une recette", async () => {
    const db = asUser({ schoolId: SCHOOL_A, role: "admin" });
    await assertFails(
      setDoc(doc(db, `ecoles/${SCHOOL_A}/recettes/r-bad`), { montant: 1 }),
    );
  });

  test("admin NE PEUT PAS créer une dépense", async () => {
    const db = asUser({ schoolId: SCHOOL_A, role: "admin" });
    await assertFails(
      setDoc(doc(db, `ecoles/${SCHOOL_A}/depenses/d-bad`), { montant: 1 }),
    );
  });

  test("admin NE PEUT PAS créer un salaire", async () => {
    const db = asUser({ schoolId: SCHOOL_A, role: "admin" });
    await assertFails(
      setDoc(doc(db, `ecoles/${SCHOOL_A}/salaires/s-bad`), { montant: 1 }),
    );
  });

  test("admin NE PEUT PAS modifier une recette existante", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, `ecoles/${SCHOOL_A}/recettes/r1`), { montant: 100 });
    });
    const db = asUser({ schoolId: SCHOOL_A, role: "admin" });
    await assertFails(
      updateDoc(doc(db, `ecoles/${SCHOOL_A}/recettes/r1`), { montant: 999 }),
    );
  });

  test("admin NE PEUT PAS supprimer une recette", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, `ecoles/${SCHOOL_A}/recettes/r1`), { montant: 100 });
    });
    const db = asUser({ schoolId: SCHOOL_A, role: "admin" });
    await assertFails(deleteDoc(doc(db, `ecoles/${SCHOOL_A}/recettes/r1`)));
  });

  test("admin NE PEUT PAS écrire des notes (notesCollege)", async () => {
    const db = asUser({ schoolId: SCHOOL_A, role: "admin" });
    await assertFails(
      setDoc(doc(db, `ecoles/${SCHOOL_A}/notesCollege/n1`), { val: 15 }),
    );
  });
});

// ───────────────────────────────────────────────────────────
// 3. /comptes intouchables côté client
// ───────────────────────────────────────────────────────────
describe("3. Comptes intouchables", () => {
  test("direction NE PEUT PAS créer un compte", async () => {
    const db = asUser({ schoolId: SCHOOL_A, role: "direction" });
    await assertFails(
      setDoc(doc(db, `ecoles/${SCHOOL_A}/comptes/c1`), { login: "x" }),
    );
  });

  test("direction NE PEUT PAS modifier un compte", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, `ecoles/${SCHOOL_A}/comptes/c1`), {
        login: "x",
        role: "admin",
      });
    });
    const db = asUser({ schoolId: SCHOOL_A, role: "direction" });
    await assertFails(
      updateDoc(doc(db, `ecoles/${SCHOOL_A}/comptes/c1`), { role: "direction" }),
    );
  });

  test("admin NE PEUT PAS modifier un compte (régression connue)", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, `ecoles/${SCHOOL_A}/comptes/c1`), {
        login: "x",
        role: "comptable",
      });
    });
    const db = asUser({ schoolId: SCHOOL_A, role: "admin" });
    await assertFails(
      updateDoc(doc(db, `ecoles/${SCHOOL_A}/comptes/c1`), { hash: "stolen" }),
    );
  });

  test("direction PEUT lire un compte", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, `ecoles/${SCHOOL_A}/comptes/c1`), { login: "x" });
    });
    const db = asUser({ schoolId: SCHOOL_A, role: "direction" });
    await assertSucceeds(getDoc(doc(db, `ecoles/${SCHOOL_A}/comptes/c1`)));
  });

  test("comptable NE PEUT PAS lire un compte", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, `ecoles/${SCHOOL_A}/comptes/c1`), { login: "x" });
    });
    const db = asUser({ schoolId: SCHOOL_A, role: "comptable" });
    await assertFails(getDoc(doc(db, `ecoles/${SCHOOL_A}/comptes/c1`)));
  });
});

// ───────────────────────────────────────────────────────────
// 4. Catch-all : whitelist stricte
// ───────────────────────────────────────────────────────────
describe("4. Catch-all whitelist", () => {
  test("direction NE PEUT PAS créer dans une collection inconnue", async () => {
    const db = asUser({ schoolId: SCHOOL_A, role: "direction" });
    await assertFails(
      setDoc(doc(db, `ecoles/${SCHOOL_A}/foobar/x`), { test: 1 }),
    );
  });

  test("direction NE PEUT PAS lire une collection inconnue", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, `ecoles/${SCHOOL_A}/foobar/x`), { test: 1 });
    });
    const db = asUser({ schoolId: SCHOOL_A, role: "direction" });
    await assertFails(getDoc(doc(db, `ecoles/${SCHOOL_A}/foobar/x`)));
  });

  test("direction PEUT créer dans une collection whitelistée (recettes)", async () => {
    const db = asUser({ schoolId: SCHOOL_A, role: "direction" });
    await assertSucceeds(
      setDoc(doc(db, `ecoles/${SCHOOL_A}/recettes/r1`), { montant: 100 }),
    );
  });
});

// ───────────────────────────────────────────────────────────
// 5. Cloisonnement pédagogique primaire / collège / lycée
// ───────────────────────────────────────────────────────────
describe("5. Cloisonnement pédagogique", () => {
  beforeEach(async () => {
    await seed(async (db) => {
      await setDoc(doc(db, `ecoles/${SCHOOL_A}/notesPrimaire/n1`), { val: 8 });
      await setDoc(doc(db, `ecoles/${SCHOOL_A}/notesCollege/n2`), { val: 12 });
    });
  });

  test("rôle 'college' NE PEUT PAS lire notesPrimaire", async () => {
    const db = asUser({ schoolId: SCHOOL_A, role: "college" });
    await assertFails(getDoc(doc(db, `ecoles/${SCHOOL_A}/notesPrimaire/n1`)));
  });

  test("rôle 'primaire' NE PEUT PAS lire notesCollege", async () => {
    const db = asUser({ schoolId: SCHOOL_A, role: "primaire" });
    await assertFails(getDoc(doc(db, `ecoles/${SCHOOL_A}/notesCollege/n2`)));
  });

  test("rôle 'primaire' PEUT écrire notesPrimaire", async () => {
    const db = asUser({ schoolId: SCHOOL_A, role: "primaire" });
    await assertSucceeds(
      setDoc(doc(db, `ecoles/${SCHOOL_A}/notesPrimaire/n3`), { val: 9 }),
    );
  });

  test("rôle 'college' PEUT écrire notesCollege", async () => {
    const db = asUser({ schoolId: SCHOOL_A, role: "college" });
    await assertSucceeds(
      setDoc(doc(db, `ecoles/${SCHOOL_A}/notesCollege/n4`), { val: 14 }),
    );
  });

  test("rôle 'primaire' NE PEUT PAS écrire absences collège", async () => {
    const db = asUser({ schoolId: SCHOOL_A, role: "primaire" });
    await assertFails(
      setDoc(doc(db, `ecoles/${SCHOOL_A}/elevesCollege_absences/a1`), {
        date: 1,
      }),
    );
  });
});

// ───────────────────────────────────────────────────────────
// 6. Parent : messageParentValide uniquement
// ───────────────────────────────────────────────────────────
describe("6. Parent restreint", () => {
  function payloadParentValide() {
    return {
      expediteur: "parent",
      sujet: "Question scolarité",
      corps: "Bonjour, j'aimerais savoir si...",
    };
  }

  test("parent PEUT créer un message conforme", async () => {
    const db = asUser({ schoolId: SCHOOL_A, role: "parent" });
    await assertSucceeds(
      setDoc(doc(db, `ecoles/${SCHOOL_A}/messages/m1`), payloadParentValide()),
    );
  });

  test("parent NE PEUT PAS usurper expediteur=admin", async () => {
    const db = asUser({ schoolId: SCHOOL_A, role: "parent" });
    await assertFails(
      setDoc(doc(db, `ecoles/${SCHOOL_A}/messages/m2`), {
        ...payloadParentValide(),
        expediteur: "admin",
      }),
    );
  });

  test("parent NE PEUT PAS créer un message avec sujet vide", async () => {
    const db = asUser({ schoolId: SCHOOL_A, role: "parent" });
    await assertFails(
      setDoc(doc(db, `ecoles/${SCHOOL_A}/messages/m3`), {
        ...payloadParentValide(),
        sujet: "",
      }),
    );
  });

  test("parent NE PEUT PAS lire les recettes", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, `ecoles/${SCHOOL_A}/recettes/r1`), { montant: 100 });
    });
    const db = asUser({ schoolId: SCHOOL_A, role: "parent" });
    await assertFails(getDoc(doc(db, `ecoles/${SCHOOL_A}/recettes/r1`)));
  });

  test("parent NE PEUT PAS lire les messages (pas dans backOfficeRoles)", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, `ecoles/${SCHOOL_A}/messages/m0`), {
        expediteur: "direction",
        sujet: "x",
        corps: "y",
      });
    });
    const db = asUser({ schoolId: SCHOOL_A, role: "parent" });
    await assertFails(getDoc(doc(db, `ecoles/${SCHOOL_A}/messages/m0`)));
  });

  test("parent NE PEUT PAS modifier un message existant", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, `ecoles/${SCHOOL_A}/messages/m0`), {
        expediteur: "parent",
        sujet: "x",
        corps: "y",
      });
    });
    const db = asUser({ schoolId: SCHOOL_A, role: "parent" });
    await assertFails(
      updateDoc(doc(db, `ecoles/${SCHOOL_A}/messages/m0`), { corps: "edit" }),
    );
  });
});

// ───────────────────────────────────────────────────────────
// 7. Champs plan protégés
// ───────────────────────────────────────────────────────────
describe("7. Champs plan protégés", () => {
  beforeEach(async () => {
    await seed(async (db) => {
      await setDoc(doc(db, `ecoles/${SCHOOL_A}`), {
        nom: "École A",
        plan: "free",
      });
    });
  });

  test("direction PEUT modifier le nom de l'école", async () => {
    const db = asUser({ schoolId: SCHOOL_A, role: "direction" });
    await assertSucceeds(
      updateDoc(doc(db, `ecoles/${SCHOOL_A}`), { nom: "École Alpha" }),
    );
  });

  test("direction NE PEUT PAS muter le champ plan", async () => {
    const db = asUser({ schoolId: SCHOOL_A, role: "direction" });
    await assertFails(
      updateDoc(doc(db, `ecoles/${SCHOOL_A}`), { plan: "premium" }),
    );
  });

  test("direction NE PEUT PAS muter planExpiry", async () => {
    const db = asUser({ schoolId: SCHOOL_A, role: "direction" });
    await assertFails(
      updateDoc(doc(db, `ecoles/${SCHOOL_A}`), { planExpiry: 9999 }),
    );
  });

  test("admin NE PEUT PAS modifier l'école (admin = lecture seule)", async () => {
    const db = asUser({ schoolId: SCHOOL_A, role: "admin" });
    await assertFails(
      updateDoc(doc(db, `ecoles/${SCHOOL_A}`), { nom: "Hacked" }),
    );
  });

  test("comptable PEUT muter UNIQUEMENT le champ monnaie", async () => {
    const db = asUser({ schoolId: SCHOOL_A, role: "comptable" });
    await assertSucceeds(
      updateDoc(doc(db, `ecoles/${SCHOOL_A}`), { monnaie: "XOF" }),
    );
  });

  test("comptable NE PEUT PAS muter d'autres champs (ex: nom)", async () => {
    const db = asUser({ schoolId: SCHOOL_A, role: "comptable" });
    await assertFails(
      updateDoc(doc(db, `ecoles/${SCHOOL_A}`), { nom: "Hacked" }),
    );
  });

  test("comptable NE PEUT PAS muter monnaie + autre champ ensemble", async () => {
    const db = asUser({ schoolId: SCHOOL_A, role: "comptable" });
    await assertFails(
      updateDoc(doc(db, `ecoles/${SCHOOL_A}`), { monnaie: "USD", nom: "Hack" }),
    );
  });

  test("superadmin PEUT muter le champ plan", async () => {
    const db = asUser({ schoolId: "central", role: "superadmin" });
    await assertSucceeds(
      updateDoc(doc(db, `ecoles/${SCHOOL_A}`), { plan: "premium" }),
    );
  });

  test("aucun rôle NE PEUT supprimer une école (delete: false)", async () => {
    const dbSuper = asUser({ schoolId: "central", role: "superadmin" });
    await assertFails(deleteDoc(doc(dbSuper, `ecoles/${SCHOOL_A}`)));
  });
});

// ───────────────────────────────────────────────────────────
// 8. Lecture anonyme limitée
// ───────────────────────────────────────────────────────────
describe("8. Anonyme", () => {
  beforeEach(async () => {
    await seed(async (db) => {
      await setDoc(doc(db, `ecoles/${SCHOOL_A}/annonces/a1`), { titre: "Bienvenue" });
      await setDoc(doc(db, `ecoles/${SCHOOL_A}/honneurs/h1`), { eleve: "X" });
      await setDoc(doc(db, `ecoles/${SCHOOL_A}/recettes/r1`), { montant: 100 });
      await setDoc(doc(db, `ecoles/${SCHOOL_A}/comptes/c1`), { login: "x" });
      await setDoc(doc(db, `ecoles_public/${SCHOOL_A}`), { nom: "École A" });
    });
  });

  test("anonyme PEUT lire les annonces", async () => {
    const db = asAnon();
    await assertSucceeds(getDoc(doc(db, `ecoles/${SCHOOL_A}/annonces/a1`)));
  });

  test("anonyme PEUT lire honneurs", async () => {
    const db = asAnon();
    await assertSucceeds(getDoc(doc(db, `ecoles/${SCHOOL_A}/honneurs/h1`)));
  });

  test("anonyme PEUT lire ecoles_public", async () => {
    const db = asAnon();
    await assertSucceeds(getDoc(doc(db, `ecoles_public/${SCHOOL_A}`)));
  });

  test("anonyme NE PEUT PAS lire les recettes", async () => {
    const db = asAnon();
    await assertFails(getDoc(doc(db, `ecoles/${SCHOOL_A}/recettes/r1`)));
  });

  test("anonyme NE PEUT PAS lire les comptes", async () => {
    const db = asAnon();
    await assertFails(getDoc(doc(db, `ecoles/${SCHOOL_A}/comptes/c1`)));
  });

  test("anonyme NE PEUT PAS écrire une annonce", async () => {
    const db = asAnon();
    await assertFails(
      setDoc(doc(db, `ecoles/${SCHOOL_A}/annonces/a2`), { titre: "Spam" }),
    );
  });

  test("anonyme NE PEUT PAS écrire dans ecoles_public", async () => {
    const db = asAnon();
    await assertFails(
      setDoc(doc(db, `ecoles_public/${SCHOOL_A}`), { nom: "Hack" }),
    );
  });
});

// ───────────────────────────────────────────────────────────
// 9. audit_securite
// ───────────────────────────────────────────────────────────
describe("9. audit_securite", () => {
  beforeEach(async () => {
    await seed(async (db) => {
      await setDoc(doc(db, `ecoles/${SCHOOL_A}/audit_securite/a1`), {
        action: "login",
      });
    });
  });

  test("direction PEUT lire un événement d'audit", async () => {
    const db = asUser({ schoolId: SCHOOL_A, role: "direction" });
    await assertSucceeds(getDoc(doc(db, `ecoles/${SCHOOL_A}/audit_securite/a1`)));
  });

  test("admin NE PEUT PAS lire l'audit (réservé direction + superadmin)", async () => {
    const db = asUser({ schoolId: SCHOOL_A, role: "admin" });
    await assertFails(getDoc(doc(db, `ecoles/${SCHOOL_A}/audit_securite/a1`)));
  });

  test("comptable NE PEUT PAS lire l'audit", async () => {
    const db = asUser({ schoolId: SCHOOL_A, role: "comptable" });
    await assertFails(getDoc(doc(db, `ecoles/${SCHOOL_A}/audit_securite/a1`)));
  });

  test("aucun rôle NE PEUT écrire dans l'audit côté client", async () => {
    const dbDir = asUser({ schoolId: SCHOOL_A, role: "direction" });
    await assertFails(
      setDoc(doc(dbDir, `ecoles/${SCHOOL_A}/audit_securite/a2`), { action: "x" }),
    );
    const dbSuper = asUser({ schoolId: "central", role: "superadmin" });
    await assertFails(
      setDoc(doc(dbSuper, `ecoles/${SCHOOL_A}/audit_securite/a3`), { action: "x" }),
    );
  });
});

// ───────────────────────────────────────────────────────────
// 10. pushSubs — payload validé, self only
// ───────────────────────────────────────────────────────────
describe("10. pushSubs", () => {
  function payloadValide({ uid, role, nom = "Alice" }) {
    return {
      subscription: { endpoint: "https://example/push" },
      role,
      nom,
      uid,
      updatedAt: 1700000000000,
    };
  }

  test("user PEUT créer son propre push sub avec payload valide", async () => {
    const uid = "user-123";
    const db = asUser({ uid, schoolId: SCHOOL_A, role: "direction" });
    await assertSucceeds(
      setDoc(
        doc(db, `ecoles/${SCHOOL_A}/pushSubs/${uid}`),
        payloadValide({ uid, role: "direction" }),
      ),
    );
  });

  test("user NE PEUT PAS créer un push sub avec un uid différent du sien", async () => {
    const uid = "user-123";
    const db = asUser({ uid, schoolId: SCHOOL_A, role: "direction" });
    await assertFails(
      setDoc(
        doc(db, `ecoles/${SCHOOL_A}/pushSubs/autre-user`),
        payloadValide({ uid: "autre-user", role: "direction" }),
      ),
    );
  });

  test("user NE PEUT PAS créer un push sub dont le rôle ment", async () => {
    const uid = "user-123";
    const db = asUser({ uid, schoolId: SCHOOL_A, role: "comptable" });
    await assertFails(
      setDoc(
        doc(db, `ecoles/${SCHOOL_A}/pushSubs/${uid}`),
        payloadValide({ uid, role: "direction" }),
      ),
    );
  });

  test("user NE PEUT PAS créer un push sub avec un champ inattendu", async () => {
    const uid = "user-123";
    const db = asUser({ uid, schoolId: SCHOOL_A, role: "direction" });
    await assertFails(
      setDoc(doc(db, `ecoles/${SCHOOL_A}/pushSubs/${uid}`), {
        ...payloadValide({ uid, role: "direction" }),
        injected: "evil",
      }),
    );
  });

  test("direction PEUT lire les push subs des autres", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, `ecoles/${SCHOOL_A}/pushSubs/u1`), { uid: "u1" });
    });
    const db = asUser({ schoolId: SCHOOL_A, role: "direction" });
    await assertSucceeds(getDoc(doc(db, `ecoles/${SCHOOL_A}/pushSubs/u1`)));
  });

  test("parent PEUT lire son propre push sub", async () => {
    const uid = "parent-1";
    await seed(async (db) => {
      await setDoc(doc(db, `ecoles/${SCHOOL_A}/pushSubs/${uid}`), { uid });
    });
    const db = asUser({ uid, schoolId: SCHOOL_A, role: "parent" });
    await assertSucceeds(getDoc(doc(db, `ecoles/${SCHOOL_A}/pushSubs/${uid}`)));
  });

  test("parent NE PEUT PAS lire le push sub d'un autre user", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, `ecoles/${SCHOOL_A}/pushSubs/u1`), { uid: "u1" });
    });
    const db = asUser({ uid: "parent-1", schoolId: SCHOOL_A, role: "parent" });
    await assertFails(getDoc(doc(db, `ecoles/${SCHOOL_A}/pushSubs/u1`)));
  });

  test("user PEUT supprimer son propre push sub", async () => {
    const uid = "user-1";
    await seed(async (db) => {
      await setDoc(doc(db, `ecoles/${SCHOOL_A}/pushSubs/${uid}`), { uid });
    });
    const db = asUser({ uid, schoolId: SCHOOL_A, role: "direction" });
    await assertSucceeds(deleteDoc(doc(db, `ecoles/${SCHOOL_A}/pushSubs/${uid}`)));
  });

  test("user NE PEUT PAS supprimer le push sub d'un autre", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, `ecoles/${SCHOOL_A}/pushSubs/u1`), { uid: "u1" });
    });
    const db = asUser({ uid: "user-2", schoolId: SCHOOL_A, role: "direction" });
    await assertFails(deleteDoc(doc(db, `ecoles/${SCHOOL_A}/pushSubs/u1`)));
  });
});

// ───────────────────────────────────────────────────────────
// 11. paiements — read restreint, jamais d'écriture client
// ───────────────────────────────────────────────────────────
describe("11. paiements", () => {
  beforeEach(async () => {
    await seed(async (db) => {
      await setDoc(doc(db, `ecoles/${SCHOOL_A}/paiements/p1`), { montant: 1000 });
    });
  });

  test("direction / admin / comptable PEUVENT lire", async () => {
    for (const role of ["direction", "admin", "comptable"]) {
      const db = asUser({ schoolId: SCHOOL_A, role });
      await assertSucceeds(getDoc(doc(db, `ecoles/${SCHOOL_A}/paiements/p1`)));
    }
  });

  test("primaire / college / parent NE PEUVENT PAS lire", async () => {
    for (const role of ["primaire", "college", "parent"]) {
      const db = asUser({ schoolId: SCHOOL_A, role });
      await assertFails(getDoc(doc(db, `ecoles/${SCHOOL_A}/paiements/p1`)));
    }
  });

  test("aucun rôle NE PEUT créer un paiement côté client", async () => {
    for (const role of ["direction", "admin", "comptable", "superadmin"]) {
      const claims =
        role === "superadmin"
          ? { schoolId: "central", role }
          : { schoolId: SCHOOL_A, role };
      const db = asUser(claims);
      await assertFails(
        setDoc(doc(db, `ecoles/${SCHOOL_A}/paiements/p2`), { montant: 1 }),
      );
    }
  });
});

// ───────────────────────────────────────────────────────────
// 12. demandes_plan
// ───────────────────────────────────────────────────────────
describe("12. demandes_plan", () => {
  test("direction PEUT créer une demande", async () => {
    const db = asUser({ schoolId: SCHOOL_A, role: "direction" });
    await assertSucceeds(
      setDoc(doc(db, `ecoles/${SCHOOL_A}/demandes_plan/d1`), { plan: "premium" }),
    );
  });

  test("comptable PEUT créer une demande", async () => {
    const db = asUser({ schoolId: SCHOOL_A, role: "comptable" });
    await assertSucceeds(
      setDoc(doc(db, `ecoles/${SCHOOL_A}/demandes_plan/d2`), { plan: "premium" }),
    );
  });

  test("admin NE PEUT PAS créer une demande", async () => {
    const db = asUser({ schoolId: SCHOOL_A, role: "admin" });
    await assertFails(
      setDoc(doc(db, `ecoles/${SCHOOL_A}/demandes_plan/d3`), { plan: "premium" }),
    );
  });

  test("superadmin PEUT mettre à jour une demande", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, `ecoles/${SCHOOL_A}/demandes_plan/d1`), {
        plan: "premium",
        statut: "en_attente",
      });
    });
    const db = asUser({ schoolId: "central", role: "superadmin" });
    await assertSucceeds(
      updateDoc(doc(db, `ecoles/${SCHOOL_A}/demandes_plan/d1`), {
        statut: "approuve",
      }),
    );
  });

  test("direction NE PEUT PAS mettre à jour une demande", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, `ecoles/${SCHOOL_A}/demandes_plan/d1`), {
        statut: "en_attente",
      });
    });
    const db = asUser({ schoolId: SCHOOL_A, role: "direction" });
    await assertFails(
      updateDoc(doc(db, `ecoles/${SCHOOL_A}/demandes_plan/d1`), {
        statut: "approuve",
      }),
    );
  });

  test("aucun rôle NE PEUT supprimer une demande", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, `ecoles/${SCHOOL_A}/demandes_plan/d1`), {
        statut: "en_attente",
      });
    });
    const dbSuper = asUser({ schoolId: "central", role: "superadmin" });
    await assertFails(
      deleteDoc(doc(dbSuper, `ecoles/${SCHOOL_A}/demandes_plan/d1`)),
    );
  });
});

// ───────────────────────────────────────────────────────────
// 13. Top-level : /users, /superadmins, /config, /transferts
// ───────────────────────────────────────────────────────────
describe("13. Top-level collections", () => {
  beforeEach(async () => {
    await seed(async (db) => {
      await setDoc(doc(db, `users/u1`), { schoolId: SCHOOL_A, role: "direction" });
      await setDoc(doc(db, `superadmins/s1`), { login: "boss" });
      await setDoc(doc(db, `config/global`), { devise: "FCFA" });
      await setDoc(doc(db, `transferts/t1`), { montant: 100 });
    });
  });

  test("/users : self read OK", async () => {
    const db = asUser({ uid: "u1", schoolId: SCHOOL_A, role: "direction" });
    await assertSucceeds(getDoc(doc(db, `users/u1`)));
  });

  test("/users : autre user → fail", async () => {
    const db = asUser({ uid: "u2", schoolId: SCHOOL_A, role: "direction" });
    await assertFails(getDoc(doc(db, `users/u1`)));
  });

  test("/users : aucune écriture client", async () => {
    const db = asUser({ uid: "u1", schoolId: SCHOOL_A, role: "direction" });
    await assertFails(updateDoc(doc(db, `users/u1`), { role: "superadmin" }));
  });

  test("/superadmins : aucun rôle ne lit", async () => {
    const dbSuper = asUser({ schoolId: "central", role: "superadmin" });
    await assertFails(getDoc(doc(dbSuper, `superadmins/s1`)));
  });

  test("/superadmins : aucune écriture", async () => {
    const dbSuper = asUser({ schoolId: "central", role: "superadmin" });
    await assertFails(setDoc(doc(dbSuper, `superadmins/s2`), { login: "x" }));
  });

  test("/config : lecture publique", async () => {
    await assertSucceeds(getDoc(doc(asAnon(), `config/global`)));
  });

  test("/config : superadmin écrit", async () => {
    const db = asUser({ schoolId: "central", role: "superadmin" });
    await assertSucceeds(updateDoc(doc(db, `config/global`), { devise: "EUR" }));
  });

  test("/config : direction NE PEUT PAS écrire", async () => {
    const db = asUser({ schoolId: SCHOOL_A, role: "direction" });
    await assertFails(updateDoc(doc(db, `config/global`), { devise: "EUR" }));
  });

  test("/transferts : aucun accès, même superadmin", async () => {
    const dbSuper = asUser({ schoolId: "central", role: "superadmin" });
    await assertFails(getDoc(doc(dbSuper, `transferts/t1`)));
    await assertFails(setDoc(doc(dbSuper, `transferts/t2`), { montant: 1 }));
  });
});

// ───────────────────────────────────────────────────────────
// 14. superadmin_messages + sub /lectures + collection group demandes_plan
// ───────────────────────────────────────────────────────────
describe("14. superadmin_messages & collection group", () => {
  beforeEach(async () => {
    await seed(async (db) => {
      await setDoc(doc(db, `superadmin_messages/m1`), { titre: "Annonce" });
      await setDoc(doc(db, `ecoles/${SCHOOL_A}/demandes_plan/d1`), {
        plan: "premium",
      });
      await setDoc(doc(db, `ecoles/${SCHOOL_B}/demandes_plan/d2`), {
        plan: "premium",
      });
    });
  });

  test("superadmin PEUT lire superadmin_messages", async () => {
    const db = asUser({ schoolId: "central", role: "superadmin" });
    await assertSucceeds(getDoc(doc(db, `superadmin_messages/m1`)));
  });

  test("direction NE PEUT PAS lire superadmin_messages", async () => {
    const db = asUser({ schoolId: SCHOOL_A, role: "direction" });
    await assertFails(getDoc(doc(db, `superadmin_messages/m1`)));
  });

  test("staff non-parent PEUT créer sa propre lecture", async () => {
    const uid = "staff-1";
    const db = asUser({ uid, schoolId: SCHOOL_A, role: "direction" });
    await assertSucceeds(
      setDoc(doc(db, `superadmin_messages/m1/lectures/${uid}`), { lu: true }),
    );
  });

  test("parent NE PEUT PAS créer une lecture", async () => {
    const uid = "parent-1";
    const db = asUser({ uid, schoolId: SCHOOL_A, role: "parent" });
    await assertFails(
      setDoc(doc(db, `superadmin_messages/m1/lectures/${uid}`), { lu: true }),
    );
  });

  test("user NE PEUT PAS créer une lecture pour quelqu'un d'autre", async () => {
    const db = asUser({ uid: "u1", schoolId: SCHOOL_A, role: "direction" });
    await assertFails(
      setDoc(doc(db, `superadmin_messages/m1/lectures/autre`), { lu: true }),
    );
  });

  test("collection group demandes_plan : superadmin PEUT lister", async () => {
    const db = asUser({ schoolId: "central", role: "superadmin" });
    await assertSucceeds(getDocs(collectionGroup(db, "demandes_plan")));
  });

  test("collection group demandes_plan : direction NE PEUT PAS lister", async () => {
    const db = asUser({ schoolId: SCHOOL_A, role: "direction" });
    await assertFails(getDocs(collectionGroup(db, "demandes_plan")));
  });
});

// ───────────────────────────────────────────────────────────
// 15. Archive multi-années — lecture cross-année autorisée
// ───────────────────────────────────────────────────────────
// L'isolation Firestore est faite par schoolId, pas par annee. Le champ `annee`
// est purement applicatif : c'est le client (useFirestore) qui filtre via
// where("annee","=="). Les rules ne doivent jamais bloquer une lecture sur la
// base de `annee` — sinon l'archive multi-années serait cassée.
describe("15. Archive multi-années — lecture cross-année", () => {
  beforeEach(async () => {
    await seed(async (db) => {
      await setDoc(doc(db, `ecoles/${SCHOOL_A}/recettes/r-courant`), { montant: 100, annee: "2025-2026" });
      await setDoc(doc(db, `ecoles/${SCHOOL_A}/recettes/r-passe`), { montant: 50, annee: "2024-2025" });
      await setDoc(doc(db, `ecoles/${SCHOOL_A}/recettes/r-legacy`), { montant: 25 }); // pas de champ annee
      await setDoc(doc(db, `ecoles/${SCHOOL_A}/notesCollege/n-passe`), { val: 14, annee: "2024-2025" });
      await setDoc(doc(db, `ecoles/${SCHOOL_B}/recettes/r-b-passe`), { montant: 999, annee: "2024-2025" });
    });
  });

  test("direction lit une recette d'année passée (même schoolId)", async () => {
    const db = asUser({ schoolId: SCHOOL_A, role: "direction" });
    await assertSucceeds(getDoc(doc(db, `ecoles/${SCHOOL_A}/recettes/r-passe`)));
  });

  test("direction lit une recette legacy sans champ annee", async () => {
    const db = asUser({ schoolId: SCHOOL_A, role: "direction" });
    await assertSucceeds(getDoc(doc(db, `ecoles/${SCHOOL_A}/recettes/r-legacy`)));
  });

  test("direction peut requêter recettes filtrées par annee=2024-2025", async () => {
    const db = asUser({ schoolId: SCHOOL_A, role: "direction" });
    const q = query(collection(db, `ecoles/${SCHOOL_A}/recettes`), where("annee", "==", "2024-2025"));
    await assertSucceeds(getDocs(q));
  });

  test("primaire peut requêter notesCollege de SA section filtré par annee", async () => {
    const db = asUser({ schoolId: SCHOOL_A, role: "college" });
    const q = query(collection(db, `ecoles/${SCHOOL_A}/notesCollege`), where("annee", "==", "2024-2025"));
    await assertSucceeds(getDocs(q));
  });

  test("isolation préservée : direction de A NE PEUT PAS lire recette de B même année passée", async () => {
    const db = asUser({ schoolId: SCHOOL_A, role: "direction" });
    await assertFails(getDoc(doc(db, `ecoles/${SCHOOL_B}/recettes/r-b-passe`)));
  });
});
