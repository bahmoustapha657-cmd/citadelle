// Mot de passe oublié par code SMS / WhatsApp (étape 4) : un parent sans
// e-mail reçoit un code à 6 chiffres sur le numéro de son compte et choisit
// lui-même son nouveau mot de passe.
//
// Règles du serveur (supabase/functions/password-reset/code.ts), adaptateur
// SMS / WhatsApp partagé avec notify (_shared/messagerie.ts), miroir Premium
// (_shared/premium.ts), textes de la modale (src/backend/code-reinitialisation.js).
// La partie « client Supabase » demande les mocks de modules du test runner :
//   node --import tsx --experimental-test-module-mocks --test tests/reinitialisation-code.test.js
import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  CODE_ESSAIS_MAX, CODES_ECOLE_PAR_HEURE, CODES_PAR_HEURE, CODE_VALIDITE_MS, DELAI_RENVOI_MS,
  codeSaisi, decisionEnvoi, empreinteCode, genererCode, masquerTelephone, messageCode, problemeMotDePasse,
  refusVerification, telephoneDuTitulaire,
} from "../supabase/functions/password-reset/code.ts";
import {
  envoyerSms, envoyerWhatsApp, lireConfigMessagerie, smsActif, whatsappActif,
} from "../supabase/functions/_shared/messagerie.ts";
import { estPremiumActif as premiumServeur } from "../supabase/functions/_shared/premium.ts";
import { estPremiumActif } from "../shared/plan-features.js";
import { annonceEnvoi, codeARedemander, dureeLisible, messageErreurCode } from "../src/backend/code-reinitialisation.js";
import { MSG_RESEAU } from "../src/backend/recovery-url.js";

const lire = (chemin) => readFileSync(new URL(chemin, import.meta.url), "utf8");

// ── Règles du code ──────────────────────────────────────────────────────────
test("limites : 15 min, 5 essais, 3 codes par heure, 1 min entre deux envois", () => {
  assert.equal(CODE_VALIDITE_MS, 15 * 60_000);
  assert.equal(CODE_ESSAIS_MAX, 5);
  assert.equal(CODES_PAR_HEURE, 3);
  assert.equal(DELAI_RENVOI_MS, 60_000);
  assert.ok(CODES_ECOLE_PAR_HEURE >= 10);
});

test("code : 6 chiffres, zéros de tête gardés, tirages biaisés rejetés", () => {
  for (let i = 0; i < 200; i++) assert.match(genererCode(), /^\d{6}$/);
  const suite = (...valeurs) => {
    const appels = [];
    return { appels, tirer: (t) => { t[0] = valeurs[appels.length]; appels.push(t[0]); return t; } };
  };
  assert.equal(genererCode(suite(7).tirer), "000007");
  assert.equal(genererCode(suite(999_999).tirer), "999999");
  assert.equal(genererCode(suite(1_000_000 + 42).tirer), "000042");
  // Au-delà du dernier multiple de 10^6 sous 2^32 : rejeté, on retire.
  const biais = suite(0xFFFF_FFFF, 4_294_000_000, 123);
  assert.equal(genererCode(biais.tirer), "000123");
  assert.equal(biais.appels.length, 3);
  assert.equal(genererCode(suite(4_293_999_999).tirer), "999999");
});

test("code saisi : espaces et tirets tolérés, rien d'autre", () => {
  assert.equal(codeSaisi("123456"), "123456");
  assert.equal(codeSaisi(" 123 456 "), "123456");
  assert.equal(codeSaisi("123-456"), "123456");
  assert.equal(codeSaisi("12.34.56"), "123456");
  for (const faux of ["12345", "1234567", "12a456", "", null, undefined, "１２３４５６"]) assert.equal(codeSaisi(faux), null, String(faux));
});

test("empreinte : HMAC-SHA256 lié au compte et à la clé, jamais le code", async () => {
  const e = await empreinteCode("123456", "compte-1", "secret");
  assert.equal(e, createHmac("sha256", "secret").update("compte-1:123456").digest("hex"));
  assert.match(e, /^[0-9a-f]{64}$/);
  assert.notEqual(await empreinteCode("123456", "compte-2", "secret"), e, "autre compte");
  assert.notEqual(await empreinteCode("123456", "compte-1", "autre"), e, "autre clé");
  assert.notEqual(await empreinteCode("123457", "compte-1", "secret"), e, "autre code");
});

