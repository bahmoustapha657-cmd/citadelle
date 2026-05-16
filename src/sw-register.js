// Intervalle de vérification d'une mise à jour du SW (1 min).
// On déclenche aussi un check au load et au retour de visibilité.
const UPDATE_CHECK_INTERVAL_MS = 60 * 1000;

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");

      const notifyIfUpdated = (worker) => {
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            window.dispatchEvent(new CustomEvent("sw-update-available", {
              detail: { registration },
            }));
          }
        });
      };

      // SW déjà en attente au moment du chargement
      if (registration.waiting && navigator.serviceWorker.controller) {
        window.dispatchEvent(new CustomEvent("sw-update-available", {
          detail: { registration },
        }));
      }

      notifyIfUpdated(registration.waiting);

      registration.addEventListener("updatefound", () => {
        notifyIfUpdated(registration.installing);
      });

      // Reload du tab dès que le nouveau SW prend le contrôle.
      // Garde-fou contre les boucles : on ne reload qu'une seule fois
      // par session de page.
      let reloading = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (reloading) return;
        reloading = true;
        window.location.reload();
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
