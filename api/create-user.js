import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import bcrypt from "bcryptjs";

function initAdmin() {
  if (getApps().length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || "{}";
  let sa;
  try { sa = JSON.parse(raw); } catch { sa = JSON.parse(raw.replace(/\\n/g, "\n")); }
  if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, "\n");
  initializeApp({ credential: cert(sa) });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const { login, mdp, role, nom, schoolId } = req.body || {};
  if (!login || !mdp || !role || !schoolId) {
    return res.status(400).json({ error: "Champs requis : login, mdp, role, schoolId" });
  }

  try { initAdmin(); } catch (e) {
    return res.status(500).json({ error: "Erreur serveur (init)" });
  }

  const authAdmin = getAuth();
  const db = getFirestore();

  // Email synthétique : login.schoolId@edugest.app
  const email = `${login.trim().toLowerCase()}.${schoolId.trim().toLowerCase()}@edugest.app`;

  try {
    let userRecord;

    // Créer ou récupérer l'utilisateur Firebase Auth
    try {
      userRecord = await authAdmin.createUser({
        email,
        password: mdp,
        displayName: nom || login,
      });
    } catch (e) {
      if (e.code === "auth/email-already-exists") {
        // Mise à jour du mot de passe si l'utilisateur existe déjà
        const existing = await authAdmin.getUserByEmail(email);
        await authAdmin.updateUser(existing.uid, { password: mdp, displayName: nom || login });
        userRecord = existing;
      } else {
        throw e;
      }
    }

    // Hasher le mot de passe pour Firestore
    const mdpHash = await bcrypt.hash(mdp, 10);

    // Stocker le profil dans /users/{uid}
    await db.collection("users").doc(userRecord.uid).set({
      schoolId,
      role,
      nom: nom || login,
      login: login.trim().toLowerCase(),
      email,
      updatedAt: Date.now(),
    });

    // Mettre à jour le compte dans /ecoles/{schoolId}/comptes (avec mdp hashé)
    const comptesSnap = await db.collection("ecoles").doc(schoolId).collection("comptes")
      .where("login", "==", login.trim().toLowerCase()).get();

    if (!comptesSnap.empty) {
      await comptesSnap.docs[0].ref.update({ mdp: mdpHash, uid: userRecord.uid });
    }

    return res.status(200).json({ ok: true, uid: userRecord.uid });
  } catch (e) {
    console.error("create-user error:", e);
    return res.status(500).json({ error: e.message || "Erreur serveur" });
  }
}
