import test from "node:test";
import assert from "node:assert/strict";
import {
  DELAIS, decider, identiteVersion, lireTentative, nouvelleTentative, versionPublieeNouvelle,
} from "../src/mise-a-jour/decision.js";
import {
  ENVOI_MAX_MS, SAISIE_RECENTE_MS, creerSuiviEnvois, creerSuiviSaisies, saisieAProteger, travailEnCours,
} from "../src/mise-a-jour/travail-en-cours.js";
import { CLE_TENTATIVE, creerMiseAJourAuto } from "../src/mise-a-jour/mise-a-jour-auto.js";

const ANCIENNE = { commit: "a".repeat(40), court: "aaaaaaa", date: "2026-11-01T10:00:00.000Z" };
const NOUVELLE = { commit: "b".repeat(40), court: "bbbbbbb", date: "2026-11-04T10:00:00.000Z" };
const CIBLE = identiteVersion(NOUVELLE);

// ── decision.js ──────────────────────────────────────────────

test("identiteVersion : commit + date, rien pour une version de dev ou illisible", () => {
  assert.equal(identiteVersion(NOUVELLE), `${NOUVELLE.commit}|${NOUVELLE.date}`);
  assert.equal(identiteVersion({ commit: "dev", date: "" }), null);
  assert.equal(identiteVersion({ commit: "inconnu" }), null);
  assert.equal(identiteVersion(null), null);
  assert.equal(identiteVersion("<!doctype html>"), null);
});

test("versionPublieeNouvelle : nouveau commit ou nouveau build du même commit", () => {
  assert.equal(versionPublieeNouvelle(ANCIENNE, NOUVELLE), CIBLE);
  assert.equal(versionPublieeNouvelle(ANCIENNE, { ...ANCIENNE }), null);
  // Même commit rebâti (déploiement de secours) : autre build.
  assert.equal(versionPublieeNouvelle(ANCIENNE, { ...ANCIENNE, date: NOUVELLE.date }), `${ANCIENNE.commit}|${NOUVELLE.date}`);
  // version.json absent (repli SPA : index.html) ou build de dev : rien.
  assert.equal(versionPublieeNouvelle(ANCIENNE, null), null);
  assert.equal(versionPublieeNouvelle({ commit: "dev" }, NOUVELLE), null);
});

test("lireTentative / nouvelleTentative : compteur par version, valeurs corrompues ignorées", () => {
  assert.equal(lireTentative(null), null);
  assert.equal(lireTentative("{pas du json"), null);
  assert.equal(lireTentative(JSON.stringify({ at: 1 })), null);
  const t1 = nouvelleTentative(null, CIBLE, 1000);
  assert.deepEqual(t1, { cible: CIBLE, at: 1000, n: 1 });
  assert.deepEqual(lireTentative(JSON.stringify(t1)), t1);
  assert.equal(nouvelleTentative(t1, CIBLE, 2000).n, 2);
  assert.equal(nouvelleTentative(t1, "autre", 2000).n, 1);
});

const base = {
  cible: CIBLE, enLigne: true, stockage: true, tentative: null, occupation: null,
  visible: true, depuisRetourMs: 1000, inactifMs: Infinity, maintenant: 10_000_000,
};

test("decider : à jour → rien ; hors ligne → attendre sans bandeau", () => {
  assert.equal(decider({ ...base, cible: null }).action, "rien");
  const horsLigne = decider({ ...base, enLigne: false });
  assert.equal(horsLigne.action, "attendre");
  assert.equal(horsLigne.bandeau, false);
});

test("decider : ouverture / retour sans rien toucher → recharger", () => {
  assert.deepEqual(decider(base), { action: "recharger", bandeau: false, raison: "retour" });
  // Une interaction AVANT le retour (dernier clic avant de quitter) ne compte pas.
  assert.equal(decider({ ...base, depuisRetourMs: 5000, inactifMs: 60_000 }).action, "recharger");
});

