import assert from "node:assert/strict";
import test from "node:test";
import { getRecuTotals } from "../src/reports.js";
import { identiteHTML, responsableNom } from "../src/reports/signatures.js";
import { computeEffectifs, sectionPourEleve } from "../src/reports/rapport-annuel/rapport-calculs.js";
import { computeRapportAnnuel } from "../src/reports/rapport-annuel/rapport-data.js";
import { buildRapportAnnuelHTML } from "../src/reports/rapport-annuel/rapport-html.js";

test("getRecuTotals inclut les autres frais et l'inscription quand ils sont réglés", () => {
  const eleve = {
    mens: { Octobre: "Payé", Novembre: "Payé", Décembre: "Impayé" },
    inscriptionPayee: true,
    autrePayee: true,
  };

  const totals = getRecuTotals(
    eleve,
    200000,
    ["Octobre", "Novembre", "Décembre"],
    { inscription: 50000, autre: 15000 },
  );

  assert.equal(totals.totalMensualites, 400000);
  assert.equal(totals.fraisIns, 50000);
  // « Autre frais » payé avec l'ancien drapeau : une ligne comme les autres.
  assert.deepEqual(totals.fraisDiversPayes, [{ id: "autre", label: "Autre frais", montant: 15000 }]);
  assert.equal(totals.totalGeneral, 465000);
});

test("identiteHTML affiche le responsable du poste sous le titre", () => {
  const schoolInfo = { responsables: { comptable: "Mamadou Diallo", direction: "  Aïssatou Bah  " } };
  assert.equal(responsableNom(schoolInfo, "comptable"), "Mamadou Diallo");
  assert.equal(responsableNom(schoolInfo, "direction"), "Aïssatou Bah");
  assert.equal(responsableNom(schoolInfo, "surveillant"), "");
  assert.equal(responsableNom({}, "comptable"), "");

  const html = identiteHTML({ titre: "Le Comptable", nom: responsableNom(schoolInfo, "comptable") });
  assert.ok(html.startsWith("Le Comptable<br/>"));
  assert.ok(html.includes("Mamadou Diallo"));
  // Sans responsable renseigné : titre seul, rendu historique inchangé.
  assert.equal(identiteHTML({ titre: "Le Surveillant", nom: "" }), "Le Surveillant");
  assert.equal(identiteHTML({ titre: "Le Directeur" }), "Le Directeur");
});

test("getRecuTotals utilise les montants figés au paiement (v2), repli tarif courant", () => {
  const eleve = {
    mens: { Octobre: "Payé", Novembre: "Payé", Décembre: "Payé" },
    // Octobre et Novembre encaissés à l'ancien tarif ; Décembre payé avant la
    // v2 (pas de montant figé) → tarif courant.
    mensMontants: { Octobre: 150000, Novembre: 150000 },
    inscriptionPayee: false,
    autrePayee: false,
  };

  const totals = getRecuTotals(
    eleve,
    200000,
    ["Octobre", "Novembre", "Décembre"],
    {},
  );

  assert.equal(totals.totalMensualites, 150000 + 150000 + 200000);
  assert.equal(totals.totalGeneral, 500000);
});

test("getRecuTotals n'ajoute pas les frais annexes non réglés", () => {
  const eleve = {
    mens: { Octobre: "Payé" },
    inscriptionPayee: false,
    autrePayee: false,
  };

  const totals = getRecuTotals(
    eleve,
    180000,
    ["Octobre"],
    { inscription: 30000, autre: 10000 },
  );

  assert.equal(totals.totalMensualites, 180000);
  assert.equal(totals.fraisIns, 0);
  assert.deepEqual(totals.fraisDiversPayes, []);
  assert.equal(totals.totalGeneral, 180000);
});

