import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import bcrypt from "bcryptjs";
import { initAdmin } from "./_lib/firebase-admin.js";
import {
  applyCors,
  consumeRateLimit,
  getClientIp,
  isAllowedSchoolRole,
  isValidLogin,
  isValidSchoolId,
  normalizeLogin,
  normalizeSchoolId,
} from "./_lib/security.js";

const LOGIN_RATE_LIMIT = {
  limit: 10,
  windowMs: 15 * 60 * 1000,
};

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

  try {
    initAdmin();
  } catch {
    return res.status(500).json({ error: "Erreur serveur (init)" });
  }

  const authAdmin = getAuth();
  const db = getFirestore();
  const clientIp = getClientIp(req);

  try {
    const quota = await consumeRateLimit({
      db,
      scope: "login",
      key: `${clientIp}|${normalizedSchoolId}|${normalizedLogin}`,
      limit: LOGIN_RATE_LIMIT.limit,
      windowMs: LOGIN_RATE_LIMIT.windowMs,
    });

    if (!quota.ok) {
      res.setHeader("Retry-After", String(Math.ceil(quota.retryAfterMs / 1000)));
      return res.status(quota.status).json({
        error: "Trop de tentatives de connexion. Réessayez plus tard.",
      });
    }

    const comptesSnap = await db
      .collection("ecoles")
      .doc(normalizedSchoolId)
      .collection("comptes")
      .where("login", "==", normalizedLogin)
      .limit(1)
      .get();

    if (comptesSnap.empty) {
      return res.status(401).json({ error: "Identifiant ou mot de passe incorrect." });
    }

    const compteDoc = comptesSnap.docs[0];
    const compte = { ...compteDoc.data(), _id: compteDoc.id };

    if (!compte.mdp?.startsWith("$2b$")) {
      return res.status(401).json({ error: "Compte non sécurisé. Contactez l'administrateur." });
    }
    if (compte.statut && compte.statut !== "Actif") {
      return res.status(403).json({ error: "Ce compte est inactif." });
    }
    if (!isAllowedSchoolRole(compte.role)) {
      return res.status(403).json({ error: "Rôle de compte invalide. Contactez l'administrateur." });
    }

    const valide = await bcrypt.compare(mdp, compte.mdp);
    if (!valide) {
      return res.status(401).json({ error: "Identifiant ou mot de passe incorrect." });
    }

    const email = `${normalizedLogin}.${normalizedSchoolId}@edugest.app`;
    const displayName = compte.nom || normalizedLogin;
    let uid;

    try {
      const userRecord = await authAdmin.createUser({ email, password: mdp, displayName });
      uid = userRecord.uid;
    } catch (e) {
      if (e.code === "auth/email-already-exists") {
        const existing = await authAdmin.getUserByEmail(email);
        if (existing.displayName !== displayName) {
          await authAdmin.updateUser(existing.uid, { displayName });
        }
        uid = existing.uid;
      } else {
        throw e;
      }
    }

    await authAdmin.setCustomUserClaims(uid, {
      role: compte.role,
      schoolId: normalizedSchoolId,
    });

    await db.collection("users").doc(uid).set({
      schoolId: normalizedSchoolId,
      role: compte.role,
      nom: compte.nom || normalizedLogin,
      login: normalizedLogin,
      email,
      compteDocId: compte._id,
      premiereCo: !!compte.premiereCo,
      updatedAt: Date.now(),
    }, { merge: true });

    const customToken = await authAdmin.createCustomToken(uid);

    return res.status(200).json({
      ok: true,
      customToken,
      compte: { login: compte.login, role: compte.role, nom: compte.nom || normalizedLogin },
    });
  } catch (e) {
    console.error("login error:", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
}
