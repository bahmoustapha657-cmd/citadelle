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

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const { login, mdp } = req.body || {};
  if (!login || !mdp) return res.status(400).json({ error: "Identifiants requis" });

  try { initAdmin(); } catch (e) {
    return res.status(500).json({ error: "Erreur serveur" });
  }

  const db = getFirestore();

  try {
    const snap = await db.collection("superadmins").get();
    let comptes = snap.docs.map(d => ({ ...d.data(), _id: d.id }));

    // Fallback uniquement si aucun compte en base — à supprimer après setup initial
    if (comptes.length === 0) {
      const fallbackHash = process.env.SUPERADMIN_PASSWORD_HASH || "";
      if (!fallbackHash) return res.status(401).json({ error: "Aucun super-admin configuré" });
      comptes = [{ login: "superadmin", mdp: fallbackHash, role: "superadmin", nom: "Super Admin" }];
    }

    const compte = comptes.find(c => c.login === login.trim());
    if (!compte) return res.status(401).json({ error: "Identifiants incorrects" });

    const valide = compte.mdp.startsWith("$2b$")
      ? await bcrypt.compare(mdp, compte.mdp)
      : false; // mots de passe en clair refusés

    if (!valide) return res.status(401).json({ error: "Identifiants incorrects" });

    return res.status(200).json({
      ok: true,
      compte: { login: compte.login, role: "superadmin", nom: compte.nom || "Super Admin" },
    });
  } catch (e) {
    console.error("superadmin-login error:", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
}
