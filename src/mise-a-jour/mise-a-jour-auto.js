// ══════════════════════════════════════════════════════════════
//  Mise à jour automatique de l'application
// ══════════════════════════════════════════════════════════════
// Après un déploiement, un onglet resté ouvert (ou l'application Android /
// la PWA reprise depuis l'arrière-plan, qui ne rechargent pas la page)
// gardait l'ancienne version jusqu'à un Ctrl+R : la plupart des
// déploiements ne changent pas sw.js, le service worker ne voyait donc
// rien passer. Ici, la page compare son build à /version.json (publié au
// même build, jamais mis en cache) à l'ouverture, au retour sur
// l'application, au retour du réseau et toutes les 5 minutes ; une
// nouvelle version est appliquée par un seul rechargement, au premier
// moment sûr (cf. decision.js et travail-en-cours.js).
//
// Les écritures hors ligne ne craignent rien : la file PowerSync est dans
// la base locale (IndexedDB) et repart au démarrage suivant ; on attend
// seulement qu'un envoi en cours se termine (garde de powersync/client.js).

import { VERSION_APP } from "../version-app.js";
import {
  DELAIS, decider, identiteVersion, lireTentative, nouvelleTentative, versionPublieeNouvelle,
} from "./decision.js";
import {
  ajouterGarde, creerSuiviEnvois, creerSuiviSaisies, gardesActives, travailEnCours,
} from "./travail-en-cours.js";

export const CLE_TENTATIVE = "edugest-maj-tentative";
const CLE_PAGE = "edugest-maj-page";

const CONTROLE_PERIODIQUE_MS = 5 * 60 * 1000;
// visibilitychange + focus arrivent ensemble : un seul aller-retour réseau.
const ESPACEMENT_CONTROLES_MS = 15 * 1000;
// Le message « rechargement en cours » reste visible ce temps-là ; un clic
// ou une frappe pendant ce délai annule le rechargement.
const DELAI_MESSAGE_MS = 1500;
// Minuterie en retard de plus de ce délai, page visible : le fil principal
// était bloqué (window.confirm/alert ouvert). La réponse de l'utilisateur
// ne laisse aucun événement DOM : on la compte comme une interaction.
const RETARD_BLOCAGE_MS = 2000;

async function lireVersionJson(fenetre) {
  try {
    const rep = await fenetre.fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!rep.ok) return null;
    return await rep.json();
  } catch {
    return null;
  }
}

/**
 * Crée le moteur de mise à jour. Toutes les dépendances au navigateur sont
 * injectables pour les tests.
 */
