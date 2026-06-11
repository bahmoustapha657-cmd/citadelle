// ══════════════════════════════════════════════════════════════
//  Rapport annuel — sections d'agrégation (calculs purs)
// ══════════════════════════════════════════════════════════════
// Chaque fonction produit une tranche du modèle final ; computeRapportAnnuel
// (rapport-data.js) les compose. Aucune dépendance au DOM.

import {
  TOUS_MOIS_COURTS,
  TOUS_MOIS_LONGS,
  getSectionForClasse,
} from "../../constants.js";

// Section d'un élève d'après sa classe (détection par motif : couvre les
// classes hors listes prédéfinies, ex. « 3ème Année E »).
export const sectionPourEleve = (e) => {
  const section = getSectionForClasse(e.classe);
  return section === "primaire" ? "Primaire" : section === "lycee" ? "Lycée" : "Collège";
};

// Net d'une fiche de paie (forfait pour Primaire/Personnel, VH sinon).
const netSalaire = (s) => {
  const isForfait = s.section === "Primaire" || s.section === "Personnel";
  return isForfait
    ? Number(s.montantForfait || 0) - Number(s.bon || 0) + Number(s.revision || 0)
    : (Number(s.vhExecute || 0) + Number(s.cinqSem || 0)) * Number(s.primeHoraire || 0) - Number(s.bon || 0) + Number(s.revision || 0);
};

const triSectionClasse = (a, b) => (a.section + a.classe).localeCompare(b.section + b.classe, "fr");

// ── Effectifs par section/classe ──
export function computeEffectifs(elevesActifs, { ensC, ensL, ensP }) {
  const effectifsClasse = {};
  for (const e of elevesActifs) {
    const cls = e.classe || "—";
    if (!effectifsClasse[cls]) effectifsClasse[cls] = { classe: cls, section: sectionPourEleve(e), effectif: 0 };
    effectifsClasse[cls].effectif++;
  }
  const lignesEffectif = Object.values(effectifsClasse).sort(triSectionClasse);
  const totEleves = elevesActifs.length;
  const totC = elevesActifs.filter((e) => getSectionForClasse(e.classe) === "college").length;
  const totL = elevesActifs.filter((e) => getSectionForClasse(e.classe) === "lycee").length;
  const totP = elevesActifs.filter((e) => getSectionForClasse(e.classe) === "primaire").length;
  const totEnseignants = ensC.length + ensL.length + ensP.length;
  return {
    lignesEffectif, totEleves, totC, totL, totP, totEnseignants,
    ensCCount: ensC.length, ensLCount: ensL.length, ensPCount: ensP.length,
  };
}

// ── Finances mensuelles ──
export function computeFinances(moisAnnee, { recettes, depenses, salaires }) {
  const moisCourt = (date) => {
    if (!date) return null;
    try {
      const d = new Date(date);
      if (Number.isNaN(d.getTime())) return null;
      const correspondance = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
      return correspondance[d.getMonth()];
    } catch {
      return null;
    }
  };
  const recettesParMois = {};
  const depensesParMois = {};
  for (const r of recettes) {
    const m = moisCourt(r.date);
    if (m) recettesParMois[m] = (recettesParMois[m] || 0) + Number(r.montant || 0);
  }
  for (const d of depenses) {
    const m = moisCourt(d.date);
    if (m) depensesParMois[m] = (depensesParMois[m] || 0) + Number(d.montant || 0);
  }
  const salairesParMois = {};
  for (const s of salaires) {
    if (!s.mois) continue;
    const m = TOUS_MOIS_LONGS.indexOf(s.mois) >= 0 ? TOUS_MOIS_COURTS[TOUS_MOIS_LONGS.indexOf(s.mois)] : s.mois.slice(0, 3);
    salairesParMois[m] = (salairesParMois[m] || 0) + netSalaire(s);
  }
  const lignesFinance = moisAnnee.map((m) => {
    const rec = recettesParMois[m] || 0;
    const dep = depensesParMois[m] || 0;
    const sal = salairesParMois[m] || 0;
    return { mois: m, recettes: rec, depenses: dep, salaires: sal, solde: rec - dep - sal };
  });
  const totRecAnnuel = lignesFinance.reduce((s, l) => s + l.recettes, 0);
  const totDepAnnuel = lignesFinance.reduce((s, l) => s + l.depenses, 0);
  const totSalAnnuel = lignesFinance.reduce((s, l) => s + l.salaires, 0);
  const soldeAnnuel = totRecAnnuel - totDepAnnuel - totSalAnnuel;
  const maxFinance = Math.max(...lignesFinance.map((l) => Math.max(l.recettes, l.depenses, l.salaires)), 1);
  return { lignesFinance, totRecAnnuel, totDepAnnuel, totSalAnnuel, soldeAnnuel, maxFinance };
}

// ── Mensualités : taux de recouvrement annuel global ──
export function computeRecouvrement(elevesActifs, moisAnnee) {
  let totalDu = 0;
  let totalPercu = 0;
  for (const e of elevesActifs) {
    const mens = e.mens || {};
    for (const mois of moisAnnee) {
      totalDu++;
      if (mens[mois] === "Payé") totalPercu++;
    }
  }
  const tauxRecouvrement = totalDu > 0 ? Math.round((totalPercu / totalDu) * 100) : 0;
  return { totalDu, totalPercu, tauxRecouvrement };
}

