import Anthropic from "@anthropic-ai/sdk";
import { initAdmin } from "./_lib/firebase-admin.js";
import { captureServerError, withObservability } from "./_lib/observability.js";
import { applyCors, requireEnv, requireSession } from "./_lib/security.js";

const DEFAULT_MODEL = "claude-opus-4-8";
const DEFAULT_MODE = "support";

// Rôles autorisés à générer une appréciation de bulletin (personnel pédagogique).
const ROLES_APPRECIATION = new Set(["direction", "admin", "primaire", "college", "enseignant"]);

// Construit le prompt de génération d'une appréciation de bulletin à partir du
// contexte de l'élève (moyenne, mention, résultats par matière).
export function buildAppreciationPrompt(payload = {}) {
  const nom = String(payload.nom || "l'élève").trim();
  const classe = String(payload.classe || "").trim();
  const periode = String(payload.periode || "").trim();
  const moyenne = payload.moyenne != null && payload.moyenne !== "—" ? String(payload.moyenne) : "";
  const mention = String(payload.mention || "").trim();
  const consigne = String(payload.consigne || "").trim();
  const lignes = Array.isArray(payload.notesMatieres)
    ? payload.notesMatieres
        .filter((x) => x && x.matiere && x.moyenne != null)
        .map((x) => `- ${x.matiere} : ${Number(x.moyenne).toFixed(1)}/20`)
        .join("\n")
    : "";

  return [
    "Tu es un enseignant expérimenté qui rédige l'appréciation de bulletin d'un élève.",
    "Rédige UNE appréciation en français, de 1 à 3 phrases, au ton bienveillant mais honnête, fondée sur les résultats fournis (progrès, points forts, axes à travailler).",
    "Réponds UNIQUEMENT par le texte de l'appréciation : pas de préambule, pas de guillemets, pas de salutation, et ne mentionne jamais d'IA.",
    `Élève : ${nom}${classe ? ` — Classe ${classe}` : ""}${periode ? ` — Période ${periode}` : ""}.`,
    moyenne ? `Moyenne générale : ${moyenne}/20${mention ? ` (mention ${mention})` : ""}.` : "",
    lignes ? `Résultats par matière :\n${lignes}` : "",
    consigne ? `Consigne du professeur à intégrer : ${consigne}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

const MODE_INSTRUCTIONS = {
  support: "Redige une reponse de support claire, calme et utile. Va droit au but, propose des etapes concretes et evite le jargon inutile.",
  annonce: "Redige une annonce officielle courte et professionnelle a destination des ecoles, avec un ton rassurant et precis.",
  incident: "Analyse un incident de facon operationnelle. Structure la reponse en 3 parties : resume, causes probables, actions recommandees.",
  commercial: "Redige un message commercial sobre et credible, sans exagere ni promesse floue.",
};

export function normalizeAssistantMode(mode) {
  const normalized = typeof mode === "string" ? mode.trim().toLowerCase() : "";
  return MODE_INSTRUCTIONS[normalized] ? normalized : DEFAULT_MODE;
}

export function buildSuperadminAssistantPrompt(payload = {}) {
  const mode = normalizeAssistantMode(payload.mode);
  const prompt = typeof payload.prompt === "string" ? payload.prompt.trim() : "";
  const context = typeof payload.context === "string" ? payload.context.trim() : "";
  const schoolName = typeof payload.schoolName === "string" ? payload.schoolName.trim() : "";

  return [
    "Tu assistes le superadmin d'une plateforme SaaS scolaire appelee EduGest / Citadelle.",
    "Ta reponse doit etre en francais, claire, exploitable et professionnelle.",
    "Ne mentionne pas de modele, d'IA, ni Claude dans la reponse finale.",
    "Si des informations manquent, fais des hypotheses prudentes et signale-les brievement.",
    MODE_INSTRUCTIONS[mode],
    schoolName ? `Ecole concernee : ${schoolName}` : "",
    context ? `Contexte : ${context}` : "",
    `Demande : ${prompt}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function extractTextContent(message) {
  if (!Array.isArray(message?.content)) {
    return "";
  }

  return message.content
    .filter((part) => part?.type === "text" && typeof part.text === "string")
    .map((part) => part.text.trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

async function handler(req, res) {
  if (!applyCors(req, res)) return;
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Methode non autorisee" });
  }

  try {
    initAdmin();
  } catch {
    return res.status(500).json({ error: "Erreur serveur (init)" });
  }

  const { action, payload } = req.body || {};

  // Sélection du périmètre d'auth + du prompt selon l'action.
  let session;
  let promptText;
  let maxTokens;
  if (action === "assistant_superadmin") {
    session = await requireSession(req, res, { allowSuperadmin: true });
    if (!session) return;
    if (session.profile.role !== "superadmin") {
      return res.status(403).json({ error: "Acces reserve au superadmin." });
    }
    if (!payload?.prompt || typeof payload.prompt !== "string" || !payload.prompt.trim()) {
      return res.status(400).json({ error: "Le champ prompt est requis." });
    }
    promptText = buildSuperadminAssistantPrompt(payload);
    maxTokens = 700;
  } else if (action === "assistant_appreciation") {
    session = await requireSession(req, res, { roles: [...ROLES_APPRECIATION] });
    if (!session) return;
    promptText = buildAppreciationPrompt(payload);
    maxTokens = 320;
  } else {
    return res.status(400).json({ error: "Action inconnue." });
  }

  let apiKey;
  try {
    apiKey = requireEnv("ANTHROPIC_API_KEY");
  } catch {
    return res.status(500).json({ error: "Assistant non configure." });
  }

  const client = new Anthropic({ apiKey });

  try {
    const message = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: promptText }],
    });

    const result = extractTextContent(message);
    if (!result) {
      return res.status(502).json({ error: "Reponse vide du service assistant." });
    }

    return res.status(200).json({
      ok: true,
      mode: normalizeAssistantMode(payload.mode),
      result,
    });
  } catch (e) {
    console.error("assistant superadmin error:", e);
    await captureServerError(e, { endpoint: "ia" });
    return res.status(500).json({ error: "Erreur lors de la generation du brouillon." });
  }
}

export default withObservability(handler);
