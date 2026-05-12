import assert from "node:assert/strict";
import test from "node:test";
import { applyPasswordTarpit } from "../api/_lib/auth-tarpit.js";

test("applyPasswordTarpit returns without throwing on empty input", async () => {
  await assert.doesNotReject(() => applyPasswordTarpit());
  await assert.doesNotReject(() => applyPasswordTarpit(""));
  await assert.doesNotReject(() => applyPasswordTarpit(null));
});

test("applyPasswordTarpit returns without throwing on arbitrary strings", async () => {
  await assert.doesNotReject(() => applyPasswordTarpit("hello"));
  await assert.doesNotReject(() => applyPasswordTarpit("a".repeat(200)));
});

test("applyPasswordTarpit takes a similar duration to a real bcrypt.compare (constant-time)", async () => {
  const start = Date.now();
  await applyPasswordTarpit("benchmark-password");
  const elapsed = Date.now() - start;
  // bcrypt(10) compare typically takes 30ms+ — far above a no-op
  assert.ok(elapsed >= 20, `tarpit took ${elapsed}ms, expected >= 20ms`);
});
