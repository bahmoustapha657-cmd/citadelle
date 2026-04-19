/**
 * API Transfert inter-écoles EduGest
 * GET  ?token=TRF-XXXX  → récupère les données du dossier de transfert
 * POST {action:"generer", schoolId, eleveSnapshot, ecoleDestination} → crée un token
 * POST {action:"accepter", token, targetSchoolId} → accepte et importe l'élève
 */
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { initAdmin } from "./_lib/firebase-admin.js";
import { applyCors } from "./_lib/security.js";

const VALIDITE_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours

function genToken() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let t = "TRF-";
  for (let i = 0; i < 6; i++) t += chars[Math.floor(Math.random() * chars.length)];
  return t;
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try { initAdmin(); } catch {
    return res.status(500).json({ error: "Erreur serveur (init)" });
  }
  const db = getFirestore();

  // ── GET : récupérer un dossier par token ────────────────────
  if (req.method === "GET") {
    const { token } = req.query || {};
    if (!token) return res.status(400).json({ error: "Token requis" });

    const snap = await db.collection("transferts")
      .where("token", "==", token.trim().toUpperCase())
      .limit(1).get();

    if (snap.empty) return res.status(404).json({ error: "Token introuvable ou expiré" });
    const data = snap.docs[0].data();

    if (data.statut === "accepté") return res.status(410).json({ error: "Ce token a déjà été utilisé" });
    if (data.statut === "expiré" || Date.now() > data.dateExpiration) {
      await snap.docs[0].ref.update({ statut: "expiré" });
      return res.status(410).json({ error: "Ce token a expiré (validité 30 jours)" });
    }

    return res.status(200).json({
      id: snap.docs[0].id,
      token: data.token,
      eleveSnapshot: data.eleveSnapshot,
      ecoleDestination: data.ecoleDestination,
      schoolIdSource: data.schoolIdSource,
      dateCreation: data.dateCreation,
    });
  }

  // ── POST ────────────────────────────────────────────────────
  if (req.method === "POST") {
    const { action, schoolId, eleveSnapshot, ecoleDestination, token, targetSchoolId } = req.body || {};

    // Générer un token de transfert
    if (action === "generer") {
      if (!schoolId || !eleveSnapshot) return res.status(400).json({ error: "schoolId et eleveSnapshot requis" });

      let tok;
      let tentatives = 0;
      do {
        tok = genToken();
        const existing = await db.collection("transferts").where("token", "==", tok).limit(1).get();
        if (existing.empty) break;
        tentatives++;
      } while (tentatives < 5);

      const docRef = await db.collection("transferts").add({
        token: tok,
        schoolIdSource: schoolId,
        eleveSnapshot: eleveSnapshot,
        ecoleDestination: ecoleDestination || "",
        statut: "en_attente",
        dateCreation: Date.now(),
        dateExpiration: Date.now() + VALIDITE_MS,
      });

      return res.status(200).json({ token: tok, id: docRef.id });
    }

    // Accepter un transfert et créer l'élève dans l'école cible
    if (action === "accepter") {
      if (!token || !targetSchoolId) return res.status(400).json({ error: "token et targetSchoolId requis" });

      const snap = await db.collection("transferts")
        .where("token", "==", token.trim().toUpperCase())
        .limit(1).get();

      if (snap.empty) return res.status(404).json({ error: "Token introuvable" });
      const docSnap = snap.docs[0];
      const data = docSnap.data();

      if (data.statut !== "en_attente") return res.status(409).json({ error: "Token déjà utilisé ou expiré" });
      if (Date.now() > data.dateExpiration) {
        await docSnap.ref.update({ statut: "expiré" });
        return res.status(410).json({ error: "Token expiré" });
      }

      // Détermine la collection de destination selon la section
      const section = data.eleveSnapshot?.section || "college";
      const collCible = section === "primaire" ? "elevesPrimaire"
        : section === "lycee" ? "elevesLycee"
        : "elevesCollege";

      // Crée la fiche élève dans l'école cible (sans le matricule source)
      const { matricule: _mat, _id: _id, schoolNom: _sn, solde: _sol, ...eleveData } = data.eleveSnapshot || {};
      await db.collection("ecoles").doc(targetSchoolId).collection(collCible).add({
        ...eleveData,
        statut: "Actif",
        typeInscription: "Réinscription",
        etablissementOrigine: data.eleveSnapshot?.schoolNom || "",
        dateTransfert: new Date().toISOString().slice(0, 10),
        mens: {},
      });

      // Marque le transfert comme accepté
      await docSnap.ref.update({ statut: "accepté", schoolIdCible: targetSchoolId, dateAcceptation: Date.now() });

      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Action inconnue" });
  }

  return res.status(405).end();
}
