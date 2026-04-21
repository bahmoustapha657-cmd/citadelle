import crypto from "crypto";
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
const RATE_LIMIT_COLLECTION = "_rateLimits";

function parseAllowedOrigins() {
  return (process.env.ALLOWED_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function getForwardedHeaderValue(value) {
  return typeof value === "string" ? value.split(",")[0].trim() : "";
}

export function isProductionEnvironment() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
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

export function getClientIp(req) {
  const forwardedFor = typeof req?.headers?.["x-forwarded-for"] === "string"
    ? req.headers["x-forwarded-for"].split(",")[0].trim()
    : "";
  const realIp = typeof req?.headers?.["x-real-ip"] === "string"
    ? req.headers["x-real-ip"].trim()
    : "";
  const remoteAddress = typeof req?.socket?.remoteAddress === "string"
    ? req.socket.remoteAddress.trim()
    : "";

  return forwardedFor || realIp || remoteAddress || "unknown";
}

export function inferRequestOrigin(req) {
  const host = getForwardedHeaderValue(req?.headers?.["x-forwarded-host"])
    || getForwardedHeaderValue(req?.headers?.host);

  if (!host) {
    return "";
  }

  const protocol = getForwardedHeaderValue(req?.headers?.["x-forwarded-proto"])
    || (req?.socket?.encrypted ? "https" : "")
    || (isProductionEnvironment() ? "https" : "http");

  return `${protocol}://${host}`;
}

export function isSameOriginRequest(req, origin) {
  if (!origin) {
    return false;
  }

  const inferredOrigin = inferRequestOrigin(req);
  if (!inferredOrigin) {
    return false;
  }

  try {
    return new URL(origin).origin === new URL(inferredOrigin).origin;
  } catch {
    return false;
  }
}

export function applyCors(req, res, methods = "POST,OPTIONS") {
  const allowedOrigins = parseAllowedOrigins();
  const origin = typeof req?.headers?.origin === "string" ? req.headers.origin.trim() : "";

  res.setHeader("Access-Control-Allow-Methods", methods);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (!origin) {
    return true;
  }

  if (isSameOriginRequest(req, origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    return true;
  }

  if (allowedOrigins.length === 0) {
    if (isProductionEnvironment()) {
      res.status(500).json({ error: "CORS non configure sur le serveur." });
      return false;
    }

    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    return true;
  }

  if (!allowedOrigins.includes(origin)) {
    res.status(403).json({ error: "Origine non autorisee." });
    return false;
  }

  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  return true;
}

export async function consumeRateLimit({
  db,
  scope,
  key,
  limit,
  windowMs,
  now = Date.now(),
}) {
  const normalizedScope = typeof scope === "string" ? scope.trim().toLowerCase() : "";
  const normalizedKey = typeof key === "string" ? key.trim() : "";

  if (!db || !normalizedScope || !normalizedKey) {
    throw new Error("Parametres de rate limit invalides.");
  }
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("La limite de rate limit est invalide.");
  }
  if (!Number.isFinite(windowMs) || windowMs < 1000) {
    throw new Error("La fenetre de rate limit est invalide.");
  }

  const bucketStart = now - (now % windowMs);
  const retryAfterMs = Math.max(1000, bucketStart + windowMs - now);
  const keyHash = crypto
    .createHash("sha256")
    .update(`${normalizedScope}:${normalizedKey}`)
    .digest("hex");
  const docId = `${normalizedScope}_${keyHash}_${bucketStart}`;
  const docRef = db.collection(RATE_LIMIT_COLLECTION).doc(docId);
  let nextCount = 0;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    const currentCount = snap.exists ? Number(snap.data()?.count || 0) : 0;
    nextCount = currentCount + 1;

    tx.set(docRef, {
      scope: normalizedScope,
      keyHash,
      bucketStart,
      windowMs,
      count: nextCount,
      updatedAt: now,
      expireAt: bucketStart + windowMs,
    }, { merge: true });
  });

  if (nextCount > limit) {
    return {
      ok: false,
      status: 429,
      error: "Trop de tentatives. Reessayez plus tard.",
      retryAfterMs,
    };
  }

  return {
    ok: true,
    remaining: Math.max(0, limit - nextCount),
    retryAfterMs,
  };
}

export function validateSessionProfile(profile, options = {}) {
  const { roles = null, schoolId = null, allowSuperadmin = false } = options;

  if (!profile?.role || !profile?.schoolId) {
    return { ok: false, status: 403, error: "Profil utilisateur incomplet." };
  }

  const isSuperadmin = profile.role === "superadmin";

  if (schoolId && profile.schoolId !== schoolId && !(allowSuperadmin && isSuperadmin)) {
    return { ok: false, status: 403, error: "Acces refuse pour cette ecole." };
  }

  if (roles && !roles.includes(profile.role) && !(allowSuperadmin && isSuperadmin)) {
    return { ok: false, status: 403, error: "Droits insuffisants." };
  }

  return { ok: true, isSuperadmin };
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
    const validation = validateSessionProfile(profile, {
      roles,
      schoolId,
      allowSuperadmin,
    });

    if (!validation.ok) {
      res.status(validation.status).json({ error: validation.error });
      return null;
    }

    return { uid: decoded.uid, profile };
  } catch {
    res.status(401).json({ error: "Session invalide ou expiree." });
    return null;
  }
}