export function creerMiseAJourAuto({
  fenetre = window,
  doc = document,
  nav = navigator,
  session = (() => { try { return fenetre.sessionStorage; } catch { return null; } })(),
  versionLocale = VERSION_APP,
  lireVersionPubliee = () => lireVersionJson(fenetre),
  recharger = () => fenetre.location.reload(),
  maintenant = () => Date.now(),
  publier = () => {},
  pageCourante = () => null,
} = {}) {
  const saisies = creerSuiviSaisies();
  let cible = null;                 // identité de la nouvelle version connue
  let retourA = maintenant();       // ouverture / dernier retour sur l'appli
  let derniereInteraction = -Infinity;
  let impression = false;
  let dernierControle = -Infinity;
  let controleEnCours = null;
  let minuterie = null;
  let rechargement = false;
  let moduleIntrouvable = false;
  let registration = null;
  const nettoyages = [];

  const visible = () => doc.visibilityState !== "hidden";
  const enLigne = () => nav.onLine !== false;

  function lireStockage() {
    try {
      const brut = session?.getItem(CLE_TENTATIVE);
      return { ok: !!session, tentative: lireTentative(brut) };
    } catch {
      return { ok: false, tentative: null };
    }
  }

  function etatCourant() {
    const t = maintenant();
    const { ok, tentative } = lireStockage();
    return {
      cible,
      enLigne: enLigne(),
      stockage: ok,
      tentative,
      occupation: travailEnCours({ doc, fenetre, saisies, impression, gardes: gardesActives(), maintenant: t }),
      visible: visible(),
      depuisRetourMs: t - retourA,
      inactifMs: t - derniereInteraction,
      moduleIntrouvable,
      maintenant: t,
    };
  }

  // Minuterie déclenchée bien après l'heure prévue, page visible : le fil
  // principal était bloqué (window.confirm…) — compté comme une interaction.
  function noterBlocage(prevu) {
    if (visible() && maintenant() - prevu > RETARD_BLOCAGE_MS) derniereInteraction = maintenant();
  }

  function programmer(ms) {
    if (minuterie) clearTimeout(minuterie);
    const prevu = maintenant() + ms;
    minuterie = setTimeout(() => {
      minuterie = null;
      noterBlocage(prevu);
      evaluer();
    }, ms);
  }

  function evaluer() {
    if (rechargement) return;
    const r = decider(etatCourant());
    publier({ cible, bandeau: r.bandeau, rechargement: false, raison: r.raison });
    if (r.action === "recharger") { lancerRechargement(); return; }
    if (r.revoirMs) programmer(r.revoirMs + 50);
  }

  // Le rechargement lui-même : trace anti-boucle, page courante mémorisée,
  // service worker en attente activé, puis reload.
  function executer() {
    const t = maintenant();
    try {
      const prec = lireTentative(session.getItem(CLE_TENTATIVE));
      session.setItem(CLE_TENTATIVE, JSON.stringify(nouvelleTentative(prec, cible, t)));
      const page = pageCourante();
      if (page) session.setItem(CLE_PAGE, page);
    } catch {
      // Sans trace, pas de rechargement automatique (risque de boucle).
      rechargement = false;
      publier({ cible, bandeau: true, rechargement: false, raison: "sans-garde-fou" });
      return;
    }
    registration?.waiting?.postMessage({ type: "SKIP_WAITING" });
    console.info(`[EduGest] mise à jour ${VERSION_APP.court} → ${String(cible).slice(0, 7)}`);
    recharger();
  }

  function lancerRechargement() {
    rechargement = true;
    if (!visible()) { executer(); return; }
    // Visible : message bref, puis dernière vérification — un clic, une
    // frappe ou une fenêtre ouverte entre-temps annule.
    publier({ cible, bandeau: false, rechargement: true, raison: "rechargement" });
    const debut = maintenant();
    setTimeout(() => {
      const e = etatCourant();
      if (derniereInteraction >= debut || decider(e).action !== "recharger") {
        rechargement = false;
        evaluer();
        return;
      }
      executer();
    }, DELAI_MESSAGE_MS);
  }

  // Interroge /version.json (au plus une fois par ESPACEMENT_CONTROLES_MS,
  // sauf `force`), puis décide.
  async function controler({ force = false } = {}) {
    if (rechargement) return;
    if (!enLigne() || !identiteVersion(versionLocale)) { evaluer(); return; }
    if (!force && maintenant() - dernierControle < ESPACEMENT_CONTROLES_MS) { evaluer(); return; }
    if (controleEnCours) { await controleEnCours; return; }
    dernierControle = maintenant();
    controleEnCours = (async () => {
      const publiee = await lireVersionPubliee().catch(() => null);
      if (!publiee) return;
      cible = versionPublieeNouvelle(versionLocale, publiee);
      // Pas de nouvelle version : le module manquant venait du réseau.
      if (!cible) moduleIntrouvable = false;
    })();
    try { await controleEnCours; } finally { controleEnCours = null; }
    evaluer();
  }

  function ecouter(cibleEvt, type, fn, options) {
    cibleEvt.addEventListener(type, fn, options);
    nettoyages.push(() => cibleEvt.removeEventListener(type, fn, options));
  }

  function demarrer() {
    // Rechargement précédent réussi : la trace n'a plus d'objet.
    const { tentative } = lireStockage();
    if (tentative && tentative.cible === identiteVersion(versionLocale)) {
      try { session.removeItem(CLE_TENTATIVE); } catch { /* stockage bloqué */ }
    }

    const interaction = () => { derniereInteraction = maintenant(); };
    const frappe = (e) => {
      interaction();
      saisies.noter(e.target, maintenant());
    };
    const opts = { capture: true, passive: true };
    // « click » en plus : un clic d'accessibilité ou de script n'émet pas
    // de pointerdown.
    for (const type of ["pointerdown", "click", "keydown", "wheel", "touchstart"]) ecouter(fenetre, type, interaction, opts);
    ecouter(fenetre, "input", frappe, opts);
    ecouter(fenetre, "change", frappe, opts);

    // Retour sur l'application : toujours vérifié (le « focus » qui arrive
    // en même temps est absorbé par l'espacement des contrôles).
    ecouter(doc, "visibilitychange", () => {
      if (!visible()) { controler(); return; }
      retourA = maintenant();
      controler({ force: true });
    });
    // Page restaurée depuis le cache arrière/avant du navigateur.
    ecouter(fenetre, "pageshow", (e) => { if (e.persisted) { retourA = maintenant(); controler({ force: true }); } });
    ecouter(fenetre, "focus", () => controler());
    ecouter(fenetre, "online", () => controler({ force: true }));
    ecouter(fenetre, "beforeprint", () => { impression = true; });
    ecouter(fenetre, "afterprint", () => { impression = false; derniereInteraction = maintenant(); });
    // Module d'une ancienne version introuvable sur le serveur (Vite) :
    // signe probable d'un déploiement — vérifié par /version.json. Sans
    // nouvelle version publiée (simple coupure réseau), rien ne change.
    ecouter(fenetre, "vite:preloadError", () => { moduleIntrouvable = true; controler({ force: true }); });

    let periodiquePrevu = maintenant() + CONTROLE_PERIODIQUE_MS;
    const periodique = setInterval(() => {
      noterBlocage(periodiquePrevu);
      periodiquePrevu = maintenant() + CONTROLE_PERIODIQUE_MS;
      controler();
    }, CONTROLE_PERIODIQUE_MS);
    nettoyages.push(() => clearInterval(periodique));

    return controler({ force: true });
  }

  return {
    demarrer,
    controler,
    evaluer,
    // Nouveau service worker installé ou aux commandes : confirmé (ou non)
    // par /version.json — un SW mis à jour sur une page déjà à jour ne
    // demande aucun rechargement.
    signalerServiceWorker(reg) {
      if (reg) registration = reg;
      return controler({ force: true });
    },
    lierServiceWorker(reg) { registration = reg; },
    // Bouton « Recharger » du bandeau : choix de l'utilisateur, immédiat.
    rechargerMaintenant() {
      rechargement = true;
      registration?.waiting?.postMessage({ type: "SKIP_WAITING" });
      recharger();
    },
    arreter() {
      if (minuterie) clearTimeout(minuterie);
      nettoyages.splice(0).forEach((fn) => fn());
    },
  };
}

