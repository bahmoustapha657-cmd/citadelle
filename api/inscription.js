import { getFirestore } from "firebase-admin/firestore";
import bcrypt from "bcryptjs";
import { initAdmin } from "./_lib/firebase-admin.js";
import { applyCors } from "./_lib/security.js";

const LOGIN_PATTERN = /^[a-z0-9._-]{3,30}$/;

const genSlug = (nom) =>
  nom.toLowerCase().trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30) || "ecole";

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const { nomEcole, ville, pays, adminLogin, adminMdp } = req.body || {};
  const normalizedLogin = adminLogin?.trim().toLowerCase();

  if (!nomEcole?.trim()) return res.status(400).json({ error: "Le nom de l'école est requis." });
  if (!ville?.trim()) return res.status(400).json({ error: "La ville est requise." });
  if (!normalizedLogin) return res.status(400).json({ error: "L'identifiant administrateur est requis." });
  if (!adminMdp || adminMdp.length < 6) {
    return res.status(400).json({ error: "Le mot de passe doit contenir au moins 6 caractères." });
  }
  if (!LOGIN_PATTERN.test(normalizedLogin)) {
    return res.status(400).json({ error: "Identifiant invalide. Utilisez 3 à 30 caractères : lettres, chiffres, ., _ ou -." });
  }

  try {
    initAdmin();
  } catch {
    return res.status(500).json({ error: "Erreur serveur (init)" });
  }

  const db = getFirestore();
  const schoolId = genSlug(nomEcole);

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
    });

    const genMdp = () => {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!";
      let pwd = "";
      for (let i = 0; i < 12; i += 1) {
        pwd += chars[Math.floor(Math.random() * chars.length)];
      }
      return pwd;
    };

    const mdpComptableClair = genMdp();
    const mdpAdminClair = genMdp();

    const [mdpAdmin, mdpComptable, mdpAdminDefault] = await Promise.all([
      bcrypt.hash(adminMdp, 10),
      bcrypt.hash(mdpComptableClair, 10),
      bcrypt.hash(mdpAdminClair, 10),
    ]);

    const comptes = [
      { login: normalizedLogin, mdp: mdpAdmin, role: "direction", label: "Direction", statut: "Actif" },
      { login: "comptable", mdp: mdpComptable, role: "comptable", label: "Comptable", statut: "Actif" },
      { login: "admin", mdp: mdpAdminDefault, role: "admin", label: "Admin", statut: "Actif" },
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
