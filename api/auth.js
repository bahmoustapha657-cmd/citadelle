import loginHandler from "./_lib/handlers/login.js";
import superadminLoginHandler from "./_lib/handlers/superadmin-login.js";
import inscriptionHandler from "./_lib/handlers/inscription.js";

const ROUTES = {
  login: loginHandler,
  "superadmin-login": superadminLoginHandler,
  inscription: inscriptionHandler,
};

export default async function handler(req, res) {
  const op = String(req.query?.op || "").trim();
  const route = ROUTES[op];
  if (!route) return res.status(404).json({ error: "Operation inconnue." });
  return route(req, res);
}
