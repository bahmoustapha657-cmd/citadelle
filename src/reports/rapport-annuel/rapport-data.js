// ══════════════════════════════════════════════════════════════
//  Rapport annuel — agrégation des données (calculs purs)
// ══════════════════════════════════════════════════════════════
// Consolide effectifs, finances, mensualités, masse salariale, absences
// et performance pédagogique à partir des collections de l'année. Aucune
// dépendance au DOM : ne renvoie qu'un modèle exploité par le gabarit HTML.

import {
  CLASSES_LYCEE,
  CLASSES_PRIMAIRE,
  MOIS_ANNEE,
  TOUS_MOIS_COURTS,
  TOUS_MOIS_LONGS,
  getAnnee,
} from "../../constants.js";

// data = { annee, moisAnnee, eleves[], absences[], notes[], recettes[],
//          depenses[], salaires[], ensC[], ensL[], ensP[] }
export const computeRapportAnnuel = (data = {}) => {
  const {
    annee = getAnnee(),
    moisAnnee = MOIS_ANNEE,
    eleves = [],
    absences = [],
    notes = [],
    recettes = [],
    depenses = [],
    salaires = [],
    ensC = [],
    ensL = [],
    ensP = [],
  } = data;

  // ── Effectifs par section/classe ──
  const elevesActifs = eleves.filter((e) => e.statut === "Actif");
  const sectionPourEleve = (e) => {
    if (CLASSES_PRIMAIRE.includes(e.classe)) return "Primaire";
    if (CLASSES_LYCEE.includes(e.classe)) return "Lycée";
    return "Collège";
  };
  const effectifsClasse = {};
  for (const e of elevesActifs) {
    const cls = e.classe || "—";
    if (!effectifsClasse[cls]) effectifsClasse[cls] = { classe: cls, section: sectionPourEleve(e), effectif: 0 };
    effectifsClasse[cls].effectif++;
  }
  const lignesEffectif = Object.values(effectifsClasse).sort(
    (a, b) => (a.section + a.classe).localeCompare(b.section + b.classe, "fr"),
  );
  const totEleves = elevesActifs.length;
  const totC = elevesActifs.filter((e) => CLASSES_PRIMAIRE.indexOf(e.classe) === -1 && CLASSES_LYCEE.indexOf(e.classe) === -1).length;
  const totL = elevesActifs.filter((e) => CLASSES_LYCEE.includes(e.classe)).length;
  const totP = elevesActifs.filter((e) => CLASSES_PRIMAIRE.includes(e.classe)).length;
  const totEnseignants = ensC.length + ensL.length + ensP.length;

  // ── Finances mensuelles ──
  const moisCourt = (date) => {
    if (!date) return null;
    try {
      const d = new Date(date);
      if (Number.isNaN(d.getTime())) return null;
      const idx = d.getMonth();
      const correspondance = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
      return correspondance[idx];
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
    const isForfait = s.section === "Primaire" || s.section === "Personnel";
    const montant = isForfait
      ? Number(s.montantForfait || 0) - Number(s.bon || 0) + Number(s.revision || 0)
      : (Number(s.vhExecute || 0) + Number(s.cinqSem || 0)) * Number(s.primeHoraire || 0) - Number(s.bon || 0) + Number(s.revision || 0);
    salairesParMois[m] = (salairesParMois[m] || 0) + montant;
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

  // ── Mensualités : taux de recouvrement annuel ──
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

  // ── Absences (par classe et par élève) ──
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
  const totAbsences = absences.length;

  // ── Pédagogie : moyenne indicative par classe ──
  // Moyenne arithmétique (non pondérée par coefficient matière), suffisante
  // pour un indicateur de fin d'année. Le bulletin officiel reste la
  // référence pour la moyenne pondérée d'un élève donné.
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
    .sort((a, b) => (a.section + a.classe).localeCompare(b.section + b.classe, "fr"));

  // ── Mensualités par classe ──
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
    .sort((a, b) => (a.section + a.classe).localeCompare(b.section + b.classe, "fr"));

  // ── Salaires par section ──
  const salairesParSection = {};
  for (const s of salaires) {
    const sec = s.section || "—";
    if (!salairesParSection[sec]) salairesParSection[sec] = { section: sec, effectif: new Set(), masse: 0 };
    const isForfait = sec === "Primaire" || sec === "Personnel";
    const net = isForfait
      ? Number(s.montantForfait || 0) - Number(s.bon || 0) + Number(s.revision || 0)
      : (Number(s.vhExecute || 0) + Number(s.cinqSem || 0)) * Number(s.primeHoraire || 0) - Number(s.bon || 0) + Number(s.revision || 0);
    salairesParSection[sec].masse += net;
    if (s.nom) salairesParSection[sec].effectif.add(s.nom);
  }
  const lignesSalSection = Object.values(salairesParSection)
    .map((sec) => ({ section: sec.section, effectif: sec.effectif.size, masse: sec.masse }))
    .sort((a, b) => b.masse - a.masse);
  const masseTotale = lignesSalSection.reduce((s, l) => s + l.masse, 0);

  return {
    annee, moisAnnee,
    lignesEffectif, totEleves, totC, totL, totP, totEnseignants,
    ensCCount: ensC.length, ensLCount: ensL.length, ensPCount: ensP.length,
    lignesFinance, totRecAnnuel, totDepAnnuel, totSalAnnuel, soldeAnnuel, maxFinance,
    totalDu, totalPercu, tauxRecouvrement,
    topAbsences, topElevesAbsents, totAbsences,
    lignesPedagogie, lignesMens, lignesSalSection, masseTotale,
  };
};
