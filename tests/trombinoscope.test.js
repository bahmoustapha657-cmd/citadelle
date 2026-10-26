import assert from "node:assert/strict";
import test from "node:test";
import {
  BADGES_PAR_PAGE, FORMATS_BADGE, TROMBI_PAR_PAGE, badgesHTML, taillePoliceAppel, trombinoscopeHTML,
} from "../src/reports/trombinoscope.js";

const ecole = { nom: "La Citadelle", ville: "Conakry", couleur1: "#0A1628" };
const enfant = (i, extra = {}) => ({
  _id: String(i), nom: "Bah", prenom: `Enfant${String(i).padStart(2, "0")}`, classe: "Petite Section A",
  contactTuteur: "622 00 00 00", ...extra,
});
const compter = (html, motif) => (html.match(motif) || []).length;

test("trombinoscope : une page par tranche de 20, en-tête de classe sur chaque page", () => {
  const petite = Array.from({ length: 23 }, (_, i) => enfant(i));
  const grande = [enfant(99, { classe: "Grande Section A", surnom: "Bobo", photo: "https://x/p.jpg" })];
  const html = trombinoscopeHTML([...petite, ...grande], { schoolInfo: ecole, annee: "2026-2027" });
  assert.equal(TROMBI_PAR_PAGE, 20);
  // 23 en Petite Section → 2 pages ; 1 en Grande Section → 1 page.
  assert.equal(compter(html, /<div class="page">/g), 3);
  assert.equal(compter(html, /<div class="enfant">/g), 24);
  assert.match(html, /page 1\/2/);
  assert.match(html, /page 2\/2/);
  // Grande Section avant Petite Section (ordre des classes), couleur du niveau.
  assert.ok(html.indexOf("Grande Section A") < html.indexOf("Petite Section A"));
  assert.match(html, /background:#2563eb">Grande Section A/);
  assert.match(html, /<div class="appel">Bobo<\/div>/);
  assert.match(html, /<div class="officiel">BAH Enfant99<\/div>/);
  assert.match(html, /crossOrigin="anonymous" src="https:\/\/x\/p\.jpg"/);
  assert.match(html, /Photo à prendre/);
  assert.match(html, /La Citadelle/);
  assert.match(html, /2026-2027/);
});

test("badges : 9 par page, dans l'ordre des classes, sans téléphone", () => {
  const enfants = Array.from({ length: 10 }, (_, i) => enfant(i, { classe: i < 5 ? "Moyenne Section A" : "Grande Section B" }));
  const html = badgesHTML(enfants, { schoolInfo: ecole, annee: "2026-2027" });
  assert.equal(BADGES_PAR_PAGE, 9);
  assert.equal(compter(html, /<div class="page" /g), 2);
  assert.equal(compter(html, /<div class="badge portrait">/g), 10);
  assert.ok(html.indexOf("Grande Section B") < html.indexOf("Moyenne Section A"));
  assert.match(html, /background:#16a34a/);
  assert.doesNotMatch(html, /622 00 00 00/);
});

test("badges de tenue : écusson de poche 8 par page, logo, marque EduGest discrète", () => {
  const ecoleLogo = { ...ecole, logo: "https://x/logo.png" };
  const eleves = Array.from({ length: 9 }, (_, i) => enfant(i, { classe: "6ème A", photo: "https://x/e.jpg" }));
  const html = badgesHTML(eleves, { schoolInfo: ecoleLogo, annee: "2026-2027", format: "poche", photo: false });
  assert.equal(FORMATS_BADGE.poche.parPage, 8);
  assert.equal(compter(html, /<div class="badge poche">/g), 9);
  assert.equal(compter(html, /<div class="page" /g), 2);
  assert.match(html, /grid-template-columns:repeat\(2,80mm\);grid-auto-rows:60mm/);
  assert.match(html, /size:A4 portrait;margin:8mm/);
  // Logo de l'école sur chaque badge ; sans photo, aucune photo d'élève.
  assert.equal(compter(html, /src="https:\/\/x\/logo\.png"/g), 9);
  assert.doesNotMatch(html, /src="https:\/\/x\/e\.jpg"/);
  // Classe hors maternelle : couleur de l'école.
  assert.match(html, /class="classe" style="background:#0A1628">6ème A/);
  // Marque EduGest sur chaque badge, sans coordonnées ni téléphone.
  assert.equal(compter(html, /<div class="marque">/g), 9);
  assert.doesNotMatch(html, /622 00 00 00|627 73 85 79|edugest26@/);
  // Avec photo.
  assert.match(badgesHTML(eleves, { schoolInfo: ecoleLogo, format: "poche", photo: true }), /src="https:\/\/x\/e\.jpg"/);
});

test("badges : impression en miroir pour le papier transfert, à l'endroit sinon", () => {
  const html = badgesHTML([enfant(1)], { schoolInfo: ecole, format: "poche", miroir: true });
  assert.match(html, /<div class="miroir">/);
  assert.match(html, /\.miroir \.badge\{transform:scaleX\(-1\)\}/);
  assert.match(html, /class="avis no-print"/);
  const endroit = badgesHTML([enfant(1)], { schoolInfo: ecole, format: "poche" });
  assert.match(endroit, /<div class="endroit">/);
  assert.doesNotMatch(endroit, /class="avis no-print"/);
  // Portrait sans photo : le logo prend la place de la photo.
  const sansPhoto = badgesHTML([enfant(1)], { schoolInfo: { ...ecole, logo: "https://x/logo.png" }, photo: false });
  assert.match(sansPhoto, /class="logo grand-logo"/);
  assert.doesNotMatch(sansPhoto, /Photo à prendre/);
  // Format inconnu : portrait.
  assert.match(badgesHTML([enfant(1)], { schoolInfo: ecole, format: "?" }), /<div class="badge portrait">/);
});

test("noms échappés : un surnom saisi à la main n'injecte pas de balise", () => {
  const piege = enfant(1, { surnom: "<b>Néné</b> & co", photo: "https://x/a.jpg\" onerror=\"alert(1)" });
  for (const html of [
    trombinoscopeHTML([piege], { schoolInfo: ecole }), badgesHTML([piege], { schoolInfo: ecole }),
    badgesHTML([piege], { schoolInfo: { ...ecole, logo: "https://x/l.png\" onerror=\"alert(1)" }, format: "poche" }),
  ]) {
    assert.match(html, /&lt;b&gt;Néné&lt;\/b&gt; &amp; co/);
    assert.doesNotMatch(html, /<b>Néné<\/b>/);
    assert.doesNotMatch(html, /" onerror="/);
  }
});

test("taille du nom d'appel sur le badge selon sa longueur", () => {
  assert.equal(taillePoliceAppel("Néné"), 22);
  assert.equal(taillePoliceAppel("Fatoumata"), 18);
  assert.equal(taillePoliceAppel("Fatoumata Binta"), 14);
  assert.equal(taillePoliceAppel("Mamadou Saliou Diallo"), 11);
  // Plus étroit (écusson de poche avec photo) : plus petit, jamais sous 9 pt.
  assert.equal(taillePoliceAppel("Néné", 45), 17);
  assert.equal(taillePoliceAppel("Mamadou Saliou Diallo", 45), 9);
  assert.equal(taillePoliceAppel("Néné", 70), 22);
});