test("decider : l'utilisateur a déjà agi depuis son retour → bandeau, pas de rechargement", () => {
  const r = decider({ ...base, depuisRetourMs: 20_000, inactifMs: 10_000 });
  assert.equal(r.action, "attendre");
  assert.equal(r.bandeau, true);
  assert.equal(r.raison, "utilisation");
  assert.equal(r.revoirMs, DELAIS.INACTIVITE_MS - 10_000);
});

test("decider : interaction il y a moins de 3 s → attendre sans bandeau (un envoi part peut-être)", () => {
  const r = decider({ ...base, visible: false, inactifMs: 1000 });
  assert.equal(r.action, "attendre");
  assert.equal(r.bandeau, false);
  assert.equal(r.revoirMs, DELAIS.INTERACTION_RECENTE_MS - 1000);
});

test("decider : arrière-plan ou longue inactivité → recharger", () => {
  assert.equal(decider({ ...base, visible: false, depuisRetourMs: 3_600_000, inactifMs: 60_000 }).raison, "arriere-plan");
  assert.equal(decider({ ...base, depuisRetourMs: 3_600_000, inactifMs: DELAIS.INACTIVITE_MS }).raison, "inactivite");
});

test("decider : travail en cours → jamais de rechargement, même en arrière-plan", () => {
  for (const occupation of ["saisie", "fenetre", "travail", "impression", "envoi"]) {
    const r = decider({ ...base, visible: false, occupation });
    assert.equal(r.action, "attendre", occupation);
    assert.equal(r.bandeau, true);
    assert.equal(r.raison, occupation);
  }
});

test("decider : garde-fou anti-boucle (même version déjà tentée)", () => {
  const recente = decider({ ...base, tentative: { cible: CIBLE, at: base.maintenant - 1000, n: 1 } });
  assert.equal(recente.action, "attendre");
  assert.equal(recente.raison, "tentative-recente");
  assert.equal(recente.bandeau, true);
  // Passé le délai, une nouvelle tentative est permise…
  const plusTard = decider({ ...base, tentative: { cible: CIBLE, at: base.maintenant - DELAIS.ENTRE_TENTATIVES_MS, n: 1 } });
  assert.equal(plusTard.action, "recharger");
  // … mais au plus TENTATIVES_MAX fois.
  const epuisee = decider({ ...base, tentative: { cible: CIBLE, at: 0, n: DELAIS.TENTATIVES_MAX } });
  assert.equal(epuisee.raison, "tentatives-epuisees");
  // Une AUTRE version n'est pas freinée par la trace de la précédente.
  assert.equal(decider({ ...base, tentative: { cible: "autre", at: base.maintenant, n: 3 } }).action, "recharger");
  // Sans stockage de session : jamais de rechargement automatique.
  assert.equal(decider({ ...base, stockage: false }).action, "attendre");
});

// ── travail-en-cours.js ──────────────────────────────────────

function champ({ tag = "INPUT", type = "text", value = "", connecte = true, dans = [] } = {}) {
  return {
    tagName: tag, type, value, isConnected: connecte,
    closest: (sel) => (dans.some((s) => sel.includes(s)) ? {} : null),
  };
}

// Document minimal : `presents` liste les sélecteurs qui trouvent un élément.
function fauxDoc({ presents = [], fixes = [], actif = null } = {}) {
  return {
    activeElement: actif,
    querySelector: (sel) => (sel.split(",").some((s) => presents.includes(s.trim())) ? {} : null),
    querySelectorAll: (sel) => (sel === "[style*=\"position: fixed\"]" ? fixes : []),
  };
}
const fenetre = { innerWidth: 400, innerHeight: 800, getComputedStyle: () => ({ display: "block", visibility: "visible", pointerEvents: "auto" }) };
const rect = (width, height) => ({ getBoundingClientRect: () => ({ width, height }) });

test("travailEnCours : rien d'ouvert → null", () => {
  assert.equal(travailEnCours({ doc: fauxDoc(), fenetre, maintenant: 0 }), null);
});

