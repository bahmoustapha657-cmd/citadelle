import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAssistantHistoryEntry,
  sanitizeAssistantHistoryEntries,
  SUPERADMIN_ASSISTANT_PRESETS,
} from "../src/components/superadminAssistantConfig.js";

test("assistant presets expose ready-to-use templates", () => {
  assert.ok(Array.isArray(SUPERADMIN_ASSISTANT_PRESETS));
  assert.ok(SUPERADMIN_ASSISTANT_PRESETS.length >= 4);
  assert.ok(SUPERADMIN_ASSISTANT_PRESETS.every((preset) => preset.id && preset.prompt));
});

test("assistant history helpers sanitize and keep the newest valid entries", () => {
  const entries = sanitizeAssistantHistoryEntries([
    buildAssistantHistoryEntry({
      mode: "support",
      schoolName: "Ecole A",
      context: "Contexte A",
      prompt: "Prompt A",
      result: "Resultat A",
      now: 10,
    }),
    {
      id: "invalid",
      createdAt: 20,
      prompt: "",
      result: "",
    },
    buildAssistantHistoryEntry({
      mode: "incident",
      schoolName: "Ecole B",
      context: "Contexte B",
      prompt: "Prompt B",
      result: "Resultat B",
      now: 30,
    }),
  ]);

  assert.equal(entries.length, 2);
  assert.equal(entries[0].prompt, "Prompt B");
  assert.equal(entries[1].prompt, "Prompt A");
});