test("numéro du titulaire : colonne du compte, sinon profil ; jamais inventé", () => {
  assert.equal(telephoneDuTitulaire({ telephone: "+224622123456", extra: { contactTuteur: "624000000" } }), "+224622123456");
  assert.equal(telephoneDuTitulaire({ telephone: null, extra: { contactTuteur: "624 00 11 22" } }), "+224624001122");
  assert.equal(telephoneDuTitulaire({ telephone: "12", extra: { contactTuteur: "00224 625 11 22 33" } }), "+224625112233");
  assert.equal(telephoneDuTitulaire({ telephone: null, extra: null }), null);
  assert.equal(telephoneDuTitulaire({}), null);
});

test("numéro masqué : premier et deux derniers chiffres", () => {
  assert.equal(masquerTelephone("+224622123456"), "6•• •• •• 56");
  assert.equal(masquerTelephone("+224625000010"), "6•• •• •• 10");
});

test("envoi : double clic, 3 codes par heure, plafond de l'école", () => {
  const T = Date.parse("2026-09-29T10:00:00Z");
  const avant = (secondes) => new Date(T - secondes * 1000).toISOString();
  assert.deepEqual(decisionEnvoi({ recentsCompte: [], recentsEcole: 0, maintenant: T }), { envoyer: true });
  assert.deepEqual(decisionEnvoi({ recentsCompte: [avant(20)], recentsEcole: 1, maintenant: T }),
    { envoyer: false, raison: "renvoi", attente: 40 });
  assert.deepEqual(decisionEnvoi({ recentsCompte: [avant(61)], recentsEcole: 1, maintenant: T }), { envoyer: true });
  // Trois envois dans l'heure : on attend que le plus ancien en sorte.
  assert.deepEqual(decisionEnvoi({ recentsCompte: [avant(120), avant(600), avant(360)], recentsEcole: 3, maintenant: T }),
    { envoyer: false, raison: "limite_compte", attente: 3000 });
  // La limite du compte passe avant le délai de renvoi (attente la plus longue).
  assert.equal(decisionEnvoi({ recentsCompte: [avant(10), avant(20), avant(30)], recentsEcole: 3, maintenant: T }).raison, "limite_compte");
  // Hors de l'heure glissante : ne compte plus.
  assert.deepEqual(decisionEnvoi({ recentsCompte: [avant(3700), avant(3800), avant(3900)], recentsEcole: 0, maintenant: T }), { envoyer: true });
  assert.deepEqual(decisionEnvoi({ recentsCompte: [], recentsEcole: CODES_ECOLE_PAR_HEURE, maintenant: T }),
    { envoyer: false, raison: "limite_ecole", attente: 0 });
  assert.deepEqual(decisionEnvoi({ recentsCompte: [avant(90)], recentsEcole: CODES_ECOLE_PAR_HEURE - 1, maintenant: T }), { envoyer: true });
});

