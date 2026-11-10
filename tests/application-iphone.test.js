// EduGest sur iPhone sans App Store : reconnaître l'appareil, dire comment
// installer, demander l'autorisation dans le geste même de l'utilisateur.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  CLE_INVITATION_MASQUEE,
  conseilNotifications,
  invitationInstallationVisible,
  masquerInvitationInstallation,
  situationApple,
} from "../src/components/installation-iphone/iphone.js";

const UA = {
  iphone18: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  iphoneAccueil: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
  iphone15: "Mozilla/5.0 (iPhone; CPU iPhone OS 15_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1",
  iphone163: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.3 Mobile/15E148 Safari/604.1",
  iphone164: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Mobile/15E148 Safari/604.1",
  ipadEnMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
  chromeIphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1",
  android: "Mozilla/5.0 (Linux; Android 14; SM-A145F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
};

function appareil(userAgent, { standalone, maxTouchPoints = 5, displayMode = false, stockage = new Map() } = {}) {
  return {
    navigator: { userAgent, standalone, maxTouchPoints },
    matchMedia: (q) => ({ matches: displayMode && q === "(display-mode: standalone)" }),
    localStorage: {
      getItem: (k) => (stockage.has(k) ? stockage.get(k) : null),
      setItem: (k, v) => stockage.set(k, String(v)),
    },
  };
}

test("iPhone dans Safari : à installer, iOS assez récent", () => {
  assert.deepEqual(situationApple(appareil(UA.iphone18, { standalone: false })), { ecranAccueil: false, tropAncien: false, version: "18.1" });
  assert.equal(situationApple(appareil(UA.chromeIphone, { standalone: false })).ecranAccueil, false);
});

test("iPhone ouvert depuis l'écran d'accueil : reconnu des deux façons", () => {
  assert.equal(situationApple(appareil(UA.iphoneAccueil, { standalone: true })).ecranAccueil, true);
  assert.equal(situationApple(appareil(UA.iphoneAccueil, { displayMode: true })).ecranAccueil, true);
  assert.equal(situationApple(appareil(UA.iphoneAccueil)).version, "17.5");
});

test("iPad présenté comme un Mac : reconnu par l'écran tactile, un vrai Mac non", () => {
  const ipad = situationApple(appareil(UA.ipadEnMac));
  assert.deepEqual(ipad, { ecranAccueil: false, tropAncien: false, version: "17.1" });
  assert.equal(situationApple(appareil(UA.ipadEnMac, { maxTouchPoints: 0 })), null);
});

test("iOS avant 16.4 : pas de notifications possibles", () => {
  assert.equal(situationApple(appareil(UA.iphone15)).tropAncien, true);
  assert.equal(situationApple(appareil(UA.iphone15)).version, "15.7");
  assert.equal(situationApple(appareil(UA.iphone163)).tropAncien, true);
  assert.equal(situationApple(appareil(UA.iphone164)).tropAncien, false);
});

test("Android et ordinateur : rien de propre à l'iPhone", () => {
  assert.equal(situationApple(appareil(UA.android)), null);
  assert.equal(situationApple({}), null);
});

test("bandeau de la Messagerie : le guide sur iPhone, « Activer » ailleurs", () => {
  const safari = situationApple(appareil(UA.iphone18, { standalone: false }));
  const accueil = situationApple(appareil(UA.iphoneAccueil, { standalone: true }));
  const ancien = situationApple(appareil(UA.iphone15));
  // Safari n'a pas l'interface des notifications : expliquer l'installation.
  assert.deepEqual(conseilNotifications("indisponible", safari), { cle: "msg.notif.iosInstall", guide: true });
  // Depuis l'icône : la demande d'autorisation, comme partout.
  assert.deepEqual(conseilNotifications("default", accueil), { cle: "msg.notif.enable", activer: true });
  assert.deepEqual(conseilNotifications("denied", accueil), { cle: "msg.notif.iosBlocked" });
  assert.equal(conseilNotifications("granted", accueil), null);
  assert.deepEqual(conseilNotifications("indisponible", ancien), { cle: "msg.notif.iosTooOld", version: "15.7" });
  // Ailleurs : inchangé.
  assert.deepEqual(conseilNotifications("default", null), { cle: "msg.notif.enable", activer: true });
  assert.deepEqual(conseilNotifications("denied", null), { cle: "msg.notif.blocked", activer: false });
  assert.deepEqual(conseilNotifications("indisponible", null), { cle: "msg.notif.unavailable", activer: false });
  assert.equal(conseilNotifications("granted", null), null);
  assert.equal(conseilNotifications(undefined, null), null);
});

