/**
 * API transfert inter-ecoles EduGest.
 * GET  ?token=TRF-XXXXXX        -> recupere un dossier de transfert
 * POST {action:"generer", ...}  -> cree un token
 * POST {action:"accepter", ...} -> importe l'eleve dans l'ecole cible
 */
import crypto from "crypto";
import { getFirestore } from "firebase-admin/firestore";
import { initAdmin } from "./_lib/firebase-admin.js";
import { captureServerError, withObservability } from "./_lib/observability.js";
import {
  applyCors,
  isValidSchoolId,
  isValidTransferToken,
  normalizeSchoolId,
  normalizeTransferToken,
  requireSession,
} from "./_lib/security.js";

const VALIDITE_MS = 30 * 24 * 60 * 60 * 1000;
const TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const TRANSFER_STATUS = Object.freeze({
  PENDING: "en_attente",
  ACCEPTED: "accepted",
  EXPIRED: "expired",
});

function genToken(length = 10) {
  const bytes = crypto.randomBytes(length);
  let token = "TRF-";
  for (let index = 0; index < length; index += 1) {
    token += TOKEN_ALPHABET[bytes[index] % TOKEN_ALPHABET.length];
  }
  return token;
}

function simplifyStatus(value) {
  return typeof value === "string"
    ? value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z_]/g, "")
    : "";
}

export function normalizeTransferStatus(value) {
  const normalized = simplifyStatus(value);

  if (normalized === TRANSFER_STATUS.PENDING) {
    return TRANSFER_STATUS.PENDING;
  }
  if (normalized.startsWith("accept")) {
    return TRANSFER_STATUS.ACCEPTED;
  }
  if (normalized.startsWith("expir")) {
    return TRANSFER_STATUS.EXPIRED;
  }

  return normalized;
}

export function resolveTransferCollection(section) {
  if (section === "primaire") return "elevesPrimaire";
  if (section === "lycee") return "elevesLycee";
  return "elevesCollege";
}

export function validateTransferReadState(data, now = Date.now()) {
  const status = normalizeTransferStatus(data?.statut);
  const expiration = Number(data?.dateExpiration || 0);

  if (status === TRANSFER_STATUS.EXPIRED || (expiration > 0 && now > expiration)) {
    return {
      ok: false,
      status: 410,
      error: "Ce token a expire (validite 30 jours).",
      shouldExpire: status !== TRANSFER_STATUS.EXPIRED,
    };
  }

  if (status !== TRANSFER_STATUS.PENDING) {
    return { ok: false, status: 410, error: "Ce token a deja ete utilise." };
  }

  return { ok: true };
}

export function validateTransferAcceptance(data, targetSchoolId, now = Date.now()) {
  const status = normalizeTransferStatus(data?.statut);
  const expiration = Number(data?.dateExpiration || 0);

  if (status !== TRANSFER_STATUS.PENDING) {
    return { ok: false, status: 409, error: "Token deja utilise ou expire." };
  }
  if (expiration > 0 && now > expiration) {
    return { ok: false, status: 410, error: "Token expire.", shouldExpire: true };
  }
  if (data?.schoolIdSource === targetSchoolId) {
    return { ok: false, status: 409, error: "Le transfert vers la meme ecole est interdit." };
  }

  return {
    ok: true,
    collCible: resolveTransferCollection(data?.eleveSnapshot?.section),
  };
}

async function findTransferByToken(db, token) {
  const snap = await db
    .collection("transferts")
    .where("token", "==", token)
    .limit(1)
    .get();

  if (snap.empty) {
    return null;
  }

  return snap.docs[0];
}

