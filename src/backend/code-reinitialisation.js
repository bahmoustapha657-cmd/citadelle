// ── Mot de passe oublié par code SMS / WhatsApp : textes de l'écran ─────────
// Module PUR (testé par tests/reinitialisation-code.test.js). L'Edge Function
// password-reset répond par des codes (method "code", erreur "code_faux"…) ;
// la modale « Mot de passe oublié » en tire ses messages, dans la langue de
// l'interface.
import i18n from "../i18n";
import { msgReseau, messageErreurRecovery } from "./recovery-url";

// Message d'un refus de l'action « verifier_code ».
export function messageErreurCode(reponse) {
  const reste = Math.max(0, Number(reponse?.essaisRestants) || 0);
  switch (reponse?.erreur) {
    case "code_invalide": return i18n.t("auth.code.invalid");
    case "code_faux": return reste
      ? i18n.t(reste > 1 ? "auth.code.wrongTriesLeft" : "auth.code.wrongOneLeft", { count: reste })
      : i18n.t("auth.code.wrong");
    case "code_epuise": return i18n.t("auth.code.exhausted");
    case "code_expire": return i18n.t("auth.code.expired");
    case "mdp_court": return i18n.t("auth.reset.tooShort");
    case "mdp_long": return i18n.t("auth.code.tooLong");
    case "mdp_refuse": return messageErreurRecovery({ code: reponse.code, message: reponse.message }, "mdp");
    case "reseau": return msgReseau();
    default: return i18n.t("auth.code.unavailable");
  }
}

// Le code en cours ne peut plus servir : il faut en demander un autre.
export const codeARedemander = (erreur) => erreur === "code_epuise" || erreur === "code_expire";

// Attente avant de pouvoir redemander un code : « 45 s », « 54 min ».
export function dureeLisible(secondes) {
  const s = Math.max(0, Math.ceil(Number(secondes) || 0));
  return s < 60 ? `${s} s` : `${Math.ceil(s / 60)} min`;
}

// Annonce de l'étape « code » : code envoyé à l'instant, ou déjà envoyé peu
// avant (double clic, trop de demandes) — le dernier reçu reste valable.
export function annonceEnvoi(reponse) {
  const phone = reponse?.telephoneMasque || "";
  if (reponse?.envoye) {
    const channel = reponse.canal === "whatsapp" ? "WhatsApp" : "SMS";
    const minutes = reponse.validiteMin || 15;
    return i18n.t(phone ? "auth.code.sentTo" : "auth.code.sent", { channel, phone, minutes });
  }
  return i18n.t(phone ? "auth.code.alreadySentTo" : "auth.code.alreadySent", { phone });
}
