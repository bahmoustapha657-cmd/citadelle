import assert from "node:assert/strict";
import test from "node:test";
import loginHandler from "../api/_lib/handlers/login.js";

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

test("login handler returns 200 on OPTIONS preflight", async () => {
  const res = makeRes();
  await loginHandler(makeReq({ method: "OPTIONS" }), res);
  assert.equal(res.statusCode, 200);
});

test("login handler returns 405 on non-POST methods", async () => {
  const res = makeRes();
  await loginHandler(makeReq({ method: "GET" }), res);
  assert.equal(res.statusCode, 405);
});

test("login handler returns 400 when required fields are missing", async () => {
  const res = makeRes();
  await loginHandler(makeReq({ body: {} }), res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /requis/i);
});

test("login handler returns 400 when login alone is missing", async () => {
  const res = makeRes();
  await loginHandler(makeReq({ body: { mdp: "abc", schoolId: "ecole-test" } }), res);
  assert.equal(res.statusCode, 400);
});

test("login handler returns 400 on malformed login (uppercase forbidden)", async () => {
  const res = makeRes();
  // normalizeLogin lowercases it, but special chars still rejected
  await loginHandler(makeReq({ body: { login: "bad login!", mdp: "abc12345", schoolId: "ecole-test" } }), res);
  assert.equal(res.statusCode, 400);
});

test("login handler returns 400 on malformed schoolId", async () => {
  const res = makeRes();
  await loginHandler(makeReq({ body: { login: "valid.user", mdp: "abc12345", schoolId: "../escape" } }), res);
  assert.equal(res.statusCode, 400);
});

test("login handler returns 400 with no body at all", async () => {
  const res = makeRes();
  await loginHandler({ method: "POST", headers: {} }, res);
  assert.equal(res.statusCode, 400);
});
