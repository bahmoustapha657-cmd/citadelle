import { getFirestore } from "firebase-admin/firestore";
import bcrypt from "bcryptjs";
import { initAdmin } from "./_lib/firebase-admin.js";
import { applyCors, isValidLogin, isValidSchoolId, normalizeLogin } from "./_lib/security.js";

const RESERVED_SCHOOL_IDS = new Set(["superadmin", "config", "users"]);

const genSlug = (nom) =>
  nom.toLowerCase().trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30) || "ecole";

function genPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!";
  let password = "";
  for (let index = 0; index < 12; index += 1) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  return password;
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const { nomEcole, ville, pays, adminLogin, adminMdp } = req.body || {};
  const normalizedLogin = normalizeLogin(adminLogin);

  if (!nomEcole?.trim()) return res.status(400).json({ error: "Le nom de l'école est requis." });
  if (!ville?.trim()) return res.status(400).json({ error: "La ville est requise." });
  if (!normalizedLogin) return res.status(400).json({ error: "L'identifiant administrateur est requis." });
  if (!adminMdp || adminMdp.length < 8) {
    return res.status(400).json({ error: "Le mot de passe doit contenir au moins 8 caractères." });
  }
  if (!isValidLogin(normalizedLogin)) {
    return res.status(400).json({ error: "Identifiant invalide. Utilisez 3 à 30 caractères : lettres, chiffres, ., _ ou -." });
  }

  try {
    initAdmin();
  } catch {
    return res.status(500).json({ error: "Erreur serveur (init)" });
  }

  const db = getFirestore();
  const schoolId = genSlug(nomEcole);

  if (!isValidSchoolId(schoolId) || RESERVED_SCHOOL_IDS.has(schoolId)) {
    return res.status(400).json({ error: "Le nom de l'école produit un code réservé ou invalide. Choisissez un nom différent." });
  }

  try {
    const existing = await db.collection("ecoles").doc(schoolId).get();
    if (existing.exists) {
      return res.status(409).json({ error: "Une école avec ce nom existe déjà. Choisissez un nom différent." });
    }

    await db.collection("ecoles").doc(schoolId).set({
      nom: nomEcole.trim(),
      ville: ville.trim(),
      pays: (pays || "Guinée").trim(),
      createdAt: Date.now(),
      actif: true,
      securityVersion: 1,
    });

    const mdpComptableClair = genPassword();
    const mdpAdminClair = genPassword();

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
    return res.status(500).json({ error: e.message || "Erreur serveur" });
  }
}