test("invitation à installer : iPhone dans Safari seulement, revient au bout d'une semaine", () => {
  const stockage = new Map();
  const safari = appareil(UA.iphone18, { standalone: false, stockage });
  const t0 = Date.UTC(2026, 10, 9);
  assert.equal(invitationInstallationVisible(safari, t0), true);
  masquerInvitationInstallation(safari, t0);
  assert.equal(stockage.get(CLE_INVITATION_MASQUEE), String(t0));
  assert.equal(invitationInstallationVisible(safari, t0 + 6 * 24 * 3600 * 1000), false);
  assert.equal(invitationInstallationVisible(safari, t0 + 8 * 24 * 3600 * 1000), true);
  assert.equal(invitationInstallationVisible(appareil(UA.iphoneAccueil, { standalone: true }), t0), false);
  assert.equal(invitationInstallationVisible(appareil(UA.android), t0), false);
  // Stockage refusé (navigation privée) : l'invitation s'affiche quand même.
  const prive = { ...safari, localStorage: { getItem: () => { throw new Error("refusé"); }, setItem: () => { throw new Error("refusé"); } } };
  assert.equal(invitationInstallationVisible(prive, t0), true);
  assert.doesNotThrow(() => masquerInvitationInstallation(prive, t0));
});

test("textes du guide et du bandeau présents dans les trois langues", () => {
  for (const l of ["fr", "en", "ar"]) {
    const d = JSON.parse(readFileSync(`src/i18n/locales/${l}.json`, "utf8"));
    for (const cle of ["title", "intro", "tooOld", "step1", "step2", "step3", "step4", "step5", "step6", "ringtone", "ok", "bannerDesc", "how"]) {
      assert.ok(d.install.ios[cle]?.trim(), `${l}.json : install.ios.${cle}`);
    }
    for (const cle of ["iosInstall", "iosBlocked", "iosTooOld", "enable", "blocked", "unavailable"]) {
      assert.ok(d.msg.notif[cle]?.trim(), `${l}.json : msg.notif.${cle}`);
    }
    assert.match(d.msg.notif.iosTooOld, /\{\{version\}\}/);
    assert.match(d.install.ios.tooOld, /\{\{version\}\}/);
  }
});

test("iPhone : l'autorisation est demandée dans le geste même, sans attente avant", () => {
  // Safari ignore une demande qui ne suit pas directement un toucher : aucun
  // `await` ne doit précéder Notification.requestPermission().
  const code = readFileSync("src/backend/push-supabase.js", "utf8");
  const corps = code.slice(code.indexOf("export async function sAbonnerAuxPush"));
  const avant = corps.slice(0, corps.indexOf("Notification.requestPermission()"));
  // (le `await` de la demande elle-même mis à part)
  const horsAndroid = avant.slice(avant.indexOf("etatNotifications()")).replace(/await\s*$/, "");
  assert.match(horsAndroid, /return "indisponible";/);
  assert.doesNotMatch(horsAndroid, /\bawait\b/);
  const contexte = readFileSync("src/components/messagerie/MessagerieContext.jsx", "utf8");
  assert.match(contexte, /activer: async \(\) => setEtatPush\(await sAbonnerAuxPush\(/);
});

test("invitation et guide branchés dans l'application", () => {
  const app = readFileSync("src/App.jsx", "utf8");
  assert.match(app, /utilisateur && <InvitationInstallationIphone \/>/);
  const bandeau = readFileSync("src/components/messagerie/BandeauNotifications.jsx", "utf8");
  assert.match(bandeau, /conseilNotifications\(notifications\?\.etat, situationApple\(\)\)/);
  assert.match(bandeau, /<GuideIphone /);
  const manifeste = JSON.parse(readFileSync("public/manifest.json", "utf8"));
  assert.equal(manifeste.display, "standalone");
  const index = readFileSync("index.html", "utf8");
  assert.match(index, /rel="apple-touch-icon"/);
  assert.match(index, /name="apple-mobile-web-app-capable" content="yes"/);
});
