import crypto from "crypto";
import { getFirestore } from "firebase-admin/firestore";
import bcrypt from "bcryptjs";
import { initAdmin } from "./_lib/firebase-admin.js";
import {
  applyCors,
  consumeRateLimit,
  getClientIp,
  isValidLogin,
  isValidSchoolId,
  normalizeLogin,
} from "./_lib/security.js";

const RESERVED_SCHOOL_IDS = new Set(["superadmin", "config", "users"]);
const INSCRIPTION_RATE_LIMIT = {
  limit: 5,
  windowMs: 24 * 60 * 60 * 1000,
};
const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!";

const genSlug = (nom) =>
  nom.toLowerCase().trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30) || "ecole";

export function generateSecurePassword(length = 12) {
  const bytes = crypto.randomBytes(length);
  let password = "";
  for (let index = 0; index < length; index += 1) {
    password += PASSWORD_ALPHABET[bytes[index] % PASSWORD_ALPHABET.length];
  }
  return password;
}

export default async function handler(req, res) {
  if (!applyCors(req, res)) return;
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const { nomEcole, ville, pays, adminLogin, adminMdp } = req.body || {};
  const normalizedLogin = normalizeLogin(adminLogin);

  if (!nomEcole?.trim()) return res.status(400).json({ error: "Le nom de l'ecole est requis." });
  if (!ville?.trim()) return res.status(400).json({ error: "La ville est requise." });
  if (!normalizedLogin) return res.status(400).json({ error: "L'identifiant administrateur est requis." });
  if (!adminMdp || adminMdp.length < 8) {
    return res.status(400).json({ error: "Le mot de passe doit contenir au moins 8 caracteres." });
  }
  if (!isValidLogin(normalizedLogin)) {
    return res.status(400).json({ error: "Identifiant invalide. Utilisez 3 a 30 caracteres : lettres, chiffres, ., _ ou -." });
  }

  try {
    initAdmin();
  } catch {
    return res.status(500).json({ error: "Erreur serveur (init)" });
  }

  const db = getFirestore();
  const clientIp = getClientIp(req);
  const schoolId = genSlug(nomEcole);

  if (!isValidSchoolId(schoolId) || RESERVED_SCHOOL_IDS.has(schoolId)) {
    return res.status(400).json({ error: "Le nom de l'ecole produit un code reserve ou invalide. Choisissez un nom different." });
  }

  try {
    const quota = await consumeRateLimit({
      db,
      scope: "inscription",
      key: clientIp,
      limit: INSCRIPTION_RATE_LIMIT.limit,
      windowMs: INSCRIPTION_RATE_LIMIT.windowMs,
    });

    if (!quota.ok) {
      res.setHeader("Retry-After", String(Math.ceil(quota.retryAfterMs / 1000)));
      return res.status(quota.status).json({
        error: "Trop de creations d'ecole depuis cette adresse. Reessayez plus tard.",
      });
    }

    const existing = await db.collection("ecoles").doc(schoolId).get();
    if (existing.exists) {
      return res.status(409).json({ error: "Une ecole avec ce nom existe deja. Choisissez un nom different." });
    }

    await db.collection("ecoles").doc(schoolId).set({
      nom: nomEcole.trim(),
      ville: ville.trim(),
      pays: (pays || "Guinee").trim(),
      createdAt: Date.now(),
      actif: true,
      securityVersion: 2,
    });

    const mdpComptableClair = generateSecurePassword();
    const mdpAdminClair = generateSecurePassword();

    const [mdpDirection, mdpComptable, mdpAdminDefault] = await Promise.all([
      bcrypt.hash(adminMdp, 10),
      bcrypt.hash(mdpComptableClair, 10),
      bcrypt.hash(mdpAdminClair, 10),
    ]);

    const createdAt = Date.now();
    const comptes = [
      {
        login: normalizedLogin,
        mdp: mdpDirection,
        role: "direction",
        label: "Direction",
        statut: "Actif",
        premiereCo: true,
        createdAt,
      },
      {
        login: "comptable",
        mdp: mdpComptable,
        role: "comptable",
        label: "Comptable",
        statut: "Actif",
        premiereCo: true,
        createdAt,
      },
      {
        login: "admin",
        mdp: mdpAdminDefault,
        role: "admin",
        label: "Admin",
        statut: "Actif",
        premiereCo: true,
        createdAt,
      },
    ];

    const batch = db.batch();
    for (const compte of comptes) {
      const ref = db.collection("ecoles").doc(schoolId).collection("comptes").doc();
      batch.set(ref, compte);
    }
    await batch.commit();

    return res.status(200).json({
      ok: true,
      schoolId,
      compteSecondaires: {
        comptable: { login: "comptable", mdp: mdpComptableClair },
        admin: { login: "admin", mdp: mdpAdminClair },
      },
    });
  } catch (e) {
    console.error("inscription error:", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
}