// ── Rapport annuel : la maternelle (préscolaire) ──
// Ses classes sortaient étiquetées « Collège », ses élèves et enseignants
// manquaient au détail par section et ses moyennes étaient jugées sur 20.
const actif = (_id, classe) => ({ _id, classe, statut: "Actif" });
const ELEVES_ECOLE = [
  actif("pre1", "Petite Section A"), actif("pre2", "Maternelle B"),
  actif("pri1", "1ère Année A"), actif("pri2", "CM2 A"),
  actif("col1", "7ème Année A"),
  actif("lyc1", "11ème Année A"),
  { _id: "pre-parti", classe: "Grande Section A", statut: "Inactif" },
];
const ENSEIGNANTS = {
  ensPre: [{ nom: "Éducatrice" }],
  ensP: [{ nom: "Instituteur" }, { nom: "Institutrice" }],
  ensC: [{ nom: "Professeur" }],
  ensL: [],
};
// La Citadelle : maternelle, primaire et collège — pas de lycée.
const CITADELLE = { sectionsActives: ["prescolaire", "primaire", "college"] };
// Année explicite : le défaut (getAnnee) lit le localStorage du navigateur.
const ANNEE = "2026-2027";
const rapport = (data) => computeRapportAnnuel({ annee: ANNEE, ...data });
// Détail « 2M · 1C · 2P » d'une tuile du bandeau KPI imprimé.
const detailKpi = (model, schoolInfo, label) => buildRapportAnnuelHTML(model, schoolInfo)
  .match(new RegExp(`<div class="kpi-label">${label}</div><div class="kpi-sub">([^<]*)</div>`))?.[1];

test("rapport annuel : une classe de maternelle est « Préscolaire », pas « Collège »", () => {
  assert.equal(sectionPourEleve({ classe: "Petite Section A" }), "Préscolaire");
  assert.equal(sectionPourEleve({ classe: "Maternelle B" }), "Préscolaire");
  assert.equal(sectionPourEleve({ classe: "1ère Année A" }), "Primaire");
  assert.equal(sectionPourEleve({ classe: "7ème Année A" }), "Collège");
  assert.equal(sectionPourEleve({ classe: "11ème Année A" }), "Lycée");

  const m = rapport({ eleves: ELEVES_ECOLE, ...ENSEIGNANTS });
  const sectionDe = (lignes, classe) => lignes.find((l) => l.classe === classe)?.section;
  // Effectifs, pédagogie et mensualités : les trois tableaux par classe.
  for (const lignes of [m.lignesEffectif, m.lignesPedagogie, m.lignesMens]) {
    assert.equal(sectionDe(lignes, "Petite Section A"), "Préscolaire");
    assert.equal(sectionDe(lignes, "Maternelle B"), "Préscolaire");
    assert.equal(sectionDe(lignes, "7ème Année A"), "Collège");
  }
});

test("rapport annuel : la maternelle a ses totaux, élèves et enseignants", () => {
  const m = rapport({ eleves: ELEVES_ECOLE, ...ENSEIGNANTS });
  assert.equal(m.totEleves, 6); // l'élève inactif n'est pas compté
  assert.deepEqual([m.totPre, m.totP, m.totC, m.totL], [2, 2, 1, 1]);
  assert.equal(m.totPre + m.totP + m.totC + m.totL, m.totEleves);
  assert.deepEqual([m.ensPreCount, m.ensPCount, m.ensCCount, m.ensLCount], [1, 2, 1, 0]);
  assert.equal(m.totEnseignants, 4);

  // Appelant qui ne fournit pas d'enseignants de maternelle : rien ne casse.
  const sansEnsPre = computeEffectifs([actif("x", "Moyenne Section A")], { ensC: [], ensL: [], ensP: [] });
  assert.equal(sansEnsPre.totPre, 1);
  assert.equal(sansEnsPre.ensPreCount, 0);
  assert.equal(sansEnsPre.totEnseignants, 0);
});

test("rapport annuel : la maternelle est notée sur 10 comme le primaire", () => {
  // Même moyenne de 6 partout : réussite sur 10, échec sur 20.
  const notes = ["pre1", "pri1", "col1"].flatMap((eleveId) => [
    { eleveId, note: 5, annee: ANNEE }, { eleveId, note: 7, annee: ANNEE },
  ]);
  const m = rapport({ eleves: ELEVES_ECOLE, notes, ...ENSEIGNANTS });
  const ligne = (classe) => m.lignesPedagogie.find((l) => l.classe === classe);

  assert.equal(ligne("Petite Section A").moyClasse, 6);
  assert.equal(ligne("Petite Section A").max, 10);
  assert.equal(ligne("Petite Section A").tauxReussite, 100);
  assert.equal(ligne("1ère Année A").max, 10);
  assert.equal(ligne("1ère Année A").tauxReussite, 100);
  assert.equal(ligne("7ème Année A").max, 20);
  assert.equal(ligne("7ème Année A").tauxReussite, 0);
  // Classe de maternelle sans note : barème sur 10, pas de taux.
  assert.equal(ligne("Maternelle B").max, 10);
  assert.equal(ligne("Maternelle B").tauxReussite, null);
});

