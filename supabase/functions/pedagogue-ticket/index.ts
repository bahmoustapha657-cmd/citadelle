// ════════════════════════════════════════════════════════════════════════
//  EduGest — Edge Function : autorisation d'ouvrir Pédagogue (« Mes fiches »)
// ════════════════════════════════════════════════════════════════════════
// Signe, pour l'enseignant connecté, une autorisation de 2 minutes que
// Pédagogue échange contre une session (fonction pont-edugest de ce projet-là).
// Les deux produits gardent chacun leur base : seul le secret est commun.
//
// Déploiement, avec le même secret que PONT_EDUGEST_SECRET côté Pédagogue :
//   supabase secrets set PONT_PEDAGOGUE_SECRET=<secret>
//   supabase functions deploy pedagogue-ticket
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { creerTicket, refusTicket } from "./ticket.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SECRET = Deno.env.get("PONT_PEDAGOGUE_SECRET") ?? "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);
  if (!SECRET) return json({ error: "« Mes fiches » n'est pas encore disponible." }, 503);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  try {
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "").trim();
    if (!jwt) return json({ error: "Non authentifié." }, 401);
    const { data: { user }, error: uErr } = await admin.auth.getUser(jwt);
    if (uErr || !user) return json({ error: "Session invalide." }, 401);

    const { data: compte } = await admin.from("comptes")
      .select("id, role, statut, nom, extra, ecole_id").eq("user_id", user.id).maybeSingle();
    const { data: ecole } = compte?.ecole_id
      ? await admin.from("ecoles").select("actif, supprime").eq("id", compte.ecole_id).maybeSingle()
      : { data: null };
    const refus = refusTicket(compte, ecole);
    if (refus) return json({ error: refus.error }, refus.status);

    const ticket = await creerTicket({
      compteId: compte!.id,
      nom: compte!.nom || "Enseignant",
      jti: crypto.randomUUID(),
      iat: Math.floor(Date.now() / 1000),
    }, SECRET);
    return json({ ok: true, ticket });
  } catch (e) {
    console.error("pedagogue-ticket", e);
    return json({ error: "Ouverture de vos fiches impossible. Réessayez dans un instant." }, 500);
  }
});