test("travailEnCours : modale, dialogue (appel), marqueur data-maj-retenir, impression", () => {
  assert.equal(travailEnCours({ doc: fauxDoc({ presents: [".lc-modal-overlay"] }), fenetre, maintenant: 0 }), "fenetre");
  assert.equal(travailEnCours({ doc: fauxDoc({ presents: ["[role=\"dialog\"]"] }), fenetre, maintenant: 0 }), "fenetre");
  assert.equal(travailEnCours({ doc: fauxDoc({ presents: ["[data-maj-retenir]"] }), fenetre, maintenant: 0 }), "travail");
  assert.equal(travailEnCours({ doc: fauxDoc(), fenetre, impression: true, maintenant: 0 }), "impression");
});

test("travailEnCours : superposition fixe plein écran, mais pas un petit élément fixe", () => {
  assert.equal(travailEnCours({ doc: fauxDoc({ fixes: [rect(400, 800)] }), fenetre, maintenant: 0 }), "fenetre");
  assert.equal(travailEnCours({ doc: fauxDoc({ fixes: [rect(340, 120)] }), fenetre, maintenant: 0 }), null);
});

test("travailEnCours : champ actif rempli = saisie ; vide (autofocus de connexion) = rien", () => {
  assert.equal(travailEnCours({ doc: fauxDoc({ actif: champ({ value: "12,5" }) }), fenetre, maintenant: 0 }), "saisie");
  assert.equal(travailEnCours({ doc: fauxDoc({ actif: champ({ value: "" }) }), fenetre, maintenant: 0 }), null);
  assert.equal(travailEnCours({ doc: fauxDoc({ actif: champ({ type: "search", value: "Bah" }) }), fenetre, maintenant: 0 }), null);
});

test("travailEnCours : les gardes du code (envoi PowerSync…) retiennent la mise à jour", () => {
  assert.equal(travailEnCours({ doc: fauxDoc(), fenetre, gardes: [() => null, () => "envoi-hors-ligne"], maintenant: 0 }), "envoi-hors-ligne");
  assert.equal(travailEnCours({ doc: fauxDoc(), fenetre, gardes: [() => { throw new Error("x"); }], maintenant: 0 }), null);
});

test("saisieAProteger : texte oui ; filtres hors formulaire et recherche non", () => {
  assert.equal(saisieAProteger(champ()), true);
  assert.equal(saisieAProteger(champ({ tag: "TEXTAREA", type: "" })), true);
  assert.equal(saisieAProteger(champ({ type: "search" })), false);
  assert.equal(saisieAProteger(champ({ tag: "SELECT", type: "select-one" })), false);
  assert.equal(saisieAProteger(champ({ tag: "SELECT", type: "select-one", dans: ["form"] })), true);
  assert.equal(saisieAProteger(champ({ type: "checkbox" })), false);
  assert.equal(saisieAProteger(champ({ dans: ["[data-maj-ignorer]"] })), false);
});

test("suivi des saisies : un champ tapé protège tant qu'il est affiché, au plus 30 min", () => {
  const suivi = creerSuiviSaisies();
  const note = champ({ value: "" }); // valeur effacée : c'est aussi une modification
  suivi.noter(note, 1000);
  assert.equal(suivi.recente(2000), true);
  assert.equal(travailEnCours({ doc: fauxDoc(), fenetre, saisies: suivi, maintenant: 2000 }), "saisie");
  assert.equal(suivi.recente(1000 + SAISIE_RECENTE_MS), false);

  const fermeAvant = champ({ value: "x" });
  suivi.noter(fermeAvant, 1000);
  fermeAvant.isConnected = false; // fenêtre fermée / page quittée
  assert.equal(suivi.recente(2000), false);

  suivi.noter(champ({ tag: "SELECT", type: "select-one" }), 1000); // filtre
  assert.equal(suivi.recente(2000), false);
});

