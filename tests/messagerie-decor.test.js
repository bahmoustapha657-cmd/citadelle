// Décor de la messagerie EduGest : un carreau dessiné pour EduGest, répété
// en filigrane derrière les messages, à la couleur de l'école.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const svg = readFileSync("public/decor-messagerie.svg", "utf8");

test("carreau : léger, autonome, sans rien charger d'ailleurs", () => {
  assert.ok(svg.length < 6000, "le décor doit rester léger sur réseau faible");
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="360" height="360" viewBox="0 0 360 360"/);
  assert.doesNotMatch(svg, /<image|<script|<text|href=|url\(/i);
});

test("carreau : aucun motif ne touche le bord, il se répète sans couture", () => {
  // Chaque motif tient dans un rayon de 34 autour de son centre.
  const centres = [...svg.matchAll(/<g transform="translate\((\d+) (\d+)\)/g)].map((m) => [Number(m[1]), Number(m[2])]);
  assert.ok(centres.length >= 10, "au moins dix motifs d'école");
  for (const [x, y] of centres) {
    assert.ok(x >= 34 && x <= 326 && y >= 34 && y <= 326, `motif en (${x}, ${y}) trop près du bord`);
  }
  // L'écusson EduGest (livre ouvert dans son carré arrondi) y figure.
  assert.match(svg, /<rect x="-26" y="-26" width="52" height="52" rx="14"\/>/);
});

test("décor : un masque à la couleur de l'école, qui ne gêne ni le toucher ni la lecture", () => {
  const decor = readFileSync("src/components/messagerie/DecorMessagerie.jsx", "utf8");
  assert.match(decor, /DECOR_URL = "\/decor-messagerie\.svg"/);
  assert.match(decor, /backgroundColor: "var\(--msg-accent, var\(--sc1\)\)"/);
  assert.match(decor, /WebkitMaskImage: masque, maskImage: masque/);
  assert.match(decor, /pointerEvents: "none"/);
  assert.match(decor, /aria-hidden="true"/);
  const opacite = Number(decor.match(/opacite = ([\d.]+)/)[1]);
  assert.ok(opacite > 0.05 && opacite <= 0.2, "visible, mais jamais plus fort que le texte");
});

test("décor posé derrière le fil et sur l'écran d'accueil de la messagerie", () => {
  const vue = readFileSync("src/components/messagerie/VueConversation.jsx", "utf8");
  // Avant la zone qui défile : le décor reste fixe.
  assert.ok(vue.indexOf("<DecorMessagerie />") < vue.indexOf("ref={defilRef}"));
  assert.match(readFileSync("src/components/messagerie/MessageriePage.jsx", "utf8"), /<DecorMessagerie \/>/);
});
