// Ordre de fin d'année : fin prévue → clôture → promotion et passage des
// admis. Chaque étape suppose la précédente — le désordre a coûté cher à La
// Citadelle en 2026 : 2026-2027 clôturée en août (annulée dans la minute),
// promotion lancée AVANT la clôture (archives 2025-2026 faussées), et une
// promotion relancée aurait fait avancer 411 élèves d'un cran de plus.
import assert from "node:assert/strict";
import test from "node:test";
import { anneeSuivante, finAnneeScolaire } from "../src/constants.js";
import {
  classeAnneeCloturee, dateLongue, etatCloture, etatPromotion, peutRouvrir,
} from "../src/components/admin/cloture-annee-utils.js";
import { decisionPassage } from "../src/promotion-utils.js";

const jour = (d) => [d.getFullYear(), d.getMonth() + 1, d.getDate()];

test("anneeSuivante : une année plus tard, format vérifié", () => {
  assert.equal(anneeSuivante("2025-2026"), "2026-2027");
  assert.equal(anneeSuivante(" 2026-2027 "), "2027-2028");
  assert.equal(anneeSuivante("2026"), "");
  assert.equal(anneeSuivante(""), "");
});

test("finAnneeScolaire : le lendemain des neuf mois de classe", () => {
  // Début en octobre (défaut) : octobre → juin, finie le 1er juillet.
  assert.deepEqual(jour(finAnneeScolaire("2025-2026")), [2026, 7, 1]);
  assert.deepEqual(jour(finAnneeScolaire("2025-2026", "Octobre")), [2026, 7, 1]);
  // Début en septembre : septembre → mai.
  assert.deepEqual(jour(finAnneeScolaire("2025-2026", "Septembre")), [2026, 6, 1]);
  // Début en novembre : novembre → juillet.
  assert.deepEqual(jour(finAnneeScolaire("2025-2026", "Novembre")), [2026, 8, 1]);
  // Début en janvier (année civile) : janvier → septembre de AAAA+1.
  assert.deepEqual(jour(finAnneeScolaire("2025-2026", "Janvier")), [2026, 10, 1]);
  // Mois inconnu : on retombe sur octobre, comme le reste de l'application.
  assert.deepEqual(jour(finAnneeScolaire("2025-2026", "???")), [2026, 7, 1]);
  assert.equal(finAnneeScolaire("n'importe quoi"), null);
});

test("etatCloture : impossible avant la fin prévue, possible dès le lendemain", () => {
  const avant = etatCloture("2026-2027", "Octobre", new Date(2027, 5, 30, 23, 59));
  assert.equal(avant.possible, false);
  assert.equal(avant.suivante, "2027-2028");
  assert.deepEqual(jour(avant.fin), [2027, 7, 1]);
  assert.equal(etatCloture("2026-2027", "Octobre", new Date(2027, 6, 1)).possible, true);
  // Le cas vécu : clôturer 2026-2027 en août 2026.
  assert.equal(etatCloture("2026-2027", "Octobre", new Date(2026, 7, 25)).possible, false);
  // Année illisible : jamais clôturable.
  assert.equal(etatCloture("", "Octobre", new Date(2030, 0, 1)).possible, false);
});

test("etatPromotion : seulement pour l'année clôturée, et une seule fois", () => {
  const cloture = { le: "2027-07-02T10:00:00.000Z" };
  assert.deepEqual(etatPromotion({}, "2026-2027"), { annee: "2025-2026", statut: "attente" });
  assert.equal(etatPromotion({ clotures: { "2026-2027": cloture } }, "2027-2028").statut, "possible");
  const promue = etatPromotion({
    clotures: { "2026-2027": cloture },
    promotions: { "2026-2027": { le: "2027-07-03T00:00:00.000Z", promus: 400, redoublants: 20 } },
  }, "2027-2028");
  assert.equal(promue.statut, "appliquee");
  assert.equal(promue.appliquee.promus, 400);
  // Une clôture ancienne ne rouvre pas la promotion de l'année courante.
  assert.equal(etatPromotion({ clotures: { "2025-2026": cloture } }, "2027-2028").statut, "attente");
  // La Citadelle : 2025-2026 clôturée AVANT ces repères, et déjà promue à
  // l'ancienne — la promotion ne doit pas pouvoir être rejouée.
  assert.equal(etatPromotion({ anneeScolaire: "2026-2027" }, "2026-2027").statut, "attente");
});

