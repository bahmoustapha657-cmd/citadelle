// ════════════════════════════════════════════════════════════════════════
//  EduGest — Edge Function : serveurs ICE des appels audio (STUN + TURN)
// ════════════════════════════════════════════════════════════════════════
// Les appels de la messagerie interne sont en WebRTC pair-à-pair. Sur un même
// Wi-Fi, ou avec des NAT « simples », STUN suffit. Sur les réseaux mobiles
// (NAT d'opérateur, fréquents chez Orange/MTN), les deux téléphones ne se
// voient pas : il faut un relais TURN. Cette fonction délivre des
// identifiants TURN ÉPHÉMÈRES (Cloudflare Realtime TURN) sans jamais exposer
// la clé d'API au navigateur.
//
// INACTIF tant que les secrets ne sont pas posés → renvoie seulement des
// serveurs STUN publics (les appels marchent sur le même réseau, et souvent
// au-delà ; sinon ils échouent proprement en « Appel interrompu »).
//
// Déploiement :  supabase functions deploy turn-credentials
// Secrets (Cloudflare → Realtime → TURN Server → créer une clé) :
//   supabase secrets set CF_TURN_KEY_ID="..." CF_TURN_API_TOKEN="..."
//
// Sans Cloudflare (carte bancaire refusée…) : tout autre relais à identifiants
// fixes, remis aux seuls comptes connectés, ou repli si Cloudflare échoue :
//   supabase secrets set TURN_URLS="turn:hote:3478?transport=udp,turn:hote:3478?transport=tcp" \
//     TURN_USERNAME="..." TURN_CREDENTIAL="..."
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { type IceServer, serveursRepli } from "../_shared/relais-turn.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CF_TURN_KEY_ID = Deno.env.get("CF_TURN_KEY_ID") ?? "";
const CF_TURN_API_TOKEN = Deno.env.get("CF_TURN_API_TOKEN") ?? "";

// Durée de vie des identifiants : plus longue que l'appel le plus long.
const TTL_SECONDES = 4 * 3600;

const REPLI = serveursRepli(Deno.env.get("TURN_URLS"), Deno.env.get("TURN_USERNAME"), Deno.env.get("TURN_CREDENTIAL"));

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// Le port 53 est bloqué par les navigateurs : l'URL correspondante ne ferait
// qu'allonger la collecte ICE (recommandation Cloudflare).
function sansPort53(serveurs: IceServer[]): IceServer[] {
  return serveurs.map((s) => ({
    ...s,
    urls: (Array.isArray(s.urls) ? s.urls : [s.urls]).filter((u) => !/:53(\?|$)/.test(u)),
  })).filter((s) => (s.urls as string[]).length > 0);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);

  // Réservé aux comptes connectés (sinon n'importe qui consommerait le relais).
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "").trim();
  const { data: { user } } = await admin.auth.getUser(jwt);
  if (!user) return json({ error: "Non authentifié." }, 401);

  if (!CF_TURN_KEY_ID || !CF_TURN_API_TOKEN) return json(REPLI);

  try {
    const rep = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${CF_TURN_KEY_ID}/credentials/generate-ice-servers`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${CF_TURN_API_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ttl: TTL_SECONDES }),
      },
    );
    if (!rep.ok) throw new Error(`Cloudflare TURN ${rep.status}`);
    const { iceServers } = await rep.json();
    const liste = Array.isArray(iceServers) ? iceServers : [iceServers];
    return json({ iceServers: sansPort53(liste), turn: true });
  } catch (e) {
    // Relais indisponible : on dépanne plutôt que de bloquer l'appel.
    console.error("turn-credentials:", (e as Error)?.message || e);
    return json(REPLI);
  }
});
