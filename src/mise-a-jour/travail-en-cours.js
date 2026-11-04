// ══════════════════════════════════════════════════════════════
//  Mise à jour automatique — y a-t-il un travail en cours ?
// ══════════════════════════════════════════════════════════════
// Un rechargement ne doit rien faire perdre. Est « travail en cours » :
//   - une fenêtre ouverte : Modale (.lc-modal-overlay), tout role="dialog"
//     (écran d'appel, appel de groupe, caméra, retouche photo…), toute
//     superposition plein écran ;
//   - un élément marqué data-maj-retenir (grille de notes modifiée,
//     message vocal en cours d'enregistrement…) ;
//   - une saisie : champ actif non vide, ou champ tapé il y a moins de
//     SAISIE_RECENTE_MS et toujours affiché ;
//   - une impression de la page ;
//   - une garde déclarée par le code (envoi PowerSync en cours…).
// Les fonctions prennent `doc` en paramètre pour être testées sans
// navigateur (tests/mise-a-jour-auto.test.js).

export const SAISIE_RECENTE_MS = 30 * 60 * 1000;

const SELECTEUR_FENETRES = [
  ".lc-modal-overlay",
  "[role=\"dialog\"]",
  "[role=\"alertdialog\"]",
  "[aria-modal=\"true\"]",
].join(",");

// Champs dont la valeur est du texte tapé.
const TYPES_TEXTE = new Set([
  "", "text", "number", "email", "tel", "password", "url",
  "date", "time", "datetime-local", "month", "week",
]);

function estChampTexte(el) {
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toUpperCase();
  if (tag === "TEXTAREA") return true;
  if (tag === "INPUT") return TYPES_TEXTE.has(String(el.type || "").toLowerCase());
  return !!el.isContentEditable;
}

function valeurNonVide(el) {
  if (el.isContentEditable) return String(el.textContent || "").trim() !== "";
  return String(el.value ?? "").trim() !== "";
}

// Une frappe dans ce champ compte-t-elle comme saisie à protéger ? Un filtre
// (liste déroulante, case à cocher, champ de recherche) hors formulaire ne
// fait rien perdre ; dans une fenêtre, la fenêtre protège déjà.
export function saisieAProteger(el) {
  if (!el || !el.tagName) return false;
  if (el.closest?.("[data-maj-ignorer]")) return false;
  const type = String(el.type || "").toLowerCase();
  if (type === "search") return false;
  if (estChampTexte(el)) return true;
  return !!el.closest?.("form");
}

// Une superposition fixe couvre-t-elle (presque) tout l'écran ?
function couvreLEcran(el, fenetre) {
  const largeur = fenetre?.innerWidth || 0;
  const hauteur = fenetre?.innerHeight || 0;
  if (!largeur || !hauteur || typeof el.getBoundingClientRect !== "function") return false;
  const style = fenetre.getComputedStyle?.(el);
  if (style && (style.display === "none" || style.visibility === "hidden" || style.pointerEvents === "none")) return false;
  const r = el.getBoundingClientRect();
  return r.width >= largeur * 0.9 && r.height >= hauteur * 0.9;
}

/**
 * Suivi des frappes de l'utilisateur. `noter(el, at)` à chaque événement
 * input/change ; `recente(maintenant)` : un champ tapé récemment est-il
 * toujours affiché ?
 */
export function creerSuiviSaisies() {
  const saisies = new Map(); // élément → date de la dernière frappe
  return {
    noter(el, at) {
      if (saisieAProteger(el)) saisies.set(el, at);
    },
    recente(maintenant) {
      for (const [el, at] of saisies) {
        if (!el.isConnected || maintenant - at >= SAISIE_RECENTE_MS) {
          saisies.delete(el);
          continue;
        }
        return true;
      }
      return false;
    },
    oublier() { saisies.clear(); },
  };
}

/**
 * Raison du travail en cours, ou null s'il n'y en a aucun.
 * @param {object} p
 * @param {Document} p.doc
 * @param {Window} [p.fenetre]
 * @param {{ recente(maintenant:number): boolean }} [p.saisies]
 * @param {boolean} [p.impression]
 * @param {Array<() => string|false|null>} [p.gardes]
 * @param {number} p.maintenant
 */
export function travailEnCours({ doc, fenetre, saisies, impression = false, gardes = [], maintenant }) {
  if (!doc) return null;
  if (impression) return "impression";
  if (doc.querySelector(SELECTEUR_FENETRES)) return "fenetre";
  if (doc.querySelector("[data-maj-retenir]")) return "travail";
  for (const el of doc.querySelectorAll("[style*=\"position: fixed\"]")) {
    if (couvreLEcran(el, fenetre)) return "fenetre";
  }
  const actif = doc.activeElement;
  if (estChampTexte(actif) && saisieAProteger(actif) && valeurNonVide(actif)) return "saisie";
  if (saisies?.recente(maintenant)) return "saisie";
  for (const garde of gardes) {
    let raison = null;
    try { raison = garde(); } catch { raison = null; }
    if (raison) return typeof raison === "string" ? raison : "travail";
  }
  return null;
}

// ── Envois réseau en cours ───────────────────────────────────
// Une écriture partie directement au serveur (encaissement en ligne, RPC,
// fonction Edge, envoi de photo…) serait coupée par un rechargement, sans
// que l'on sache si elle est arrivée. On compte les requêtes fetch autres
// que GET/HEAD tant qu'elles n'ont pas répondu. Exclus : le flux de synchro
// PowerSync (requête ouverte en permanence) et toute requête de plus de
// ENVOI_MAX_MS (bloquée : elle n'aboutira plus).
export const ENVOI_MAX_MS = 60 * 1000;

function methodeEtUrl(entree, init) {
  const methode = String(init?.method || entree?.method || "GET").toUpperCase();
  const url = typeof entree === "string" ? entree : String(entree?.url || entree?.href || entree || "");
  return { methode, url };
}

export function creerSuiviEnvois(fenetre, maintenant = () => Date.now()) {
  const enVol = new Map(); // jeton → début
  let suivant = 0;
  return {
    installer() {
      const origine = fenetre?.fetch;
      if (typeof origine !== "function" || origine.__suiviMaj) return;
      const suivi = function (entree, init) {
        const { methode, url } = methodeEtUrl(entree, init);
        const promesse = origine.apply(fenetre, arguments);
        if (methode === "GET" || methode === "HEAD" || /powersync|\/sync\/stream/i.test(url)) return promesse;
        const jeton = suivant++;
        enVol.set(jeton, maintenant());
        const fin = () => { enVol.delete(jeton); };
        promesse.then(fin, fin);
        return promesse;
      };
      suivi.__suiviMaj = true;
      fenetre.fetch = suivi;
    },
    enCours() {
      const t = maintenant();
      for (const debut of enVol.values()) if (t - debut < ENVOI_MAX_MS) return true;
      return false;
    },
  };
}

// ── Gardes déclarées par le code ─────────────────────────────
// Un module qui fait un travail que le rechargement interromprait (envoi
// des écritures hors ligne…) déclare une fonction qui renvoie sa raison
// tant qu'il est occupé. Module sans dépendance : importable partout sans
// alourdir le chargement.
const gardes = new Set();

export function ajouterGarde(fn) {
  gardes.add(fn);
  return () => gardes.delete(fn);
}

export function gardesActives() {
  return [...gardes];
}