test("SMS : code en tête, tout en ASCII (160 caractères GSM), nom d'école abrégé entre deux mots", () => {
  const sms = messageCode("042917", "École Sainte-Thérèse de l'Enfant-Jésus de Kaloum — Conakry");
  assert.equal(sms, "042917 est votre code EduGest (Ecole Sainte-Therese de l'Enfant-Jesus) pour choisir un nouveau mot de passe."
    + " Valable 15 min. Ne le communiquez a personne.");
  assert.ok(sms.length <= 160, `${sms.length} caractères`);
  // Tiret long, apostrophe courbe, ligature : ramenés à l'ASCII (sinon SMS en Unicode, 70 caractères).
  const typo = messageCode("111111", "Cœur d’Or — Kipé");
  assert.match(typo, /\(Coeur d'Or - Kipe\)/);
  assert.match(typo, /^[\x20-\x7E]+$/);
  // Coupure après un espace, ou pile à la fin d'un mot : les mots entiers restent.
  assert.match(messageCode("222222", "Groupe Scolaire Les Anges Gardiens Unis Matoto"), /\(Groupe Scolaire Les Anges Gardiens Unis\)/);
  assert.match(messageCode("333333", `Ecole ${"x".repeat(34)} Fin`), new RegExp(`\\(Ecole x{34}\\)`));
  assert.equal(messageCode("123456", ""), "123456 est votre code EduGest pour choisir un nouveau mot de passe. Valable 15 min. Ne le communiquez a personne.");
});

test("nouveau mot de passe : 8 caractères au moins, 72 octets au plus", () => {
  assert.equal(problemeMotDePasse("1234567"), "mdp_court");
  assert.equal(problemeMotDePasse(""), "mdp_court");
  assert.equal(problemeMotDePasse(undefined), "mdp_court");
  assert.equal(problemeMotDePasse(12345678), "mdp_court", "pas une chaîne");
  assert.equal(problemeMotDePasse("12345678"), null);
  assert.equal(problemeMotDePasse("a".repeat(72)), null);
  assert.equal(problemeMotDePasse("a".repeat(73)), "mdp_long");
  assert.equal(problemeMotDePasse("é".repeat(37)), "mdp_long", "74 octets en UTF-8");
});

test("verdict de la fonction SQL → réponse au navigateur", () => {
  assert.equal(refusVerification({ statut: "ok", codeId: "c1", essaisRestants: 5 }), null);
  assert.deepEqual(refusVerification({ statut: "faux", codeId: "c1", essaisRestants: 3 }), { ok: false, erreur: "code_faux", essaisRestants: 3 });
  assert.deepEqual(refusVerification({ statut: "epuise", codeId: "c1" }), { ok: false, erreur: "code_epuise" });
  assert.deepEqual(refusVerification({ statut: "expire" }), { ok: false, erreur: "code_expire" });
  assert.deepEqual(refusVerification(null), { ok: false, erreur: "code_expire" });
  assert.deepEqual(refusVerification({ statut: "ok" }), { ok: false, erreur: "code_expire" }, "ok sans code : refusé");
});

// ── Premium : le serveur rend le même verdict que l'app ─────────────────────
test("Premium : _shared/premium.ts = shared/plan-features.js", () => {
  const MAINTENANT = Date.parse("2026-09-29T10:00:00Z");
  const JOUR = 86400000;
  for (const plan of ["premium", "gratuit", "standard", "inconnu", null, undefined, ""]) {
    for (const planExpiry of [null, undefined, 0, MAINTENANT + 10 * JOUR, MAINTENANT - 2 * JOUR, MAINTENANT - 4 * JOUR]) {
      assert.equal(
        premiumServeur(plan, planExpiry, MAINTENANT),
        estPremiumActif({ plan, planExpiry, now: MAINTENANT }),
        `${plan} / ${planExpiry}`,
      );
    }
  }
});

// ── Adaptateur SMS / WhatsApp (partagé par notify et password-reset) ───────
const config = (surcharges = {}) => lireConfigMessagerie((cle) => ({
  WHATSAPP_TOKEN: "EAAG", WHATSAPP_PHONE_ID: "123", SMS_API_URL: "https://sms.exemple/api", SMS_API_KEY: "cle", ...surcharges,
})[cle]);
const fauxFetch = (reponse = { ok: true }) => {
  const appels = [];
  const f = async (url, init) => {
    appels.push({ url, ...init, body: JSON.parse(init.body) });
    if (reponse instanceof Error) throw reponse;
    return reponse;
  };
  return { f, appels };
};

test("configuration : valeurs par défaut, canaux actifs seulement avec leurs secrets", () => {
  const vide = lireConfigMessagerie(() => undefined);
  assert.deepEqual(vide, {
    whatsappToken: "", whatsappPhoneId: "", whatsappModele: "edugest_notif", whatsappModeleCode: "", whatsappLangue: "fr",
    smsUrl: "", smsCle: "", smsExpediteur: "EduGest",
  });
  assert.equal(smsActif(vide), false);
  assert.equal(whatsappActif(vide), false);
  assert.equal(smsActif(config()), true);
  assert.equal(whatsappActif(config()), true);
  assert.equal(smsActif(config({ SMS_API_KEY: undefined })), false);
});

test("SMS : même requête que l'ancienne implémentation de notify", async () => {
  const { f, appels } = fauxFetch();
  assert.equal(await envoyerSms(config({ SMS_SENDER: "MonEcole" }), "+224622123456", "Bonjour", f), true);
  assert.deepEqual(appels, [{
    url: "https://sms.exemple/api", method: "POST",
    headers: { Authorization: "Bearer cle", "Content-Type": "application/json" },
    body: { to: "+224622123456", message: "Bonjour", sender_name: "MonEcole" },
  }]);
  assert.equal(await envoyerSms(config(), "+224622123456", "x", fauxFetch({ ok: false }).f), false, "refus du fournisseur");
  assert.equal(await envoyerSms(config(), "+224622123456", "x", fauxFetch(new Error("réseau")).f), false, "réseau coupé");
  const inactif = fauxFetch();
  assert.equal(await envoyerSms(config({ SMS_API_URL: undefined }), "+224622123456", "x", inactif.f), false);
  assert.equal(inactif.appels.length, 0, "aucun appel sans secrets");
});

test("WhatsApp : modèle des notifications inchangé, modèle d'authentification avec bouton", async () => {
  const notif = fauxFetch();
  assert.equal(await envoyerWhatsApp(config(), "+224622123456", "edugest_notif", ["Absence d'Awa"], { fetchFn: notif.f }), true);
  assert.deepEqual(notif.appels, [{
    url: "https://graph.facebook.com/v20.0/123/messages", method: "POST",
    headers: { Authorization: "Bearer EAAG", "Content-Type": "application/json" },
    body: {
      messaging_product: "whatsapp", to: "224622123456", type: "template",
      template: { name: "edugest_notif", language: { code: "fr" }, components: [{ type: "body", parameters: [{ type: "text", text: "Absence d'Awa" }] }] },
    },
  }]);

  const code = fauxFetch();
  await envoyerWhatsApp(config(), "+224622123456", "edugest_code", ["042917"], { bouton: "042917", fetchFn: code.f });
  assert.deepEqual(code.appels[0].body.template.components, [
    { type: "body", parameters: [{ type: "text", text: "042917" }] },
    { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: "042917" }] },
  ]);

  const sansModele = fauxFetch();
  assert.equal(await envoyerWhatsApp(config(), "+224622123456", "", ["x"], { fetchFn: sansModele.f }), false);
  assert.equal(sansModele.appels.length, 0);
});

