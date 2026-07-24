// ════════════════════════════════════════════════════════════════════════
//  EduGest — Edge Function : notifications parents (WhatsApp + repli SMS)
// ════════════════════════════════════════════════════════════════════════
// Appelée par le client (fire-and-forget) après un événement :
//   invoke("notify", { body: { schoolId, type, eleveId?, data } })
//   type ∈ 'paiement' | 'absence' | 'annonce'
//
// Tout se passe côté serveur (service_role) : lecture des réglages de l'école
// (ecoles.extra.notifications), résolution du numéro du tuteur
// (eleves.contact_tuteur), composition du message par gabarit, anti-doublon
// (notifications_envois.dedup_key), envoi WhatsApp puis repli SMS, journal.
//
// INACTIF tant qu'aucun secret fournisseur n'est posé → répond
// { ok:true, method:"inactif" } sans rien envoyer (aucun risque en prod).
//
// ⚠️ PREMIUM : chaque message est facturé → réservé aux écoles du plan
// Premium. Ce contrôle est l'autorité (le gating de l'UI n'est qu'un
// confort) ; il duplique volontairement estPremiumActif de
// shared/plan-features.js (Deno ne partage pas ce module) — garder alignés.
//
// Déploiement :  supabase functions deploy notify
// Secrets WhatsApp (Meta Cloud API) :
//   supabase secrets set WHATSAPP_TOKEN="EAAG..." WHATSAPP_PHONE_ID="123..." \
//     WHATSAPP_TEMPLATE="edugest_notif" WHATSAPP_LANG="fr"
//   (le gabarit « edugest_notif » avec un paramètre {{1}} = corps, doit être
//    approuvé dans le Meta Business Manager.)
// Secrets SMS (générique HTTP — À ADAPTER au fournisseur choisi, cf.
//   envoyerSms ci-dessous) :
//   supabase secrets set SMS_API_URL="https://..." SMS_API_KEY="..." \
//     SMS_SENDER="EduGest"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN") ?? "";
const WHATSAPP_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_ID") ?? "";
const WHATSAPP_TEMPLATE = Deno.env.get("WHATSAPP_TEMPLATE") ?? "edugest_notif";
const WHATSAPP_LANG = Deno.env.get("WHATSAPP_LANG") ?? "fr";

const SMS_API_URL = Deno.env.get("SMS_API_URL") ?? "";
const SMS_API_KEY = Deno.env.get("SMS_API_KEY") ?? "";
const SMS_SENDER = Deno.env.get("SMS_SENDER") ?? "EduGest";

const SMS_ACTIF = Boolean(SMS_API_URL && SMS_API_KEY);
const WA_ACTIF = Boolean(WHATSAPP_TOKEN && WHATSAPP_PHONE_ID);

// ── Premium (miroir de shared/plan-features.js) ─────────────────────────────
const PLANS_PREMIUM = ["premium"];
const GRACE_MS = 3 * 86400000;
function estPremiumActif(plan: string | null, planExpiry: number | null): boolean {
  if (!plan || !PLANS_PREMIUM.includes(plan)) return false;
  if (!planExpiry) return true;
  return Date.now() < Number(planExpiry) + GRACE_MS;
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// ── Normalisation E.164 Guinée (miroir de shared/phone.js) ──────────────────
function normaliserTel(brut: string | null): string | null {
  if (!brut) return null;
  const premier = String(brut).split(/[/,;]| ou /i)[0];
  let d = premier.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("224")) d = d.slice(3);
  if (d.length === 9 && d.startsWith("6")) return "+224" + d;
  return null;
}

// ── Gabarits de message (courts : 1 SMS = 160 car.) ─────────────────────────
type Charge = Record<string, unknown>;
function composer(type: string, data: Charge, nomEcole: string): string | null {
  const ecole = nomEcole || "votre école";
  const eleve = String(data.nomEleve || "votre enfant");
  if (type === "paiement") {
    const mois = data.mois ? ` (${data.mois})` : "";
    return data.paye === false
      ? `${ecole}: la scolarite${mois} de ${eleve} est marquee IMPAYEE. Merci de regulariser.`
      : `${ecole}: paiement${mois} de ${eleve} bien recu. Merci.`;
  }
  if (type === "absence") {
    const date = data.date ? ` le ${data.date}` : "";
    return `${ecole}: ${eleve} a ete note(e) ABSENT(e)${date}. Contactez l'ecole si besoin.`;
  }
  if (type === "annonce") {
    const titre = String(data.titre || "").trim();
    const corps = String(data.corps || "").trim();
    return `${ecole}: ${titre}${titre && corps ? " — " : ""}${corps}`.slice(0, 300);
  }
  return null;
}

