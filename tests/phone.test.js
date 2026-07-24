import { test } from "node:test";
import assert from "node:assert/strict";
import { normaliserTelGuinee, estJoignable } from "../shared/phone.js";

test("normalise les formats guinéens courants vers E.164", () => {
  assert.equal(normaliserTelGuinee("622123456"), "+224622123456");
  assert.equal(normaliserTelGuinee("+224 622 12 34 56"), "+224622123456");
  assert.equal(normaliserTelGuinee("00224622123456"), "+224622123456");
  assert.equal(normaliserTelGuinee("224-622-123-456"), "+224622123456");
  assert.equal(normaliserTelGuinee("621 00 00 00"), "+224621000000");
});

test("garde le premier numéro quand plusieurs sont saisis", () => {
  assert.equal(normaliserTelGuinee("622123456 / 623000000"), "+224622123456");
  assert.equal(normaliserTelGuinee("622123456 ou 664111111"), "+224622123456");
  assert.equal(normaliserTelGuinee("655000000, 666000000"), "+224655000000");
});

test("rejette les entrées irrécupérables", () => {
  assert.equal(normaliserTelGuinee(""), null);
  assert.equal(normaliserTelGuinee(null), null);
  assert.equal(normaliserTelGuinee("Sambaya"), null);          // un nom
  assert.equal(normaliserTelGuinee("12345678"), null);          // 8 chiffres (ancien)
  assert.equal(normaliserTelGuinee("512123456"), null);         // ne commence pas par 6
  assert.equal(normaliserTelGuinee("6221234567"), null);        // 10 chiffres
});

test("estJoignable reflète normaliserTelGuinee", () => {
  assert.equal(estJoignable("622123456"), true);
  assert.equal(estJoignable("Sambaya"), false);
  assert.equal(estJoignable(""), false);
});
