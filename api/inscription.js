import crypto from "crypto";
import { getFirestore } from "firebase-admin/firestore";
import bcrypt from "bcryptjs";
import { initAdmin } from "./_lib/firebase-admin.js";
import { syncEcolePublic } from "./_lib/ecole-public.js";
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
const DEFAULT_SCHOOL_BRANDING = {
  type: "Groupe Scolaire Prive",
  couleur1: "#0A1628",
  couleur2: "#00C48C",
  logo: null,
  devise: "",
  accueil: {
    active: false,
    slogan: "",
    texteAccueil: "",
    bannerUrl: "",
    photos: [],
    showAnnonces: true,
    showHonneurs: true,
    showContact: true,
    telephone: "",
    email: "",
    facebook: "",
    whatsapp: "",
    adresse: "",
  },
};
const DEFAULT_BOOTSTRAP_ACCOUNTS = [
  { key: "comptable", login: "comptable", role: "comptable", nom: "Comptable", label: "Comptabilite" },
  { key: "admin", login: "admin", role: "admin", nom: "Administrateur", label: "Administrateur" },
  { key: "primaire", login: "primaire", role: "primaire", nom: "Direction Primaire", label: "Direction Primaire" },
  { key: "college", login: "college", role: "college", nom: "Bureau College", label: "Bureau College" },
];

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

    const ecoleData = {
      nom: nomEcole.trim(),
      ville: ville.trim(),
      pays: (pays || "Guinee").trim(),
      ...DEFAULT_SCHOOL_BRANDING,
      createdAt: Date.now(),
      actif: true,
      securityVersion: 2,
    };

    await db.collection("ecoles").doc(schoolId).set(ecoleData);
    await syncEcolePublic(db, schoolId, ecoleData);

    const createdAt = Date.now();
    const bootstrapPasswords = Object.fromEntries(
      DEFAULT_BOOTSTRAP_ACCOUNTS.map((account) => [account.key, generateSecurePassword()]),
    );
    const hashedBootstrapAccounts = await Promise.all([
      bcrypt.hash(adminMdp, 10),
      ...DEFAULT_BOOTSTRAP_ACCOUNTS.map((account) => bcrypt.hash(bootstrapPasswords[account.key], 10)),
    ]);

    const [mdpDirection, ...hashedDefaults] = hashedBootstrapAccounts;
    const comptes = [
      {
        login: normalizedLogin,
        mdp: mdpDirection,
        role: "direction",
        nom: "Directeur General",
        label: "Direction Generale",
        statut: "Actif",
        premiereCo: true,
        createdAt,
      },
      ...DEFAULT_BOOTSTRAP_ACCOUNTS.map((account, index) => ({
        login: account.login,
        mdp: hashedDefaults[index],
        role: account.role,
        nom: account.nom,
        label: account.label,
        statut: "Actif",
        premiereCo: true,
        createdAt,
      })),
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
      compteSecondaires: Object.fromEntries(
        DEFAULT_BOOTSTRAP_ACCOUNTS.map((account) => [
          account.key,
          { login: account.login, mdp: bootstrapPasswords[account.key], label: account.label },
        ]),
      ),
    });
  } catch (e) {
    console.error("inscription error:", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
}
