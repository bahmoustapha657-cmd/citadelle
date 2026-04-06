import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
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

const COMPTES_DEFAUT = [
  {login:"admin",     nom:"Administrateur",    mdp:"admin123",   role:"admin"},
  {login:"directeur", nom:"Directeur Général", mdp:"dir2024",    role:"direction"},
  {login:"primaire",  nom:"Dir. Primaire",     mdp:"prim2024",   role:"primaire"},
  {login:"college",   nom:"Principal Collège", mdp:"col2024",    role:"college"},
  {login:"comptable", nom:"Comptable",         mdp:"compta2024", role:"comptable"},
];

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const { login, mdp, schoolId } = req.body || {};
  if (!login || !mdp || !schoolId) {
    return res.status(400).json({ error: "Champs requis : login, mdp, schoolId" });
  }

  try { initAdmin(); } catch (e) {
    return res.status(500).json({ error: "Erreur serveur (init)" });
  }

  const authAdmin = getAuth();
  const db = getFirestore();

  try {
    // Récupérer les comptes depuis Firestore (Admin SDK bypass les règles)
    const snap = await db.collection("ecoles").doc(schoolId).collection("comptes").get();
    const comptes = snap.docs.map(d => ({ ...d.data(), _id: d.id }));
    const source = comptes.length > 0 ? comptes : COMPTES_DEFAUT;

    const compte = source.find(c => c.login === login.trim().toLowerCase());
    if (!compte) return res.status(401).json({ error: "Identifiant ou mot de passe incorrect." });

    const valide = compte.mdp.startsWith("$2b$")
      ? await bcrypt.compare(mdp, compte.mdp)
      : compte.mdp === mdp;

    if (!valide) return res.status(401).json({ error: "Identifiant ou mot de passe incorrect." });

    // Créer ou mettre à jour le compte Firebase Auth
    const email = `${login.trim().toLowerCase()}.${schoolId}@edugest.app`;
    let uid;
    try {
      const userRecord = await authAdmin.createUser({ email, password: mdp, displayName: compte.nom });
      uid = userRecord.uid;
    } catch (e) {
      if (e.code === "auth/email-already-exists") {
        const existing = await authAdmin.getUserByEmail(email);
        await authAdmin.updateUser(existing.uid, { password: mdp });
        uid = existing.uid;
      } else throw e;
    }

    // Stocker/mettre à jour le profil dans /users/{uid}
    await db.collection("users").doc(uid).set({
      schoolId,
      role: compte.role,
      nom: compte.nom,
      login: login.trim().toLowerCase(),
      email,
      updatedAt: Date.now(),
    }, { merge: true });

    // Créer un custom token pour connecter le client
    const customToken = await authAdmin.createCustomToken(uid);

    return res.status(200).json({ ok: true, customToken, compte: { login: compte.login, role: compte.role, nom: compte.nom } });
  } catch (e) {
    console.error("login error:", e);
    return res.status(500).json({ error: e.message || "Erreur serveur" });
  }
}
