import accountManageHandler from "./_lib/handlers/account-manage.js";
import schoolLifecycleHandler from "./_lib/handlers/school-lifecycle.js";
import ecolePublicSyncHandler from "./_lib/handlers/ecole-public-sync.js";
import superadminMessagesHandler from "./_lib/handlers/superadmin-messages.js";
import sentryStatusHandler from "./_lib/handlers/sentry-status.js";

const ROUTES = {
  "account-manage": accountManageHandler,
  "lifecycle": schoolLifecycleHandler,
  "public-sync": ecolePublicSyncHandler,
  "superadmin-messages": superadminMessagesHandler,
  "sentry-status": sentryStatusHandler,
};

export default async function handler(req, res) {
  const op = String(req.query?.op || "").trim();
  const route = ROUTES[op];
  if (!route) return res.status(404).json({ error: "Operation inconnue." });
  return route(req, res);
}
