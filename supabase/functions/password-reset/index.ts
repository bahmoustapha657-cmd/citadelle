// ════════════════════════════════════════════════════════════════════════
//  EduGest — Edge Function PUBLIQUE : mot de passe oublié (hybride)
// ════════════════════════════════════════════════════════════════════════
// Aucun appelant authentifié (écran de connexion). Selon le compte :
//   • s'il a un e-mail RÉEL (comptes.email) ET qu'un envoi est configuré
//     (SMTP ou Resend) → on génère un lien de réinitialisation Supabase et on
//     l'envoie à cet e-mail (self-service) ;
//   • sinon, s'il a un numéro (parent : comptes.telephone) ET que l'école est
//     Premium ET qu'un fournisseur SMS/WhatsApp est configuré → on envoie un
//     code à 6 chiffres à ce numéro ; le parent le saisit avec son nouveau
//     mot de passe (action « verifier_code », cf. code.ts) ;
//   • sinon → on dépose un message interne (de la personne vers les postes
//     direction/admin) pour que la Direction réinitialise depuis Comptes &
//     Postes.
// Anti-énumération : réponse générique pour un compte inexistant. Le lien et
// le code ne partent JAMAIS vers une adresse ou un numéro fourni par
// l'appelant, uniquement vers ceux enregistrés sur le compte.
//
// Déploiement : supabase functions deploy password-reset
// (voie code : appliquer d'abord supabase/historique/reinitialisation-code.sql)
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
// Secrets de la voie code : ceux des notifications (SMS_API_URL, SMS_API_KEY,
// SMS_SENDER ; WhatsApp : WHATSAPP_TOKEN, WHATSAPP_PHONE_ID et le modèle
// d'authentification WHATSAPP_TEMPLATE_CODE), cf. _shared/messagerie.ts.
// Optionnel : RESET_CODE_SECRET, clé des empreintes de codes (défaut : la clé
// service_role).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { identifiantConnexion, normaliserTel } from "../_shared/telephone.ts";
import { envoyerSms, envoyerWhatsApp, lireConfigMessagerie, smsActif, whatsappActif } from "../_shared/messagerie.ts";
import { estPremiumActif } from "../_shared/premium.ts";
import {
  CODE_ESSAIS_MAX, CODE_VALIDITE_MS, DELAI_RENVOI_MS, HEURE_MS, codeSaisi, decisionEnvoi, empreinteCode, genererCode,
  masquerTelephone, messageCode, problemeMotDePasse, refusVerification, telephoneDuTitulaire,
} from "./code.ts";

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
const MESSAGERIE = lireConfigMessagerie((cle) => Deno.env.get(cle));
const SECRET_CODES = Deno.env.get("RESET_CODE_SECRET") || SERVICE_ROLE;

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

// Client service_role. Type tiré d'un appel concret : celui de
// ReturnType<typeof createClient> (paramètres génériques par défaut) refuse
// les lectures et écritures de tables non typées.
const creerAdmin = () => createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
type Admin = ReturnType<typeof creerAdmin>;
// deno-lint-ignore no-explicit-any
type Compte = Record<string, any>;
const compteActif = (c: Compte) => !c.statut || c.statut === "Actif";

