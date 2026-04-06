import crypto from "crypto";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

if (!getApps().length) {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || "{}";
  let sa;
  try { sa = JSON.parse(raw); } catch { sa = JSON.parse(raw.replace(/\\n/g, "\n")); }
  if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, "\n");
  initializeApp({ credential: cert(sa) });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  // ── Vérification signature HMAC Kkiapay ─────────────────
  const signature = req.headers["x-kkiapay-signature"] || "";
  const rawBody = JSON.stringify(req.body);
  const expected = crypto
    .createHmac("sha256", process.env.KKIAPAY_PRIVATE_KEY || "")
    .update(rawBody)
    .digest("hex");

  if (process.env.NODE_ENV === "production" && signature !== expected) {
    console.error("Signature Kkiapay invalide");
    return res.status(401).json({ error: "Signature invalide" });
  }

  const { status, transaction_id, amount, phone, data: schoolId } = req.body;

  if (!schoolId) {
    return res.status(400).json({ error: "schoolId manquant dans le champ data" });
  }

  const db = getFirestore();

  // ── Enregistrer le paiement ──────────────────────────────
  try {
    await db.collection("ecoles").doc(schoolId)
      .collection("paiements").add({
        transactionId: transaction_id || "",
        montant: amount || 0,
        telephone: phone || "",
        statut: status || "UNKNOWN",
        createdAt: FieldValue.serverTimestamp(),
        source: "kkiapay",
      });
  } catch (e) {
    console.error("Erreur enregistrement paiement :", e);
  }

  // ── Activer le plan Pro si paiement réussi ───────────────
  if (status === "SUCCESS") {
    const planExpiry = Date.now() + 365 * 24 * 60 * 60 * 1000; // +1 an
    try {
      await db.collection("ecoles").doc(schoolId).update({
        plan: "pro",
        planExpiry,
        planActivatedAt: FieldValue.serverTimestamp(),
        planActivatedBy: "kkiapay",
      });
      console.log(`Plan Pro activé pour ${schoolId} jusqu'au ${new Date(planExpiry).toLocaleDateString("fr-FR")}`);
    } catch (e) {
      console.error("Erreur activation plan :", e);
      return res.status(500).json({ error: "Erreur activation plan" });
    }
  }

  return res.status(200).json({ received: true, status });
}
