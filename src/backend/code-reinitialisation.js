// ── Mot de passe oublié par code SMS / WhatsApp : textes de l'écran ─────────
// Module PUR (testé par tests/reinitialisation-code.test.js). L'Edge Function
// password-reset répond par des codes (method "code", erreur "code_faux"…) ;
// la modale « Mot de passe oublié » en tire ses messages.
import { MSG_RESEAU, messageErreurRecovery } from "./recovery-url";

// Message d'un refus de l'action « verifier_code ».
export function messageErreurCode(reponse) {
  const reste = Math.max(0, Number(reponse?.essaisRestants) || 0);
  switch (reponse?.erreur) {
    case "code_invalide": return "Saisissez les 6 chiffres du code reçu.";
    case "code_faux": return reste
      ? `Code incorrect. Encore ${reste} essai${reste > 1 ? "s" : ""}.`
      : "Code incorrect.";
    case "code_epuise": return "Trop d'essais : ce code n'est plus valable. Demandez-en un nouveau.";
    case "code_expire": return "Ce code a expiré ou n'est plus valable. Demandez-en un nouveau.";
    case "mdp_court": return "Le mot de passe doit contenir au moins 8 caractères.";
    case "mdp_long": return "Mot de passe trop long : 72 caractères au plus.";
    case "mdp_refuse": return messageErreurRecovery({ code: reponse.code, message: reponse.message }, "mdp");
    case "reseau": return MSG_RESEAU;
    default: return "Service momentanément indisponible. Réessayez dans un instant.";
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
  const numero = reponse?.telephoneMasque ? ` au ${reponse.telephoneMasque}` : "";
  if (reponse?.envoye) {
    const canal = reponse.canal === "whatsapp" ? "WhatsApp" : "SMS";
    return `Un code à 6 chiffres vient de vous être envoyé par ${canal}${numero}. Il est valable ${reponse.validiteMin || 15} minutes.`;
  }
  return `Un code vous a déjà été envoyé${numero} il y a peu : saisissez le dernier reçu.`;
}
