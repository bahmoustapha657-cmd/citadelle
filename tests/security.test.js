import assert from "node:assert/strict";
import process from "node:process";
import test from "node:test";
import {
  applyCors,
  consumeRateLimit,
  getClientIp,
  inferRequestOrigin,
  isAllowedSchoolRole,
  isSameOriginRequest,
  isValidLogin,
  isValidSchoolId,
  isValidTransferToken,
  normalizeLogin,
  normalizeSchoolId,
  normalizeTransferToken,
  validateSessionProfile,
} from "../api/_lib/security.js";

function createResponseDouble() {
  return {
    headers: {},
    statusCode: 200,
    body: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function restoreEnv(name, value) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

function createRateLimitDb() {
  const store = new Map();

  return {
    collection(name) {
      assert.equal(name, "_rateLimits");
      return {
        doc(id) {
          return { id };
        },
      };
    },
    async runTransaction(callback) {
      const tx = {
        async get(ref) {
          const data = store.get(ref.id);
          return {
            exists: data !== undefined,
            data: () => data,
          };
        },
        set(ref, data, options = {}) {
          const previous = store.get(ref.id) || {};
          store.set(ref.id, options.merge ? { ...previous, ...data } : data);
        },
      };

      return callback(tx);
    },
  };
}

test("normalize helpers sanitize login, school id, and transfer token", () => {
  assert.equal(normalizeLogin("  Admin.User  "), "admin.user");
  assert.equal(normalizeSchoolId("  ECOLE-KINDIA  "), "ecole-kindia");
  assert.equal(normalizeTransferToken("  trf-ab234c  "), "TRF-AB234C");
});

test("security validators reject malformed identifiers", () => {
  assert.equal(isValidLogin("valid.user-01"), true);
  assert.equal(isValidLogin("NOPE"), false);
  assert.equal(isValidSchoolId("ecole-kindia"), true);
  assert.equal(isValidSchoolId("../bad"), false);
  assert.equal(isValidTransferToken("TRF-AB23CD"), true);
  assert.equal(isValidTransferToken("TRF-bad"), false);
});

test("allowed school roles do not include superadmin", () => {
  assert.equal(isAllowedSchoolRole("admin"), true);
  assert.equal(isAllowedSchoolRole("parent"), true);
  assert.equal(isAllowedSchoolRole("superadmin"), false);
});

test("validateSessionProfile rejects incomplete profiles", () => {
  assert.deepEqual(validateSessionProfile({}, {}), {
    ok: false,
    status: 403,
    error: "Profil utilisateur incomplet.",
  });
});

test("validateSessionProfile rejects wrong school access", () => {
  assert.deepEqual(
    validateSessionProfile(
      { role: "admin", schoolId: "ecole-a" },
      { schoolId: "ecole-b" },
    ),
    {
      ok: false,
      status: 403,
      error: "Acces refuse pour cette ecole.",
    },
  );
});

test("validateSessionProfile rejects insufficient roles", () => {
  assert.deepEqual(
    validateSessionProfile(
      { role: "parent", schoolId: "ecole-a" },
      { roles: ["admin", "direction"] },
    ),
    {
      ok: false,
      status: 403,
      error: "Droits insuffisants.",
    },
  );
});

test("validateSessionProfile allows a matching staff profile", () => {
  assert.deepEqual(
    validateSessionProfile(
      { role: "admin", schoolId: "ecole-a" },
      { roles: ["admin", "direction"], schoolId: "ecole-a" },
    ),
    {
      ok: true,
      isSuperadmin: false,
    },
  );
});

test("validateSessionProfile lets superadmin bypass role and school checks only when allowed", () => {
  assert.deepEqual(
    validateSessionProfile(
      { role: "superadmin", schoolId: "central" },
      { roles: ["admin"], schoolId: "ecole-a", allowSuperadmin: true },
    ),
    {
      ok: true,
      isSuperadmin: true,
    },
  );

  assert.deepEqual(
    validateSessionProfile(
      { role: "superadmin", schoolId: "central" },
      { roles: ["admin"], schoolId: "ecole-a", allowSuperadmin: false },
    ),
    {
      ok: false,
      status: 403,
      error: "Acces refuse pour cette ecole.",
    },
  );
});

test("applyCors allows configured origins", () => {
  const previous = process.env.ALLOWED_ORIGIN;
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.ALLOWED_ORIGIN = "https://app.edugest.test";
  process.env.NODE_ENV = "production";

  try {
    const req = { headers: { origin: "https://app.edugest.test" } };
    const res = createResponseDouble();

    assert.equal(applyCors(req, res), true);
    assert.equal(res.headers["Access-Control-Allow-Origin"], "https://app.edugest.test");
  } finally {
    restoreEnv("ALLOWED_ORIGIN", previous);
    restoreEnv("NODE_ENV", previousNodeEnv);
  }
});

test("inferRequestOrigin rebuilds the deployed app origin from forwarded headers", () => {
  assert.equal(
    inferRequestOrigin({
      headers: {
        "x-forwarded-proto": "https",
        "x-forwarded-host": "citadelle.vercel.app",
      },
    }),
    "https://citadelle.vercel.app",
  );
});

test("isSameOriginRequest matches browser origin to deployment origin", () => {
  assert.equal(
    isSameOriginRequest(
      {
        headers: {
          origin: "https://citadelle.vercel.app",
          "x-forwarded-proto": "https",
          "x-forwarded-host": "citadelle.vercel.app",
        },
      },
      "https://citadelle.vercel.app",
    ),
    true,
  );
});

test("applyCors allows same-origin browser requests in production when ALLOWED_ORIGIN is missing", () => {
  const previous = process.env.ALLOWED_ORIGIN;
  const previousNodeEnv = process.env.NODE_ENV;
  delete process.env.ALLOWED_ORIGIN;
  process.env.NODE_ENV = "production";

  try {
    const req = {
      headers: {
        origin: "https://citadelle.vercel.app",
        "x-forwarded-proto": "https",
        "x-forwarded-host": "citadelle.vercel.app",
      },
    };
    const res = createResponseDouble();

    assert.equal(applyCors(req, res), true);
    assert.equal(res.headers["Access-Control-Allow-Origin"], "https://citadelle.vercel.app");
  } finally {
    restoreEnv("ALLOWED_ORIGIN", previous);
    restoreEnv("NODE_ENV", previousNodeEnv);
  }
});

test("applyCors still rejects cross-origin browser requests in production when ALLOWED_ORIGIN is missing", () => {
  const previous = process.env.ALLOWED_ORIGIN;
  const previousNodeEnv = process.env.NODE_ENV;
  delete process.env.ALLOWED_ORIGIN;
  process.env.NODE_ENV = "production";

  try {
    const req = {
      headers: {
        origin: "https://app.edugest.test",
        "x-forwarded-proto": "https",
        "x-forwarded-host": "citadelle.vercel.app",
      },
    };
    const res = createResponseDouble();

    assert.equal(applyCors(req, res), false);
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, { error: "CORS non configure sur le serveur." });
  } finally {
    restoreEnv("ALLOWED_ORIGIN", previous);
    restoreEnv("NODE_ENV", previousNodeEnv);
  }
});

test("applyCors still allows server-to-server requests without origin", () => {
  const previous = process.env.ALLOWED_ORIGIN;
  const previousNodeEnv = process.env.NODE_ENV;
  delete process.env.ALLOWED_ORIGIN;
  process.env.NODE_ENV = "production";

  try {
    const req = { headers: {} };
    const res = createResponseDouble();

    assert.equal(applyCors(req, res), true);
    assert.equal(res.statusCode, 200);
  } finally {
    restoreEnv("ALLOWED_ORIGIN", previous);
    restoreEnv("NODE_ENV", previousNodeEnv);
  }
});

test("getClientIp prioritizes forwarded headers", () => {
  assert.equal(
    getClientIp({
      headers: {
        "x-forwarded-for": "203.0.113.10, 10.0.0.1",
        "x-real-ip": "198.51.100.2",
      },
      socket: { remoteAddress: "127.0.0.1" },
    }),
    "203.0.113.10",
  );
});

test("consumeRateLimit blocks requests after the configured limit", async () => {
  const db = createRateLimitDb();

  const first = await consumeRateLimit({
    db,
    scope: "inscription",
    key: "203.0.113.10",
    limit: 1,
    windowMs: 60_000,
    now: 10_000,
  });
  const second = await consumeRateLimit({
    db,
    scope: "inscription",
    key: "203.0.113.10",
    limit: 1,
    windowMs: 60_000,
    now: 20_000,
  });

  assert.equal(first.ok, true);
  assert.equal(second.ok, false);
  assert.equal(second.status, 429);
});
