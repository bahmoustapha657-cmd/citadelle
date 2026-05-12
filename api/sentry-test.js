/**
 * Endpoint TEMPORAIRE pour vérifier que la capture Sentry fonctionne en prod.
 *
 * Usage : GET /api/sentry-test → throw volontaire → 500 + erreur capturée
 * dans le dashboard Sentry sous l'event "EduGest sentry-test trigger".
 *
 * À supprimer une fois la vérification faite (généralement dans le commit qui suit).
 */
import { withObservability } from "./_lib/observability.js";

async function handler(_req, _res) {
  throw new Error("EduGest sentry-test trigger — verification capture en prod");
}

export default withObservability(handler);
