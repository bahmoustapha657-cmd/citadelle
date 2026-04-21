import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import bcrypt from "bcryptjs";
import { initAdmin } from "./_lib/firebase-admin.js";
import {
  applyCors,
  isAllowedSchoolRole,
  isValidLogin,
  isValidSchoolId,
  normalizeLogin,
  normalizeSchoolId,
  requireSession,
} from "./_lib/security.js";

export default async function handler(req, res) {
  if (!applyCors(req, res)) return;
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const { login, mdp, schoolId } = req.body || {};
  const normalizedLogin = normalizeLogin(login);
  const normalizedSchoolId = normalizeSchoolId(schoolId);

  if (!normalizedLogin || !mdp || !normalizedSchoolId) {
    return res.status(400).json({ error: "Champs requis : login, mdp, schoolId" });
  }
  if (!isValidLogin(normalizedLogin) || !isValidSchoolId(normalizedSchoolId)) {
    return res.status(400).json({ error: "Identifiant ou code école invalide." });
  }
  if (mdp.length < 8) {
    return res.status(400).json({ error: "Le mot de passe doit contenir au moins 8 caractères." });
  }

  try {
    initAdmin();
  } catch {
    return res.status(500).json({ error: "Erreur serveur (init)" });
  }

  const isAuthorized = await requireSession(req, res, {
    roles: ["direction", "admin"],
    schoolId: normalizedSchoolId,
    allowSuperadmin: true,
  });
  if (!isAuthorized) return;

  const authAdmin = getAuth();
  const db = getFirestore();

  try {
    const comptesSnap = await db
      .collection("ecoles")
      .doc(normalizedSchoolId)
      .collection("comptes")
      .where("login", "==", normalizedLogin)
      .limit(1)
      .get();

    if (comptesSnap.empty) {
      return res.status(404).json({ error: "Compte Firestore introuvable pour cet identifiant." });
    }

    const compteDoc = comptesSnap.docs[0];
    const compte = compteDoc.data();

    if (!isAllowedSchoolRole(compte.role)) {
      return res.status(403).json({ error: "Rôle de compte invalide. Synchronisation refusée." });
    }
    if (compte.statut && compte.statut !== "Actif") {
      return res.status(403).json({ error: "Ce compte est inactif." });
    }

    const email = `${normalizedLogin}.${normalizedSchoolId}@edugest.app`;
    let userRecord;

    try {
      userRecord = await authAdmin.createUser({
        email,
        password: mdp,
        displayName: compte.nom || normalizedLogin,
      });
    } catch (e) {
      if (e.code === "auth/email-already-exists") {
        const existing = await authAdmin.getUserByEmail(email);
        await authAdmin.updateUser(existing.uid, {
          password: mdp,
          displayName: compte.nom || normalizedLogin,
        });
        userRecord = existing;
      } else {
        throw e;
      }
    }

    const mdpHash = await bcrypt.hash(mdp, 10);

    await authAdmin.setCustomUserClaims(userRecord.uid, {
      role: compte.role,
      schoolId: normalizedSchoolId,
    });

    await db.collection("users").doc(userRecord.uid).set({
      schoolId: normalizedSchoolId,
      role: compte.role,
      nom: compte.nom || normalizedLogin,
      login: normalizedLogin,
      email,
      compteDocId: compteDoc.id,
      premiereCo: !!compte.premiereCo,
      updatedAt: Date.now(),
    }, { merge: true });

    await compteDoc.ref.update({
      mdp: mdpHash,
      uid: userRecord.uid,
      updatedAt: Date.now(),
    });

    return res.status(200).json({ ok: true, uid: userRecord.uid });
  } catch (e) {
    console.error("create-user error:", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
}