test("rapport annuel imprimé : la maternelle (M) détaillée quand sa section est ouverte", () => {
  const m = rapport({ eleves: ELEVES_ECOLE, ...ENSEIGNANTS });

  assert.equal(detailKpi(m, CITADELLE, "Élèves actifs"), "2M · 1C · 2P");
  assert.equal(detailKpi(m, CITADELLE, "Enseignants"), "1M · 1C · 2P");

  // Maternelle fermée : pas de « M », même s'il reste des élèves.
  const sansMaternelle = { sectionsActives: ["primaire", "college", "lycee"] };
  assert.equal(detailKpi(m, sansMaternelle, "Élèves actifs"), "1C · 1L · 2P");

  // Réglage absent : toutes les sections sont ouvertes.
  assert.equal(detailKpi(m, {}, "Élèves actifs"), "2M · 1C · 1L · 2P");
  assert.equal(detailKpi(m, {}, "Enseignants"), "1M · 1C · 0L · 2P");
});

test("rapport annuel imprimé : sans effectif de maternelle, pas de « 0M » (comme la tuile du tableau de bord)", () => {
  // École sans maternelle, réglage absent : la ligne d'avant, inchangée.
  const eleves = ELEVES_ECOLE.filter((e) => !e._id.startsWith("pre"));
  const m = rapport({ eleves, ensC: [{}], ensL: [{}], ensP: [{}] });
  assert.equal(detailKpi(m, {}, "Élèves actifs"), "1C · 1L · 2P");
  assert.equal(detailKpi(m, {}, "Enseignants"), "1C · 1L · 1P");

  // Maternelle ouverte avec des élèves mais aucun enseignant enregistré.
  const m2 = rapport({ eleves: ELEVES_ECOLE, ensC: [{}], ensP: [{}] });
  assert.equal(detailKpi(m2, CITADELLE, "Élèves actifs"), "2M · 1C · 2P");
  assert.equal(detailKpi(m2, CITADELLE, "Enseignants"), "1C · 1P");
});

// ── Rapport annuel : une seule année ──
// Le tableau de bord transmet recettes, dépenses, fiches de paie et absences
// de toutes les années : « Oct » additionnait octobre 2025 et octobre 2026, et
// la pédagogie mélangeait les notes de toutes les années d'un élève.
test("rapport annuel : seule l'année du rapport compte (notes, finances, paie, absences)", () => {
  const AUTRE = "2025-2026";
  const m = rapport({
    eleves: ELEVES_ECOLE,
    ...ENSEIGNANTS,
    notes: [
      { eleveId: "pre1", note: 6, annee: ANNEE },
      { eleveId: "pre1", note: 1, annee: AUTRE },
      { eleveId: "pre1", note: 1 }, // sans année : rattachée à aucune
    ],
    recettes: [
      { annee: ANNEE, date: "2026-10-05", montant: 100 },
      { annee: AUTRE, date: "2025-10-05", montant: 1000 },
    ],
    depenses: [
      { annee: ANNEE, date: "2026-11-05", montant: 40 },
      { annee: AUTRE, date: "2025-11-05", montant: 400 },
    ],
    salaires: [
      { annee: ANNEE, mois: "Octobre", section: "Primaire", nom: "Instituteur", montantForfait: 30 },
      { annee: AUTRE, mois: "Octobre", section: "Primaire", nom: "Ancien", montantForfait: 300 },
    ],
    absences: [
      { eleveId: "pre1", date: "2026-11-03" }, // ISO (formulaires) → 2026-2027
      { eleveId: "pri1", date: "03/12/2026" }, // JJ/MM/AAAA (repli today()) → 2026-2027
      { eleveId: "col1", date: "2025-11-03" }, // → 2025-2026
      { eleveId: "col1", date: "hier" }, // illisible : rattachée à aucune année
    ],
  });

  const mois = (m3) => m.lignesFinance.find((l) => l.mois === m3);
  assert.equal(mois("Oct").recettes, 100);
  assert.equal(mois("Oct").salaires, 30);
  assert.equal(mois("Nov").depenses, 40);
  assert.deepEqual([m.totRecAnnuel, m.totDepAnnuel, m.totSalAnnuel, m.soldeAnnuel], [100, 40, 30, 30]);
  assert.deepEqual(m.lignesSalSection, [{ section: "Primaire", effectif: 1, masse: 30 }]);

  assert.equal(m.lignesPedagogie.find((l) => l.classe === "Petite Section A").moyClasse, 6);

  // Les absences de maternelle comptent comme les autres.
  assert.equal(m.totAbsences, 2);
  assert.deepEqual(m.topAbsences.map((a) => a.classe).sort(), ["1ère Année A", "Petite Section A"]);
});
