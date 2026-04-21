// Sentry scaffolding — activé uniquement si VITE_SENTRY_DSN est défini.
// Charge @sentry/react dynamiquement pour ne rien ajouter au bundle quand désactivé.
let sentryModule = null;
let initPromise = null;

export function initSentry() {
  if (initPromise) return initPromise;
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    initPromise = Promise.resolve(null);
    return initPromise;
  }
  initPromise = (async () => {
    try {
      const Sentry = await import("@sentry/react");
      Sentry.init({
        dsn,
        environment: import.meta.env.MODE,
        release: import.meta.env.VITE_SENTRY_RELEASE || undefined,
        tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES || 0),
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0,
      });
      sentryModule = Sentry;
      return Sentry;
    } catch (err) {
      if (typeof console !== "undefined") {
        console.warn("[sentry] init échouée", err?.message || err);
      }
      return null;
    }
  })();
  return initPromise;
}

export function captureClientError(error, context) {
  if (!sentryModule) {
    if (typeof console !== "undefined") {
      console.error("[client error]", error, context || "");
    }
    return;
  }
  try {
    sentryModule.captureException(error, context ? { extra: context } : undefined);
  } catch {
    /* swallow */
  }
}

export function setSentryUser(user) {
  if (!sentryModule) return;
  try {
    sentryModule.setUser(user || null);
  } catch {
    /* swallow */
  }
}

export function isSentryEnabled() {
  return sentryModule !== null;
}
