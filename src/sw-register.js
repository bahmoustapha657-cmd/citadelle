import { demarrerMiseAJourAuto } from "./mise-a-jour/mise-a-jour-auto.js";

// Intervalle de vérification d'une mise à jour du SW (1 min).
// On déclenche aussi un check au load et au retour de visibilité.
const UPDATE_CHECK_INTERVAL_MS = 60 * 1000;
const DELAI_RANGEMENT_MODULES_MS = 10 * 1000;

export function registerServiceWorker() {
  window.addEventListener("load", async () => {
    // Nouvelle version détectée par /version.json (la plupart des
    // déploiements ne touchent pas sw.js) : cf. mise-a-jour/.
    const maj = demarrerMiseAJourAuto();
    if (!("serviceWorker" in navigator)) return;

    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      maj.lierServiceWorker(registration);

      // Modules de l'application rangés sur l'appareil en arrière-plan
      // (rangerModules, sw.js), une fois l'ouverture passée : le démarrage
      // et la première synchronisation gardent le réseau pour eux.
      setTimeout(() => {
        navigator.serviceWorker.ready
          .then((reg) => reg.active?.postMessage({ type: "RANGER_MODULES" }))
          .catch(() => {});
      }, DELAI_RANGEMENT_MODULES_MS);

      const notifyIfUpdated = (worker) => {
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            maj.signalerServiceWorker(registration);
          }
        });
      };

      // SW déjà en attente au moment du chargement
      if (registration.waiting && navigator.serviceWorker.controller) {
        maj.signalerServiceWorker(registration);
      }

      notifyIfUpdated(registration.waiting);

      registration.addEventListener("updatefound", () => {
        notifyIfUpdated(registration.installing);
      });

      // Nouveau SW aux commandes (skipWaiting + clients.claim de sw.js) :
      // le rechargement n'est plus immédiat — il attend un moment sûr
      // (aucune saisie, fenêtre ou appel en cours), comme toute mise à jour.
      // Uniquement si un SW contrôlait DÉJÀ la page (mise à jour) : à la
      // 1re visite, clients.claim() (sw.js) déclenche aussi controllerchange
      // alors que la page vient du réseau et est déjà à jour — recharger ne
      // ferait que perdre la saisie en cours (connexion, nouveau mot de passe,
      // inscription…).
      let controle = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        // Première prise de contrôle (1re visite) : la page est déjà à jour.
        if (!controle) {
          controle = true;
          return;
        }
        maj.signalerServiceWorker(registration);
      });

      // Check périodique
      setInterval(() => {
        registration.update().catch(() => {});
      }, UPDATE_CHECK_INTERVAL_MS);

      // Check au retour de visibilité (l'utilisateur revient sur l'onglet)
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          registration.update().catch(() => {});
        }
      });

      // Check au focus de la fenêtre
      window.addEventListener("focus", () => {
        registration.update().catch(() => {});
      });
    } catch {
      /* dev HTTP — ignore */
    }
  });
}
