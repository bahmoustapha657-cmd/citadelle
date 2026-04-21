import crypto from "crypto";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { initAdmin } from "./_lib/firebase-admin.js";
import { isValidSchoolId, normalizeSchoolId, requireEnv } from "./_lib/security.js";

export function signaturesMatch(expected, received) {
  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(received, "hex");

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

export function buildKkiapaySignature(payload, privateKey) {
  return crypto
    .createHmac("sha256", privateKey)
    .update(JSON.stringify(payload || {}))
    .digest("hex");
}

export function verifyKkiapaySignature(payload, signature, privateKey) {
  if (!signature || !/^[a-f0-9]+$/i.test(signature)) {
    return false;
  }

  return signaturesMatch(buildKkiapaySignature(payload, privateKey), signature);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  try {
    initAdmin();
  } catch {
    return res.status(500).json({ error: "Erreur serveur (init)" });
  }

  let privateKey;
  try {
    privateKey = requireEnv("KKIAPAY_PRIVATE_KEY");
  } catch {
    return res.status(500).json({ error: "Webhook non configuré." });
  }

  const signature = typeof req.headers["x-kkiapay-signature"] === "string"
    ? req.headers["x-kkiapay-signature"]
    : "";

  if (!signature) {
    return res.status(401).json({ error: "Signature manquante" });
  }

  if (!verifyKkiapaySignature(req.body || {}, signature, privateKey)) {
    console.error("Signature Kkiapay invalide");
    return res.status(401).json({ error: "Signature invalide" });
  }

  const {
    status,
    transaction_id: transactionId,
    amount,
    phone,
    data: schoolId,
  } = req.body || {};
  const normalizedSchoolId = normalizeSchoolId(schoolId);

  if (!normalizedSchoolId || !isValidSchoolId(normalizedSchoolId)) {
    return res.status(400).json({ error: "schoolId manquant ou invalide dans le champ data" });
  }
  if (!transactionId) {
    return res.status(400).json({ error: "transaction_id manquant" });
  }

  const db = getFirestore();
  const paiementRef = db
    .collection("ecoles")
    .doc(normalizedSchoolId)
    .collection("paiements")
    .doc(`kkiapay_${transactionId}`);

  try {
    const existing = await paiementRef.get();
    if (existing.exists) {
      return res.status(200).json({ received: true, status, duplicate: true });
    }

    await paiementRef.set({
      transactionId,
      montant: amount || 0,
      telephone: phone || "",
      statut: status || "UNKNOWN",
      createdAt: FieldValue.serverTimestamp(),
      source: "kkiapay",
    });
  } catch (e) {
    console.error("Erreur enregistrement paiement :", e);
    return res.status(500).json({ error: "Erreur enregistrement paiement" });
  }

  if (status === "SUCCESS") {
    const planExpiry = Date.now() + 365 * 24 * 60 * 60 * 1000;
    try {
      await db.collection("ecoles").doc(normalizedSchoolId).update({
        plan: "pro",
        planExpiry,
        planActivatedAt: FieldValue.serverTimestamp(),
        planActivatedBy: "kkiapay",
        lastSuccessfulPaymentId: transactionId,
      });
    } catch (e) {
      console.error("Erreur activation plan :", e);
      return res.status(500).json({ error: "Erreur activation plan" });
    }
  }

  return res.status(200).json({ received: true, status });
}