test("suivi des envois : une écriture en vol retient, une lecture ou le flux PowerSync non", async () => {
  const resolutions = [];
  let horloge = 0;
  const fen = { fetch: () => new Promise((r) => resolutions.push(r)) };
  const envois = creerSuiviEnvois(fen, () => horloge);
  envois.installer();
  envois.installer(); // idempotent

  fen.fetch("/version.json");
  fen.fetch("https://x.powersync.journeyapps.com/sync/stream", { method: "POST" });
  assert.equal(envois.enCours(), false);

  const p = fen.fetch("https://x.supabase.co/rest/v1/rpc/encaisser", { method: "POST" });
  assert.equal(envois.enCours(), true);
  horloge = ENVOI_MAX_MS; // requête bloquée depuis 60 s : ignorée
  assert.equal(envois.enCours(), false);
  horloge = 10;
  resolutions[2]("ok");
  assert.equal(await p, "ok");
  assert.equal(envois.enCours(), false);
});

// ── mise-a-jour-auto.js : scénarios complets ─────────────────

// Cible d'événements minimale : `emettre` appelle les écouteurs avec un
// objet simple (target, persisted…), comme le ferait le navigateur.
function cibleEvenements(proprietes = {}) {
  const ecouteurs = new Map();
  return Object.assign(proprietes, {
    addEventListener(type, fn) {
      if (!ecouteurs.has(type)) ecouteurs.set(type, new Set());
      ecouteurs.get(type).add(fn);
    },
    removeEventListener(type, fn) { ecouteurs.get(type)?.delete(fn); },
    emettre(type, evt = {}) { for (const fn of ecouteurs.get(type) || []) fn({ type, ...evt }); },
  });
}

function environnement(t, { versionPubliee = NOUVELLE, session = new Map(), presents = [], visible = true, enLigne = true } = {}) {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"], now: 1_000_000 });
  const etatDoc = { presents, actif: null };
  const fen = cibleEvenements({ ...fenetre });
  const doc = cibleEvenements({
    visibilityState: visible ? "visible" : "hidden",
    querySelector: (sel) => fauxDoc({ presents: etatDoc.presents }).querySelector(sel),
    querySelectorAll: () => [],
    get activeElement() { return etatDoc.actif; },
  });
  const stockage = {
    getItem: (k) => (session.has(k) ? session.get(k) : null),
    setItem: (k, v) => session.set(k, String(v)),
    removeItem: (k) => session.delete(k),
  };
  const env = { rechargements: 0, lectures: 0, publications: [], session, etatDoc, doc, fen, versionPubliee };
  env.maj = creerMiseAJourAuto({
    fenetre: fen, doc, nav: { get onLine() { return enLigne; } }, session: stockage,
    versionLocale: ANCIENNE,
    lireVersionPubliee: async () => { env.lectures += 1; return env.versionPubliee; },
    recharger: () => { env.rechargements += 1; },
    maintenant: () => Date.now(),
    publier: (e) => env.publications.push(e),
    pageCourante: () => "comptabilite",
  });
  // Avance l'horloge par pas d'une seconde (le tick simulé met l'heure à la
  // fin du pas AVANT de lancer les minuteries : un grand pas passerait pour
  // un fil principal bloqué), en laissant se terminer les promesses.
  env.tick = async (ms) => {
    let reste = ms;
    do {
      const pas = Math.min(reste, 1000);
      t.mock.timers.tick(pas);
      reste -= pas;
      await new Promise((r) => setImmediate(r));
    } while (reste > 0);
  };
  env.cacher = async () => { doc.visibilityState = "hidden"; doc.emettre("visibilitychange"); await env.tick(0); };
  env.montrer = async () => { doc.visibilityState = "visible"; doc.emettre("visibilitychange"); await env.tick(0); };
  env.dernier = () => env.publications.at(-1);
  t.after(() => env.maj.arreter());
  return env;
}

