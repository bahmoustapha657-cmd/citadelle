import assert from "node:assert/strict";
import test from "node:test";

import {
  accuseLecture, annoncesEnAlerte, construireFil, destinatairesAnnonce, filtrerConversations,
  formatChrono, formatDuree, initiales, lecteursMessage, libelleAppel, libelleJour,
  messagerieOuverteA, peutPublierAnnonce, titreConversation, totalNonLus, trierAnnonces,
} from "../src/components/messagerie/messagerie-logic.js";

const annuaire = new Map([
  ["moi", { id: "moi", nom: "Aïssatou Diallo", poste: "Comptable" }],
  ["b", { id: "b", nom: "Mamadou Bah", poste: "Enseignant · Maths" }],
]);

test("accès : enseignants et parents dedans, superadmin dehors", () => {
  assert.equal(messagerieOuverteA({ compteDocId: "x", role: "enseignant" }), true);
  assert.equal(messagerieOuverteA({ compteDocId: "x", role: "comptable" }), true);
  assert.equal(messagerieOuverteA({ compteDocId: "x", role: "parent" }), true);
  assert.equal(messagerieOuverteA({ compteDocId: "x", role: "superadmin" }), false);
  assert.equal(messagerieOuverteA({ role: "direction" }), false); // sans compte Supabase
  assert.equal(peutPublierAnnonce({ compteDocId: "x", role: "enseignant" }), false);
  assert.equal(peutPublierAnnonce({ compteDocId: "x", role: "surveillant" }), true);
});

test("titre : nom du correspondant en direct, titre en groupe", () => {
  const directe = { type: "direct", membres: [{ id: "moi" }, { id: "b" }] };
  assert.equal(titreConversation(directe, annuaire, "moi"), "Mamadou Bah");
  assert.equal(titreConversation({ type: "groupe", titre: "Direction", membres: [] }, annuaire, "moi"), "Direction");
  assert.equal(titreConversation({ type: "direct", membres: [{ id: "moi" }, { id: "z" }] }, annuaire, "moi"), "Compte retiré");
});

test("« Lu par » : membres dont la dernière lecture couvre le message, expéditeur exclu", () => {
  const conv = {
    membres: [
      { id: "moi", lu: "2026-09-30T10:05:00Z" },
      { id: "b", lu: "2026-09-30T10:01:00Z" },
      { id: "c", lu: "2026-09-30T09:00:00Z" },
    ],
  };
  const message = { de_compte_id: "moi", created_at: "2026-09-30T10:00:00Z" };
  assert.deepEqual(lecteursMessage(message, conv), ["b"]);
  assert.deepEqual(accuseLecture(message, conv), { lus: 1, total: 2 });
  // Lecture pile à l'heure du message : compte comme lu.
  assert.deepEqual(lecteursMessage({ ...message, created_at: "2026-09-30T10:01:00Z" }, conv), ["b"]);
});

test("fil : séparateurs de jour et messages enchaînés du même auteur", () => {
  const maintenant = new Date(2026, 8, 30, 12, 0);
  const iso = (j, h, m) => new Date(2026, 8, j, h, m).toISOString();
  const fil = construireFil([
    { id: "1", de_compte_id: "b", created_at: iso(29, 9, 0), type: "texte" },
    { id: "2", de_compte_id: "b", created_at: iso(30, 8, 0), type: "texte" },
    { id: "3", de_compte_id: "b", created_at: iso(30, 8, 2), type: "texte" },
    { id: "4", de_compte_id: "b", created_at: iso(30, 8, 30), type: "texte" },
    { id: "5", de_compte_id: "moi", created_at: iso(30, 8, 31), type: "texte" },
  ], maintenant);
  assert.deepEqual(fil.map((i) => (i.type === "jour" ? i.libelle : `${i.cle}${i.suite ? "+" : ""}`)),
    ["Hier", "1", "Aujourd'hui", "2", "3+", "4", "5"]);
  assert.equal(libelleJour("pas une date"), "");
});

