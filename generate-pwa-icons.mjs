/**
 * Génère des icônes PNG PWA (192x192 et 512x512) pour EduGest
 * Format PNG pur Node.js — pas de dépendances natives
 */

import { writeFileSync, mkdirSync } from "fs";
import { createHash } from "crypto";
import zlib from "zlib";

// ── Encodage PNG minimal ────────────────────────────────────────
function u32be(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n);
  return b;
}

function chunk(type, data) {
  const typeB = Buffer.from(type, "ascii");
  const crcData = Buffer.concat([typeB, data]);
  const crc = crc32(crcData);
  return Buffer.concat([u32be(data.length), typeB, data, u32be(crc)]);
}

// Table CRC32
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function makePNG(size, drawFn) {
  const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR
  const ihdr = Buffer.concat([u32be(size), u32be(size),
    Buffer.from([8, 2, 0, 0, 0])]);

  // Raw image data (RGB, filter byte 0 per row)
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    const rowOff = y * (size * 3 + 1);
    raw[rowOff] = 0; // filter = None
    for (let x = 0; x < size; x++) {
      const [r, g, b] = drawFn(x, y, size);
      const px = rowOff + 1 + x * 3;
      raw[px] = r; raw[px + 1] = g; raw[px + 2] = b;
    }
  }

  const idat = zlib.deflateSync(raw, { level: 9 });
  const iend = Buffer.alloc(0);

  return Buffer.concat([
    PNG_HEADER,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", iend),
  ]);
}

// ── Design de l'icône EduGest ──────────────────────────────────
// Fond dégradé bleu nuit → vert, avec "E" blanc centré + point vert
function drawIcon(x, y, s) {
  const cx = s / 2, cy = s / 2;
  const r = s / 2;

  // Coins arrondis (cercle inscrit)
  const dx = x - cx, dy = y - cy;
  const inCircle = Math.sqrt(dx * dx + dy * dy) < r * 0.88;

  if (!inCircle) {
    // Fond blanc hors du cercle → transparence simulée (fond blanc)
    return [255, 255, 255];
  }

  // Dégradé fond : bleu #0A1628 en haut → vert #00A876 en bas
  const t = y / s;
  const bg = [
    Math.round(10  + (0   - 10)  * t),
    Math.round(22  + (168 - 22)  * t),
    Math.round(40  + (118 - 40)  * t),
  ];

  // Dessiner "E" blanc centré (Police bold, taille ~40% du carré)
  const fs = s * 0.42; // font-size
  const lx = cx - fs * 0.28; // left x
  const ty2 = cy - fs * 0.46; // top y
  const by = cy + fs * 0.46;  // bottom y
  const thick = fs * 0.13;    // épaisseur trait
  const barW  = fs * 0.55;    // largeur barre

  function inRect(px, py, rx, ry, rw, rh) {
    return px >= rx && px < rx + rw && py >= ry && py < ry + rh;
  }

  // Trait vertical gauche
  const inStem = inRect(x, y, lx, ty2, thick, by - ty2);
  // Barre haute
  const inTop = inRect(x, y, lx, ty2, barW, thick);
  // Barre milieu
  const inMid = inRect(x, y, lx, cy - thick / 2, barW * 0.8, thick);
  // Barre basse
  const inBot = inRect(x, y, lx, by - thick, barW, thick);

  if (inStem || inTop || inMid || inBot) return [255, 255, 255];

  // Petit point vert vif en bas à droite
  const dotCx = cx + fs * 0.3, dotCy = cy + fs * 0.35;
  const dotR  = fs * 0.11;
  const dotD  = Math.sqrt((x - dotCx) ** 2 + (y - dotCy) ** 2);
  if (dotD < dotR) return [0, 196, 140]; // #00C48C

  return bg;
}

// ── Génération ─────────────────────────────────────────────────
mkdirSync("public/icons", { recursive: true });

for (const size of [192, 512]) {
  const png = makePNG(size, drawIcon);
  writeFileSync(`public/icons/pwa-${size}.png`, png);
  console.log(`✅  public/icons/pwa-${size}.png  (${png.length} octets)`);
}

// Apple touch icon (180x180)
const appleIcon = makePNG(180, drawIcon);
writeFileSync("public/icons/apple-touch-icon.png", appleIcon);
console.log(`✅  public/icons/apple-touch-icon.png  (${appleIcon.length} octets)`);

console.log("\nIcônes PWA générées avec succès !");