async function notifierDirection(admin: Admin, compte: Compte) {
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

// École + compte désignés par la saisie de l'écran de connexion, ou null.
// Sert à la demande comme à la vérification du code : les deux désignent le
// compte de la même façon.
async function trouverCompte(admin: Admin, schoolId: unknown, identifiant: unknown) {
  const code = String(schoolId || "").trim().toLowerCase();
  const saisie = String(identifiant || "").trim();
  if (!code || saisie.length < 2) return null;

  const { data: ec } = await admin.from("ecoles").select("id, nom, plan, plan_expiry").eq("code", code).maybeSingle();
  if (!ec) return null;

  // Résolution du compte par identifiant OU par e-mail réel. L'e-mail passe
  // par la RPC login_pour_email (égalité exacte, insensible à la casse) : le
  // filtre ilike d'avant prenait * % _ pour des jokers, et une saisie comme
  // « a*@gmail.com » visait n'importe quel compte correspondant.
  let login = saisie.toLowerCase();
  if (saisie.includes("@")) {
    const { data: loginEmail } = await admin.rpc("login_pour_email", { p_code: code, p_email: saisie });
    if (!loginEmail) return null;
    login = String(loginEmail);
  }
  // select("*") : la colonne telephone (comptes-parents.sql) est lue si elle
  // existe, sans faire échouer la recherche tant que le SQL n'est pas passé.
  const chercher = (l: string) => admin.from("comptes").select("*").eq("ecole_id", ec.id).eq("login", l).maybeSingle();
  let { data: compte } = await chercher(login);
  // Parent dont l'identifiant est son numéro, écrit à sa façon
  // (« 622 12 34 56 ») : second essai avec le numéro à 9 chiffres, comme
  // à la connexion (auth-supabase.js). L'identifiant exact passe d'abord.
  const numero = identifiantConnexion(saisie);
  if (!compte && !saisie.includes("@") && numero !== saisie) ({ data: compte } = await chercher(numero));
  // Parent qui ne se souvient plus que de son numéro : le compte parent qui
  // le porte. Sans risque : le code part vers ce numéro, et l'identifiant
  // n'est rappelé qu'une fois le code vérifié.
  let parTelephone = false;
  if (!compte) {
    compte = await compteParTelephone(admin, ec.id, saisie);
    parTelephone = Boolean(compte);
  }
  // Compte parent absorbé par une fusion de doublons : bloqué, rien à
  // réinitialiser (l'écran de connexion l'oriente vers l'école).
  if (!compte || (compte.extra as Record<string, unknown> | null)?.fusionneDans) return null;
  return { code, ec, compte: compte as Compte, parTelephone };
}

// Compte parent désigné par son numéro de téléphone (comptes.telephone) :
// seulement s'il est le seul compte parent actif à le porter. Un numéro
// partagé (doublons pas encore fusionnés, numéro de l'école) ne désigne
// personne.
async function compteParTelephone(admin: Admin, ecoleId: string, saisie: string): Promise<Compte | null> {
  const tel = normaliserTel(saisie);
  if (!tel || /[a-z@]/i.test(saisie)) return null;
  const { data, error } = await admin.from("comptes").select("*")
    .eq("ecole_id", ecoleId).eq("role", "parent").eq("telephone", tel).limit(20);
  if (error || !data) return null;
  const actifs = (data as Compte[]).filter((c) => compteActif(c) && !c.extra?.fusionneDans);
  return actifs.length === 1 ? actifs[0] : null;
}

// ── Voie code (SMS / WhatsApp) ──────────────────────────────────────────────
// SMS d'abord : il atteint tout téléphone, quand un message WhatsApp accepté
// par Meta peut ne jamais arriver (numéro sans WhatsApp) sans que la fonction
// le sache. WhatsApp seulement avec un modèle d'authentification.
async function envoyerCode(tel: string, code: string, nomEcole: string): Promise<string | null> {
  if (await envoyerSms(MESSAGERIE, tel, messageCode(code, nomEcole))) return "sms";
  if (MESSAGERIE.whatsappModeleCode
    && await envoyerWhatsApp(MESSAGERIE, tel, MESSAGERIE.whatsappModeleCode, [code], { bouton: code })) return "whatsapp";
  return null;
}

const voieCodeOuverte = () => smsActif(MESSAGERIE) || (whatsappActif(MESSAGERIE) && Boolean(MESSAGERIE.whatsappModeleCode));

// Envoie un code au numéro du compte, si la voie est ouverte pour lui : numéro
// connu, compte actif, école Premium (chaque SMS est facturé), fournisseur
// configuré, limites d'envoi respectées. null → voie Direction.
async function voieCode(admin: Admin, ec: Compte, compte: Compte): Promise<Record<string, unknown> | null> {
  const tel = telephoneDuTitulaire(compte);
  if (!tel || !compte.user_id || !compteActif(compte) || !voieCodeOuverte()) return null;
  if (!estPremiumActif(ec.plan, ec.plan_expiry)) return null;

  const maintenant = Date.now();
  const depuis = new Date(maintenant - HEURE_MS).toISOString();
  const [parCompte, parEcole] = await Promise.all([
    admin.from("codes_reinitialisation").select("created_at").eq("compte_id", compte.id).gte("created_at", depuis),
    admin.from("codes_reinitialisation").select("id", { count: "exact", head: true }).eq("ecole_id", ec.id).gte("created_at", depuis),
  ]);
  if (parCompte.error || parEcole.error) return null; // table absente (SQL non passé) : Direction
  const decision = decisionEnvoi({
    recentsCompte: (parCompte.data || []).map((r: Compte) => r.created_at),
    recentsEcole: parEcole.count ?? 0,
    maintenant,
  });
  const reponse = { ok: true, method: "code", telephoneMasque: masquerTelephone(tel), validiteMin: CODE_VALIDITE_MS / 60_000 };
  if (!decision.envoyer) {
    // Plafond de l'école atteint (abus probable) : rien n'est envoyé, la
    // Direction prend le relais. Sinon, le dernier code reçu reste valable.
    return decision.raison === "limite_ecole" ? null : { ...reponse, envoye: false, attente: decision.attente };
  }

  const code = genererCode();
  const { data: ligne, error } = await admin.from("codes_reinitialisation").insert({
    ecole_id: ec.id,
    compte_id: compte.id,
    empreinte: await empreinteCode(code, compte.id, SECRET_CODES),
    expire_le: new Date(maintenant + CODE_VALIDITE_MS).toISOString(),
  }).select("id").single();
  if (error || !ligne) return null;

  const canal = await envoyerCode(tel, code, ec.nom || "");
  if (!canal) {
    // Rien n'est parti : ce code n'existe pas pour le parent.
    await admin.from("codes_reinitialisation").delete().eq("id", ligne.id);
    return null;
  }
  // Seul le dernier code reçu vaut : les précédents sont annulés.
  await Promise.all([
    admin.from("codes_reinitialisation").update({ canal }).eq("id", ligne.id),
    admin.from("codes_reinitialisation").update({ expire_le: new Date(maintenant).toISOString() })
      .eq("compte_id", compte.id).is("utilise_le", null).neq("id", ligne.id).gt("expire_le", new Date(maintenant).toISOString()),
  ]);
  return { ...reponse, envoye: true, canal, attente: DELAI_RENVOI_MS / 1000 };
}

// ── Action « verifier_code » : code reçu + nouveau mot de passe ─────────────
// Réponses : { ok: true, login, schoolId } ou { ok: false, erreur } (code_faux
// avec essaisRestants, code_epuise, code_expire, code_invalide, mdp_court,
// mdp_long, mdp_refuse, indisponible). Un compte inconnu répond comme un
// compte sans code en cours (code_expire) : rien à apprendre en essayant.
async function verifierCode(admin: Admin, corps: Compte): Promise<Record<string, unknown>> {
  const saisi = codeSaisi(corps.code);
  if (!saisi) return { ok: false, erreur: "code_invalide" };
  const probleme = problemeMotDePasse(corps.nouveauMdp);
  if (probleme) return { ok: false, erreur: probleme };

  const trouve = await trouverCompte(admin, corps.schoolId, corps.identifiant);
  if (!trouve?.compte.user_id) return { ok: false, erreur: "code_expire" };
  const { compte } = trouve;

  const { data: verdict, error } = await admin.rpc("verifier_code_reinitialisation", {
    p_compte_id: compte.id,
    p_empreinte: await empreinteCode(saisi, compte.id, SECRET_CODES),
    p_essais_max: CODE_ESSAIS_MAX,
  });
  if (error) {
    console.error("verifier_code:", error.message);
    return { ok: false, erreur: "indisponible" };
  }
  const refus = refusVerification(verdict);
  if (refus) return refus;

  const { error: errMdp } = await admin.auth.admin.updateUserById(compte.user_id, { password: corps.nouveauMdp });
  if (errMdp) {
    // Le code reste valable : le parent choisit un autre mot de passe.
    return { ok: false, erreur: "mdp_refuse", code: errMdp.code || "", message: errMdp.message || "" };
  }
  const maintenant = new Date().toISOString();
  await Promise.all([
    admin.from("codes_reinitialisation").update({ utilise_le: maintenant }).eq("id", verdict.codeId),
    // Le mot de passe vient d'être choisi par le parent lui-même.
    admin.from("comptes").update({ premiere_co: false }).eq("id", compte.id),
    admin.from("audit").insert({
      ecole_id: compte.ecole_id,
      action: "reinitialisation_mdp_code",
      auteur: { compteId: compte.id, login: compte.login, role: compte.role },
      cible: { compteId: compte.id, login: compte.login },
      details: { codeId: verdict.codeId },
    }),
  ]);
  return { ok: true, login: compte.login, schoolId: trouve.code };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);

  const admin = creerAdmin();
  const generique = { ok: true, message: "Si le compte existe, la marche à suivre a été déclenchée (e-mail, code par SMS ou notification à la Direction)." };
  const corps = await req.json().catch(() => ({}));
  if (corps?.action === "verifier_code") {
    try {
      return json(await verifierCode(admin, corps));
    } catch (e) {
      console.error("password-reset/verifier_code:", String((e as Error)?.message || e));
      return json({ ok: false, erreur: "indisponible" });
    }
  }
  try {
    const trouve = await trouverCompte(admin, corps?.schoolId, corps?.identifiant);
    if (!trouve) return json(generique);
    const { code, ec, compte } = trouve;

    // Voie e-mail (self-service) si e-mail réel + envoi configuré.
    if (compte.email) {
      const emailAuth = `${compte.login}.${code}@${DOMAIN}`;
      const { data: lien } = await admin.auth.admin.generateLink({ type: "recovery", email: emailAuth });
      const tokenHash = lien?.properties?.hashed_token;
      if (tokenHash && await envoyerEmail(compte.email, lienReinitialisation(tokenHash), ec.nom || "")) {
        return json({ ok: true, method: "email", emailMasque: masque(compte.email) });
      }
    }

    // Voie code (parent sans e-mail) : SMS / WhatsApp au numéro du compte.
    const parCode = await voieCode(admin, ec, compte);
    if (parCode) return json(parCode);

    // Voie Direction (ni e-mail ni numéro joignable, ou envoi non configuré/échoué).
    // Compte trouvé par son numéro : réponse générique, sans quoi l'écran
    // dirait à qui essaie des numéros lesquels sont ceux de parents de l'école.
    await notifierDirection(admin, compte);
    return json(trouve.parTelephone ? generique : { ok: true, method: "direction" });
  } catch (e) {
    // On reste générique même en cas d'erreur interne (pas de fuite).
    console.error("password-reset:", String((e as Error)?.message || e));
    return json(generique);
  }
});
