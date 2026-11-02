// Documents d'apparat : bulletin Prestige et affiche du tableau d'honneur.
// Mise en page seulement (aucun calcul ici) : ornements autonomes, une page
// par affiche, densité selon la longueur de la liste, barème respecté, noms
// échappés, rien de chargé depuis Internet.
import test from "node:test";
import assert from "node:assert/strict";

import { ajusterPagesScript, cadreGuilloche, medaille, monogramme } from "../src/reports/ornements.js";
import { AJUSTER_PAGES, documentBulletinHTML } from "../src/reports/bulletins/bulletin-doc.js";
import { buildBulletinPageHTML } from "../src/reports/bulletins/bulletin-page.js";
import { htmlTableauxHonneur } from "../src/reports/tableau-honneur.js";

// getAnnee() lit l'année consultée dans localStorage.
globalThis.localStorage ??= { getItem: () => "2026-2027", setItem() {}, removeItem() {} };

// ── Ornements ────────────────────────────────────────────────────────────
test("monogramme : initiales sans mots vides ni accents, trois au plus", () => {
  assert.equal(monogramme("Groupe Scolaire Les Étoiles du Savoir"), `<div class="mono">GSE</div>`);
  assert.equal(monogramme("École de la Paix"), `<div class="mono">EP</div>`);
  assert.equal(monogramme("Lycée d'Excellence"), `<div class="mono">LE</div>`);
  assert.equal(monogramme(""), `<div class="mono">★</div>`);
});

test("médailles : or, argent, bronze aux trois premiers rangs, rang écrit dessus", () => {
  const [or, argent, bronze] = [1, 2, 3].map((r) => medaille(r));
  assert.match(or, />1</);
  assert.match(argent, />2</);
  assert.match(bronze, />3</);
  assert.equal(new Set([or, argent, bronze].map((m) => m.match(/orn-metal-\w+/)[0])).size, 3);
});

test("cadre guilloché : micro-texte et dimensions de la feuille", () => {
  const paysage = cadreGuilloche({ largeur: 297, hauteur: 210, microTexte: "ÉCOLE · 2026-2027" });
  assert.match(paysage, /viewBox="0 0 297 210"/);
  assert.match(paysage, /ÉCOLE · 2026-2027/);
});

test("ajustement à la page : vise le sélecteur et la hauteur de la feuille", () => {
  const script = ajusterPagesScript(".affiche", 210);
  assert.match(script, /"\.affiche \.ajustable"/);
  assert.match(script, /210 \* 96 \/ 25\.4/);
  assert.match(AJUSTER_PAGES, /"\.page\.pro \.ajustable"/);
});

// ── Bulletin Prestige ────────────────────────────────────────────────────
const prestige = (si = {}) => buildBulletinPageHTML({
  eleve: { _id: "e", nom: "DIALLO", prenom: "Mariama", sexe: "F", classe: "7ème A" },
  notes: [{ eleveId: "e", matiere: "Maths", type: "Devoir", note: 15, periode: "T1" }],
  matieres: [{ nom: "Maths", coefficient: 2 }],
  periode: "T1", niveau: "college", maxNote: 20,
  schoolInfo: { nom: "La Citadelle", ville: "Conakry", modeleBulletin: "prestige", signatures: {}, couleur2: "#a8fc54", ...si },
  rang: { rang: 1, effectif: 30 },
  classStats: { effectif: 30, moyenneClasse: 11.2, min: 6, max: 17 },
});

test("Prestige : cadre guilloché, micro-texte à l'école, contenu ajustable", () => {
  const html = prestige();
  assert.match(html, /class="cadre"/);
  assert.match(html, /LA CITADELLE · BULLETIN DE NOTES/);
  assert.match(html, /class="ajustable"/);
  assert.ok(!prestige({ nom: "École <i>" }).includes("<I>"), "micro-texte échappé");
});

test("document bulletin : ajustement à la page, impression seulement sur demande", () => {
  const doc = documentBulletinHTML({ title: "B", body: "<div></div>", imprimer: false });
  assert.ok(doc.includes(AJUSTER_PAGES));
  assert.ok(!doc.includes("window.print"));
  assert.match(documentBulletinHTML({ title: "B", body: "" }), /window\.print/);
});