test("Edge Functions : un seul adaptateur, SMS d'abord pour les codes, Premium exigé", () => {
  const notify = lire("../supabase/functions/notify/index.ts");
  assert.match(notify, /from "\.\.\/_shared\/messagerie\.ts";/);
  assert.match(notify, /from "\.\.\/_shared\/premium\.ts";/);
  assert.doesNotMatch(notify, /async function envoyerSms|function estPremiumActif/, "plus de copie locale");

  const reset = lire("../supabase/functions/password-reset/index.ts");
  const envoi = reset.slice(reset.indexOf("async function envoyerCode("), reset.indexOf("const voieCodeOuverte"));
  assert.ok(envoi.indexOf("envoyerSms(") > 0 && envoi.indexOf("envoyerSms(") < envoi.indexOf("envoyerWhatsApp("), "SMS avant WhatsApp");
  const voie = reset.slice(reset.indexOf("async function voieCode("), reset.indexOf("// ── Action « verifier_code »"));
  assert.match(voie, /if \(!estPremiumActif\(ec\.plan, ec\.plan_expiry\)\) return null;/);
  const verif = reset.slice(reset.indexOf("async function verifierCode("), reset.indexOf("Deno.serve("));
  assert.ok(verif.indexOf("refusVerification(verdict)") < verif.indexOf("updateUserById("), "mot de passe changé seulement après un code juste");
  // Compte trouvé par son numéro : pas de « Direction » qui confirmerait le numéro.
  assert.match(reset, /return json\(trouve\.parTelephone \? generique : \{ ok: true, method: "direction" \}\);/);
});

