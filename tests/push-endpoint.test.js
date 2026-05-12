import assert from "node:assert/strict";
import test from "node:test";

// web-push throws at module load if no VAPID keys are configured.
// Stub them with a valid (test-only) keypair before dynamic-importing the handler.
process.env.VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY
  || "BNbBSXfAUKsuvznT6dQH3rRy7r9PdsZQiL2t5MOZL6QvfHbAr5p1JIbqRpaQB-LqOk3GiHkBPjF0LZGUcfwJqgI";
process.env.VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
  || "uM1AdwGsT2gK6Q0vlgUaCi6_T6KkXjyB3KvX8M8WnYI";

const { default: pushHandler } = await import("../api/push.js");

function makeRes() {
  return {
    headers: {},
    statusCode: 200,
    body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
    end() { return this; },
  };
}

function makeReq({ method = "POST", body = {}, headers = {} } = {}) {
  return { method, body, headers };
}

test("push handler returns 200 on OPTIONS preflight", async () => {
  const res = makeRes();
  await pushHandler(makeReq({ method: "OPTIONS" }), res);
  assert.equal(res.statusCode, 200);
});

test("push handler returns 405 on non-POST methods", async () => {
  const res = makeRes();
  await pushHandler(makeReq({ method: "GET" }), res);
  assert.equal(res.statusCode, 405);
});

test("push handler returns 400 when required fields are missing", async () => {
  const res = makeRes();
  await pushHandler(makeReq({ body: {} }), res);
  assert.equal(res.statusCode, 400);
});

test("push handler returns 400 when titre is missing", async () => {
  const res = makeRes();
  await pushHandler(makeReq({ body: { schoolId: "ecole-test" } }), res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /titre/i);
});

test("push handler returns 400 when schoolId is missing", async () => {
  const res = makeRes();
  await pushHandler(makeReq({ body: { titre: "Alerte" } }), res);
  assert.equal(res.statusCode, 400);
});

test("push handler returns 400 on malformed schoolId", async () => {
  const res = makeRes();
  await pushHandler(makeReq({ body: { schoolId: "../escape", titre: "Alerte" } }), res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /Code école invalide/i);
});

test("push handler returns 400 with no body at all", async () => {
  const res = makeRes();
  await pushHandler({ method: "POST", headers: {} }, res);
  assert.equal(res.statusCode, 400);
});
