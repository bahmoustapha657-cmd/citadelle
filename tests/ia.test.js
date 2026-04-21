import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSuperadminAssistantPrompt,
  normalizeAssistantMode,
} from "../api/ia.js";

test("normalizeAssistantMode falls back to support for unknown values", () => {
  assert.equal(normalizeAssistantMode("support"), "support");
  assert.equal(normalizeAssistantMode("incident"), "incident");
  assert.equal(normalizeAssistantMode("unknown"), "support");
  assert.equal(normalizeAssistantMode(""), "support");
});

test("buildSuperadminAssistantPrompt injects mode, school and context", () => {
  const prompt = buildSuperadminAssistantPrompt({
    mode: "annonce",
    schoolName: "Ecole Horizon",
    context: "Maintenance prevue samedi a 8h",
    prompt: "Redige une annonce courte.",
  });

  assert.match(prompt, /superadmin/i);
  assert.match(prompt, /annonce officielle/i);
  assert.match(prompt, /Ecole concernee : Ecole Horizon/);
  assert.match(prompt, /Contexte : Maintenance prevue samedi a 8h/);
  assert.match(prompt, /Demande : Redige une annonce courte\./);
});
