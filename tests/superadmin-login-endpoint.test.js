import assert from "node:assert/strict";
import test from "node:test";
import superadminLoginHandler from "../api/_lib/handlers/superadmin-login.js";

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

test("superadmin-login returns 200 on OPTIONS preflight", async () => {
  const res = makeRes();
  await superadminLoginHandler(makeReq({ method: "OPTIONS" }), res);
  assert.equal(res.statusCode, 200);
});

test("superadmin-login returns 405 on non-POST methods", async () => {
  const res = makeRes();
  await superadminLoginHandler(makeReq({ method: "GET" }), res);
  assert.equal(res.statusCode, 405);
});

test("superadmin-login returns 400 when credentials are missing", async () => {
  const res = makeRes();
  await superadminLoginHandler(makeReq({ body: {} }), res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /Identifiants requis/i);
});

test("superadmin-login returns 400 on malformed login (too short)", async () => {
  const res = makeRes();
  await superadminLoginHandler(makeReq({ body: { login: "ab", mdp: "validpassword" } }), res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /Identifiant invalide/i);
});

test("superadmin-login returns 400 on malformed login (forbidden chars)", async () => {
  const res = makeRes();
  await superadminLoginHandler(makeReq({ body: { login: "bad!login", mdp: "validpassword" } }), res);
  assert.equal(res.statusCode, 400);
});

test("superadmin-login returns 400 on password shorter than 8 chars", async () => {
  const res = makeRes();
  await superadminLoginHandler(makeReq({ body: { login: "superadmin", mdp: "short" } }), res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /Mot de passe invalide/i);
});

test("superadmin-login accepts valid login pattern but rejects empty body", async () => {
  const res = makeRes();
  await superadminLoginHandler({ method: "POST", headers: {} }, res);
  assert.equal(res.statusCode, 400);
});
