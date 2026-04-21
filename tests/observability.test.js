import { test } from "node:test";
import assert from "node:assert/strict";
import {
  captureServerError,
  captureServerErrorSync,
  withObservability,
} from "../api/_lib/observability.js";

test("captureServerError is a no-op when SENTRY_DSN is absent", async () => {
  const originalDsn = process.env.SENTRY_DSN;
  delete process.env.SENTRY_DSN;

  const originalError = console.error;
  console.error = () => {};
  try {
    await captureServerError(new Error("boom"), { endpoint: "test" });
  } finally {
    console.error = originalError;
    if (originalDsn !== undefined) process.env.SENTRY_DSN = originalDsn;
  }
});

test("captureServerErrorSync never throws", () => {
  assert.doesNotThrow(() => {
    captureServerErrorSync(new Error("boom"));
  });
});

test("withObservability returns a 500 and captures on unhandled errors", async () => {
  const originalDsn = process.env.SENTRY_DSN;
  delete process.env.SENTRY_DSN;

  const originalError = console.error;
  console.error = () => {};

  const wrapped = withObservability(async () => {
    throw new Error("kaboom");
  });

  let statusCode = null;
  let body = null;
  const res = {
    headersSent: false,
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      body = payload;
    },
  };

  try {
    await wrapped({ url: "/api/test", method: "POST" }, res);
  } finally {
    console.error = originalError;
    if (originalDsn !== undefined) process.env.SENTRY_DSN = originalDsn;
  }

  assert.equal(statusCode, 500);
  assert.deepEqual(body, { error: "Erreur serveur." });
});

test("withObservability passes through successful responses", async () => {
  const wrapped = withObservability(async (_req, res) => {
    res.status(200).json({ ok: true });
  });

  let statusCode = null;
  let body = null;
  const res = {
    headersSent: false,
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      body = payload;
    },
  };

  await wrapped({ url: "/api/test", method: "GET" }, res);

  assert.equal(statusCode, 200);
  assert.deepEqual(body, { ok: true });
});
