const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");

      const notifyIfUpdated = (worker) => {
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            window.dispatchEvent(new CustomEvent("sw-update-available"));
          }
        });
      };

      notifyIfUpdated(registration.waiting);

      registration.addEventListener("updatefound", () => {
        notifyIfUpdated(registration.installing);
      });

      setInterval(() => {
        registration.update().catch(() => {});
      }, UPDATE_CHECK_INTERVAL_MS);
    } catch {
      /* dev HTTP — ignore */
    }
  });
}