test("boîte : épinglées d'abord, archives à part, vides de l'autre masquées", () => {
  const convs = [
    { id: "a", type: "direct", dernier_message_at: "2026-09-30T10:00:00Z", dernier_apercu: "salut", non_lus: 2 },
    { id: "b", type: "direct", dernier_message_at: "2026-09-29T10:00:00Z", dernier_apercu: "ok", epingle: true, non_lus: 1, sourdine: true },
    { id: "c", type: "direct", dernier_message_at: "2026-09-30T11:00:00Z", dernier_apercu: null, cree_par: "autre" },
    { id: "d", type: "groupe", dernier_message_at: "2026-09-28T10:00:00Z", archive: true, non_lus: 5 },
  ];
  assert.deepEqual(filtrerConversations(convs, { moi: "moi" }).map((c) => c.id), ["b", "a"]);
  assert.deepEqual(filtrerConversations(convs, { moi: "moi", archivees: true }).map((c) => c.id), ["d"]);
  assert.deepEqual(filtrerConversations(convs, { moi: "moi", recherche: "SALUT" }).map((c) => c.id), ["a"]);
  // Sourdine et archivées ne comptent pas dans le badge.
  assert.equal(totalNonLus(convs), 2);
});

test("annonces : ciblage identique à la base", () => {
  const liste = [
    { id: "moi", role: "direction", poste_cle: "direction" },
    { id: "e1", role: "enseignant", poste_cle: "enseignant" },
    { id: "c1", role: "comptable", poste_cle: "comptable" },
    { id: "s1", role: "surveillant", poste_cle: "surveillant_chef" },
  ];
  const ids = (cible) => destinatairesAnnonce(cible, liste, "moi").map((c) => c.id);
  assert.deepEqual(ids({ tous: true }), ["e1", "c1", "s1"]);
  assert.deepEqual(ids({ personnel: true }), ["c1", "s1"]);
  assert.deepEqual(ids({ enseignants: true }), ["e1"]);
  assert.deepEqual(ids({ postes: ["surveillant_chef"] }), ["s1"]);
  assert.deepEqual(ids({ comptes: ["c1"], enseignants: true }), ["e1", "c1"]);
  assert.deepEqual(ids({}), []);
});

test("annonces : alertes (à confirmer / urgentes non lues) et tri", () => {
  const lus = new Map([["lue-non-confirmee", { lu_at: "x", confirme_at: null }], ["urgente-lue", { lu_at: "x" }]]);
  const annonces = [
    { id: "normale", priorite: "normale", created_at: "2026-09-30T10:00:00Z" },
    { id: "lue-non-confirmee", priorite: "normale", accuse_requis: true, created_at: "2026-09-29T10:00:00Z" },
    { id: "urgente", priorite: "urgente", created_at: "2026-09-28T10:00:00Z" },
    { id: "urgente-lue", priorite: "urgente", created_at: "2026-09-27T10:00:00Z" },
    { id: "mienne", priorite: "urgente", accuse_requis: true, de_compte_id: "moi", created_at: "2026-09-26T10:00:00Z" },
    { id: "epinglee", priorite: "normale", epinglee: true, created_at: "2026-09-01T10:00:00Z" },
  ];
  assert.deepEqual(annoncesEnAlerte(annonces, lus, "moi").map((a) => a.id), ["lue-non-confirmee", "urgente"]);
  assert.deepEqual(trierAnnonces(annonces, lus).map((a) => a.id).slice(0, 3), ["epinglee", "urgente", "mienne"]);
});

test("appels et durées", () => {
  assert.equal(libelleAppel("termine:192", true), "Appel sortant · 3 min 12 s");
  assert.equal(libelleAppel("termine:40", false), "Appel entrant · 40 s");
  assert.equal(libelleAppel("manque", false), "Appel manqué");
  assert.equal(libelleAppel("manque", true), "Appel sans réponse");
  assert.equal(libelleAppel("refuse", true), "Appel refusé");
  assert.equal(formatChrono(75), "1:15");
  assert.equal(formatDuree(0), "0 s");
  assert.equal(initiales("Aïssatou  Diallo"), "AD");
  assert.equal(initiales(""), "?");
});