// ── Instance de l'application ─────────────────────────────────
let instance = null;
let etat = { cible: null, bandeau: false, rechargement: false, raison: "a-jour" };
const abonnes = new Set();
let page = null;

export function etatMiseAJour() { return etat; }

export function ecouterMiseAJour(fn) {
  abonnes.add(fn);
  return () => abonnes.delete(fn);
}

function publier(nouvel) {
  if (nouvel.cible === etat.cible && nouvel.bandeau === etat.bandeau && nouvel.rechargement === etat.rechargement) return;
  etat = nouvel;
  abonnes.forEach((fn) => fn(etat));
}

// Démarre la surveillance (production, au chargement de la page).
export function demarrerMiseAJourAuto() {
  if (instance) return instance;
  const envois = creerSuiviEnvois(window);
  envois.installer();
  ajouterGarde(() => (envois.enCours() ? "envoi" : null));
  instance = creerMiseAJourAuto({ publier, pageCourante: () => page });
  instance.demarrer();
  return instance;
}

export function rechargerMaintenant() {
  if (instance) instance.rechargerMaintenant();
  else window.location.reload();
}

// Module affiché (App) : retrouvé après un rechargement de mise à jour, pour
// que l'utilisateur reste là où il était.
export function memoriserPage(p) { page = p || null; }

// Lu une seule fois par chargement de page (puis effacé du stockage).
let pageRestauree;
export function pageApresMiseAJour() {
  if (pageRestauree !== undefined) return pageRestauree;
  pageRestauree = null;
  try {
    pageRestauree = window.sessionStorage.getItem(CLE_PAGE) || null;
    if (pageRestauree) window.sessionStorage.removeItem(CLE_PAGE);
  } catch { /* stockage bloqué */ }
  return pageRestauree;
}

export { DELAIS };
