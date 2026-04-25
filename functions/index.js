import process from "node:process";
import { onRequest } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2/options";
import accountManageHandler from "../api/account-manage.js";
import ecolePublicSyncHandler from "../api/ecole-public-sync.js";
import iaHandler from "../api/ia.js";
import inscriptionHandler from "../api/inscription.js";
import kkiapayWebhookHandler from "../api/kkiapay-webhook.js";
import loginHandler from "../api/login.js";
import parentPortalHandler from "../api/parent-portal.js";
import pushHandler from "../api/push.js";
import schoolLifecycleHandler from "../api/school-lifecycle.js";
import superadminLoginHandler from "../api/superadmin-login.js";
import teacherPortalHandler from "../api/teacher-portal.js";
import transfertHandler from "../api/transfert.js";

const FUNCTION_REGION = process.env.FUNCTION_REGION || "europe-west1";

setGlobalOptions({
  region: FUNCTION_REGION,
  maxInstances: 10,
});

const ROUTES = new Map([
  ["/account-manage", accountManageHandler],
  ["/ecole-public-sync", ecolePublicSyncHandler],
  ["/ia", iaHandler],
  ["/inscription", inscriptionHandler],
  ["/kkiapay-webhook", kkiapayWebhookHandler],
  ["/login", loginHandler],
  ["/parent-portal", parentPortalHandler],
  ["/push", pushHandler],
  ["/school-lifecycle", schoolLifecycleHandler],
  ["/superadmin-login", superadminLoginHandler],
  ["/teacher-portal", teacherPortalHandler],
  ["/transfert", transfertHandler],
]);

function normalizeRequestPath(req) {
  const url = new URL(req.originalUrl || req.url || "/", "https://local.firebase");
  const path = url.pathname || "/";
  const normalized = path.replace(/\/+$/, "");
  return normalized || "/";
}

function withErrorBoundary(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      console.error("firebase api router error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Erreur serveur." });
      }
    }
  };
}

export const api = onRequest({ timeoutSeconds: 60, memory: "512MiB" }, withErrorBoundary(async (req, res) => {
  const routePath = normalizeRequestPath(req);
  const handler = ROUTES.get(routePath);

  if (!handler) {
    return res.status(404).json({ error: `Route API introuvable: ${routePath}` });
  }

  return handler(req, res);
}));
