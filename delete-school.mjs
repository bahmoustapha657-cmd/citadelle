// Script de suppression d'une école
// Usage : node delete-school.mjs <schoolId>
// Exemple : node delete-school.mjs gsp-la-hac

import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const sa = require("./serviceAccount.json");

initializeApp({ credential: cert(sa) });

const auth = getAuth();
const db = getFirestore();

const schoolId = process.argv[2];
if (!schoolId) {
  console.error("❌ Usage : node delete-school.mjs <schoolId>");
  process.exit(1);
}

async function supprimerSousCollections(docRef) {
  const collections = await docRef.listCollections();
  for (const col of collections) {
    const snap = await col.get();
    for (const d of snap.docs) {
      await supprimerSousCollections(d.ref);
      await d.ref.delete();
    }
    console.log(`   🗑️  Collection /${col.id} supprimée (${snap.size} docs)`);
  }
}

async function main() {
  console.log(`\n⚠️  Suppression de l'école : ${schoolId}`);
  console.log("   Cette action est irréversible !\n");

  // Vérifier que l'école existe
  const ecoleRef = db.collection("ecoles").doc(schoolId);
  const ecoleSnap = await ecoleRef.get();
  if (!ecoleSnap.exists) {
    console.error(`❌ École "${schoolId}" introuvable.`);
    process.exit(1);
  }

  const ecoleData = ecoleSnap.data();
  console.log(`   Nom : ${ecoleData.nom || schoolId}`);

  // Supprimer les comptes Firebase Auth
  const comptesSnap = await db.collection("ecoles").doc(schoolId).collection("comptes").get();
  for (const d of comptesSnap.docs) {
    const login = d.data().login;
    if (!login) continue;
    const email = `${login}.${schoolId}@edugest.app`;
    try {
      const user = await auth.getUserByEmail(email);
      await auth.deleteUser(user.uid);
      await db.collection("users").doc(user.uid).delete();
      console.log(`   ✅ Compte Firebase Auth supprimé : ${email}`);
    } catch (e) {
      if (e.code !== "auth/user-not-found") {
        console.log(`   ⚠️  ${email} : ${e.message}`);
      }
    }
  }

  // Supprimer toutes les sous-collections
  await supprimerSousCollections(ecoleRef);

  // Supprimer le document école
  await ecoleRef.delete();
  console.log(`\n✅ École "${schoolId}" supprimée avec succès.`);
  process.exit(0);
}

main().catch(e => { console.error("Erreur fatale:", e); process.exit(1); });
