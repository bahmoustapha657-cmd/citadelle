// Serveur — helper Sentry no-op quand SENTRY_DSN est absent.
// Évite tout coût runtime tant que l'observabilité n'est pas activée.
let initialized = false;
let sentryModule = null;

async function ensureInit() {
  if (initialized) return sentryModule;
  initialized = true;

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return null;

  try {
    const Sentry = await import("@sentry/node");
    Sentry.init({
      dsn,
      environment:
        process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
      release: process.env.SENTRY_RELEASE || undefined,
      tracesSampleRate: Number(process.env.SENTRY_TRACES || 0),
    });
    sentryModule = Sentry;
    return Sentry;
  } catch (err) {
    console.warn("[sentry] init échouée", err?.message || err);
    return null;
  }
}

export async function captureServerError(error, context) {
  const Sentry = await ensureInit();
  if (!Sentry) {
    console.error("[server error]", error?.message || error, context || "");
    return;
  }
  try {
    Sentry.captureException(error, context ? { extra: context } : undefined);
    await Sentry.flush(2000);
  } catch {
    /* swallow */
  }
}

export function captureServerErrorSync(error, context) {
  captureServerError(error, context).catch(() => {});
}

export function withObservability(handler) {
  return async function observedHandler(req, res) {
    try {
      return await handler(req, res);
    } catch (err) {
      await captureServerError(err, {
        url: req?.url,
        method: req?.method,
      });
      if (!res.headersSent) {
        res.status(500).json({ error: "Erreur serveur." });
      }
      return undefined;
    }
  };
}
