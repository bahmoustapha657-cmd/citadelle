import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import bcrypt from "bcryptjs";
import { initAdmin } from "./_lib/firebase-admin.js";
import { applyCors } from "./_lib/security.js";

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const { login, mdp } = req.body || {};
  if (!login || !mdp) return res.status(400).json({ error: "Identifiants requis" });

  try { initAdmin(); } catch {
    return res.status(500).json({ error: "Erreur serveur" });
  }

  const db = getFirestore();
  const authAdmin = getAuth();

  try {
    const snap = await db.collection("superadmins").get();
    let comptes = snap.docs.map(d => ({ ...d.data(), _id: d.id }));

    // Fallback uniquement si aucun compte en base — à supprimer après setup initial
    if (comptes.length === 0) {
      const fallbackHash = process.env.SUPERADMIN_PASSWORD_HASH || "";
      if (!fallbackHash) return res.status(401).json({ error: "Aucun super-admin configuré" });
      comptes = [{ login: "superadmin", mdp: fallbackHash, role: "superadmin", nom: "Super Admin" }];
    }

    const compte = comptes.find(c => c.login === login.trim());
    if (!compte) return res.status(401).json({ error: "Identifiants incorrects" });

    const valide = compte.mdp.startsWith("$2b$")
      ? await bcrypt.compare(mdp, compte.mdp)
      : false; // mots de passe en clair refusés

    if (!valide) return res.status(401).json({ error: "Identifiants incorrects" });

    // Créer ou récupérer le compte Firebase Auth du superadmin
    const email = `${login.trim()}@superadmin.edugest.app`;
    let uid;
    try {
      const userRecord = await authAdmin.createUser({ email, password: mdp, displayName: compte.nom || "Super Admin" });
      uid = userRecord.uid;
    } catch (e) {
      if (e.code === "auth/email-already-exists") {
        const existing = await authAdmin.getUserByEmail(email);
        await authAdmin.updateUser(existing.uid, { password: mdp });
        uid = existing.uid;
      } else throw e;
    }

    // Créer/mettre à jour le profil /users/{uid} (admin SDK — contourne les règles)
    await db.collection("users").doc(uid).set({
      schoolId: "superadmin",
      role: "superadmin",
      nom: compte.nom || "Super Admin",
      login: login.trim(),
      updatedAt: Date.now(),
    }, { merge: true });

    // Retourner un custom token pour que le client soit persistant
    const customToken = await authAdmin.createCustomToken(uid);

    return res.status(200).json({
      ok: true,
      customToken,
      compte: { login: compte.login, role: "superadmin", nom: compte.nom || "Super Admin" },
    });
  } catch (e) {
    console.error("superadmin-login error:", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
}
