import webpush from "web-push";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function initAdmin() {
  if (getApps().length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || "{}";
  let sa;
  try { sa = JSON.parse(raw); } catch { sa = JSON.parse(raw.replace(/\\n/g, "\n")); }
  if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, "\n");
  initializeApp({ credential: cert(sa) });
}

webpush.setVapidDetails(
  "mailto:bahmoustapha657@gmail.com",
  process.env.VAPID_PUBLIC_KEY || "",
  process.env.VAPID_PRIVATE_KEY || ""
);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const { schoolId, cibles, titre, corps, url = "/" } = req.body || {};
  if (!schoolId || !titre) return res.status(400).json({ error: "schoolId et titre requis" });

  try { initAdmin(); } catch {
    return res.status(500).json({ error: "Erreur serveur" });
  }

  const db = getFirestore();
  const payload = JSON.stringify({ titre, corps: corps || "", url, icon: "/icons/pwa-192.png" });

  try {
    // Récupère les souscriptions push du schoolId
    const snap = await db.collection("ecoles").doc(schoolId).collection("pushSubs").get();
    let docs = snap.docs;

    // Filtre par rôles cibles si précisé (ex: ["parent", "direction"])
    if (cibles && cibles.length) {
      docs = docs.filter(d => cibles.includes(d.data().role));
    }

    let envoyes = 0, expirés = 0;
    await Promise.all(docs.map(async (d) => {
      const sub = d.data().subscription;
      if (!sub) return;
      try {
        await webpush.sendNotification(sub, payload);
        envoyes++;
      } catch (e) {
        // Souscription expirée (410) → supprimer de Firestore
        if (e.statusCode === 410 || e.statusCode === 404) {
          await d.ref.delete();
          expirés++;
        }
      }
    }));

    return res.status(200).json({ ok: true, envoyes, expirés });
  } catch (e) {
    console.error("push error:", e);
    return res.status(500).json({ error: "Erreur envoi push" });
  }
}