test("ouverture sur une ancienne version : message bref puis UN rechargement, page mémorisée", async (t) => {
  const env = environnement(t);
  await env.maj.demarrer();
  assert.equal(env.dernier().rechargement, true); // « rechargement en cours… »
  assert.equal(env.rechargements, 0);
  await env.tick(1500);
  assert.equal(env.rechargements, 1);
  assert.deepEqual(lireTentative(env.session.get(CLE_TENTATIVE)), { cible: CIBLE, at: 1_001_500, n: 1 });
  assert.equal(env.session.get("edugest-maj-page"), "comptabilite");
  await env.tick(60 * 60 * 1000);
  assert.equal(env.rechargements, 1);
});

test("version déjà à jour : aucun rechargement, aucun bandeau", async (t) => {
  const env = environnement(t, { versionPubliee: { ...ANCIENNE } });
  await env.maj.demarrer();
  await env.tick(30 * 60 * 1000);
  assert.equal(env.rechargements, 0);
  assert.equal(env.publications.some((e) => e.bandeau || e.rechargement), false);
});

test("version.json illisible (repli index.html, réseau coupé en route) : rien", async (t) => {
  const env = environnement(t, { versionPubliee: null });
  await env.maj.demarrer();
  await env.tick(30 * 60 * 1000);
  assert.equal(env.rechargements, 0);
});

test("hors ligne : ni lecture de version.json ni rechargement", async (t) => {
  const env = environnement(t, { enLigne: false });
  await env.maj.demarrer();
  await env.tick(10 * 60 * 1000);
  assert.equal(env.lectures, 0);
  assert.equal(env.rechargements, 0);
});

test("retour sur l'appli (PWA / Android reprise) après un déploiement : rechargée sans Ctrl+R", async (t) => {
  const env = environnement(t, { versionPubliee: { ...ANCIENNE }, visible: false });
  await env.maj.demarrer();
  env.versionPubliee = NOUVELLE; // déploiement pendant que l'appli dort
  await env.tick(20 * 1000);
  await env.montrer();
  assert.equal(env.dernier().rechargement, true);
  await env.tick(1500);
  assert.equal(env.rechargements, 1);
});

test("fenêtre ouverte (encaissement) : bandeau ; rechargement une fois fermée et l'appli en arrière-plan", async (t) => {
  const env = environnement(t, { presents: [".lc-modal-overlay"] });
  await env.maj.demarrer();
  await env.tick(5 * 60 * 1000);
  assert.equal(env.rechargements, 0);
  assert.equal(env.dernier().bandeau, true);

  // L'utilisateur passe à une autre appli, fenêtre toujours ouverte : on attend.
  await env.cacher();
  await env.tick(60 * 1000);
  assert.equal(env.rechargements, 0);

  // Fenêtre refermée (encaissement enregistré), appli toujours en arrière-plan.
  env.etatDoc.presents = [];
  await env.tick(60 * 1000);
  assert.equal(env.rechargements, 1);
});

test("appel en cours (écran role=dialog) : aucune mise à jour tant qu'il dure", async (t) => {
  const env = environnement(t, { presents: ["[role=\"dialog\"]"] });
  await env.maj.demarrer();
  await env.cacher();
  await env.tick(30 * 60 * 1000);
  assert.equal(env.rechargements, 0);
});

test("un clic pendant le message « rechargement » l'annule (bandeau à la place)", async (t) => {
  const env = environnement(t);
  await env.maj.demarrer();
  assert.equal(env.dernier().rechargement, true);
  await env.tick(500);
  env.fen.emettre("pointerdown");
  await env.tick(1000);
  assert.equal(env.rechargements, 0);
  assert.equal(env.dernier().rechargement, false);
  await env.tick(2100);
  assert.equal(env.dernier().bandeau, true);
  assert.equal(env.rechargements, 0);
});

