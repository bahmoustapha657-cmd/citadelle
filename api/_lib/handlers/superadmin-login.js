import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import bcrypt from "bcryptjs";
import { applyPasswordTarpit } from "../auth-tarpit.js";
import { initAdmin } from "../firebase-admin.js";
import {
  applyCors,
  consumeRateLimit,
  getClientIp,
  sanitizeDisplayName,
} from "../security.js";

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

  try {
    initAdmin();
  } catch {
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
        error: "Trop de tentatives. R�essayez plus tard.",
      });
    }

    const snap = await db.collection("superadmins").get();
    let comptes = snap.docs.map((d) => ({ ...d.data(), _id: d.id }));

    if (comptes.length === 0) {
      const fallbackHash = process.env.SUPERADMIN_PASSWORD_HASH || "";
      if (!fallbackHash) return res.status(401).json({ error: "Aucun super-admin configur�" });
      comptes = [{ login: "superadmin", mdp: fallbackHash, role: "superadmin", nom: "Super Admin" }];
    }

    const compte = comptes.find((c) => c.login === trimmedLogin);
    if (!compte) {
      await applyPasswordTarpit(mdp);
      return res.status(401).json({ error: "Identifiants incorrects" });
    }

    const valide = compte.mdp.startsWith("$2b$")
      ? await bcrypt.compare(mdp, compte.mdp)
      : false;

    if (!valide) {
      if (!compte.mdp.startsWith("$2b$")) {
        await applyPasswordTarpit(mdp);
      }
      return res.status(401).json({ error: "Identifiants incorrects" });
    }

    const email = `${trimmedLogin.toLowerCase()}@superadmin.edugest.app`;
    const displayName = sanitizeDisplayName(compte.nom, "Super Admin");
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

    await db.collection("users").doc(uid).set({
      schoolId: "superadmin",
      role: "superadmin",
      nom: compte.nom || "Super Admin",
      login: trimmedLogin,
      updatedAt: Date.now(),
    }, { merge: true });

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
