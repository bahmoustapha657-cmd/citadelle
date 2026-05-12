import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeDisplayName } from "../api/_lib/security.js";

test("sanitizeDisplayName returns fallback for non-string input", () => {
  assert.equal(sanitizeDisplayName(null, "Fallback"), "Fallback");
  assert.equal(sanitizeDisplayName(undefined, "Fallback"), "Fallback");
  assert.equal(sanitizeDisplayName(42, "Fallback"), "Fallback");
});

test("sanitizeDisplayName trims and collapses whitespace", () => {
  assert.equal(sanitizeDisplayName("  Jean   Dupont  "), "Jean Dupont");
});

test("sanitizeDisplayName strips control characters", () => {
  // \x00 NUL, \x07 BEL, \x1F unit separator, \x7F DEL
  assert.equal(sanitizeDisplayName("Jean\x00Dupont"), "JeanDupont");
  assert.equal(sanitizeDisplayName("Bell\x07Test"), "BellTest");
  assert.equal(sanitizeDisplayName("With\x1FSep"), "WithSep");
  assert.equal(sanitizeDisplayName("Del\x7FInside"), "DelInside");
});

test("sanitizeDisplayName caps long inputs to 128 chars", () => {
  const long = "a".repeat(500);
  assert.equal(sanitizeDisplayName(long).length, 128);
});

test("sanitizeDisplayName falls back when input becomes empty after sanitize", () => {
  assert.equal(sanitizeDisplayName("\x00\x01\x02", "Fallback"), "Fallback");
  assert.equal(sanitizeDisplayName("   ", "Fallback"), "Fallback");
});

test("sanitizeDisplayName preserves accents and common punctuation", () => {
  assert.equal(sanitizeDisplayName("Éléonore Dupré-Martin"), "Éléonore Dupré-Martin");
  assert.equal(sanitizeDisplayName("O'Brien"), "O'Brien");
});