// ── Absences (par classe et par élève) ──
export function computeAbsences(absences, elevesActifs) {
  const absencesParClasse = {};
  const absencesParEleve = {};
  for (const a of absences) {
    const eleveAbs = elevesActifs.find((e) => e._id === a.eleveId || `${e.nom} ${e.prenom}` === a.eleveNom);
    if (!eleveAbs) continue;
    const cls = eleveAbs.classe || "—";
    if (!absencesParClasse[cls]) absencesParClasse[cls] = { classe: cls, total: 0, justif: 0, nonJust: 0 };
    absencesParClasse[cls].total++;
    if (a.justifie === "Oui") absencesParClasse[cls].justif++;
    else absencesParClasse[cls].nonJust++;
    const eleveKey = eleveAbs._id || `${eleveAbs.nom} ${eleveAbs.prenom}`;
    if (!absencesParEleve[eleveKey]) {
      absencesParEleve[eleveKey] = {
        nom: `${eleveAbs.nom || ""} ${eleveAbs.prenom || ""}`.trim(),
        classe: cls,
        total: 0,
        justif: 0,
        nonJust: 0,
      };
    }
    absencesParEleve[eleveKey].total++;
    if (a.justifie === "Oui") absencesParEleve[eleveKey].justif++;
    else absencesParEleve[eleveKey].nonJust++;
  }
  const topAbsences = Object.values(absencesParClasse).sort((a, b) => b.total - a.total).slice(0, 10);
  const topElevesAbsents = Object.values(absencesParEleve).sort((a, b) => b.total - a.total).slice(0, 10);
  return { topAbsences, topElevesAbsents, totAbsences: absences.length };
}

// ── Pédagogie : moyenne indicative par classe ──
// Moyenne arithmétique (non pondérée par coefficient matière), suffisante
// pour un indicateur de fin d'année. Le bulletin officiel reste la
// référence pour la moyenne pondérée d'un élève donné.
export function computePedagogie(elevesActifs, notes) {
  const notesParEleve = {};
  for (const n of notes) {
    if (n.eleveId == null) continue;
    const val = Number(n.note);
    if (!Number.isFinite(val)) continue;
    if (!notesParEleve[n.eleveId]) notesParEleve[n.eleveId] = [];
    notesParEleve[n.eleveId].push(val);
  }
  const moyennesParClasse = {};
  for (const e of elevesActifs) {
    const cls = e.classe || "—";
    if (!moyennesParClasse[cls]) {
      moyennesParClasse[cls] = { classe: cls, section: sectionPourEleve(e), effectif: 0, moyennes: [] };
    }
    moyennesParClasse[cls].effectif++;
    const notesEleve = notesParEleve[e._id] || [];
    if (notesEleve.length > 0) {
      const moy = notesEleve.reduce((s, v) => s + v, 0) / notesEleve.length;
      moyennesParClasse[cls].moyennes.push(moy);
    }
  }
  const lignesPedagogie = Object.values(moyennesParClasse)
    .map((g) => {
      const moys = g.moyennes;
      const seuil = g.section === "Primaire" ? 5 : 10; // /10 pour primaire, /20 sinon
      const max = g.section === "Primaire" ? 10 : 20;
      const moyClasse = moys.length > 0 ? moys.reduce((s, v) => s + v, 0) / moys.length : null;
      const reussite = moys.filter((m) => m >= seuil).length;
      const tauxReussite = moys.length > 0 ? Math.round((reussite / moys.length) * 100) : null;
      return { classe: g.classe, section: g.section, effectif: g.effectif, nbAvecNotes: moys.length, moyClasse, max, tauxReussite };
    })
    .sort(triSectionClasse);
  return { lignesPedagogie };
}

// ── Mensualités par classe ──
export function computeMensParClasse(elevesActifs, moisAnnee) {
  const mensParClasse = {};
  for (const e of elevesActifs) {
    const cls = e.classe || "—";
    if (!mensParClasse[cls]) {
      mensParClasse[cls] = { classe: cls, section: sectionPourEleve(e), effectif: 0, due: 0, paye: 0 };
    }
    mensParClasse[cls].effectif++;
    const mens = e.mens || {};
    for (const mois of moisAnnee) {
      mensParClasse[cls].due++;
      if (mens[mois] === "Payé") mensParClasse[cls].paye++;
    }
  }
  const lignesMens = Object.values(mensParClasse)
    .map((m) => ({ ...m, taux: m.due > 0 ? Math.round((m.paye / m.due) * 100) : 0 }))
    .sort(triSectionClasse);
  return { lignesMens };
}

// ── Salaires par section ──
export function computeSalairesSection(salaires) {
  const salairesParSection = {};
  for (const s of salaires) {
    const sec = s.section || "—";
    if (!salairesParSection[sec]) salairesParSection[sec] = { section: sec, effectif: new Set(), masse: 0 };
    salairesParSection[sec].masse += netSalaire(s);
    if (s.nom) salairesParSection[sec].effectif.add(s.nom);
  }
  const lignesSalSection = Object.values(salairesParSection)
    .map((sec) => ({ section: sec.section, effectif: sec.effectif.size, masse: sec.masse }))
    .sort((a, b) => b.masse - a.masse);
  const masseTotale = lignesSalSection.reduce((s, l) => s + l.masse, 0);
  return { lignesSalSection, masseTotale };
}
