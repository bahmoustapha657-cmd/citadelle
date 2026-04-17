import crypto from "crypto";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { initAdmin } from "./_lib/firebase-admin.js";

initAdmin();

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const signature = req.headers["x-kkiapay-signature"] || "";
  const rawBody = JSON.stringify(req.body);
  const expected = crypto
    .createHmac("sha256", process.env.KKIAPAY_PRIVATE_KEY || "")
    .update(rawBody)
    .digest("hex");

  if (process.env.KKIAPAY_PRIVATE_KEY && signature !== expected) {
    console.error("Signature Kkiapay invalide");
    return res.status(401).json({ error: "Signature invalide" });
  }

  const { status, transaction_id: transactionId, amount, phone, data: schoolId } = req.body || {};

  if (!schoolId) {
    return res.status(400).json({ error: "schoolId manquant dans le champ data" });
  }

  const db = getFirestore();

  try {
    await db.collection("ecoles").doc(schoolId)
      .collection("paiements").add({
        transactionId: transactionId || "",
        montant: amount || 0,
        telephone: phone || "",
        statut: status || "UNKNOWN",
        createdAt: FieldValue.serverTimestamp(),
        source: "kkiapay",
      });
  } catch (e) {
    console.error("Erreur enregistrement paiement :", e);
  }

  if (status === "SUCCESS") {
    const planExpiry = Date.now() + 365 * 24 * 60 * 60 * 1000;
    try {
      await db.collection("ecoles").doc(schoolId).update({
        plan: "pro",
        planExpiry,
        planActivatedAt: FieldValue.serverTimestamp(),
        planActivatedBy: "kkiapay",
      });
    } catch (e) {
      console.error("Erreur activation plan :", e);
      return res.status(500).json({ error: "Erreur activation plan" });
    }
  }

  return res.status(200).json({ received: true, status });
}
