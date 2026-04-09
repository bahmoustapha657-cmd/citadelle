// Script de migration : photos base64 Firestore → Firebase Storage
// Usage : node migrate-photos.mjs
// Prérequis : serviceAccount.json dans le même dossier

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const sa = require("./serviceAccount.json");

initializeApp({
  credential: cert(sa),
  storageBucket: `${sa.project_id}.firebasestorage.app`,
});

const db = getFirestore();
const bucket = getStorage().bucket();

// Convertit une chaîne data:image/...;base64,... en Buffer
function base64VersBuffer(dataUrl) {
  const contenu = dataUrl.split(",")[1];
  return Buffer.from(contenu, "base64");
}

// Détecte le type MIME depuis le data URL
function mimeDepuis(dataUrl) {
  const m = dataUrl.match(/^data:(image\/\w+);base64,/);
  return m ? m[1] : "image/jpeg";
}

function extDepuis(mime) {
  if (mime === "image/png")  return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

async function migrerCollection(schoolId, nomCollection) {
  console.log(`   📂 ${nomCollection}...`);
  const snap = await db.collection("ecoles").doc(schoolId).collection(nomCollection).get();

  let migres = 0, ignores = 0, erreurs = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const photo = data.photo || "";

    // Déjà une URL https → déjà migré, on saute
    if (!photo || photo.startsWith("http")) { ignores++; continue; }

    // Pas un data URL → on saute
    if (!photo.startsWith("data:")) { ignores++; continue; }

    try {
      const mime    = mimeDepuis(photo);
      const ext     = extDepuis(mime);
      const chemin  = `ecoles/${schoolId}/photos/${docSnap.id}.${ext}`;
      const buffer  = base64VersBuffer(photo);

      // Upload dans Firebase Storage
      const fichier = bucket.file(chemin);
      await fichier.save(buffer, {
        metadata: { contentType: mime },
        resumable: false,
      });

      // Rendre le fichier public et obtenir l'URL signée longue durée
      await fichier.makePublic();
      const url = `https://storage.googleapis.com/${bucket.name}/${chemin}`;

      // Mettre à jour Firestore : remplacer base64 par URL
      await docSnap.ref.update({ photo: url });

      console.log(`      ✅ ${docSnap.id} → ${url.slice(0, 60)}...`);
      migres++;
    } catch (e) {
      console.error(`      ❌ ${docSnap.id} : ${e.message}`);
      erreurs++;
    }
  }

  console.log(`      → ${migres} migrés, ${ignores} ignorés, ${erreurs} erreurs`);
  return { migres, erreurs };
}

async function main() {
  console.log("🚀 Migration photos base64 → Firebase Storage\n");

  const ecolesSnap = await db.collection("ecoles").get();
  const schoolIds = ecolesSnap.docs.map(d => d.id);
  console.log(`${schoolIds.length} école(s) : ${schoolIds.join(", ")}\n`);

  let totalMigres = 0, totalErreurs = 0;

  for (const schoolId of schoolIds) {
    console.log(`\n🏫 École : ${schoolId}`);
    for (const col of ["elevesCollege", "elevesPrimaire"]) {
      const { migres, erreurs } = await migrerCollection(schoolId, col);
      totalMigres  += migres;
      totalErreurs += erreurs;
    }
  }

  console.log(`\n✅ Migration terminée : ${totalMigres} photo(s) migrée(s), ${totalErreurs} erreur(s).`);
  process.exit(0);
}

main().catch(e => { console.error("Erreur fatale :", e); process.exit(1); });