// ── Tableau d'honneur ────────────────────────────────────────────────────
const NOMS = ["Diallo", "Camara", "Bah", "Sylla", "Condé", "Keïta", "Barry", "Touré", "Soumah", "Kourouma",
  "Doumbouya", "Baldé", "Fofana", "Cissé", "Kaba", "Sow"];
const laureats = (n, base = 18, classes = ["7ème A"]) => NOMS.slice(0, n).map((nom, i) => ({
  _id: `l${i}`, nom, prenom: `Prénom${i}`, classe: classes[i % classes.length], moyenne: base - i / 4, rang: i + 1,
}));
const ECOLE = { nom: "École fictive", ville: "Kindia", couleur1: "#1c548c", couleur2: "#a8fc54" };
const sections = (html) => html.match(/<section class="affiche[^"]*"/g) || [];

test("affiche : une page par classe, ornements vectoriels, rien d'Internet", () => {
  const html = htmlTableauxHonneur(
    [{ classe: "7ème A", classement: laureats(5), evalues: 30 }, { classe: "8ème B", classement: laureats(4), evalues: 28 }],
    ECOLE, { periodeLabel: "Premier trimestre", annee: "2026-2027", maxNote: 20 },
  );
  assert.equal(sections(html).length, 2);
  assert.equal((html.match(/class="cadre"/g) || []).length, 2);
  assert.ok(!/[\u{1F947}-\u{1F949}]/u.test(html), "plus de médailles en émoji");
  assert.ok(!/https?:\/\/|<link|@import/.test(html), "aucune ressource en ligne");
  // La seconde couleur (ici un vert citron) n'écrit jamais rien.
  assert.ok(!html.includes("#a8fc54"));
  assert.match(html, /Premier trimestre · Année scolaire 2026-2027/);
  assert.match(html, /Fait à Kindia, le /);
  assert.match(html, /ajustable/);
});

test("affiche : densité selon la longueur de la liste (palmarès de section plus dense)", () => {
  const classe = (n) => sections(htmlTableauxHonneur([{ classe: "7ème A", classement: laureats(n) }], ECOLE, {}))[0];
  const section = (n) => sections(htmlTableauxHonneur([{ classement: laureats(n, 18, ["7ème A", "8ème B"]) }], ECOLE, { portee: "Collège" }))[0];
  assert.match(classe(3), /affiche seul"/);
  assert.equal(classe(10), `<section class="affiche"`);
  assert.match(classe(12), /affiche serre"/);
  assert.match(classe(16), /affiche serre tres-serre"/);
  assert.match(section(10), /affiche serre"/);
  assert.match(section(16), /affiche serre tres-serre"/);
});

test("affiche : moyennes à la française et mentions au barème de la section", () => {
  const html = htmlTableauxHonneur(
    [{ classe: "CM2", classement: [{ nom: "Diallo", prenom: "Awa", moyenne: 9, rang: 1 }, ...laureats(4, 8.6).slice(1)] }],
    ECOLE, { maxNote: 10 },
  );
  assert.match(html, /9,00<small>\/10<\/small>/);
  assert.match(html, /Moy\. \/10/);
  assert.match(html, /Très bien/);
  assert.ok(!html.includes("Insuffisant"), "9/10 n'est pas insuffisant");
});

test("affiche : noms et classes échappés, classe sous le nom au palmarès de section", () => {
  const classement = laureats(5, 18, ["7ème <A>"]);
  classement[4] = { ...classement[4], nom: "Bah <script>" };
  const html = htmlTableauxHonneur([{ classement }], ECOLE, { portee: "Collège" });
  assert.ok(!html.includes("<script>Prénom") && !html.includes("Bah <script>"));
  assert.match(html, /BAH &lt;SCRIPT&gt;|Bah &lt;script&gt;/);
  assert.match(html, /<span class="cl">7ème &lt;A&gt;<\/span>/);
});
