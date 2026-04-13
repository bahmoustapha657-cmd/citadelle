// Script de création du compte superadmin
// Usage : node create-superadmin.mjs <login> <motdepasse>
// Exemple : node create-superadmin.mjs superadmin MonMotDePasse123

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createRequire } from "module";
import bcrypt from "bcryptjs";

const require = createRequire(import.meta.url);
const sa = require("./serviceAccount.json");

initializeApp({ credential: cert(sa) });
const db = getFirestore();

const login = process.argv[2];
const mdp   = process.argv[3];

if (!login || !mdp) {
  console.error("❌ Usage : node create-superadmin.mjs <login> <motdepasse>");
  process.exit(1);
}

if (mdp.length < 8) {
  console.error("❌ Le mot de passe doit contenir au moins 8 caractères.");
  process.exit(1);
}

async function main() {
  console.log(`\n🔐 Création du compte superadmin : ${login}`);

  const mdpHash = await bcrypt.hash(mdp, 12);

  await db.collection("superadmins").doc(login).set({
    login,
    mdp: mdpHash,
    nom: "Super Administrateur",
    role: "superadmin",
    createdAt: Date.now(),
  });

  console.log(`✅ Compte superadmin "${login}" créé avec succès.`);
  console.log(`   → Connectez-vous avec le code école : superadmin`);
  console.log(`   → Login : ${login}`);
  console.log(`   → Mot de passe : (celui que vous venez de saisir)\n`);
  process.exit(0);
}

main().catch(e => { console.error("Erreur fatale:", e); process.exit(1); });
