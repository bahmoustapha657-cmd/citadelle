import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import bcrypt from "bcryptjs";
import { initAdmin } from "./_lib/firebase-admin.js";
import {
  applyCors,
  consumeRateLimit,
  getClientIp,
} from "./_lib/security.js";

const SUPERADMIN_LOGIN_PATTERN = /^[a-z0-9._-]{3,40}$/i;
const SUPERADMIN_RATE_LIMIT = {
  limit: 5,
  windowMs: 60 * 60 * 1000,
};

export default async function handler(req, res) {
  if (!applyCors(req, res)) return;
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const { login, mdp } = req.body || {};
  if (!login || !mdp) return res.status(400).json({ error: "Identifiants requis" });

  const trimmedLogin = typeof login === "string" ? login.trim() : "";
  if (!SUPERADMIN_LOGIN_PATTERN.test(trimmedLogin)) {
    return res.status(400).json({ error: "Identifiant invalide." });
  }
  if (typeof mdp !== "string" || mdp.length < 8) {
    return res.status(400).json({ error: "Mot de passe invalide." });
  }

  try { initAdmin(); } catch {
    return res.status(500).json({ error: "Erreur serveur" });
  }

  const db = getFirestore();
  const authAdmin = getAuth();
  const clientIp = getClientIp(req);

  try {
    const quota = await consumeRateLimit({
      db,
      scope: "superadmin-login",
      key: `${clientIp}|${trimmedLogin.toLowerCase()}`,
      limit: SUPERADMIN_RATE_LIMIT.limit,
      windowMs: SUPERADMIN_RATE_LIMIT.windowMs,
    });

    if (!quota.ok) {
      res.setHeader("Retry-After", String(Math.ceil(quota.retryAfterMs / 1000)));
      return res.status(quota.status).json({
        error: "Trop de tentatives. Réessayez plus tard.",
      });
    }

    const snap = await db.collection("superadmins").get();
    let comptes = snap.docs.map(d => ({ ...d.data(), _id: d.id }));

    // Fallback uniquement si aucun compte en base — à supprimer après setup initial
    if (comptes.length === 0) {
      const fallbackHash = process.env.SUPERADMIN_PASSWORD_HASH || "";
      if (!fallbackHash) return res.status(401).json({ error: "Aucun super-admin configuré" });
      comptes = [{ login: "superadmin", mdp: fallbackHash, role: "superadmin", nom: "Super Admin" }];
    }

    const compte = comptes.find(c => c.login === trimmedLogin);
    if (!compte) return res.status(401).json({ error: "Identifiants incorrects" });

    const valide = compte.mdp.startsWith("$2b$")
      ? await bcrypt.compare(mdp, compte.mdp)
      : false; // mots de passe en clair refusés

    if (!valide) return res.status(401).json({ error: "Identifiants incorrects" });

    // Créer ou récupérer le compte Firebase Auth du superadmin
    const email = `${trimmedLogin.toLowerCase()}@superadmin.edugest.app`;
    const displayName = compte.nom || "Super Admin";
    let uid;
    try {
      const userRecord = await authAdmin.createUser({ email, password: mdp, displayName });
      uid = userRecord.uid;
    } catch (e) {
      if (e.code === "auth/email-already-exists") {
        const existing = await authAdmin.getUserByEmail(email);
        uid = existing.uid;
      } else throw e;
    }

    await authAdmin.setCustomUserClaims(uid, {
      role: "superadmin",
      schoolId: "superadmin",
    });

    // Créer/mettre à jour le profil /users/{uid} (admin SDK — contourne les règles)
    await db.collection("users").doc(uid).set({
      schoolId: "superadmin",
      role: "superadmin",
      nom: compte.nom || "Super Admin",
      login: trimmedLogin,
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
