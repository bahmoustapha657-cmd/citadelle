// ════════════════════════════════════════════════════════════════════════
//  Envoi SMS / WhatsApp — partagé par les Edge Functions
// ════════════════════════════════════════════════════════════════════════
// notify (alertes aux tuteurs) et password-reset (code de réinitialisation)
// passent par ce seul adaptateur : brancher un autre fournisseur SMS se fait
// ICI, une fois pour les deux. Module sans dépendance Deno — la fonction
// appelante lit les secrets (lireConfigMessagerie((cle) => Deno.env.get(cle)))
// — que les tests Node chargent tel quel (tests/reinitialisation-code.test.js).
//
// Secrets (communs à toutes les fonctions du projet) :
//   WhatsApp (Meta Cloud API) : WHATSAPP_TOKEN, WHATSAPP_PHONE_ID,
//     WHATSAPP_TEMPLATE (notifications ; défaut « edugest_notif », un
//     paramètre {{1}} = corps), WHATSAPP_TEMPLATE_CODE (codes de
//     réinitialisation : modèle de catégorie « Authentification », que Meta
//     exige pour un code à usage unique ; {{1}} = code, bouton « Copier le
//     code »), WHATSAPP_LANG (défaut « fr »).
//   SMS (générique HTTP — À ADAPTER au fournisseur, cf. envoyerSms) :
//     SMS_API_URL, SMS_API_KEY, SMS_SENDER (défaut « EduGest »).

export type ConfigMessagerie = {
  whatsappToken: string;
  whatsappPhoneId: string;
  whatsappModele: string;
  whatsappModeleCode: string;
  whatsappLangue: string;
  smsUrl: string;
  smsCle: string;
  smsExpediteur: string;
};

type Requete = { method: string; headers: Record<string, string>; body: string };
export type Fetch = (url: string, init: Requete) => Promise<{ ok: boolean }>;

export function lireConfigMessagerie(lire: (cle: string) => string | undefined): ConfigMessagerie {
  return {
    whatsappToken: lire("WHATSAPP_TOKEN") ?? "",
    whatsappPhoneId: lire("WHATSAPP_PHONE_ID") ?? "",
    whatsappModele: lire("WHATSAPP_TEMPLATE") ?? "edugest_notif",
    whatsappModeleCode: lire("WHATSAPP_TEMPLATE_CODE") ?? "",
    whatsappLangue: lire("WHATSAPP_LANG") ?? "fr",
    smsUrl: lire("SMS_API_URL") ?? "",
    smsCle: lire("SMS_API_KEY") ?? "",
    smsExpediteur: lire("SMS_SENDER") ?? "EduGest",
  };
}

export const whatsappActif = (c: ConfigMessagerie): boolean => Boolean(c.whatsappToken && c.whatsappPhoneId);
export const smsActif = (c: ConfigMessagerie): boolean => Boolean(c.smsUrl && c.smsCle);

// ── Canal WhatsApp (Meta Cloud API) : message sur modèle approuvé ───────────
// `parametres` : valeurs {{1}}, {{2}}… du corps. `bouton` : paramètre du
// bouton « Copier le code » d'un modèle d'authentification (le code même).
// Un envoi accepté par l'API n'est pas encore distribué : un numéro sans
// WhatsApp échoue plus tard, sans retour ici.
export async function envoyerWhatsApp(
  c: ConfigMessagerie, to: string, modele: string, parametres: string[],
  { bouton = "", fetchFn = fetch as unknown as Fetch }: { bouton?: string; fetchFn?: Fetch } = {},
): Promise<boolean> {
  if (!whatsappActif(c) || !modele) return false;
  const components: Array<Record<string, unknown>> = [
    { type: "body", parameters: parametres.map((text) => ({ type: "text", text })) },
  ];
  if (bouton) components.push({ type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: bouton }] });
  try {
    const r = await fetchFn(`https://graph.facebook.com/v20.0/${c.whatsappPhoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${c.whatsappToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to.replace("+", ""),
        type: "template",
        template: { name: modele, language: { code: c.whatsappLangue }, components },
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
export async function envoyerSms(
  c: ConfigMessagerie, to: string, corps: string, fetchFn: Fetch = fetch as unknown as Fetch,
): Promise<boolean> {
  if (!smsActif(c)) return false;
  try {
    const r = await fetchFn(c.smsUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${c.smsCle}`, "Content-Type": "application/json" },
      body: JSON.stringify({ to, message: corps, sender_name: c.smsExpediteur }),
    });
    return r.ok;
  } catch (e) {
    console.error("sms:", String((e as Error)?.message || e));
    return false;
  }
}
