// ── Application Android (Trusted Web Activity) ──────────────────────────────
// Module sans dépendance, testé sous Node : tests/application-android.test.js.
//
// L'application ouvre le site dans Chrome : aucun pont avec du code natif. Elle
// remet son jeton Firebase dans le fragment de l'adresse de lancement, et n'a
// plus besoin de Web Push. Le fragment n'est retenu que si le lancement vient
// bien de l'application (document.referrer) : sans cela, un simple lien piégé
// abonnerait le compte à l'appareil de quelqu'un d'autre.
const CLE_JETON = "LC_jeton_android";
const REFERENT = "android-app://com.edugest.app";

export function recevoirJetonAndroid(env = globalThis) {
  const trouve = /^#fcm=(.+)$/.exec(env.location?.hash || "");
  if (!trouve) return;
  env.history.replaceState(null, "", env.location.pathname + env.location.search);
  if (!String(env.document?.referrer || "").startsWith(REFERENT)) return;
  try { env.localStorage.setItem(CLE_JETON, decodeURIComponent(trouve[1])); } catch { /* stockage indisponible */ }
}

export function jetonAndroid(env = globalThis) {
  try { return env.localStorage?.getItem(CLE_JETON) || null; } catch { return null; }
}

// Ligne push_subs d'un appareil Android : l'Edge push la sert par Firebase.
export const abonnementAndroid = (jeton) => ({ endpoint: `fcm:${jeton}`, fcm: jeton });

// « Répondre » sur l'écran d'appel natif rouvre le site avec ?repondre=<appel>.
// L'adresse est nettoyée, et le paramètre ignoré hors de l'application.
export function appelADecrocher(env = globalThis) {
  const url = new URL(env.location.href);
  const id = url.searchParams.get("repondre");
  if (!id) return null;
  url.searchParams.delete("repondre");
  env.history.replaceState(null, "", url.pathname + url.search + url.hash);
  return jetonAndroid(env) ? id : null;
}
