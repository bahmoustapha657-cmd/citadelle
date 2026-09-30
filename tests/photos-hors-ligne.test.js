// Photos d'élèves hors ligne (src/photos-hors-ligne.js) : l'enregistrement
// d'un élève n'attend plus l'envoi de sa photo ; sans réseau (ou sur réseau
// trop lent), la photo attend sur l'appareil et part au retour du réseau.
// Node n'a pas de Cache Storage : une version en mémoire le remplace.
import test from "node:test";
import assert from "node:assert/strict";
import {
  CACHE_PHOTOS, CACHE_PHOTOS_ATTENTE, ESSAIS_MAX,
  envoyerSansAttendreLeReseau, envoyerPhotosEnAttente, compterPhotosEnAttente, prechargerPhotos, estErreurReseau,
} from "../src/photos-hors-ligne.js";

// ── Cache Storage en mémoire ────────────────────────────────────────────────
const magasins = new Map();
const cle = (k) => (typeof k === "string" ? k : k.url);
function fauxCache() {
  const entrees = new Map();
  return {
    entrees,
    async put(k, reponse) { entrees.set(cle(k), { corps: await reponse.arrayBuffer(), headers: [...reponse.headers], status: reponse.status }); },
    async match(k) {
      const e = entrees.get(cle(k));
      return e ? new Response(e.corps.slice(0), { headers: e.headers, status: e.status }) : undefined;
    },
    async keys() { return [...entrees.keys()].map((url) => new Request(url)); },
    async delete(k) { return entrees.delete(cle(k)); },
  };
}
globalThis.caches = {
  async open(nom) {
    if (!magasins.has(nom)) magasins.set(nom, fauxCache());
    return magasins.get(nom);
  },
};
const etat = { enLigne: true, connexion: null };
Object.defineProperty(globalThis.navigator, "onLine", { configurable: true, get: () => etat.enLigne });
Object.defineProperty(globalThis.navigator, "connection", { configurable: true, get: () => etat.connexion });

const raz = () => { magasins.clear(); etat.enLigne = true; etat.connexion = null; };
const contenu = async (nom) => [...(await caches.open(nom)).entrees.keys()];
const BASE = "https://x.supabase.co/storage/v1/object/public/photos";
const photo = (n, ecole = "citadelle") => ({
  blob: new Blob([`jpeg-${n}`], { type: "image/jpeg" }),
  chemin: `${ecole}/photos/${n}.jpg`,
  url: `${BASE}/${ecole}/photos/${n}.jpg`,
});
const reseauCoupe = () => Promise.reject(new Error("Failed to fetch"));

test("en ligne : envoi direct, photo gardée pour l'affichage, rien en attente", async () => {
  raz();
  const p = photo(1);
  const envois = [];
  const url = await envoyerSansAttendreLeReseau({ ...p, envoyer: async () => { envois.push(p.chemin); } });
  assert.equal(url, p.url);
  assert.deepEqual(envois, [p.chemin]);
  assert.deepEqual(await contenu(CACHE_PHOTOS), [p.url]);
  assert.equal(await compterPhotosEnAttente(), 0);
});

test("hors ligne : l'élève s'enregistre, la photo attend sur l'appareil", async () => {
  raz();
  etat.enLigne = false;
  const p = photo(2);
  let appele = false;
  const url = await envoyerSansAttendreLeReseau({ ...p, envoyer: async () => { appele = true; } });
  assert.equal(url, p.url, "URL définitive, calculée sans réseau");
  assert.equal(appele, false, "aucun envoi tenté sans réseau");
  assert.deepEqual(await contenu(CACHE_PHOTOS), [p.url], "affichable hors ligne");
  const attente = await (await caches.open(CACHE_PHOTOS_ATTENTE)).match(p.url);
  assert.equal(decodeURIComponent(attente.headers.get("X-Chemin")), p.chemin);
  assert.equal(await attente.text(), "jpeg-2");
});

test("coupure pendant l'envoi : mise en attente au lieu d'une erreur", async () => {
  raz();
  const p = photo(3);
  assert.equal(await envoyerSansAttendreLeReseau({ ...p, envoyer: reseauCoupe }), p.url);
  assert.equal(await compterPhotosEnAttente(), 1);
});

