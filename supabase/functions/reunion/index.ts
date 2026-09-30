// ════════════════════════════════════════════════════════════════════════
//  EduGest — Edge Function : appels de groupe (SFU Cloudflare Realtime)
// ════════════════════════════════════════════════════════════════════════
// Un appel de groupe (« réunion », table msg_reunions) passe par le SFU de
// Cloudflare : chaque téléphone envoie sa voix (et sa vidéo) UNE fois au
// serveur, qui la redistribue — tenable à 30 participants sur réseau mobile.
//
// Le navigateur ne parle jamais directement à Cloudflare : la clé
// d'application reste ici, et chaque action vérifie que l'appelant est
// membre de la discussion, participant de la réunion, et ne manipule que SA
// session (règles pures dans _shared/reunion.ts).
//
// Actions (POST { action, reunionId, … }) :
//   rejoindre  → crée la session Cloudflare, inscrit le participant
//   publier    → { sessionDescription (offer), tracks:[{ mid, trackName }] }
//   recevoir   → { pistes:[{ compteId, trackName }] } (pistes des autres)
//   renegocier → { sessionDescription (answer) }
//   fermer     → { mids:[…] } (pistes reçues à abandonner)
//
// INACTIF tant que les secrets ne sont pas posés (réponse 503 explicite).
// Déploiement :  supabase functions deploy reunion
// Secrets (Cloudflare → Realtime → Serverless SFU → créer une application) :
//   supabase secrets set CF_REALTIME_APP_ID="..." CF_REALTIME_APP_SECRET="..."
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fusionnerPistes, type Participant, pistesAPublier, pistesARecevoir } from "../_shared/reunion.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_ID = Deno.env.get("CF_REALTIME_APP_ID") ?? "";
const APP_SECRET = Deno.env.get("CF_REALTIME_APP_SECRET") ?? "";
const CF = `https://rtc.live.cloudflare.com/v1/apps/${APP_ID}`;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

class Refus extends Error {
  constructor(message: string, public statut = 403) { super(message); }
}

