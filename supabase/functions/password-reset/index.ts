// ════════════════════════════════════════════════════════════════════════
//  EduGest — Edge Function PUBLIQUE : mot de passe oublié (hybride)
// ════════════════════════════════════════════════════════════════════════
// Aucun appelant authentifié (écran de connexion). Selon le compte :
//   • s'il a un e-mail RÉEL (comptes.email) ET qu'un envoi est configuré
//     (RESEND_API_KEY + RESEND_FROM) → on génère un lien de réinitialisation
//     Supabase et on l'envoie à cet e-mail (self-service) ;
//   • sinon → on dépose un message interne (de la personne vers les postes
//     direction/admin) pour que la Direction réinitialise depuis Comptes &
//     Postes.
// Anti-énumération : réponse générique quoi qu'il arrive (compte inexistant
// inclus). Le lien n'est JAMAIS envoyé à une adresse fournie par l'appelant,
// uniquement à l'e-mail enregistré sur le compte.
//
// Déploiement : supabase functions deploy password-reset
// APP_URL = adresse de l'app où atterrit le lien (défaut ci-dessous) : le
// lien pointe directement dessus, sans dépendre de la « Site URL » ni des
// « Redirect URLs » de Supabase Auth (voir lienReinitialisation).
// Secrets (optionnels, pour la voie e-mail — 2 fournisseurs possibles) :
//   • SMTP (ex. Gmail, SANS domaine) :
//     supabase secrets set SMTP_USER="edugest26@gmail.com" SMTP_PASS="<mot de passe d'application 16 car.>" APP_URL="https://edugest-gn.pages.dev"
//     (Gmail : activer la validation en 2 étapes puis créer un « mot de passe d'application ».
//      Optionnel : SMTP_HOST/SMTP_PORT si autre que smtp.gmail.com:465.)
//   • Resend (nécessite un domaine vérifié) :
//     supabase secrets set RESEND_API_KEY="re_..." RESEND_FROM="EduGest <noreply@mondomaine>" APP_URL="https://edugest-gn.pages.dev"
// Priorité : SMTP si configuré, sinon Resend, sinon repli notification Direction.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM = Deno.env.get("RESEND_FROM") ?? "";
const SMTP_USER = Deno.env.get("SMTP_USER") ?? "";
const SMTP_PASS = Deno.env.get("SMTP_PASS") ?? "";
const SMTP_HOST = Deno.env.get("SMTP_HOST") ?? "smtp.gmail.com";
const SMTP_PORT = Number(Deno.env.get("SMTP_PORT") ?? "465");
const APP_URL = Deno.env.get("APP_URL") ?? "https://edugest-gn.pages.dev";
const DOMAIN = "edugest.app";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const masque = (email: string) => email.replace(/^(.).*(@.*)$/, (_m, a, b) => `${a}•••${b}`);

// Lien de réinitialisation : vers l'APP directement, jeton dans le fragment.
// L'action_link de Supabase Auth (…/auth/v1/verify?…) n'est plus envoyé :
//   • il ne redirige que vers une URL autorisée (Authentication → URL
//     Configuration), sinon vers la « Site URL » — http://localhost:3000 par
//     défaut : le lien reçu ne menait nulle part ;
//   • ce simple GET consomme le jeton : l'analyseur de liens d'une messagerie
//     qui ouvre le lien avant l'utilisateur le rendait déjà expiré.
// Le fragment (#…) n'est jamais envoyé au serveur (ni journaux, ni cache du
// service worker) ; l'app n'échange le jeton contre une session qu'au clic
// « Enregistrer » (verifyOtp, cf. src/backend/password-reset-supabase.js).
const lienReinitialisation = (tokenHash: string) =>
  `${APP_URL.replace(/\/+$/, "")}/#type=recovery&token_hash=${encodeURIComponent(tokenHash)}`;

function corpsHtml(lien: string, nomEcole: string): string {
  const href = lien.replace(/&/g, "&amp;");
  return `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#1e293b">
      <h2 style="color:#0A1628">Réinitialisation de votre mot de passe</h2>
      <p>Une demande de réinitialisation a été faite pour votre compte EduGest${nomEcole ? ` (${nomEcole})` : ""}.</p>
      <p><a href="${href}" style="display:inline-block;background:#00C48C;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700">Choisir un nouveau mot de passe</a></p>
      <p style="font-size:12px;color:#64748b">Si le bouton ne s'ouvre pas, copiez ce lien dans votre navigateur :<br><a href="${href}" style="color:#1d4ed8;word-break:break-all">${href}</a></p>
      <p style="font-size:13px;color:#64748b">Ce lien expire après un court délai. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : votre mot de passe reste inchangé.</p>
    </div>`;
}

