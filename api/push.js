import webpush from "web-push";
import { getFirestore } from "firebase-admin/firestore";
import { initAdmin } from "./_lib/firebase-admin.js";
import { captureServerError, withObservability } from "./_lib/observability.js";
import {
  applyCors,
  isValidSchoolId,
  normalizeSchoolId,
  requireSession,
} from "./_lib/security.js";

webpush.setVapidDetails(
  "mailto:bahmoustapha657@gmail.com",
  process.env.VAPID_PUBLIC_KEY || "",
  process.env.VAPID_PRIVATE_KEY || ""
);

async function handler(req, res) {
  if (!applyCors(req, res)) return;
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const { schoolId, cibles, titre, corps, url = "/" } = req.body || {};
  const normalizedSchoolId = normalizeSchoolId(schoolId);

  if (!normalizedSchoolId || !titre) {
    return res.status(400).json({ error: "schoolId et titre requis" });
  }
  if (!isValidSchoolId(normalizedSchoolId)) {
    return res.status(400).json({ error: "Code école invalide." });
  }

  try { initAdmin(); } catch {
    return res.status(500).json({ error: "Erreur serveur" });
  }

  const isAuthorized = await requireSession(req, res, {
    roles: ["direction", "admin", "comptable"],
    schoolId: normalizedSchoolId,
    allowSuperadmin: true,
  });
  if (!isAuthorized) return;

  const db = getFirestore();
  const payload = JSON.stringify({ titre, corps: corps || "", url, icon: "/icons/pwa-192.png" });

  try {
    // Récupère les souscriptions push du schoolId
    const snap = await db.collection("ecoles").doc(normalizedSchoolId).collection("pushSubs").get();
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
    await captureServerError(e, { endpoint: "push" });
    return res.status(500).json({ error: "Erreur envoi push" });
  }
}

export default withObservability(handler);