test("classeAnneeCloturee : seuls les élèves de l'année close, pas encore déplacés", () => {
  const snap = { classe: "3ème Année A", clotureLe: "2027-07-02" };
  // Présent l'an dernier, pas encore promu : jugé sur sa classe de l'année.
  assert.equal(classeAnneeCloturee({ classe: "3ème Année A", historique: { "2026-2027": snap } }, "2026-2027"), "3ème Année A");
  // Déjà promu (ou déplacé à la main) : ne plus y toucher.
  assert.equal(classeAnneeCloturee({ classe: "4ème Année A", historique: { "2026-2027": snap } }, "2026-2027"), null);
  // Arrivé depuis la clôture : rien à juger.
  assert.equal(classeAnneeCloturee({ classe: "3ème Année A" }, "2026-2027"), null);
  // Instantané de promotion sans clôture : l'année n'est pas close.
  assert.equal(classeAnneeCloturee({ classe: "3ème Année A", historique: { "2026-2027": { classe: "3ème Année A", archiveLe: "x" } } }, "2026-2027"), null);
});

test("peutRouvrir : jamais une année déjà promue ou dont des admis sont passés", () => {
  assert.equal(peutRouvrir({}, "2026-2027"), true);
  assert.equal(peutRouvrir({ promotions: { "2026-2027": { le: "x" } } }, "2026-2027"), false);
  assert.equal(peutRouvrir({ passagesAdmis: { "2026-2027": { le: "x" } } }, "2026-2027"), false);
  assert.equal(peutRouvrir({ promotions: { "2025-2026": { le: "x" } } }, "2026-2027"), true);
});

test("dateLongue : « 1er » pour le premier du mois", () => {
  assert.equal(dateLongue(new Date(2027, 6, 1)), "1er juillet 2027");
  assert.equal(dateLongue(new Date(2027, 5, 30)), "30 juin 2027");
  assert.equal(dateLongue(null), "");
});

test("passage des admis : le résultat saisi décide, pas la moyenne", () => {
  const toutes = { sectionsActives: ["prescolaire", "primaire", "college", "lycee"] };
  const sansLycee = { sectionsActives: ["prescolaire", "primaire", "college"] };
  // CEE : l'admis passe au collège, dans la section qui va avec.
  assert.deepEqual(decisionPassage("6ème Année A", "Admis", "primaire", toutes),
    { decision: "passe", classe: "7ème Année A", section: "college" });
  // BEPC : au lycée s'il existe…
  assert.deepEqual(decisionPassage("10ème Année A", "Admis", "college", toutes),
    { decision: "passe", classe: "11ème Année A", section: "lycee" });
  // … diplômé sinon (La Citadelle n'a pas de lycée).
  assert.deepEqual(decisionPassage("10ème Année A", "Admis", "college", sansLycee), { decision: "diplome" });
  // BAC : diplômé, il n'y a pas de classe après la Terminale.
  assert.deepEqual(decisionPassage("Terminale A", "Admis", "lycee", toutes), { decision: "diplome" });
  // Refusé : il redouble ; pas de résultat : on attend.
  assert.deepEqual(decisionPassage("6ème Année A", "Refusé", "primaire", toutes), { decision: "reste" });
  assert.deepEqual(decisionPassage("6ème Année A", "", "primaire", toutes), { decision: "attente" });
  assert.deepEqual(decisionPassage("6ème Année A", undefined, "primaire", toutes), { decision: "attente" });
  // Francophone : CM2 → 6ème, au collège.
  assert.deepEqual(decisionPassage("CM2 B", "Admis", "primaire", { ...toutes, systemeScolaire: "francophone" }),
    { decision: "passe", classe: "6ème B", section: "college" });
});
