// Envoi immédiat (le message s'affiche avant la réponse du serveur, sans
// doublon ni double envoi) et brouillons gardés par discussion.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ecrireBrouillon, enEnvoi, envoiEchoue, estProvisoire, fusionnerFil, lireBrouillon, messageProvisoire,
  messagesEchoues,
} from "../src/components/messagerie/envoi-local.js";

const T0 = Date.UTC(2026, 10, 10, 9, 0, 0);
const iso = (ms) => new Date(ms).toISOString();
const env = (uuid = "11111111-1111-4111-8111-111111111111") => ({ crypto: { randomUUID: () => uuid } });

function stockage() {
  const m = new Map();
  return {
    localStorage: {
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: (k) => m.delete(k),
    },
    contenu: m,
  };
}

test("message provisoire : affichable tout de suite, avec son identifiant définitif", () => {
  const p = messageProvisoire({ convId: "c1", moi: "moi", corps: "  Bonjour  ", reponseA: "m0", maintenant: T0, env: env() });
  assert.equal(p.id, "11111111-1111-4111-8111-111111111111");
  assert.equal(p.corps, "Bonjour");
  assert.equal(p.type, "texte");
  assert.equal(p.reponse_a, "m0");
  assert.equal(p.created_at, iso(T0));
  assert.ok(enEnvoi(p) && estProvisoire(p) && !envoiEchoue(p));
  // Sans crypto.randomUUID : un identifiant de même forme.
  assert.match(messageProvisoire({ convId: "c1", moi: "moi", corps: "x", env: {} }).id,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
});

test("horloge de l'appareil en retard : le message reste en bas du fil", () => {
  const dernier = iso(T0 + 60000);
  const p = messageProvisoire({ convId: "c1", moi: "moi", corps: "x", dernier, maintenant: T0, env: env() });
  assert.equal(p.created_at, iso(T0 + 60001));
  const fil = fusionnerFil([{ id: "a", created_at: dernier }], [p]);
  assert.deepEqual(fil.map((m) => m.id), ["a", p.id]);
});

test("fil : la version du serveur remplace la provisoire, sans doublon", () => {
  const p = messageProvisoire({ convId: "c1", moi: "moi", corps: "Bonjour", maintenant: T0, env: env() });
  const fil = fusionnerFil([{ id: "a", created_at: iso(T0 - 1000) }], [p]);
  assert.equal(fil.length, 2);
  const serveur = { id: p.id, conversation_id: "c1", corps: "Bonjour", created_at: iso(T0 + 300) };
  // Réponse de l'envoi, puis le même message par le temps réel.
  const apres = fusionnerFil(fusionnerFil(fil, [serveur]), [serveur]);
  assert.equal(apres.length, 2);
  assert.equal(apres[1].envoi, undefined);
  assert.equal(apres[1].created_at, iso(T0 + 300));
  // Une provisoire ne remplace jamais une ligne du serveur.
  assert.equal(fusionnerFil(apres, [{ ...p, envoi: "echec" }])[1].envoi, undefined);
});

test("fil : messages anciens en tête, ordre chronologique gardé", () => {
  const fil = fusionnerFil([{ id: "c", created_at: iso(T0) }], [{ id: "a", created_at: iso(T0 - 2000) }, { id: "b", created_at: iso(T0 - 1000) }], { enTete: true });
  assert.deepEqual(fil.map((m) => m.id), ["a", "b", "c"]);
});

test("messages restés non envoyés : retrouvés dans tous les fils", () => {
  const fils = {
    c1: { messages: [{ id: "a" }, { id: "b", envoi: "echec" }, { id: "c", envoi: "en_cours" }] },
    c2: { messages: [{ id: "d", envoi: "echec" }] },
    c3: undefined,
  };
  assert.deepEqual(messagesEchoues(fils).map((m) => m.id), ["b", "d"]);
  assert.deepEqual(messagesEchoues(undefined), []);
});

test("brouillon : gardé par discussion et par compte, effacé quand il est vide", () => {
  const e = stockage();
  ecrireBrouillon("moi", "c1", "Je voulais vous dire", e);
  ecrireBrouillon("moi", "c2", "Autre", e);
  assert.equal(lireBrouillon("moi", "c1", e), "Je voulais vous dire");
  assert.equal(lireBrouillon("moi", "c2", e), "Autre");
  assert.equal(lireBrouillon("autre-compte", "c1", e), "");
  ecrireBrouillon("moi", "c1", "   ", e);
  assert.equal(lireBrouillon("moi", "c1", e), "");
  ecrireBrouillon("moi", "c2", "", e);
  assert.equal(e.contenu.size, 0, "plus aucun brouillon : la clé disparaît");
});

test("brouillon : borné, et sans stockage la saisie continue", () => {
  const e = stockage();
  for (let i = 0; i < 60; i++) ecrireBrouillon("moi", `c${i}`, `texte ${i}`, e);
  assert.equal(lireBrouillon("moi", "c0", e), "", "les plus anciens partent");
  assert.equal(lireBrouillon("moi", "c59", e), "texte 59");
  assert.equal(Object.keys(JSON.parse(e.contenu.get("LC_msg_brouillons_moi"))).length, 40);
  ecrireBrouillon("moi", "long", "x".repeat(9000), e);
  assert.equal(lireBrouillon("moi", "long", e).length, 4000);
  const refuse = { localStorage: { getItem: () => { throw new Error("refusé"); }, setItem: () => { throw new Error("refusé"); } } };
  assert.doesNotThrow(() => ecrireBrouillon("moi", "c1", "x", refuse));
  assert.equal(lireBrouillon("moi", "c1", refuse), "");
  assert.equal(lireBrouillon(null, "c1", e), "");
  e.contenu.set("LC_msg_brouillons_moi", "pas du json");
  assert.equal(lireBrouillon("moi", "c1", e), "");
});

test("envoi : même identifiant à chaque essai, ligne déjà en base relue", () => {
  const api = readFileSync("src/backend/messagerie-supabase.js", "utf8");
  assert.match(api, /\.\.\.\(id \? \{ id \} : \{\}\),/);
  assert.match(api, /error\.code === "23505"/);
  const etat = readFileSync("src/components/messagerie/use-messagerie-etat.js", "utf8");
  assert.match(etat, /id: provisoire\.id, conversationId: convId/);
  assert.match(etat, /remplacerDansFil\(\{ \.\.\.provisoire, envoi: "echec" \}\);/);
  assert.match(etat, /window\.addEventListener\("online", relancer\);/);
  // La saisie ne s'arrête plus pendant l'envoi d'un texte.
  const saisie = readFileSync("src/components/messagerie/Composeur.jsx", "utf8");
  assert.match(saisie, /if \(!edition\) \{ setErreur\(""\); onEnvoyerTexte\(contenu\); setTexte\(""\);/);
});
