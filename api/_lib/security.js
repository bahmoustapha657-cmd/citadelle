import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { initAdmin } from "./firebase-admin.js";

export const SCHOOL_ROLES = [
  "direction",
  "admin",
  "primaire",
  "college",
  "comptable",
  "enseignant",
  "parent",
];

export const PRIVILEGED_SCHOOL_ROLES = ["direction", "admin"];
export const STAFF_ROLES = [
  "direction",
  "admin",
  "primaire",
  "college",
  "comptable",
  "enseignant",
];

const LOGIN_PATTERN = /^[a-z0-9._-]{3,30}$/;
const SCHOOL_ID_PATTERN = /^[a-z0-9-]{3,50}$/;
const TRANSFER_TOKEN_PATTERN = /^TRF-[A-Z2-9]{6,10}$/;

function parseAllowedOrigins() {
  return (process.env.ALLOWED_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function normalizeLogin(login) {
  return typeof login === "string" ? login.trim().toLowerCase() : "";
}

export function normalizeSchoolId(schoolId) {
  return typeof schoolId === "string" ? schoolId.trim().toLowerCase() : "";
}

export function normalizeTransferToken(token) {
  return typeof token === "string" ? token.trim().toUpperCase() : "";
}

export function isValidLogin(login) {
  return LOGIN_PATTERN.test(login);
}

export function isValidSchoolId(schoolId) {
  return SCHOOL_ID_PATTERN.test(schoolId);
}

export function isValidTransferToken(token) {
  return TRANSFER_TOKEN_PATTERN.test(token);
}

export function isAllowedSchoolRole(role) {
  return SCHOOL_ROLES.includes(role);
}

export function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variable d'environnement manquante: ${name}`);
  }
  return value;
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
    if (!profile?.role || !profile?.schoolId) {
      res.status(403).json({ error: "Profil utilisateur incomplet." });
      return null;
    }
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
