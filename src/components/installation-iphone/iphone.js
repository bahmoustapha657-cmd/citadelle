// ── EduGest sur iPhone et iPad, sans App Store ──────────────────────────────
// L'iPhone ne donne les notifications (appels, messages) qu'à un site ajouté à
// l'écran d'accueil ET ouvert depuis cette icône, à partir d'iOS 16.4. Dans
// Safari, le navigateur n'a même pas l'interface des notifications : il faut
// donc expliquer l'installation, pas proposer « Activer ».
// Module sans dépendance, testé sous Node : tests/application-iphone.test.js.

const IOS_MINIMUM = [16, 4];

// « CPU iPhone OS 15_7 like Mac OS X » ; à défaut (iPad présenté en Mac),
// « Version/17.1 » de Safari, qui suit la version d'iOS.
function versionIos(ua) {
  const m = ua.match(/ OS (\d+)_(\d+)/) || ua.match(/Version\/(\d+)\.(\d+)/);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

// null hors iPhone/iPad ; sinon où EduGest est ouvert et si iOS suffit.
export function situationApple(env = globalThis) {
  const nav = env.navigator || {};
  const ua = nav.userAgent || "";
  // iPadOS se présente comme un Mac : seul l'écran tactile le trahit.
  const ipadEnMac = /Macintosh/.test(ua) && nav.maxTouchPoints > 1;
  if (!/iPhone|iPad|iPod/.test(ua) && !ipadEnMac) return null;
  let ecranAccueil = nav.standalone === true;
  try { ecranAccueil ||= env.matchMedia?.("(display-mode: standalone)")?.matches === true; } catch { /* rien */ }
  const v = versionIos(ua);
  const tropAncien = !!v && (v[0] < IOS_MINIMUM[0] || (v[0] === IOS_MINIMUM[0] && v[1] < IOS_MINIMUM[1]));
  return { ecranAccueil, tropAncien, version: v ? v.join(".") : null };
}

// Ce que dit le bandeau de la Messagerie : clé de traduction, et s'il propose
// « Activer » ou le guide d'installation.
const CONSEILS = {
  default: "msg.notif.enable",
  denied: "msg.notif.blocked",
  indisponible: "msg.notif.unavailable",
};

export function conseilNotifications(etat, apple) {
  if (etat === "granted") return null;
  if (apple?.tropAncien) return { cle: "msg.notif.iosTooOld", version: apple.version };
  if (apple && !apple.ecranAccueil) return { cle: "msg.notif.iosInstall", guide: true };
  if (apple && etat === "denied") return { cle: "msg.notif.iosBlocked" };
  const cle = CONSEILS[etat];
  return cle ? { cle, activer: etat === "default" } : null;
}

// Invitation à installer, en bas de l'écran : une fois fermée, elle revient
// au bout d'une semaine, pas à chaque ouverture.
export const CLE_INVITATION_MASQUEE = "LC_iphone_installation_masquee";
const INVITATION_MASQUEE_MS = 7 * 24 * 3600 * 1000;

export function invitationInstallationVisible(env = globalThis, maintenant = Date.now()) {
  const apple = situationApple(env);
  if (!apple || apple.ecranAccueil) return false;
  try {
    const masquee = Number(env.localStorage?.getItem(CLE_INVITATION_MASQUEE));
    if (masquee && maintenant - masquee < INVITATION_MASQUEE_MS) return false;
  } catch { /* stockage refusé : on l'affiche */ }
  return true;
}

export function masquerInvitationInstallation(env = globalThis, maintenant = Date.now()) {
  try { env.localStorage?.setItem(CLE_INVITATION_MASQUEE, String(maintenant)); } catch { /* rien */ }
}
