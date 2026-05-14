import { withObservability } from "../observability.js";
import { captureServerError } from "../observability.js";
import { applyCors, requireSession } from "../security.js";

const SENTRY_API_BASE = "https://sentry.io/api/0";

export function getSentryConfig(env = process.env) {
  const token = env.SENTRY_AUTH_TOKEN;
  const org = env.SENTRY_ORG_SLUG;
  const project = env.SENTRY_PROJECT_SLUG;
  if (!token || !org || !project) {
    return { ok: false, error: "Sentry non configure (SENTRY_AUTH_TOKEN, SENTRY_ORG_SLUG, SENTRY_PROJECT_SLUG manquants)." };
  }
  return { ok: true, token, org, project };
}

async function listIssues({ token, org, project }) {
  const url = `${SENTRY_API_BASE}/projects/${org}/${project}/issues/?limit=20&statsPeriod=14d`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`Sentry API ${r.status}: ${text.slice(0, 200)}`);
  }
  const data = await r.json();
  // Forme l'output : on n'expose au client que ce qui est utile.
  return data.map((it) => ({
    id: it.id,
    title: it.title,
    culprit: it.culprit || "",
    level: it.level || "",
    status: it.status || "",
    count: Number(it.count || 0),
    userCount: Number(it.userCount || 0),
    firstSeen: it.firstSeen || null,
    lastSeen: it.lastSeen || null,
    permalink: it.permalink || "",
  }));
}

async function handler(req, res) {
  if (!applyCors(req, res)) return;
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const session = await requireSession(req, res, { allowSuperadmin: true });
  if (!session) return;
  if (session.profile.role !== "superadmin") {
    return res.status(403).json({ error: "Acces reserve au superadmin." });
  }

  const action = String(req.body?.action || "issues");
  const cfg = getSentryConfig();

  if (action === "config") {
    return res.status(200).json({
      configured: cfg.ok,
      org: cfg.ok ? cfg.org : null,
      project: cfg.ok ? cfg.project : null,
      dashboardUrl: cfg.ok ? `https://sentry.io/organizations/${cfg.org}/projects/${cfg.project}/` : null,
      error: cfg.ok ? null : cfg.error,
    });
  }

  if (action === "issues") {
    if (!cfg.ok) return res.status(503).json({ error: cfg.error });
    try {
      const issues = await listIssues(cfg);
      return res.status(200).json({ issues });
    } catch (e) {
      return res.status(502).json({ error: e?.message || "Erreur Sentry API." });
    }
  }

  if (action === "test") {
    // Declenche une exception capturee par Sentry sans crasher l'endpoint.
    const err = new Error("Sentry test capture (declenche depuis SuperAdmin)");
    await captureServerError(err, { source: "superadmin-test", at: new Date().toISOString() });
    return res.status(200).json({ ok: true, message: "Event envoye a Sentry. Verifiez le dashboard dans la minute." });
  }

  return res.status(400).json({ error: "Action inconnue (issues | test | config)." });
}

export default withObservability(handler);
