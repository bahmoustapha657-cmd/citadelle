// Langues : le français est chargé d'office, l'anglais et l'arabe à la
// demande (src/i18n/index.js). La langue choisie est retrouvée à l'ouverture
// suivante, et l'initialisation en français ne l'efface pas.
import test from "node:test";
import assert from "node:assert/strict";

const stock = new Map([["LC_lang", "ar"]]);
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: { getItem: (k) => stock.get(k) ?? null, setItem: (k, v) => stock.set(k, String(v)) },
});

const { default: i18n, changerLangue, chargerLangue, languePrete } = await import("../src/i18n/index.js");

test("ouverture : la langue choisie auparavant est chargée avant le premier affichage", async () => {
  assert.equal(i18n.hasResourceBundle("fr", "translation"), true);
  await languePrete;
  assert.equal(i18n.language, "ar");
  assert.equal(i18n.t("common.save"), "حفظ");
  assert.equal(stock.get("LC_lang"), "ar", "le choix n'est pas effacé par l'initialisation");
  assert.equal(i18n.hasResourceBundle("en", "translation"), false, "l'anglais n'est pas chargé pour rien");
});

test("changement de langue : textes chargés, puis choix mémorisé", async () => {
  assert.equal(await changerLangue("en"), true);
  assert.equal(i18n.t("common.save"), "Save");
  assert.equal(stock.get("LC_lang"), "en");
  assert.equal(await changerLangue("fr"), true);
  assert.equal(i18n.t("common.save"), "Enregistrer");
  assert.equal(stock.get("LC_lang"), "fr");
});

test("langue inconnue : refusée, rien ne change", async () => {
  assert.equal(await changerLangue("xx"), false);
  assert.equal(i18n.language, "fr");
  assert.equal(await chargerLangue("xx"), true, "rien à charger");
});