// Version texte (messageries qui n'affichent pas le HTML).
function corpsTexte(lien: string, nomEcole: string): string {
  return [
    `Une demande de réinitialisation a été faite pour votre compte EduGest${nomEcole ? ` (${nomEcole})` : ""}.`,
    "",
    "Choisissez un nouveau mot de passe en ouvrant ce lien :",
    lien,
    "",
    "Ce lien expire après un court délai. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : votre mot de passe reste inchangé.",
  ].join("\n");
}

const SUJET = "EduGest — réinitialisation de mot de passe";

// SMTP (Gmail par défaut) — prioritaire, ne nécessite pas de domaine.
async function envoyerSmtp(to: string, html: string, texte: string): Promise<boolean> {
  if (!SMTP_USER || !SMTP_PASS) return false;
  const client = new SMTPClient({
    connection: { hostname: SMTP_HOST, port: SMTP_PORT, tls: SMTP_PORT === 465, auth: { username: SMTP_USER, password: SMTP_PASS } },
  });
  try {
    // denomailer : `content` = partie texte (elle valait « text/html » mot
    // pour mot), `html` = partie HTML.
    await client.send({ from: `EduGest <${SMTP_USER}>`, to, subject: SUJET, content: texte, html });
    return true;
  } catch (e) {
    console.error("smtp:", String((e as Error)?.message || e));
    return false;
  } finally {
    try { await client.close(); } catch { /* ignore */ }
  }
}

// Resend — repli (nécessite un domaine vérifié).
async function envoyerResend(to: string, html: string, texte: string): Promise<boolean> {
  if (!RESEND_API_KEY || !RESEND_FROM) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: RESEND_FROM, to, subject: SUJET, html, text: texte }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

async function envoyerEmail(to: string, lien: string, nomEcole: string): Promise<boolean> {
  const html = corpsHtml(lien, nomEcole);
  const texte = corpsTexte(lien, nomEcole);
  return (await envoyerSmtp(to, html, texte)) || (await envoyerResend(to, html, texte));
}

async function notifierDirection(admin: ReturnType<typeof createClient>, compte: Record<string, unknown>) {
  // Message interne : de la personne (qui a oublié) vers les postes direction+admin.
  try {
    await admin.from("messages_internes").insert({
      ecole_id: compte.ecole_id,
      de_compte_id: compte.id,
      de_nom: compte.nom || compte.login,
      de_poste: compte.label || null,
      a_postes: ["direction", "admin"],
      a_tous: false,
      sujet: "🔑 Mot de passe oublié",
      corps: `${compte.nom || compte.login} (identifiant « ${compte.login} ») a oublié son mot de passe et demande une réinitialisation. Ouvrez Comptes & Postes → « Réinitialiser le mot de passe ».`,
    });
  } catch { /* best effort : la notification ne doit pas faire échouer la demande */ }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const generique = { ok: true, message: "Si le compte existe, la marche à suivre a été déclenchée (e-mail ou notification à la Direction)." };
  try {
    const { schoolId, identifiant } = await req.json().catch(() => ({}));
    const code = String(schoolId || "").trim().toLowerCase();
    const saisie = String(identifiant || "").trim();
    if (!code || saisie.length < 2) return json(generique); // réponse neutre

    const { data: ec } = await admin.from("ecoles").select("id, nom").eq("code", code).maybeSingle();
    if (!ec) return json(generique);

    // Résolution du compte par identifiant OU par e-mail réel. L'e-mail passe
    // par la RPC login_pour_email (égalité exacte, insensible à la casse) : le
    // filtre ilike d'avant prenait * % _ pour des jokers, et une saisie comme
    // « a*@gmail.com » visait n'importe quel compte correspondant.
    let login = saisie.toLowerCase();
    if (saisie.includes("@")) {
      const { data: loginEmail } = await admin.rpc("login_pour_email", { p_code: code, p_email: saisie });
      if (!loginEmail) return json(generique);
      login = String(loginEmail);
    }
    const { data: compte } = await admin.from("comptes")
      .select("id, ecole_id, login, nom, label, email, role")
      .eq("ecole_id", ec.id).eq("login", login).maybeSingle();
    // Portails parent/enseignant : réinitialisation par l'école aussi (pas ici).
    if (!compte) return json(generique);

    // Voie e-mail (self-service) si e-mail réel + envoi configuré.
    if (compte.email) {
      const emailAuth = `${compte.login}.${code}@${DOMAIN}`;
      const { data: lien } = await admin.auth.admin.generateLink({ type: "recovery", email: emailAuth });
      const tokenHash = lien?.properties?.hashed_token;
      if (tokenHash && await envoyerEmail(compte.email, lienReinitialisation(tokenHash), ec.nom || "")) {
        return json({ ok: true, method: "email", emailMasque: masque(compte.email) });
      }
    }

    // Voie Direction (aucun e-mail réel, ou envoi non configuré/échoué).
    await notifierDirection(admin, compte);
    return json({ ok: true, method: "direction" });
  } catch (e) {
    // On reste générique même en cas d'erreur interne (pas de fuite).
    console.error("password-reset:", String((e as Error)?.message || e));
    return json(generique);
  }
});
