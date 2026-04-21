import crypto from "crypto";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { initAdmin } from "./_lib/firebase-admin.js";
import { captureServerError } from "./_lib/observability.js";
import {
  applyCors,
  isValidSchoolId,
  normalizeSchoolId,
  requireEnv,
} from "./_lib/security.js";

const DEFAULT_PRO_PAYMENT_AMOUNT = 500_000;

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

export function normalizePaymentAmount(amount) {
  const numericAmount = Number(amount);
  return Number.isFinite(numericAmount) && numericAmount > 0 ? numericAmount : 0;
}

export function getMinimumProPaymentAmount() {
  const configuredAmount = Number(process.env.KKIAPAY_PRO_MIN_AMOUNT);
  return Number.isFinite(configuredAmount) && configuredAmount > 0
    ? configuredAmount
    : DEFAULT_PRO_PAYMENT_AMOUNT;
}

export function isEligibleProPayment(status, amount, minimumAmount = getMinimumProPaymentAmount()) {
  return status === "SUCCESS" && normalizePaymentAmount(amount) >= minimumAmount;
}

export default async function handler(req, res) {
  if (!applyCors(req, res, "POST,OPTIONS")) return;
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
    return res.status(500).json({ error: "Webhook non configure." });
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
  const paymentAmount = normalizePaymentAmount(amount);
  const minimumProPaymentAmount = getMinimumProPaymentAmount();

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
      montant: paymentAmount,
      telephone: phone || "",
      statut: status || "UNKNOWN",
      activationEligible: isEligibleProPayment(status, paymentAmount, minimumProPaymentAmount),
      createdAt: FieldValue.serverTimestamp(),
      source: "kkiapay",
    });
  } catch (e) {
    console.error("Erreur enregistrement paiement :", e);
    await captureServerError(e, {
      endpoint: "kkiapay-webhook",
      phase: "record",
      schoolId: normalizedSchoolId,
      transactionId,
    });
    return res.status(500).json({ error: "Erreur enregistrement paiement" });
  }

  if (status === "SUCCESS") {
    if (paymentAmount < minimumProPaymentAmount) {
      console.error("Montant Kkiapay insuffisant pour activation plan :", {
        transactionId,
        schoolId: normalizedSchoolId,
        paymentAmount,
        minimumProPaymentAmount,
      });
      return res.status(400).json({ error: "Montant insuffisant pour activer le plan Pro." });
    }

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
      await captureServerError(e, {
        endpoint: "kkiapay-webhook",
        phase: "activate-plan",
        schoolId: normalizedSchoolId,
        transactionId,
      });
      return res.status(500).json({ error: "Erreur activation plan" });
    }
  }

  return res.status(200).json({ received: true, status });
}
