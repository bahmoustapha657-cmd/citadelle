// ══════════════════════════════════════════════════════════════
//  Mise à jour automatique — décision « recharger ou attendre »
// ══════════════════════════════════════════════════════════════
// Fonctions pures (aucun accès au navigateur), testées dans
// tests/mise-a-jour-auto.test.js. Le câblage (version.json, événements,
// rechargement) est dans ./mise-a-jour-auto.js.
//
// Principe : une nouvelle version est appliquée par UN rechargement, mais
// seulement à un moment où il ne coûte rien à l'utilisateur — application
// en arrière-plan, ouverture / retour sur l'application sans avoir encore
// rien touché, ou longue inactivité. Jamais pendant un travail en cours
// (saisie, fenêtre ouverte, appel…) : le bandeau « Recharger » prend alors
// le relais, et le prochain moment sûr fera la mise à jour.

export const DELAIS = {
  // Retour sur l'application (ouverture, onglet de nouveau visible, fenêtre
  // de nouveau active) : tant que l'utilisateur n'a rien touché depuis, et
  // dans cette fenêtre, il ne perd rien à voir la page se recharger.
  FENETRE_RETOUR_MS: 30 * 1000,
  // Application visible mais inutilisée depuis ce délai : rechargement.
  INACTIVITE_MS: 10 * 60 * 1000,
  // Dernier clic / frappe trop récent : une action vient peut-être de
  // partir (enregistrement en cours d'envoi) — on la laisse finir.
  INTERACTION_RECENTE_MS: 3 * 1000,
  // Garde-fou contre les boucles : une même version n'est retentée qu'après
  // ce délai, et au plus TENTATIVES_MAX fois par onglet.
  ENTRE_TENTATIVES_MS: 5 * 60 * 1000,
  TENTATIVES_MAX: 3,
  // Travail en cours : on regarde de nouveau au bout de ce délai.
  REVOIR_OCCUPE_MS: 30 * 1000,
};

// Identité d'un build : commit + date du build (une même révision rebâtie
// est un autre build). `null` si la version est inconnue (dev, tests).
export function identiteVersion(v) {
  if (!v || typeof v !== "object") return null;
  const commit = typeof v.commit === "string" ? v.commit : "";
  if (!commit || commit === "dev" || commit === "inconnu") return null;
  return `${commit}|${typeof v.date === "string" ? v.date : ""}`;
}

// La version publiée (/version.json) diffère-t-elle de celle qui tourne ?
// Renvoie l'identité de la version publiée, ou null si rien à faire
// (identique, ou l'une des deux illisible).
export function versionPublieeNouvelle(locale, publiee) {
  const ici = identiteVersion(locale);
  const enLigne = identiteVersion(publiee);
  if (!ici || !enLigne) return null;
  return ici === enLigne ? null : enLigne;
}

// Lit la trace de la dernière tentative ({ cible, at, n }) ; tolère le vide
// et les valeurs corrompues.
export function lireTentative(brut) {
  if (!brut) return null;
  try {
    const t = JSON.parse(brut);
    if (!t || typeof t.cible !== "string") return null;
    return { cible: t.cible, at: Number(t.at) || 0, n: Number(t.n) || 0 };
  } catch {
    return null;
  }
}

// Trace à écrire juste avant de recharger pour `cible`.
export function nouvelleTentative(precedente, cible, maintenant) {
  const n = precedente && precedente.cible === cible ? precedente.n + 1 : 1;
  return { cible, at: maintenant, n };
}

/**
 * Décide quoi faire d'une nouvelle version connue.
 *
 * @param {object} e
 * @param {string|null} e.cible        identité de la nouvelle version (null = à jour)
 * @param {boolean} e.enLigne          navigator.onLine
 * @param {boolean} e.stockage         sessionStorage utilisable (garde-fou anti-boucle)
 * @param {{cible,at,n}|null} e.tentative  dernière tentative de cet onglet
 * @param {string|null} e.occupation   travail en cours (raison) ou null
 * @param {boolean} e.visible          document.visibilityState === "visible"
 * @param {number} e.depuisRetourMs    temps écoulé depuis l'ouverture / le dernier retour
 * @param {number} e.inactifMs         temps écoulé depuis le dernier clic / la dernière frappe
 * @param {boolean} [e.moduleIntrouvable] un module de l'ancienne version n'a pas pu être chargé
 * @param {number} e.maintenant
 * @returns {{ action: "rien"|"attendre"|"recharger", bandeau: boolean, raison: string, revoirMs?: number }}
 */
export function decider(e) {
  const d = DELAIS;
  if (!e.cible) return { action: "rien", bandeau: false, raison: "a-jour" };
  // Hors ligne, recharger servirait l'ancienne version depuis le cache.
  if (!e.enLigne) return { action: "attendre", bandeau: false, raison: "hors-ligne" };
  // Sans stockage de session, impossible de garantir l'absence de boucle :
  // l'utilisateur recharge lui-même.
  if (!e.stockage) return { action: "attendre", bandeau: true, raison: "sans-garde-fou" };

  const t = e.tentative;
  if (t && t.cible === e.cible) {
    if (t.n >= d.TENTATIVES_MAX) return { action: "attendre", bandeau: true, raison: "tentatives-epuisees" };
    const ecoule = e.maintenant - t.at;
    if (ecoule >= 0 && ecoule < d.ENTRE_TENTATIVES_MS) {
      return { action: "attendre", bandeau: true, raison: "tentative-recente", revoirMs: d.ENTRE_TENTATIVES_MS - ecoule };
    }
  }

  if (e.occupation) return { action: "attendre", bandeau: true, raison: e.occupation, revoirMs: d.REVOIR_OCCUPE_MS };

  if (e.inactifMs < d.INTERACTION_RECENTE_MS) {
    return { action: "attendre", bandeau: false, raison: "interaction-recente", revoirMs: d.INTERACTION_RECENTE_MS - e.inactifMs };
  }

  // Un module de l'ancienne version n'existe plus sur le serveur : l'écran
  // demandé ne s'ouvrira pas. Recharger est le seul remède (le module où
  // l'on allait est rouvert, cf. pageApresMiseAJour).
  if (e.moduleIntrouvable) return { action: "recharger", bandeau: false, raison: "module-introuvable" };

  // Application en arrière-plan : personne ne la regarde.
  if (!e.visible) return { action: "recharger", bandeau: false, raison: "arriere-plan" };

  // Ouverture ou retour, sans rien avoir touché depuis.
  if (e.depuisRetourMs <= d.FENETRE_RETOUR_MS && e.inactifMs > e.depuisRetourMs) {
    return { action: "recharger", bandeau: false, raison: "retour" };
  }

  if (e.inactifMs >= d.INACTIVITE_MS) return { action: "recharger", bandeau: false, raison: "inactivite" };

  // En pleine utilisation : bandeau, et rechargement au prochain moment sûr
  // (inactivité, arrière-plan, retour).
  return { action: "attendre", bandeau: true, raison: "utilisation", revoirMs: d.INACTIVITE_MS - e.inactifMs };
}
