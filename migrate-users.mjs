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

// Génère un mot de passe aléatoire sécurisé
const genererMdp = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!";
  return Array.from({length:12}, () => chars[Math.floor(Math.random()*chars.length)]).join("");
};

const COMPTES_DEFAUT = [
  { login: "admin",     nom: "Administrateur",    role: "admin" },
  { login: "directeur", nom: "Directeur Général", role: "direction" },
  { login: "primaire",  nom: "Dir. Primaire",     role: "primaire" },
  { login: "college",   nom: "Principal Collège", role: "college" },
  { login: "comptable", nom: "Comptable",         role: "comptable" },
];

async function migrerEcole(schoolId) {
  console.log(`\n📚 Migration école : ${schoolId}`);

  const snap = await db.collection("ecoles").doc(schoolId).collection("comptes").get();
  const comptes = snap.empty
    ? COMPTES_DEFAUT.map(c => ({ ...c, _id: c.login }))
    : snap.docs.map(d => ({ ...d.data(), _id: d.id }));

  console.log(`   ${comptes.length} compte(s) trouvé(s)`);
  const mdpsGeneres = {};

  for (const compte of comptes) {
    const loginNorm = (compte.login || "").trim().toLowerCase();
    if (!loginNorm) { console.log(`   ⚠️  Compte sans login ignoré`); continue; }

    const email = `${loginNorm}.${schoolId}@edugest.app`;

    // Si mot de passe hashé ou absent → générer un nouveau mot de passe aléatoire
    let mdpClair = compte.mdp || "";
    if (!mdpClair || mdpClair.startsWith("$2b$")) {
      mdpClair = genererMdp();
      mdpsGeneres[loginNorm] = mdpClair;
      const mdpHash = await bcrypt.hash(mdpClair, 10);
      // Mettre à jour le hash dans Firestore si le doc existe
      if (!snap.empty) {
        const docRef = snap.docs.find(d => (d.data().login||"") === loginNorm);
        if (docRef) await docRef.ref.update({ mdp: mdpHash, premiereCo: true });
      }
      console.log(`   🔑 ${loginNorm} : mot de passe aléatoire généré`);
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
  return mdpsGeneres;
}

async function main() {
  console.log("🚀 Démarrage de la migration Firebase Auth...\n");

  // Récupérer toutes les écoles
  const ecolesSnap = await db.collection("ecoles").get();
  const schoolIds = ecolesSnap.docs.map(d => d.id);

  console.log(`${schoolIds.length} école(s) trouvée(s) : ${schoolIds.join(", ")}`);

  const tousLesMdps = {};
  for (const schoolId of schoolIds) {
    const mdps = await migrerEcole(schoolId);
    if (Object.keys(mdps).length > 0) tousLesMdps[schoolId] = mdps;
  }

  console.log("\n✅ Migration terminée !");
  if (Object.keys(tousLesMdps).length > 0) {
    console.log("\n⚠️  MOTS DE PASSE GÉNÉRÉS — À NOTER MAINTENANT (ne seront plus affichés) :");
    for (const [sid, mdps] of Object.entries(tousLesMdps)) {
      console.log(`\n  École : ${sid}`);
      for (const [login, mdp] of Object.entries(mdps)) {
        console.log(`    ${login.padEnd(12)} → ${mdp}`);
      }
    }
    console.log("");
  }
  process.exit(0);
}

main().catch(e => { console.error("Erreur fatale:", e); process.exit(1); });
