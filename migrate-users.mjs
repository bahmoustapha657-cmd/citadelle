// Script de migration : Firestore comptes → Firebase Auth
// Usage : node migrate-users.mjs
// Prérequis : serviceAccount.json dans le même dossier

import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { createRequire } from "module";
import bcrypt from "bcryptjs";

const require = createRequire(import.meta.url);
const sa = require("./serviceAccount.json");

initializeApp({ credential: cert(sa) });

const auth = getAuth();
const db = getFirestore();

const COMPTES_DEFAUT = [
  { login: "admin",     nom: "Administrateur",    mdp: "admin123",   role: "admin" },
  { login: "directeur", nom: "Directeur Général", mdp: "dir2024",    role: "direction" },
  { login: "primaire",  nom: "Dir. Primaire",     mdp: "prim2024",   role: "primaire" },
  { login: "college",   nom: "Principal Collège", mdp: "col2024",    role: "college" },
  { login: "comptable", nom: "Comptable",         mdp: "compta2024", role: "comptable" },
];

async function migrerEcole(schoolId) {
  console.log(`\n📚 Migration école : ${schoolId}`);

  const snap = await db.collection("ecoles").doc(schoolId).collection("comptes").get();
  const comptes = snap.empty
    ? COMPTES_DEFAUT.map(c => ({ ...c, _id: c.login }))
    : snap.docs.map(d => ({ ...d.data(), _id: d.id }));

  console.log(`   ${comptes.length} compte(s) trouvé(s)`);

  for (const compte of comptes) {
    const loginNorm = (compte.login || "").trim().toLowerCase();
    if (!loginNorm) { console.log(`   ⚠️  Compte sans login ignoré`); continue; }

    const email = `${loginNorm}.${schoolId}@edugest.app`;

    // Récupérer le mot de passe en clair (si hashé, on utilise le défaut)
    let mdpClair = compte.mdp || "";
    if (mdpClair.startsWith("$2b$")) {
      // Mot de passe hashé — chercher dans les défauts
      const defaut = COMPTES_DEFAUT.find(c => c.login === loginNorm);
      mdpClair = defaut ? defaut.mdp : "Edugest@2024"; // mot de passe temporaire
      console.log(`   ⚠️  ${loginNorm} : mot de passe hashé → mot de passe temporaire utilisé`);
    }

    try {
      let uid;

      try {
        const userRecord = await auth.createUser({
          email,
          password: mdpClair,
          displayName: compte.nom || loginNorm,
        });
        uid = userRecord.uid;
        console.log(`   ✅ ${loginNorm} → créé (${uid})`);
      } catch (e) {
        if (e.code === "auth/email-already-exists") {
          const existing = await auth.getUserByEmail(email);
          await auth.updateUser(existing.uid, { password: mdpClair, displayName: compte.nom || loginNorm });
          uid = existing.uid;
          console.log(`   🔄 ${loginNorm} → mis à jour (${uid})`);
        } else throw e;
      }

      // Créer/mettre à jour le profil /users/{uid}
      await db.collection("users").doc(uid).set({
        schoolId,
        role: compte.role || "admin",
        nom: compte.nom || loginNorm,
        login: loginNorm,
        email,
        updatedAt: Date.now(),
      }, { merge: true });

      // Mettre à jour l'uid dans le document comptes
      if (!snap.empty) {
        const docRef = snap.docs.find(d => d.data().login === loginNorm);
        if (docRef) await docRef.ref.update({ uid });
      }

    } catch (e) {
      console.error(`   ❌ ${loginNorm} : erreur → ${e.message}`);
    }
  }
}

async function main() {
  console.log("🚀 Démarrage de la migration Firebase Auth...\n");

  // Récupérer toutes les écoles
  const ecolesSnap = await db.collection("ecoles").get();
  const schoolIds = ecolesSnap.docs.map(d => d.id);

  console.log(`${schoolIds.length} école(s) trouvée(s) : ${schoolIds.join(", ")}`);

  for (const schoolId of schoolIds) {
    await migrerEcole(schoolId);
  }

  console.log("\n✅ Migration terminée !");
  process.exit(0);
}

main().catch(e => { console.error("Erreur fatale:", e); process.exit(1); });
