// Canal de retours terrain (feuille de route, étape 1 « consolider ») : une
// école signale un problème ou propose une idée depuis son centre d'aide ;
// EduGest lit, classe et répond. Logique pure de src/retours-terrain.js et
// cohérence avec la migration (mêmes genres, statuts et bornes).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  GENRES, MESSAGE_MAX, MESSAGE_MIN, STATUTS, appareilCourt, cleErreurEnvoi, compterNouveaux, contexteRetour,
  filtrerRetours, genreDe, modificationRetour, resumeContexte, verifierRetour,
} from "../src/retours-terrain.js";

const migration = readFileSync(new URL("../supabase/migrations/20261119185253_retours_terrain.sql", import.meta.url), "utf8");
const fr = JSON.parse(readFileSync(new URL("../src/i18n/locales/fr.json", import.meta.url), "utf8"));

test("genres, statuts et bornes : les mêmes que les contraintes de la table", () => {
  const liste = (col) => {
    const m = migration.match(new RegExp(`${col} in \\(([^)]*)\\)`));
    return m[1].split(",").map((s) => s.trim().replace(/'/g, ""));
  };
  assert.deepEqual(GENRES.map((g) => g.id), liste("genre"));
  assert.deepEqual(STATUTS, liste("statut"));
  assert.match(migration, new RegExp(`between ${MESSAGE_MIN} and ${MESSAGE_MAX}`));
  // Chaque genre et chaque statut a son libellé.
  for (const g of GENRES) assert.ok(fr.feedback.genres[g.id], g.id);
  for (const g of GENRES) assert.ok(fr.feedback.placeholders[g.id], g.id);
  for (const s of STATUTS) assert.ok(fr.feedback.statuts[s], s);
});

test("verifierRetour : genre connu, message de 3 à 2000 caractères (espaces ôtés)", () => {
  assert.equal(verifierRetour({ genre: "idee", message: "Exporter la liste en PDF" }), null);
  assert.equal(verifierRetour({ genre: "autre", message: "Bonjour" }), "feedback.errors.genre");
  assert.equal(verifierRetour({ genre: "probleme", message: "  ok  " }), "feedback.errors.tooShort");
  assert.equal(verifierRetour({ genre: "probleme", message: "x".repeat(MESSAGE_MAX + 1) }), "feedback.errors.tooLong");
  assert.equal(verifierRetour({ genre: "bravo", message: "abc" }), null);
  assert.equal(verifierRetour(), "feedback.errors.genre");
  // Chaque clé d'erreur existe en français.
  for (const cle of ["genre", "tooShort", "tooLong", "tooMany", "account", "network", "generic", "list"]) {
    assert.ok(fr.feedback.errors[cle], cle);
  }
});

test("appareilCourt : système et navigateur, sans la signature complète", () => {
  assert.equal(appareilCourt("Mozilla/5.0 (Linux; Android 13; SM-A135F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36"), "Android · Chrome");
  assert.equal(appareilCourt("Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0 Mobile Safari/537.36"), "Android · Samsung Internet");
  assert.equal(appareilCourt("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"), "iPhone · Safari");
  assert.equal(appareilCourt("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 Edg/120.0"), "Windows · Edge");
  assert.equal(appareilCourt("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0"), "Windows · Firefox");
  assert.equal(appareilCourt(""), "");
});

test("contexteRetour : écran, version, langue, réseau, taille, appareil ; rien de vide, rien de long", () => {
  const c = contexteRetour({
    ecran: "ecole", version: "6d1ca07", langue: "fr", enLigne: false, largeur: 390.4, hauteur: 844,
    userAgent: "Mozilla/5.0 (Linux; Android 13) Chrome/120.0 Mobile Safari/537.36", installee: true,
  });
  assert.deepEqual(c, {
    ecran: "ecole", version: "6d1ca07", langue: "fr", enLigne: false, taille: "390x844", appareil: "Android · Chrome", installee: true,
  });
  assert.deepEqual(contexteRetour({}), {});
  assert.deepEqual(contexteRetour({ ecran: "", langue: "ar" }), { langue: "ar" });
  // Le jsonb est limité à 2000 caractères en base : chaque valeur est coupée.
  const long = contexteRetour({ ecran: "e".repeat(5000), version: "v".repeat(5000), langue: "l".repeat(5000) });
  assert.ok(JSON.stringify(long).length < 2000);
});

test("resumeContexte : ligne lisible pour le super-admin, contexte absent toléré", () => {
  assert.equal(resumeContexte({ ecran: "ecole", version: "6d1ca07", langue: "fr", appareil: "Android · Chrome", taille: "390x844" }),
    "ecole · v 6d1ca07 · fr · Android · Chrome · 390x844");
  assert.equal(resumeContexte(null), "");
  assert.equal(resumeContexte({}), "");
});

test("cleErreurEnvoi : plafond du jour, compte refusé, réseau coupé, le reste", () => {
  assert.equal(cleErreurEnvoi({ code: "P0001", message: "Trop de retours envoyés aujourd'hui : réessayez demain." }), "feedback.errors.tooMany");
  assert.equal(cleErreurEnvoi({ code: "42501", message: "Compte introuvable." }), "feedback.errors.account");
  assert.equal(cleErreurEnvoi(new TypeError("Failed to fetch")), "feedback.errors.network");
  assert.equal(cleErreurEnvoi({ message: "TypeError: NetworkError when attempting to fetch resource." }), "feedback.errors.network");
  assert.equal(cleErreurEnvoi({ code: "23514", message: "violates check constraint" }), "feedback.errors.generic");
  assert.equal(cleErreurEnvoi(undefined), "feedback.errors.generic");
});

const R = [
  { _id: "1", statut: "nouveau", genre: "probleme", message: "Le bulletin ne s'imprime pas", ecoleNom: "École Élan", ecoleCode: "elan", auteur: "Awa", role: "Comptable", reponse: "" },
  { _id: "2", statut: "lu", genre: "idee", message: "Export Excel des notes", ecoleNom: "La Citadelle", ecoleCode: "citadelle", auteur: "Mamadou", role: "Direction", reponse: "" },
  { _id: "3", statut: "traite", genre: "question", message: "Comment changer d'année ?", ecoleNom: "La Citadelle", ecoleCode: "citadelle", auteur: "Fanta", role: "Secrétaire", reponse: "Paramètres puis Année scolaire" },
  { _id: "4", statut: "nouveau", genre: "bravo", message: "Merci pour le reçu famille", ecoleNom: "Lycée Kaloum", ecoleCode: "kaloum", auteur: "Ibrahima", role: "Direction", reponse: "" },
];

test("compterNouveaux et filtrerRetours : statut, genre, recherche sans accents", () => {
  assert.equal(compterNouveaux(R), 2);
  assert.equal(compterNouveaux(), 0);
  assert.deepEqual(filtrerRetours(R, { statut: "nouveau" }).map((r) => r._id), ["1", "4"]);
  assert.deepEqual(filtrerRetours(R, { genre: "idee" }).map((r) => r._id), ["2"]);
  assert.deepEqual(filtrerRetours(R, { q: "ecole elan" }).map((r) => r._id), ["1"]);
  assert.deepEqual(filtrerRetours(R, { q: "citadelle" }).map((r) => r._id), ["2", "3"]);
  assert.deepEqual(filtrerRetours(R, { q: "annee scolaire" }).map((r) => r._id), ["3"]);
  assert.deepEqual(filtrerRetours(R, { statut: "lu", q: "fanta" }), []);
  assert.equal(filtrerRetours(R).length, 4);
  assert.equal(genreDe("idee").icone, "💡");
  assert.equal(genreDe("autre"), null);
});

test("modificationRetour : la date de réponse ne change qu'avec la réponse", () => {
  const maintenant = new Date("2026-11-19T20:00:00Z");
  assert.deepEqual(modificationRetour(R[0], { statut: "lu", reponse: "" }, maintenant), { statut: "lu" });
  assert.deepEqual(modificationRetour(R[0], { statut: "traite", reponse: "  Corrigé dans la version du jour.  " }, maintenant), {
    statut: "traite", reponse: "Corrigé dans la version du jour.", repondu_le: "2026-11-19T20:00:00.000Z",
  });
  // Réponse inchangée (espaces près) : la date n'est pas réécrite.
  assert.deepEqual(modificationRetour(R[2], { statut: "traite", reponse: "Paramètres puis Année scolaire " }, maintenant), { statut: "traite" });
  // Réponse effacée : plus de date de réponse.
  assert.deepEqual(modificationRetour(R[2], { statut: "lu", reponse: "" }, maintenant), { statut: "lu", reponse: null, repondu_le: null });
  // Statut inconnu : on garde celui du retour.
  assert.deepEqual(modificationRetour(R[1], { statut: "archive", reponse: "" }, maintenant), { statut: "lu" });
});
