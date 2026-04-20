/**
 * API Transfert inter-écoles EduGest
 * GET  ?token=TRF-XXXXXX       -> récupère un dossier de transfert
 * POST {action:"generer", ...} -> crée un token
 * POST {action:"accepter", ...} -> importe l'élève dans l'école cible
 */
import crypto from "crypto";
import { getFirestore } from "firebase-admin/firestore";
import { initAdmin } from "./_lib/firebase-admin.js";
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

function genToken(length = 10) {
  const bytes = crypto.randomBytes(length);
  let token = "TRF-";
  for (let index = 0; index < length; index += 1) {
    token += TOKEN_ALPHABET[bytes[index] % TOKEN_ALPHABET.length];
  }
  return token;
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

export default async function handler(req, res) {
  applyCors(req, res, "GET,POST,OPTIONS");
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
        return res.status(404).json({ error: "Token introuvable ou expiré" });
      }

      const data = transferDoc.data();

      if (data.statut === "accepté") {
        return res.status(410).json({ error: "Ce token a déjà été utilisé" });
      }
      if (data.statut === "expiré" || Date.now() > data.dateExpiration) {
        await transferDoc.ref.update({ statut: "expiré", updatedAt: Date.now() });
        return res.status(410).json({ error: "Ce token a expiré (validité 30 jours)" });
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
      let generatedToken;
      let attempts = 0;

      do {
        generatedToken = genToken();
        const existing = await findTransferByToken(db, generatedToken);
        if (!existing) break;
        attempts += 1;
      } while (attempts < 5);

      if (!generatedToken) {
        return res.status(500).json({ error: "Impossible de générer un token de transfert." });
      }

      const docRef = await db.collection("transferts").add({
        token: generatedToken,
        schoolIdSource: normalizedSchoolId,
        eleveSnapshot,
        ecoleDestination: ecoleDestination || "",
        statut: "en_attente",
        dateCreation: Date.now(),
        dateExpiration: Date.now() + VALIDITE_MS,
        createdByUid: session.uid,
        createdByRole: session.profile.role,
      });

      return res.status(200).json({ token: generatedToken, id: docRef.id });
    } catch (e) {
      console.error("transfert generate error:", e);
      return res.status(500).json({ error: "Erreur génération transfert" });
    }
  }

  if (action === "accepter") {
    const normalizedToken = normalizeTransferToken(token);
    const normalizedTargetSchoolId = normalizeSchoolId(targetSchoolId);

    if (!normalizedToken || !isValidTransferToken(normalizedToken) || !normalizedTargetSchoolId || !isValidSchoolId(normalizedTargetSchoolId)) {
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

      if (data.statut !== "en_attente") {
        return res.status(409).json({ error: "Token déjà utilisé ou expiré" });
      }
      if (Date.now() > data.dateExpiration) {
        await transferDoc.ref.update({ statut: "expiré", updatedAt: Date.now() });
        return res.status(410).json({ error: "Token expiré" });
      }
      if (data.schoolIdSource === normalizedTargetSchoolId) {
        return res.status(409).json({ error: "Le transfert vers la même école est interdit." });
      }

      const section = data.eleveSnapshot?.section || "college";
      const collCible = section === "primaire"
        ? "elevesPrimaire"
        : section === "lycee"
          ? "elevesLycee"
          : "elevesCollege";

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
        typeInscription: "Réinscription",
        etablissementOrigine: data.eleveSnapshot?.schoolNom || "",
        dateTransfert: new Date().toISOString().slice(0, 10),
        mens: {},
        createdAt: Date.now(),
      });

      await transferDoc.ref.update({
        statut: "accepté",
        schoolIdCible: normalizedTargetSchoolId,
        dateAcceptation: Date.now(),
        acceptedByUid: session.uid,
      });

      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error("transfert accept error:", e);
      return res.status(500).json({ error: "Erreur acceptation transfert" });
    }
  }

  return res.status(400).json({ error: "Action inconnue" });
}
