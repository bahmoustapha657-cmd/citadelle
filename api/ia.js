import Anthropic from "@anthropic-ai/sdk";
import { initAdmin } from "./_lib/firebase-admin.js";
import { captureServerError, withObservability } from "./_lib/observability.js";
import { applyCors, requireEnv, requireSession } from "./_lib/security.js";

const DEFAULT_MODEL = "claude-opus-4-5";
const DEFAULT_MODE = "support";

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

  const session = await requireSession(req, res, { allowSuperadmin: true });
  if (!session) return;

  if (session.profile.role !== "superadmin") {
    return res.status(403).json({ error: "Acces reserve au superadmin." });
  }

  const { action, payload } = req.body || {};
  if (action !== "assistant_superadmin") {
    return res.status(400).json({ error: "Action inconnue." });
  }

  if (!payload?.prompt || typeof payload.prompt !== "string" || !payload.prompt.trim()) {
    return res.status(400).json({ error: "Le champ prompt est requis." });
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
      max_tokens: 700,
      messages: [
        {
          role: "user",
          content: buildSuperadminAssistantPrompt(payload),
        },
      ],
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
