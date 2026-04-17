import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { initAdmin } from "./firebase-admin.js";

function parseAllowedOrigins() {
  return (process.env.ALLOWED_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function applyCors(req, res, methods = "POST,OPTIONS") {
  const allowedOrigins = parseAllowedOrigins();
  const origin = req.headers.origin;
  const isAllowedOrigin =
    !origin ||
    allowedOrigins.length === 0 ||
    allowedOrigins.includes(origin);

  if (isAllowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", origin || allowedOrigins[0] || "*");
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", methods);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export async function requireSession(req, res, options = {}) {
  const { roles = null, schoolId = null, allowSuperadmin = false } = options;
  const authHeader = req.headers.authorization || "";

  if (!authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentification requise." });
    return null;
  }

  try {
    initAdmin();

    const idToken = authHeader.slice("Bearer ".length);
    const decoded = await getAuth().verifyIdToken(idToken);
    const db = getFirestore();
    const userSnap = await db.collection("users").doc(decoded.uid).get();

    if (!userSnap.exists) {
      res.status(403).json({ error: "Profil utilisateur introuvable." });
      return null;
    }

    const profile = userSnap.data();
    const isSuperadmin = profile.role === "superadmin";

    if (schoolId && profile.schoolId !== schoolId && !(allowSuperadmin && isSuperadmin)) {
      res.status(403).json({ error: "Accès refusé pour cette école." });
      return null;
    }

    if (roles && !roles.includes(profile.role) && !(allowSuperadmin && isSuperadmin)) {
      res.status(403).json({ error: "Droits insuffisants." });
      return null;
    }

    return { uid: decoded.uid, profile };
  } catch {
    res.status(401).json({ error: "Session invalide ou expirée." });
    return null;
  }
}
