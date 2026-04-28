import { getFirestore } from "firebase-admin/firestore";
import bcrypt from "bcryptjs";
import { getActiveRoleAccounts, getRoleConfig, getRoleSettingsMap } from "../../../shared/role-config.js";
import { generateSecurePassword } from "../passwords.js";
import { initAdmin } from "../firebase-admin.js";
import { syncEcolePublic } from "../ecole-public.js";
import {
  applyCors,
  consumeRateLimit,
  getClientIp,
  isValidLogin,
  isValidSchoolId,
  normalizeLogin,
} from "../security.js";

const RESERVED_SCHOOL_IDS = new Set(["superadmin", "config", "users"]);
const INSCRIPTION_RATE_LIMIT = {
  limit: 5,
  windowMs: 24 * 60 * 60 * 1000,
};
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

const genSlug = (nom) =>
  nom.toLowerCase().trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30) || "ecole";

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

    const roleSettings = getRoleSettingsMap({
      direction: { login: normalizedLogin },
    });
    const directionConfig = getRoleConfig("direction", roleSettings);
    const secondaryAccounts = getActiveRoleAccounts(roleSettings).filter((account) => account.role !== "direction");

    const ecoleData = {
      nom: nomEcole.trim(),
      ville: ville.trim(),
      pays: (pays || "Guinee").trim(),
      ...DEFAULT_SCHOOL_BRANDING,
      roleSettings,
      createdAt: Date.now(),
      actif: true,
      securityVersion: 2,
    };

    await db.collection("ecoles").doc(schoolId).set(ecoleData);
    await syncEcolePublic(db, schoolId, ecoleData);

    const createdAt = Date.now();
    const bootstrapPasswords = Object.fromEntries(
      secondaryAccounts.map((account) => [account.role, generateSecurePassword()]),
    );
    const hashedBootstrapAccounts = await Promise.all([
      bcrypt.hash(adminMdp, 10),
      ...secondaryAccounts.map((account) => bcrypt.hash(bootstrapPasswords[account.role], 10)),
    ]);

    const [mdpDirection, ...hashedDefaults] = hashedBootstrapAccounts;
    const comptes = [
      {
        login: directionConfig.login,
        mdp: mdpDirection,
        role: "direction",
        nom: directionConfig.nom,
        label: directionConfig.label,
        statut: "Actif",
        premiereCo: true,
        createdAt,
        updatedAt: createdAt,
      },
      ...secondaryAccounts.map((account, index) => ({
        login: account.login,
        mdp: hashedDefaults[index],
        role: account.role,
        nom: account.nom,
        label: account.label,
        statut: account.active ? "Actif" : "Inactif",
        premiereCo: true,
        createdAt,
        updatedAt: createdAt,
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
        secondaryAccounts.map((account) => [
          account.role,
          { login: account.login, mdp: bootstrapPasswords[account.role], label: account.label },
        ]),
      ),
    });
  } catch (e) {
    console.error("inscription error:", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
}
