import parentPortalHandler from "./_lib/handlers/parent-portal.js";
import teacherPortalHandler from "./_lib/handlers/teacher-portal.js";

const ROUTES = {
  parent: parentPortalHandler,
  teacher: teacherPortalHandler,
};

export default async function handler(req, res) {
  const op = String(req.query?.op || "").trim();
  const route = ROUTES[op];
  if (!route) return res.status(404).json({ error: "Operation inconnue." });
  return route(req, res);
}
