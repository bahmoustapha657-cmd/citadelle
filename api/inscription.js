import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import bcrypt from "bcryptjs";

function initAdmin() {
  if (getApps().length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || "{}";
  let sa;
  try { sa = JSON.parse(raw); } catch { sa = JSON.parse(raw.replace(/\\n/g, "\n")); }
  if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, "\n");
  initializeApp({ credential: cert(sa) });
}

const genSlug = (nom) =>
  nom.toLowerCase().trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30) || "ecole";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const { nomEcole, ville, pays, adminLogin, adminMdp } = req.body || {};

  if (!nomEcole?.trim()) return res.status(400).json({ error: "Le nom de l'école est requis." });
  if (!ville?.trim())    return res.status(400).json({ error: "La ville est requise." });
  if (!adminLogin?.trim()) return res.status(400).json({ error: "L'identifiant administrateur est requis." });
  if (!adminMdp || adminMdp.length < 6) return res.status(400).json({ error: "Le mot de passe doit contenir au moins 6 caractères." });

  try { initAdmin(); } catch (e) {
    return res.status(500).json({ error: "Erreur serveur (init)" });
  }

  const db = getFirestore();
  const schoolId = genSlug(nomEcole);

  try {
    // Vérifier si l'école existe déjà
    const existing = await db.collection("ecoles").doc(schoolId).get();
    if (existing.exists) {
      return res.status(409).json({ error: "Une école avec ce nom existe déjà. Choisissez un nom différent." });
    }

    // Créer le document école
    await db.collection("ecoles").doc(schoolId).set({
      nom: nomEcole.trim(),
      ville: ville.trim(),
      pays: (pays || "Guinée").trim(),
      createdAt: Date.now(),
      actif: true,
    });

    // Hasher les mots de passe
    const [mdpAdmin, mdpComptable, mdpAdminDefault] = await Promise.all([
      bcrypt.hash(adminMdp, 10),
      bcrypt.hash("compta123", 10),
      bcrypt.hash("admin123", 10),
    ]);

    // Créer les comptes par défaut
    const comptes = [
      { login: adminLogin.trim().toLowerCase(), mdp: mdpAdmin,        role: "direction",  label: "Direction",  statut: "Actif" },
      { login: "comptable",                     mdp: mdpComptable,     role: "comptable",  label: "Comptable",  statut: "Actif" },
      { login: "admin",                         mdp: mdpAdminDefault,  role: "admin",      label: "Admin",      statut: "Actif" },
    ];

    const batch = db.batch();
    for (const c of comptes) {
      const ref = db.collection("ecoles").doc(schoolId).collection("comptes").doc();
      batch.set(ref, c);
    }
    await batch.commit();

    return res.status(200).json({ ok: true, schoolId });
  } catch (e) {
    console.error("inscription error:", e);
    return res.status(500).json({ error: e.message || "Erreur serveur" });
  }
}
