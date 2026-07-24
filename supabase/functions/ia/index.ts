// ════════════════════════════════════════════════════════════════════════
//  EduGest — Edge Function : assistant IA (Anthropic)
// ════════════════════════════════════════════════════════════════════════
// Deux actions : assistant_superadmin (superadmin) et assistant_appreciation
// (personnel pédagogique → génération d'appréciation de bulletin). La clé
// Anthropic reste côté serveur. Modèle : claude-opus-4-8.
//
// ⚠️ PREMIUM : `assistant_appreciation` est facturé au jeton → réservé aux
// écoles du plan Premium. Ce contrôle est l'autorité (le gating de l'UI n'est
// qu'un confort) : il duplique volontairement estPremiumActif de
// shared/plan-features.js (Deno ne partage pas ce module) — garder les deux
// alignés. Le superadmin n'est pas soumis à cette règle.
//
// Déploiement : supabase functions deploy ia
//   supabase secrets set ANTHROPIC_API_KEY="sk-ant-..."   (ANTHROPIC_MODEL optionnel)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.40.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const MODEL = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-opus-4-8";

const ROLES_APPRECIATION = new Set(["direction", "admin", "primaire", "college", "enseignant", "staff"]);

// ── Premium (miroir de shared/plan-features.js) ─────────────────────────────
const PLANS_PREMIUM = ["premium"];
const GRACE_MS = 3 * 86400000;
const MESSAGE_PREMIUM = "Cette fonctionnalité est réservée au plan Premium.";
function estPremiumActif(plan: string | null, planExpiry: number | null): boolean {
  if (!plan || !PLANS_PREMIUM.includes(plan)) return false;
  if (!planExpiry) return true;
  return Date.now() < Number(planExpiry) + GRACE_MS;
}
const MODES: Record<string, string> = {
  support: "Rédige une réponse de support claire, calme et utile, avec des étapes concrètes.",
  annonce: "Rédige une annonce officielle courte et professionnelle pour les écoles.",
  incident: "Analyse un incident : résumé, causes probables, actions recommandées.",
  commercial: "Rédige un message commercial sobre et crédible.",
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

function promptSuperadmin(p: Record<string, unknown> = {}): string {
  const mode = MODES[String(p.mode || "").toLowerCase()] ? String(p.mode).toLowerCase() : "support";
  return [
    "Tu assistes le superadmin de la plateforme scolaire EduGest.",
    "Réponse en français, claire, exploitable et professionnelle ; ne mentionne jamais d'IA.",
    MODES[mode],
    p.schoolName ? `École concernée : ${p.schoolName}` : "",
    p.context ? `Contexte : ${p.context}` : "",
    `Demande : ${p.prompt}`,
  ].filter(Boolean).join("\n\n");
}

function promptAppreciation(p: Record<string, any> = {}): string {
  const lignes = Array.isArray(p.notesMatieres)
    ? p.notesMatieres.filter((x: any) => x?.matiere && x.moyenne != null)
        .map((x: any) => `- ${x.matiere} : ${Number(x.moyenne).toFixed(1)}/20`).join("\n")
    : "";
  return [
    "Tu es un enseignant expérimenté qui rédige l'appréciation de bulletin d'un élève.",
    "Rédige UNE appréciation en français, de 1 à 3 phrases, au ton bienveillant mais honnête, fondée sur les résultats (progrès, points forts, axes à travailler).",
    "Réponds UNIQUEMENT par le texte de l'appréciation : pas de préambule, pas de guillemets, pas de salutation, et ne mentionne jamais d'IA.",
    `Élève : ${p.nom || "l'élève"}${p.classe ? ` — Classe ${p.classe}` : ""}${p.periode ? ` — Période ${p.periode}` : ""}.`,
    p.moyenne && p.moyenne !== "—" ? `Moyenne générale : ${p.moyenne}/20${p.mention ? ` (mention ${p.mention})` : ""}.` : "",
    lignes ? `Résultats par matière :\n${lignes}` : "",
    p.consigne ? `Consigne du professeur à intégrer : ${p.consigne}` : "",
  ].filter(Boolean).join("\n\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  try {
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "").trim();
    const { data: { user } } = await admin.auth.getUser(jwt);
    if (!user) return json({ error: "Non authentifié." }, 401);
    const { data: compte } = await admin.from("comptes").select("role, ecole_id").eq("user_id", user.id).maybeSingle();
    if (!compte) return json({ error: "Compte introuvable." }, 403);

    const { action, payload } = await req.json().catch(() => ({}));
    let promptText: string;
    let maxTokens: number;
    if (action === "assistant_superadmin") {
      if (compte.role !== "superadmin") return json({ error: "Accès réservé au superadmin." }, 403);
      if (!payload?.prompt?.trim()) return json({ error: "Le champ prompt est requis." }, 400);
      promptText = promptSuperadmin(payload); maxTokens = 700;
    } else if (action === "assistant_appreciation") {
      if (!ROLES_APPRECIATION.has(compte.role)) return json({ error: "Droits insuffisants." }, 403);
      // Premium : la génération est facturée au jeton → plan Premium exigé.
      const { data: ec } = await admin.from("ecoles")
        .select("plan, plan_expiry").eq("id", compte.ecole_id).maybeSingle();
      if (!estPremiumActif(ec?.plan ?? null, ec?.plan_expiry ?? null)) {
        return json({ error: MESSAGE_PREMIUM, premium: true }, 402);
      }
      promptText = promptAppreciation(payload || {}); maxTokens = 320;
    } else {
      return json({ error: "Action inconnue." }, 400);
    }

    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: MODEL, max_tokens: maxTokens,
      messages: [{ role: "user", content: promptText }],
    });
    const result = (message.content || [])
      .filter((b: any) => b.type === "text").map((b: any) => b.text.trim()).filter(Boolean).join("\n\n").trim();
    if (!result) return json({ error: "Réponse vide du service assistant." }, 502);
    return json({ ok: true, result });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
