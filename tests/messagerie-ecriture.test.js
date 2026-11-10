// « En train d'écrire… » (signal éphémère, compté, qui s'éteint seul) et
// photo collée ou glissée dans la saisie.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

import {
  DUREE_INDICATION_MS, INTERVALLE_SIGNAL_MS, creerEmetteur, creerSuivi, fichiersTransferes, libelleEcriture,
} from "../src/components/messagerie/ecriture-logic.js";

test("émetteur : un signal au plus toutes les 3 s tant que la frappe dure", () => {
  const envois = [];
  const e = creerEmetteur((ev) => envois.push(ev));
  e.frappe("B", 0);
  e.frappe("Bo", 500);
  e.frappe("Bon", 2900);
  assert.deepEqual(envois, ["e"]);
  e.frappe("Bonj", INTERVALLE_SIGNAL_MS);
  assert.deepEqual(envois, ["e", "e"]);
});

test("émetteur : saisie vidée ou message envoyé = « j'arrête », une seule fois", () => {
  const envois = [];
  const e = creerEmetteur((ev) => envois.push(ev));
  e.arret();
  e.frappe("   ", 0);
  assert.deepEqual(envois, [], "rien écrit : rien à signaler");
  e.frappe("Bonjour", 100);
  e.frappe("", 200);
  e.arret();
  assert.deepEqual(envois, ["e", "f"]);
  // La frappe reprend aussitôt : le signal repart sans attendre 3 s.
  e.frappe("Re", 300);
  assert.deepEqual(envois, ["e", "f", "e"]);
});

test("suivi : l'indication s'éteint seule si « j'arrête » se perd", () => {
  const s = creerSuivi();
  s.recevoir("e", "a", 0);
  s.recevoir("e", "b", 1000);
  assert.deepEqual(s.actifs(1500), ["a", "b"]);
  assert.equal(s.prochaineEcheance(), DUREE_INDICATION_MS);
  assert.deepEqual(s.actifs(DUREE_INDICATION_MS), ["b"]);
  s.recevoir("f", "b", 6500);
  assert.deepEqual(s.actifs(6600), []);
  assert.equal(s.prochaineEcheance(), null);
  // Signal répété : l'échéance recule ; message reçu : indication retirée.
  s.recevoir("e", "a", 7000);
  s.recevoir("e", "a", 9000);
  assert.deepEqual(s.actifs(14000), ["a"]);
  s.oublier("a");
  assert.deepEqual(s.actifs(14000), []);
  s.recevoir("e", undefined, 0);
  assert.deepEqual(s.actifs(0), []);
});

test("libellé : « écrit… » à deux, prénom dans un groupe", () => {
  const annuaire = new Map([["a", { nom: "Mariama Diallo" }]]);
  assert.equal(libelleEcriture([], { groupe: false, annuaire }), "");
  assert.equal(libelleEcriture(["a"], { groupe: false, annuaire }), "écrit…");
  assert.equal(libelleEcriture(["a"], { groupe: true, annuaire }), "Mariama écrit…");
  assert.equal(libelleEcriture(["x"], { groupe: true, annuaire }), "écrit…");
  assert.equal(libelleEcriture(["a", "b"], { groupe: true, annuaire }), "2 personnes écrivent…");
});

test("collage ou dépôt : les fichiers seulement, jamais le texte", () => {
  const photo = { name: "photo.png" };
  assert.deepEqual(fichiersTransferes({ files: [photo] }), [photo]);
  // Capture d'écran collée : pas de `files`, un élément de type fichier.
  assert.deepEqual(fichiersTransferes({ files: [], items: [{ kind: "string" }, { kind: "file", getAsFile: () => photo }] }), [photo]);
  assert.deepEqual(fichiersTransferes({ files: [], items: [{ kind: "string" }] }), []);
  assert.deepEqual(fichiersTransferes(undefined), []);
});

test("migration : canal réservé aux membres de la discussion, sans exécution publique", () => {
  const nom = readdirSync("supabase/migrations").find((f) => f.endsWith("_messagerie_ecrit.sql"));
  const sql = readFileSync(`supabase/migrations/${nom}`, "utf8");
  assert.match(sql, /m\.compte_id = my_compte_id\(\)/);
  assert.match(sql, /\^ecrit:\[0-9a-f\]\{8\}/);
  assert.match(sql, /revoke all on function public\.msg_ecrit_autorise\(text\) from public, anon/);
  assert.match(sql, /for select to authenticated/);
  assert.match(sql, /for insert to authenticated/);
  // Le canal des appels garde sa propre règle.
  const api = readFileSync("src/backend/messagerie-supabase.js", "utf8");
  assert.match(api, /ouvrirCanalPrive\(`appel:\$\{id\}`, surMessage\)/);
  assert.match(api, /ouvrirCanalPrive\(`ecrit:\$\{convId\}`, surMessage\)/);
});

test("discussion : frappe signalée, collage et dépôt branchés", () => {
  const saisie = readFileSync("src/components/messagerie/Composeur.jsx", "utf8");
  assert.match(saisie, /onBrouillon\?\.\(valeur\); onFrappe\?\.\(valeur\);/);
  assert.match(saisie, /onPaste=\{surCollage\}/);
  const vue = readFileSync("src/components/messagerie/VueConversation.jsx", "utf8");
  assert.match(vue, /onFrappe=\{ecriture\.signalerFrappe\} depot=\{depot\}/);
  assert.match(vue, /onDrop=\{surDepot\}/);
  const crochet = readFileSync("src/components/messagerie/use-ecriture.js", "utf8");
  assert.match(crochet, /charge\.de === moi\) return;/);
});