async function cloudflare(methode: string, chemin: string, corps?: unknown) {
  const rep = await fetch(CF + chemin, {
    method: methode,
    headers: { Authorization: `Bearer ${APP_SECRET}`, "Content-Type": "application/json" },
    body: corps === undefined ? undefined : JSON.stringify(corps),
  });
  const donnees = await rep.json().catch(() => ({}));
  if (!rep.ok || donnees?.errorCode) {
    throw new Refus(`Serveur d'appels : ${donnees?.errorDescription || rep.status}`, 502);
  }
  return donnees;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);
  if (!APP_ID || !APP_SECRET) {
    return json({ error: "Les appels de groupe ne sont pas encore activés pour cette école (serveur d'appels non configuré)." }, 503);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  try {
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "").trim();
    const { data: { user } } = await admin.auth.getUser(jwt);
    if (!user) return json({ error: "Non authentifié." }, 401);

    const corps = await req.json().catch(() => ({}));
    const { action, reunionId } = corps as { action?: string; reunionId?: string };
    if (!action || !reunionId) throw new Refus("Paramètres manquants.", 400);

    // Qui appelle, et a-t-il sa place dans cette réunion ?
    const { data: compte } = await admin.from("comptes")
      .select("id, ecole_id, role").eq("user_id", user.id).maybeSingle();
    if (!compte?.ecole_id || ["parent", "superadmin"].includes(compte.role)) throw new Refus("Accès refusé.");
    const { data: reunion } = await admin.from("msg_reunions")
      .select("id, ecole_id, conversation_id, statut").eq("id", reunionId).maybeSingle();
    if (!reunion || reunion.ecole_id !== compte.ecole_id) throw new Refus("Appel introuvable.", 404);
    if (reunion.statut !== "en_cours") throw new Refus("Cet appel est terminé.", 410);
    const { data: membre } = await admin.from("msg_membres").select("compte_id")
      .eq("conversation_id", reunion.conversation_id).eq("compte_id", compte.id).maybeSingle();
    if (!membre) throw new Refus("Vous ne faites pas partie de cette discussion.");

    if (action === "rejoindre") {
      const { sessionId } = await cloudflare("POST", "/sessions/new");
      const maintenant = new Date().toISOString();
      const { error } = await admin.from("msg_reunion_participants").upsert({
        reunion_id: reunion.id, compte_id: compte.id, ecole_id: compte.ecole_id,
        session_id: sessionId, pistes: [], micro: true, camera: false,
        rejoint_at: maintenant, vu_at: maintenant, quitte_at: null,
      }, { onConflict: "reunion_id,compte_id" });
      if (error) throw new Error(error.message);
      return json({ ok: true, sessionId });
    }

    // Toutes les autres actions portent sur la session du participant.
    const { data: moi } = await admin.from("msg_reunion_participants")
      .select("compte_id, session_id, pistes, quitte_at")
      .eq("reunion_id", reunion.id).eq("compte_id", compte.id).maybeSingle();
    if (!moi?.session_id || moi.quitte_at) throw new Refus("Rejoignez d'abord l'appel.", 409);
    const session = `/sessions/${moi.session_id}`;

    if (action === "publier") {
      const pistes = pistesAPublier((corps as { tracks?: unknown }).tracks);
      const rep = await cloudflare("POST", `${session}/tracks/new`, {
        sessionDescription: (corps as { sessionDescription?: unknown }).sessionDescription,
        tracks: pistes.map((p) => ({ location: "local", mid: p.mid, trackName: p.trackName })),
      });
      const reussies = (rep.tracks || []).filter((t: { errorCode?: string }) => !t.errorCode)
        .map((t: { trackName: string }) => t.trackName);
      await admin.from("msg_reunion_participants")
        .update({ pistes: fusionnerPistes(moi.pistes, reussies), vu_at: new Date().toISOString() })
        .eq("reunion_id", reunion.id).eq("compte_id", compte.id);
      return json({ ok: true, ...rep });
    }

    if (action === "recevoir") {
      const { data: participants } = await admin.from("msg_reunion_participants")
        .select("compte_id, session_id, pistes, quitte_at").eq("reunion_id", reunion.id);
      const pistes = pistesARecevoir((corps as { pistes?: unknown }).pistes, (participants || []) as Participant[], compte.id);
      if (!pistes.length) return json({ ok: true, tracks: [], requiresImmediateRenegotiation: false });
      const rep = await cloudflare("POST", `${session}/tracks/new`, {
        tracks: pistes.map(({ location, sessionId, trackName }) => ({ location, sessionId, trackName })),
      });
      // Cloudflare renvoie session + nom de piste : on y rattache le compte.
      const tracks = (rep.tracks || []).map((t: { sessionId?: string; trackName?: string }) => ({
        ...t,
        compteId: pistes.find((p) => p.sessionId === t.sessionId && p.trackName === t.trackName)?.compteId ?? null,
      }));
      return json({ ok: true, ...rep, tracks });
    }

    if (action === "renegocier") {
      const rep = await cloudflare("PUT", `${session}/renegotiate`, {
        sessionDescription: (corps as { sessionDescription?: unknown }).sessionDescription,
      });
      return json({ ok: true, ...rep });
    }

    if (action === "fermer") {
      const mids = ((corps as { mids?: unknown }).mids as unknown[] || []).map(String).filter(Boolean).slice(0, 60);
      if (!mids.length) return json({ ok: true });
      const rep = await cloudflare("PUT", `${session}/tracks/close`, { tracks: mids.map((mid) => ({ mid })), force: true });
      return json({ ok: true, ...rep });
    }

    throw new Refus("Action inconnue.", 400);
  } catch (e) {
    const statut = e instanceof Refus ? e.statut : 500;
    return json({ error: String((e as Error)?.message || e) }, statut);
  }
});