test("champ tapé : jamais rechargé, même en arrière-plan, tant qu'il est affiché", async (t) => {
  const env = environnement(t, { versionPubliee: { ...ANCIENNE } });
  await env.maj.demarrer();
  const note = champ({ value: "" });
  env.fen.emettre("input", { target: note });
  note.value = "15";
  env.versionPubliee = NOUVELLE;
  await env.tick(20 * 1000);
  await env.cacher();
  await env.tick(20 * 60 * 1000);
  assert.equal(env.rechargements, 0);
  assert.equal(env.dernier().raison, "saisie");
  // Grille quittée (champ retiré de la page) : la mise à jour se fait.
  note.isConnected = false;
  await env.tick(60 * 1000);
  assert.equal(env.rechargements, 1);
});

test("utilisation active : rien sous les doigts ; dès que l'appli passe en arrière-plan, mise à jour", async (t) => {
  const env = environnement(t, { versionPubliee: { ...ANCIENNE } });
  await env.maj.demarrer();
  await env.tick(60 * 1000);
  env.fen.emettre("pointerdown");
  env.versionPubliee = NOUVELLE; // déploiement en pleine journée
  await env.tick(4 * 60 * 1000); // contrôle périodique (5 min)
  env.fen.emettre("keydown");
  await env.tick(4000);
  assert.equal(env.rechargements, 0);
  assert.equal(env.dernier().bandeau, true);

  await env.cacher();
  assert.equal(env.rechargements, 1);
});

test("application visible mais inutilisée 10 min : mise à jour", async (t) => {
  const env = environnement(t, { versionPubliee: { ...ANCIENNE } });
  await env.maj.demarrer();
  await env.tick(60 * 1000);
  env.fen.emettre("pointerdown");
  env.versionPubliee = NOUVELLE;
  await env.tick(4 * 60 * 1000);
  assert.equal(env.rechargements, 0);
  await env.tick(6 * 60 * 1000 + 5000);
  assert.equal(env.rechargements, 1);
});

test("fenêtre window.confirm restée ouverte : la réponse compte comme une interaction", async (t) => {
  const env = environnement(t, { versionPubliee: { ...ANCIENNE } });
  await env.maj.demarrer();
  await env.tick(60 * 1000);
  env.fen.emettre("pointerdown");
  env.versionPubliee = NOUVELLE;
  await env.tick(4 * 60 * 1000); // bandeau ; revoir dans 6 min
  // Fil principal bloqué 20 min par un confirm() : les minuteries sautent.
  t.mock.timers.setTime(Date.now() + 20 * 60 * 1000);
  await env.tick(6 * 60 * 1000);
  assert.equal(env.rechargements, 0);
});

test("garde-fou : la page rechargée toujours ancienne (cache) ne reboucle pas", async (t) => {
  const session = new Map([[CLE_TENTATIVE, JSON.stringify({ cible: CIBLE, at: 1_000_000 - 10_000, n: 1 })]]);
  const env = environnement(t, { session });
  await env.maj.demarrer();
  await env.tick(1500);
  assert.equal(env.rechargements, 0);
  assert.equal(env.dernier().bandeau, true);
  assert.equal(env.dernier().raison, "tentative-recente");
});

test("garde-fou : sans sessionStorage, jamais de rechargement automatique", async (t) => {
  const env = environnement(t);
  env.maj.arreter();
  env.maj = creerMiseAJourAuto({
    fenetre: env.fen, doc: env.doc, nav: { onLine: true }, session: null, versionLocale: ANCIENNE,
    lireVersionPubliee: async () => NOUVELLE, recharger: () => { env.rechargements += 1; },
    maintenant: () => Date.now(), publier: (e) => env.publications.push(e),
  });
  await env.maj.demarrer();
  await env.cacher();
  await env.tick(60 * 60 * 1000);
  assert.equal(env.rechargements, 0);
  assert.equal(env.dernier().bandeau, true);
});

test("rechargement réussi : la trace de la tentative est effacée", async (t) => {
  const session = new Map([[CLE_TENTATIVE, JSON.stringify({ cible: identiteVersion(ANCIENNE), at: 1, n: 1 })]]);
  const env = environnement(t, { session, versionPubliee: { ...ANCIENNE } });
  await env.maj.demarrer();
  assert.equal(env.session.has(CLE_TENTATIVE), false);
});

