// Seed du profil légal officiel d'une école.
// Écrit /ecoles/{schoolId}/config/legal avec les données fournies
// (par défaut : La Citadelle).
//
// Usage :
//   node seed-legal-profile.mjs                  # → schoolId "citadelle"
//   node seed-legal-profile.mjs <schoolId>       # → schoolId arbitraire
//
// Nécessite serviceAccount.json à la racine (admin SDK).

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const sa = require("./serviceAccount.json");

initializeApp({ credential: cert(sa) });
const db = getFirestore();

const schoolId = process.argv[2] || "citadelle";

// ⚠️ Reflet exact de `legalProfileMock` (src/legal-utils.ts).
// Si tu modifies l'un, mets l'autre à jour.
const profile = {
  promoteur: {
    nom: "Souleymane DIALLO",
    anneeNaissance: 1975,
    lieuNaissance: "Kindia",
  },
  autorisationCreation: {
    numero: "0197/MEN-A/CAB/20",
    dateSignature: "2020-04-29",
    ministre: "Mory SANGARE",
    ministere: "MEN-A",
  },
  arreteOuverture: {
    numero: "A/2022/1065/MEPU-A/SGG",
    dateSignature: "2022-05-17",
    ministre: "Guillaume HAWING",
    ministere: "MEPU-A",
    dureeValiditeAnnees: 5,
  },
  codesStatistiques: {
    maternelle: "541 10 16",
    primaire: "541 10 13",
    secondaire: "954 17 12",
  },
  etablissement: {
    denomination: "Groupe Scolaire Privé La Citadelle",
    quartier: "Dar-Es-Salam",
    commune: "Commune urbaine de Kindia",
    region: "Région de Kindia",
    email: "lacitadelle16@gmail.com",
    // coordonnees: { latitude: ..., longitude: ... }  // note manuscrite illisible
  },
};

async function main() {
  console.log(`\n🏛️  Seed profil légal — école « ${schoolId} »`);
  const ref = db
    .collection("ecoles")
    .doc(schoolId)
    .collection("config")
    .doc("legal");

  const existing = await ref.get();
  if (existing.exists) {
    console.log("ℹ️  Document /config/legal déjà présent — merge des champs.");
  }

  await ref.set(
    {
      ...profile,
      updatedAt: Date.now(),
    },
    { merge: true },
  );

  console.log(`✅ /ecoles/${schoolId}/config/legal écrit.`);
  console.log(`   Agrément : ${profile.arreteOuverture.numero}`);
  console.log(`   Signé le : ${profile.arreteOuverture.dateSignature}`);
  console.log(`   Validité : ${profile.arreteOuverture.dureeValiditeAnnees} ans`);
  process.exit(0);
}

main().catch((e) => {
  console.error("❌ Échec du seed :", e);
  process.exit(1);
});
