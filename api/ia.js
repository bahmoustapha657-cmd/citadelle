import Anthropic from "@anthropic-ai/sdk";
import { getFirestore } from "firebase-admin/firestore";
import { initAdmin } from "./_lib/firebase-admin.js";
import { applyCors, requireSession } from "./_lib/security.js";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  const { action, schoolId, payload } = req.body || {};

  if (!action || !schoolId) {
    return res.status(400).json({ error: "action et schoolId requis" });
  }

  try {
    initAdmin();
  } catch (e) {
    return res.status(500).json({ error: `Firebase Admin init failed: ${e.message}` });
  }

  const isAuthorized = await requireSession(req, res, { schoolId, allowSuperadmin: true });
  if (!isAuthorized) return;

  try {
    const db = getFirestore();
    const snap = await db.collection("ecoles").doc(schoolId).get();
    if (!snap.exists || snap.data().plan !== "pro") {
      return res.status(403).json({ error: "Plan Pro requis pour utiliser l'IA" });
    }
  } catch (e) {
    return res.status(500).json({ error: `Erreur vérification plan : ${e.message}` });
  }

  if (action === "commentaire_bulletin") {
    const { eleve, moyenneGenerale, mention, matieres, periode, niveau } = payload || {};
    const matieresStr = Array.isArray(matieres)
      ? matieres.map((m) => `${m.nom} (${m.moy || m.moyenne || "-"}/20)`).join(", ")
      : "";

    const prompt = `Tu es un directeur d'école en Guinée (Afrique de l'Ouest).
Rédige un commentaire de bulletin scolaire en français formel et bienveillant.
Le commentaire doit faire 2 à 3 phrases, refléter les résultats réels et encourager l'élève.
N'écris que le commentaire, sans titre ni introduction.

Élève : ${eleve?.nom || ""} ${eleve?.prenom || ""}
Classe : ${eleve?.classe || ""} - Niveau : ${niveau || ""}
Période : ${periode || ""}
Moyenne générale : ${moyenneGenerale}/20 - Mention : ${mention || ""}
Matières : ${matieresStr}`;

    try {
      const message = await client.messages.create({
        model: "claude-opus-4-5",
        max_tokens: 250,
        messages: [{ role: "user", content: prompt }],
      });
      return res.json({ commentaire: message.content[0].text.trim() });
    } catch (e) {
      return res.status(500).json({ error: `Erreur Claude : ${e.message}` });
    }
  }

  if (action === "generer_document") {
    const { type, eleve, contexte } = payload || {};
    const nomComplet = `${eleve?.nom || ""} ${eleve?.prenom || ""}`.trim();
    const classe = eleve?.classe || "";

    const prompts = {
      courrier_tuteur: `Tu rédiges un courrier officiel en français pour une école en Guinée (Afrique de l'Ouest).
Destinataire : le tuteur/parent de l'élève ${nomComplet}, classe ${classe}.
Objet : ${contexte}
Format : lettre officielle avec en-tête générique, formule de politesse, corps structuré, signature.
Ton : professionnel, bienveillant, formel.`,
      attestation_perso: `Tu rédiges une attestation personnalisée officielle en français pour une école en Guinée.
Élève concerné : ${nomComplet}, classe ${classe}.
Objet de l'attestation : ${contexte}
Format : document administratif avec titre, corps, date et espace signature.
Style : formel, administratif guinéen.`,
      certificat_scolarite: `Tu rédiges un certificat de scolarité en français pour une école en Guinée.
Élève : ${nomComplet}, classe ${classe}.
Informations complémentaires : ${contexte}
Format : certificat officiel avec formule attestant la scolarité de l'élève pour l'année en cours.`,
      rapport_comportement: `Tu rédiges un rapport de comportement officiel en français pour une école en Guinée.
Élève : ${nomComplet}, classe ${classe}.
Contexte : ${contexte}
Format : rapport structuré avec constats, recommandations et conclusion.
Ton : objectif, constructif, professionnel.`,
    };

    try {
      const message = await client.messages.create({
        model: "claude-opus-4-5",
        max_tokens: 600,
        messages: [{ role: "user", content: prompts[type] || prompts.courrier_tuteur }],
      });
      return res.json({ document: message.content[0].text.trim() });
    } catch (e) {
      return res.status(500).json({ error: `Erreur Claude : ${e.message}` });
    }
  }

  return res.status(400).json({ error: `Action inconnue : ${action}` });
}
