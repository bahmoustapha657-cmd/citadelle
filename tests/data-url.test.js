import assert from "node:assert/strict";
import test from "node:test";
import { dataUrlToBlob } from "../src/data-url.js";

const octetsVersDataUrl = (octets, type) =>
  `data:${type};base64,${Buffer.from(octets).toString("base64")}`;

const lireOctets = async (blob) => new Uint8Array(await blob.arrayBuffer());

// En-tete JPEG reel (SOI + APP0 "JFIF") : ces octets sont > 127, donc ceux qui
// se corrompent si la chaine binaire est remise telle quelle a Blob et
// re-encodee en UTF-8. C'est le piege que ce test verrouille.
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0xff, 0xd9];

test("les octets binaires traversent intacts", async () => {
  const blob = dataUrlToBlob(octetsVersDataUrl(JPEG, "image/jpeg"));
  assert.equal(blob.type, "image/jpeg");
  assert.deepEqual([...(await lireOctets(blob))], JPEG);
});

test("tous les octets de 0 a 255 sont preserves", async () => {
  const tous = Array.from({ length: 256 }, (_, i) => i);
  const blob = dataUrlToBlob(octetsVersDataUrl(tous, "image/png"));
  assert.equal(blob.size, 256);
  assert.deepEqual([...(await lireOctets(blob))], tous);
});

test("le type MIME est repris de l'en-tete", async () => {
  assert.equal(dataUrlToBlob(octetsVersDataUrl([1], "image/webp")).type, "image/webp");
  // Sans type declare, la specification data URL retombe sur text/plain.
  assert.equal(dataUrlToBlob("data:,bonjour").type, "text/plain");
});

test("une data URL non base64 est decodee aussi", async () => {
  const blob = dataUrlToBlob("data:text/plain,bonjour%20Kindia");
  assert.equal(await blob.text(), "bonjour Kindia");
});

test("une valeur qui n'est pas une data URL est refusee", () => {
  assert.throws(() => dataUrlToBlob("https://exemple.test/photo.jpg"), /data URL/);
  assert.throws(() => dataUrlToBlob(""), /data URL/);
});