// ── Textes de la modale ─────────────────────────────────────────────────────
test("messages d'erreur du code", () => {
  assert.equal(messageErreurCode({ erreur: "code_faux", essaisRestants: 3 }), "Code incorrect. Encore 3 essais.");
  assert.equal(messageErreurCode({ erreur: "code_faux", essaisRestants: 1 }), "Code incorrect. Encore 1 essai.");
  assert.equal(messageErreurCode({ erreur: "code_faux" }), "Code incorrect.");
  assert.match(messageErreurCode({ erreur: "code_epuise" }), /Trop d'essais.*nouveau/);
  assert.match(messageErreurCode({ erreur: "code_expire" }), /expiré.*nouveau/);
  assert.match(messageErreurCode({ erreur: "code_invalide" }), /6 chiffres/);
  assert.match(messageErreurCode({ erreur: "mdp_court" }), /8 caractères/);
  assert.match(messageErreurCode({ erreur: "mdp_long" }), /72 caractères/);
  assert.match(messageErreurCode({ erreur: "mdp_refuse", code: "weak_password" }), /trop faible/);
  assert.equal(messageErreurCode({ erreur: "reseau" }), MSG_RESEAU);
  assert.match(messageErreurCode({ erreur: "indisponible" }), /indisponible/);
  assert.match(messageErreurCode(null), /indisponible/);
  assert.equal(codeARedemander("code_epuise"), true);
  assert.equal(codeARedemander("code_expire"), true);
  assert.equal(codeARedemander("code_faux"), false);
});

test("attente et annonce de l'envoi", () => {
  assert.equal(dureeLisible(0), "0 s");
  assert.equal(dureeLisible(45), "45 s");
  assert.equal(dureeLisible(59.2), "1 min", "arrondi à la seconde supérieure");
  assert.equal(dureeLisible(60), "1 min");
  assert.equal(dureeLisible(61), "2 min");
  assert.equal(dureeLisible(3240), "54 min");
  assert.equal(
    annonceEnvoi({ envoye: true, canal: "sms", telephoneMasque: "6•• •• •• 56", validiteMin: 15 }),
    "Un code à 6 chiffres vient de vous être envoyé par SMS au 6•• •• •• 56. Il est valable 15 minutes.",
  );
  assert.match(annonceEnvoi({ envoye: true, canal: "whatsapp", telephoneMasque: "6•• •• •• 56" }), /par WhatsApp au/);
  assert.equal(annonceEnvoi({ envoye: false, telephoneMasque: "6•• •• •• 56", attente: 40 }),
    "Un code vous a déjà été envoyé au 6•• •• •• 56 il y a peu : saisissez le dernier reçu.");
});

// ── Client Supabase (mocks de modules) ─────────────────────────────────────
const ignore = typeof mock.module !== "function"
  && "mocks de modules absents : lancer avec --experimental-test-module-mocks";

test("vérification du code : appel de l'Edge Function, erreurs réseau", { skip: ignore }, async () => {
  const appels = [];
  let reponse = { data: { ok: true, login: "parent.bah", schoolId: "citadelle" }, error: null };
  mock.module(new URL("../src/supabaseClient.js", import.meta.url).href, {
    namedExports: {
      getSupabase: () => ({ functions: { invoke: async (nom, options) => { appels.push([nom, options.body]); return reponse; } } }),
      creerClientEphemere: () => { throw new Error("pas de session pour la voie code"); },
    },
  });
  const { validerCodeReinitialisation } = await import("../src/backend/password-reset-supabase.js");
  const params = { schoolId: "citadelle", identifiant: "625 00 00 10", code: "042917", nouveauMdp: "Nouveau2026" };

  assert.deepEqual(await validerCodeReinitialisation(params), { ok: true, login: "parent.bah", schoolId: "citadelle" });
  assert.deepEqual(appels, [["password-reset", { action: "verifier_code", ...params }]]);

  reponse = { data: { ok: false, erreur: "code_faux", essaisRestants: 2 }, error: null };
  assert.deepEqual(await validerCodeReinitialisation(params), { ok: false, erreur: "code_faux", essaisRestants: 2 });
  reponse = { data: null, error: { name: "FunctionsFetchError" } };
  assert.deepEqual(await validerCodeReinitialisation(params), { ok: false, erreur: "reseau" });
  reponse = { data: null, error: { name: "FunctionsHttpError" } };
  assert.deepEqual(await validerCodeReinitialisation(params), { ok: false, erreur: "indisponible" });
  reponse = { data: null, error: null };
  assert.deepEqual(await validerCodeReinitialisation(params), { ok: false, erreur: "indisponible" });
});