async function handler(req, res) {
  if (!applyCors(req, res, "GET,POST,OPTIONS")) return;
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    initAdmin();
  } catch {
    return res.status(500).json({ error: "Erreur serveur (init)" });
  }

  const db = getFirestore();

  if (req.method === "GET") {
    const token = normalizeTransferToken(req.query?.token);
    if (!token || !isValidTransferToken(token)) {
      return res.status(400).json({ error: "Token invalide." });
    }

    const session = await requireSession(req, res, {
      roles: ["direction", "admin", "comptable", "primaire", "college"],
      allowSuperadmin: true,
    });
    if (!session) return;

    try {
      const transferDoc = await findTransferByToken(db, token);
      if (!transferDoc) {
        return res.status(404).json({ error: "Token introuvable ou expire." });
      }

      const data = transferDoc.data();
      const validation = validateTransferReadState(data);
      if (!validation.ok) {
        if (validation.shouldExpire) {
          await transferDoc.ref.update({
            statut: TRANSFER_STATUS.EXPIRED,
            updatedAt: Date.now(),
          });
        }
        return res.status(validation.status).json({ error: validation.error });
      }

      return res.status(200).json({
        id: transferDoc.id,
        token: data.token,
        eleveSnapshot: data.eleveSnapshot,
        ecoleDestination: data.ecoleDestination,
        schoolIdSource: data.schoolIdSource,
        dateCreation: data.dateCreation,
      });
    } catch (e) {
      console.error("transfert get error:", e);
      return res.status(500).json({ error: "Erreur lecture transfert" });
    }
  }

  if (req.method !== "POST") {
    return res.status(405).end();
  }

  const {
    action,
    schoolId,
    eleveSnapshot,
    ecoleDestination,
    token,
    targetSchoolId,
  } = req.body || {};

  if (action === "generer") {
    const normalizedSchoolId = normalizeSchoolId(schoolId);
    if (!normalizedSchoolId || !isValidSchoolId(normalizedSchoolId) || !eleveSnapshot) {
      return res.status(400).json({ error: "schoolId valide et eleveSnapshot requis" });
    }

    const session = await requireSession(req, res, {
      roles: ["direction", "admin", "comptable", "primaire", "college"],
      schoolId: normalizedSchoolId,
      allowSuperadmin: true,
    });
    if (!session) return;

    try {
      let generatedToken = "";
      let attempts = 0;

      do {
        generatedToken = genToken();
        const existing = await findTransferByToken(db, generatedToken);
        if (!existing) break;
        attempts += 1;
      } while (attempts < 5);

      if (!generatedToken) {
        return res.status(500).json({ error: "Impossible de generer un token de transfert." });
      }

      const docRef = await db.collection("transferts").add({
        token: generatedToken,
        schoolIdSource: normalizedSchoolId,
        eleveSnapshot,
        ecoleDestination: ecoleDestination || "",
        statut: TRANSFER_STATUS.PENDING,
        dateCreation: Date.now(),
        dateExpiration: Date.now() + VALIDITE_MS,
        createdByUid: session.uid,
        createdByRole: session.profile.role,
      });

      return res.status(200).json({ token: generatedToken, id: docRef.id });
    } catch (e) {
      console.error("transfert generate error:", e);
      return res.status(500).json({ error: "Erreur generation transfert" });
    }
  }

  if (action === "accepter") {
    const normalizedToken = normalizeTransferToken(token);
    const normalizedTargetSchoolId = normalizeSchoolId(targetSchoolId);

    if (
      !normalizedToken
      || !isValidTransferToken(normalizedToken)
      || !normalizedTargetSchoolId
      || !isValidSchoolId(normalizedTargetSchoolId)
    ) {
      return res.status(400).json({ error: "token et targetSchoolId valides requis" });
    }

    const session = await requireSession(req, res, {
      roles: ["direction", "admin", "comptable", "primaire", "college"],
      schoolId: normalizedTargetSchoolId,
      allowSuperadmin: true,
    });
    if (!session) return;

    try {
      const transferDoc = await findTransferByToken(db, normalizedToken);
      if (!transferDoc) {
        return res.status(404).json({ error: "Token introuvable" });
      }

      const data = transferDoc.data();
      const validation = validateTransferAcceptance(data, normalizedTargetSchoolId);
      if (!validation.ok) {
        if (validation.shouldExpire) {
          await transferDoc.ref.update({
            statut: TRANSFER_STATUS.EXPIRED,
            updatedAt: Date.now(),
          });
        }
        return res.status(validation.status).json({ error: validation.error });
      }

      const { collCible } = validation;
      const {
        matricule: _matricule,
        _id: _id,
        schoolNom: _schoolNom,
        solde: _solde,
        ...eleveData
      } = data.eleveSnapshot || {};

      await db.collection("ecoles").doc(normalizedTargetSchoolId).collection(collCible).add({
        ...eleveData,
        statut: "Actif",
        typeInscription: "Reinscription",
        etablissementOrigine: data.eleveSnapshot?.schoolNom || "",
        dateTransfert: new Date().toISOString().slice(0, 10),
        mens: {},
        createdAt: Date.now(),
      });

      await transferDoc.ref.update({
        statut: TRANSFER_STATUS.ACCEPTED,
        schoolIdCible: normalizedTargetSchoolId,
        dateAcceptation: Date.now(),
        acceptedByUid: session.uid,
      });

      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error("transfert accept error:", e);
      await captureServerError(e, { endpoint: "transfert", action: "accept" });
      return res.status(500).json({ error: "Erreur acceptation transfert" });
    }
  }

  return res.status(400).json({ error: "Action inconnue" });
}

export default withObservability(handler);