test("nouveau service worker sur une page déjà à jour : pas de rechargement", async (t) => {
  const env = environnement(t, { versionPubliee: { ...ANCIENNE } });
  await env.maj.demarrer();
  await env.maj.signalerServiceWorker({ waiting: null });
  await env.tick(5000);
  assert.equal(env.rechargements, 0);
});

test("service worker en attente : activé (SKIP_WAITING) juste avant le rechargement", async (t) => {
  const env = environnement(t);
  const messages = [];
  await env.maj.signalerServiceWorker({ waiting: { postMessage: (m) => messages.push(m) } });
  await env.tick(1500);
  assert.equal(env.rechargements, 1);
  assert.deepEqual(messages, [{ type: "SKIP_WAITING" }]);
});

test("bouton « Recharger » : immédiat, même pendant une saisie", async (t) => {
  const env = environnement(t, { presents: [".lc-modal-overlay"] });
  await env.maj.demarrer();
  env.maj.rechargerMaintenant();
  assert.equal(env.rechargements, 1);
});

test("decider : module de l'ancienne version introuvable → recharger, sauf travail en cours", () => {
  const actif = { ...base, depuisRetourMs: 600_000, inactifMs: 5000, moduleIntrouvable: true };
  assert.equal(decider(actif).raison, "module-introuvable");
  assert.equal(decider({ ...actif, occupation: "saisie" }).action, "attendre");
  assert.equal(decider({ ...actif, inactifMs: 500 }).raison, "interaction-recente");
  // Sans nouvelle version publiée (coupure réseau passagère) : rien.
  assert.equal(decider({ ...actif, cible: null }).action, "rien");
});

test("un clic sans pointerdown (accessibilité, script) compte aussi comme une interaction", async (t) => {
  const env = environnement(t, { versionPubliee: { ...ANCIENNE } });
  await env.maj.demarrer();
  await env.tick(20 * 1000);
  env.versionPubliee = NOUVELLE;
  await env.montrer();          // retour : rechargement prévu…
  env.fen.emettre("click");     // … mais l'utilisateur clique aussitôt
  await env.tick(1500);
  assert.equal(env.rechargements, 0);
  await env.tick(10 * 1000);
  assert.equal(env.rechargements, 0);
  assert.equal(env.dernier().bandeau, true);
});

test("module introuvable après un déploiement (clic vers un écran) : rechargement pour l'ouvrir", async (t) => {
  const env = environnement(t, { versionPubliee: { ...ANCIENNE } });
  await env.maj.demarrer();
  await env.tick(5 * 60 * 1000);
  env.versionPubliee = NOUVELLE;
  env.fen.emettre("click");             // ouvre un module…
  env.fen.emettre("vite:preloadError"); // … dont le fichier n'existe plus
  await env.tick(8000);
  assert.equal(env.rechargements, 1);
});

test("module introuvable sans nouvelle version (réseau) : pas de rechargement", async (t) => {
  const env = environnement(t, { versionPubliee: { ...ANCIENNE } });
  await env.maj.demarrer();
  await env.tick(20 * 1000);
  env.fen.emettre("vite:preloadError");
  await env.tick(60 * 1000);
  assert.equal(env.rechargements, 0);
});

test("module introuvable dû au réseau, puis vrai déploiement : pas de rechargement en pleine utilisation", async (t) => {
  const env = environnement(t, { versionPubliee: { ...ANCIENNE } });
  await env.maj.demarrer();
  await env.tick(20 * 1000);
  env.fen.emettre("vite:preloadError"); // coupure passagère, même version publiée
  await env.tick(60 * 1000);
  env.fen.emettre("pointerdown");
  env.versionPubliee = NOUVELLE;
  await env.tick(4 * 60 * 1000); // contrôle périodique : nouvelle version
  env.fen.emettre("keydown");
  await env.tick(5000);
  assert.equal(env.rechargements, 0);
  assert.equal(env.dernier().raison, "utilisation");
});
