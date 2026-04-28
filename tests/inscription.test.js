import assert from "node:assert/strict";
import test from "node:test";
import { generateSecurePassword } from "../api/_lib/passwords.js";

const PASSWORD_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!]{12}$/;

test("generateSecurePassword returns a 12-char password from the approved alphabet", () => {
  const password = generateSecurePassword();

  assert.equal(password.length, 12);
  assert.equal(PASSWORD_PATTERN.test(password), true);
});