test("réseau trop lent : l'enregistrement n'attend pas ; l'envoi qui aboutit vide la file", async () => {
  raz();
  const p = photo(4);
  let finir;
  const envoi = new Promise((r) => { finir = r; });
  const url = await envoyerSansAttendreLeReseau({ ...p, envoyer: () => envoi, delaiMs: 20 });
  assert.equal(url, p.url);
  assert.equal(await compterPhotosEnAttente(), 1);
  finir();
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(await compterPhotosEnAttente(), 0);
});

test("refus du stockage (pas une coupure) : l'erreur remonte comme avant", async () => {
  raz();
  const p = photo(5);
  await assert.rejects(
    envoyerSansAttendreLeReseau({ ...p, envoyer: () => Promise.reject(new Error("new row violates row-level security policy")) }),
    /row-level security/,
  );
  assert.equal(await compterPhotosEnAttente(), 0);
});

test("retour du réseau : envoi des photos de l'école, une à une", async () => {
  raz();
  etat.enLigne = false;
  for (const p of [photo(6), photo(7), photo(8, "autre-ecole")]) {
    await envoyerSansAttendreLeReseau({ ...p, envoyer: async () => {} });
  }
  etat.enLigne = true;
  const envoyes = [];
  const n = await envoyerPhotosEnAttente(async (blob, chemin) => { envoyes.push([chemin, await blob.text()]); }, "citadelle");
  assert.equal(n, 2);
  assert.deepEqual(envoyes, [["citadelle/photos/6.jpg", "jpeg-6"], ["citadelle/photos/7.jpg", "jpeg-7"]]);
  assert.deepEqual(await contenu(CACHE_PHOTOS_ATTENTE), [photo(8, "autre-ecole").url], "l'autre école attend son compte");
});

test("réseau encore instable : on s'arrête et on garde tout", async () => {
  raz();
  etat.enLigne = false;
  for (const p of [photo(9), photo(10)]) await envoyerSansAttendreLeReseau({ ...p, envoyer: async () => {} });
  etat.enLigne = true;
  let tentatives = 0;
  const n = await envoyerPhotosEnAttente(() => { tentatives += 1; return reseauCoupe(); }, "citadelle");
  assert.equal(n, 0);
  assert.equal(tentatives, 1, "arrêt à la première coupure");
  assert.equal(await compterPhotosEnAttente(), 2);
});

test("refus répétés : abandon après ESSAIS_MAX passages", async () => {
  raz();
  etat.enLigne = false;
  const p = photo(11);
  await envoyerSansAttendreLeReseau({ ...p, envoyer: async () => {} });
  etat.enLigne = true;
  const refus = () => Promise.reject(new Error("JWT expired"));
  const erreur = console.error;
  console.error = () => {};
  try {
    for (let i = 1; i < ESSAIS_MAX; i += 1) {
      await envoyerPhotosEnAttente(refus, "citadelle");
      assert.equal(await compterPhotosEnAttente(), 1, `gardée après ${i} refus`);
    }
    await envoyerPhotosEnAttente(refus, "citadelle");
  } finally {
    console.error = erreur;
  }
  assert.equal(await compterPhotosEnAttente(), 0);
  assert.deepEqual(await contenu(CACHE_PHOTOS), [p.url], "toujours affichée sur cet appareil");
});

test("préchargement : seules les photos absentes sont téléchargées", async () => {
  raz();
  const dejaLa = photo(12);
  await envoyerSansAttendreLeReseau({ ...dejaLa, envoyer: async () => {} });
  const demandes = [];
  const fetchOrigine = globalThis.fetch;
  globalThis.fetch = async (url) => { demandes.push(url); return new Response("img", { status: 200 }); };
  try {
    const n = await prechargerPhotos([dejaLa.url, photo(13).url, photo(13).url, "data:image/png;base64,xx"]);
    assert.equal(n, 1);
    assert.deepEqual(demandes, [photo(13).url]);
    assert.ok((await contenu(CACHE_PHOTOS)).includes(photo(13).url));

    etat.connexion = { saveData: true };
    assert.equal(await prechargerPhotos([photo(14).url]), 0, "économie de données : rien");
  } finally {
    globalThis.fetch = fetchOrigine;
  }
});

test("erreurs réseau reconnues", () => {
  for (const m of ["Failed to fetch", "Load failed", "NetworkError when attempting to fetch resource.", "timeout : délai d'envoi dépassé"]) {
    assert.equal(estErreurReseau(new Error(m)), true, m);
  }
  assert.equal(estErreurReseau(new Error("new row violates row-level security policy")), false);
});