// ── Canal WhatsApp (Meta Cloud API) — implémentation standard ───────────────
async function envoyerWhatsApp(to: string, corps: string): Promise<boolean> {
  if (!WA_ACTIF) return false;
  try {
    const r = await fetch(`https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to.replace("+", ""),
        type: "template",
        template: {
          name: WHATSAPP_TEMPLATE,
          language: { code: WHATSAPP_LANG },
          components: [{ type: "body", parameters: [{ type: "text", text: corps }] }],
        },
      }),
    });
    return r.ok;
  } catch (e) {
    console.error("whatsapp:", String((e as Error)?.message || e));
    return false;
  }
}

// ── Canal SMS (générique) — ⚠️ À ADAPTER au fournisseur retenu ───────────────
// La forme exacte du corps (champs to/message/sender, en-têtes d'auth) dépend
// du fournisseur (Nimba SMS, Twilio…). Ci-dessous : POST JSON avec Bearer, la
// forme la plus courante. Vérifier la doc du fournisseur et ajuster body/headers.
async function envoyerSms(to: string, corps: string): Promise<boolean> {
  if (!SMS_ACTIF) return false;
  try {
    const r = await fetch(SMS_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${SMS_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ to, message: corps, sender_name: SMS_SENDER }),
    });
    return r.ok;
  } catch (e) {
    console.error("sms:", String((e as Error)?.message || e));
    return false;
  }
}

// Envoie via WhatsApp puis repli SMS ; renvoie le canal utilisé ou null.
async function envoyer(to: string, corps: string): Promise<string | null> {
  if (await envoyerWhatsApp(to, corps)) return "whatsapp";
  if (await envoyerSms(to, corps)) return "sms";
  return null;
}

type Admin = ReturnType<typeof createClient>;

// Un envoi vers un élève (résout le tuteur, dedup, envoie, journalise).
async function notifierEleve(
  admin: Admin, ecoleId: string, eleveId: string, type: string, corps: string, dedupKey: string,
): Promise<string> {
  // Anti-doublon : si une ligne existe déjà pour cette clé, on ne renvoie pas.
  if (dedupKey) {
    const { data: existe } = await admin.from("notifications_envois")
      .select("id").eq("dedup_key", dedupKey).maybeSingle();
    if (existe) return "doublon";
  }
  const { data: el } = await admin.from("eleves")
    .select("contact_tuteur").eq("id", eleveId).eq("ecole_id", ecoleId).maybeSingle();
  const tel = normaliserTel((el?.contact_tuteur as string) ?? null);
  if (!tel) {
    await admin.from("notifications_envois").insert({
      ecole_id: ecoleId, eleve_id: eleveId, type, statut: "ignore",
      erreur: "numero injoignable", dedup_key: dedupKey || null,
    });
    return "injoignable";
  }
  const canal = await envoyer(tel, corps);
  await admin.from("notifications_envois").insert({
    ecole_id: ecoleId, eleve_id: eleveId, type, canal, destinataire: tel,
    statut: canal ? "envoye" : "echec", dedup_key: dedupKey || null,
  });
  return canal ? "envoye" : "echec";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  try {
    // Authentifie l'appelant (un membre du personnel déclenche l'événement).
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "").trim();
    const { data: { user } } = await admin.auth.getUser(jwt);
    if (!user) return json({ error: "Non authentifié." }, 401);

    const { schoolId, type, eleveId, data = {} } = await req.json().catch(() => ({}));
    if (!schoolId || !type) return json({ error: "Paramètres manquants." }, 400);

    // Aucun fournisseur configuré → no-op (feature désactivée, zéro envoi).
    if (!WA_ACTIF && !SMS_ACTIF) return json({ ok: true, method: "inactif" });

    const { data: ec } = await admin.from("ecoles")
      .select("id, nom, extra, plan, plan_expiry").eq("code", String(schoolId).toLowerCase()).maybeSingle();
    if (!ec) return json({ error: "École introuvable." }, 404);

    // Premium : chaque SMS/WhatsApp est facturé → plan Premium exigé.
    if (!estPremiumActif((ec.plan as string) ?? null, (ec.plan_expiry as number) ?? null)) {
      return json({ ok: true, method: "non_premium" });
    }

    // Réglages de l'école : le déclencheur doit être activé (opt-in) + heures.
    const prefs = (ec.extra?.notifications ?? {}) as Charge;
    if (prefs[type] !== true) return json({ ok: true, method: "desactive" });
    const h = new Date().getUTCHours(); // Guinée = UTC+0
    const hDeb = Number(prefs.heureDebut ?? 7);
    const hFin = Number(prefs.heureFin ?? 20);
    if (h < hDeb || h >= hFin) return json({ ok: true, method: "heure_silence" });

    const corps = composer(type, data, (ec.nom as string) || "");
    if (!corps) return json({ error: "Type inconnu." }, 400);

    // ── Diffusion (annonce) : tous les élèves actifs de l'école ──────────────
    if (type === "annonce") {
      const { data: eleves } = await admin.from("eleves")
        .select("id, contact_tuteur, statut").eq("ecole_id", ec.id);
      const actifs = (eleves || []).filter((e) => (e.statut ?? "Actif") === "Actif");
      let envoyes = 0, injoignables = 0;
      // dedup par (annonce, élève, date) pour ne pas re-diffuser au re-clic.
      const jour = new Date().toISOString().slice(0, 10);
      const cle = String(data.annonceId || data.titre || jour);
      for (const e of actifs) {
        const tel = normaliserTel((e.contact_tuteur as string) ?? null);
        const dedupKey = `annonce:${cle}:${e.id}`;
        if (!tel) { injoignables++; continue; }
        const { data: existe } = await admin.from("notifications_envois")
          .select("id").eq("dedup_key", dedupKey).maybeSingle();
        if (existe) continue;
        const canal = await envoyer(tel, corps);
        await admin.from("notifications_envois").insert({
          ecole_id: ec.id, eleve_id: e.id, type, canal, destinataire: tel,
          statut: canal ? "envoye" : "echec", dedup_key: dedupKey,
        });
        if (canal) envoyes++;
      }
      return json({ ok: true, method: "annonce", envoyes, injoignables, total: actifs.length });
    }

    // ── Événement ciblé (paiement / absence) : un élève ──────────────────────
    if (!eleveId) return json({ error: "eleveId requis." }, 400);
    const jour = new Date().toISOString().slice(0, 10);
    const suffixe = type === "paiement" ? String(data.mois || jour) : jour;
    const dedupKey = `${type}:${eleveId}:${suffixe}`;
    const res = await notifierEleve(admin, ec.id, eleveId, type, corps, dedupKey);
    return json({ ok: true, method: type, resultat: res });
  } catch (e) {
    console.error("notify:", String((e as Error)?.message || e));
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
