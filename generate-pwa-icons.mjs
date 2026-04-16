/**
 * Génère les icônes PWA PNG depuis public/favicon.svg (logo EduGest)
 * Utilise @resvg/resvg-js — rendu fidèle, pas de dépendances natives fragiles.
 *
 * Usage : node generate-pwa-icons.mjs
 */

import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync, mkdirSync } from "fs";

const svgRaw = readFileSync("public/favicon.svg", "utf8");

// Fond carré arrondi #0A1628 + logo centré à 70 % de la taille
function wrapSvg(size) {
  const r   = Math.round(size * 0.18);   // rayon coins
  const pad = Math.round(size * 0.15);   // padding intérieur
  const inner = size - pad * 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <!-- Fond bleu nuit arrondi -->
  <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="#0A1628"/>
  <!-- Logo EduGest centré -->
  <image href="data:image/svg+xml;base64,${Buffer.from(svgRaw).toString("base64")}"
         x="${pad}" y="${pad}" width="${inner}" height="${inner}"/>
</svg>`;
}

mkdirSync("public/icons", { recursive: true });

for (const size of [192, 512]) {
  const svg = wrapSvg(size);
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: size } });
  const png = resvg.render().asPng();
  writeFileSync(`public/icons/pwa-${size}.png`, png);
  console.log(`✅  public/icons/pwa-${size}.png  (${size}×${size}, ${png.length} octets)`);
}

// Apple touch icon 180×180
const svgApple = wrapSvg(180);
const resvgApple = new Resvg(svgApple, { fitTo: { mode: "width", value: 180 } });
const pngApple = resvgApple.render().asPng();
writeFileSync("public/icons/apple-touch-icon.png", pngApple);
console.log(`✅  public/icons/apple-touch-icon.png  (180×180, ${pngApple.length} octets)`);

console.log("\nIcônes PWA générées depuis le logo EduGest ✓");
