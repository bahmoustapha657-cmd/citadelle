// ════════════════════════════════════════════════════════════════════════
//  EduGest — Edge Function : envoi de notifications push (Web Push / VAPID)
// ════════════════════════════════════════════════════════════════════════
// Lit les abonnements (table push_subs) des rôles ciblés d'une école et envoie
// la notification via le protocole Web Push. La clé VAPID privée reste ici.
//
// Déploiement + secrets :
//   supabase functions deploy push
//   supabase secrets set VAPID_PUBLIC_KEY="..." VAPID_PRIVATE_KEY="..." VAPID_SUBJECT="mailto:contact@edugest.app"
//
// Appelé par le client : supabase.functions.invoke("push", { body }).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:contact@edugest.app";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  try {
    // Authentifie l'appelant (un membre du personnel envoie ; ou superadmin).
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "").trim();
    const { data: { user } } = await admin.auth.getUser(jwt);
    if (!user) return json({ error: "Non authentifié." }, 401);

    const { schoolId, cibles, userIds, tousStaff, titre, corps, url } = await req.json().catch(() => ({}));
    const aCibles = Array.isArray(cibles) && cibles.length > 0;
    const aUserIds = Array.isArray(userIds) && userIds.length > 0;
    if (!schoolId || (!aCibles && !aUserIds && !tousStaff)) return json({ error: "Paramètres manquants." }, 400);

    const { data: ec } = await admin.from("ecoles").select("id").eq("code", String(schoolId).toLowerCase()).maybeSingle();
    if (!ec) return json({ error: "École introuvable." }, 404);

    // Ciblage : rôle legacy OU clé de poste (les cibles historiques 'admin',
    // 'direction'… matchent les postes système), OU utilisateurs précis
    // (messagerie individuelle), OU tout le personnel (hors parents/enseignants).
    let query = admin.from("push_subs").select("user_id, subscription").eq("ecole_id", ec.id);
    if (tousStaff) {
      query = query.not("role", "in", '("parent","enseignant")');
    } else {
      const filtres: string[] = [];
      if (aCibles) {
        const liste = cibles.map((c: unknown) => String(c).replace(/[^a-z0-9._-]/gi, "")).filter(Boolean).join(",");
        if (liste) filtres.push(`role.in.(${liste})`, `poste_cle.in.(${liste})`);
      }
      if (aUserIds) {
        const uids = userIds.map((u: unknown) => String(u).replace(/[^a-f0-9-]/gi, "")).filter(Boolean).join(",");
        if (uids) filtres.push(`user_id.in.(${uids})`);
      }
      if (!filtres.length) return json({ ok: true, envoyes: 0 });
      query = query.or(filtres.join(","));
    }
    const { data: subs } = await query;
    if (!subs?.length) return json({ ok: true, envoyes: 0 });

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    const payload = JSON.stringify({ title: titre || "EduGest", body: corps || "", url: url || "/" });

    let envoyes = 0;
    const aSupprimer: string[] = [];
    await Promise.all((subs || []).map(async (s) => {
      try {
        await webpush.sendNotification(s.subscription, payload);
        envoyes++;
      } catch (err) {
        // 404/410 = abonnement expiré → on le purge.
        const code = (err as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) aSupprimer.push(s.user_id);
      }
    }));
    if (aSupprimer.length) await admin.from("push_subs").delete().eq("ecole_id", ec.id).in("user_id", aSupprimer);

    return json({ ok: true, envoyes });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
