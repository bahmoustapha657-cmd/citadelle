// ══════════════════════════════════════════════════════════════
//  Rapport annuel — Bilan de fin d'année (DG)
// ══════════════════════════════════════════════════════════════
// Produit un PDF "bilan annuel" consolidant effectifs, finances,
// mensualités, masse salariale et absences sur tous les mois de
// l'année scolaire. Lancé depuis TableauDeBord — destiné à la DG
// et à l'archivage en fin d'année.

import {
  CLASSES_LYCEE,
  CLASSES_PRIMAIRE,
  MOIS_ANNEE,
  TOUS_MOIS_COURTS,
  TOUS_MOIS_LONGS,
  fmt,
  getAnnee,
  today,
} from "../constants.js";
import {
  PRINT_RESET,
  PRINT_TRIGGER,
  WATERMARK_CSS,
  printDir,
  printLang,
  tr,
  watermarkHtml,
} from "./print-helpers.js";

// data = { annee, moisAnnee, eleves[], absences[], notes[], recettes[],
//          depenses[], salaires[], ensC[], ensL[], ensP[] }
export const genererRapportAnnuel = (data = {}, schoolInfo = {}) => {
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

  if (!eleves.length && !recettes.length && !salaires.length) {
    alert(tr("reports.annualReport.noData") || "Pas assez de données pour générer un rapport annuel.");
    return;
  }

  const c1 = schoolInfo.couleur1 || "#0A1628";
  const c2 = schoolInfo.couleur2 || "#00C48C";
  const nomEcole = schoolInfo.nom || "École";
  const logo = schoolInfo.logo || "";

  const fmtMoney = (n) => fmt(Math.round(Number(n) || 0));

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

  // ── Pavé HTML ──
  const barreLargeur = (value, max) => Math.max(0, Math.min(100, max > 0 ? Math.round((value / max) * 100) : 0));
  const maxFinance = Math.max(...lignesFinance.map((l) => Math.max(l.recettes, l.depenses, l.salaires)), 1);

  const w = window.open("", "_blank");
  w.document.write(`<!DOCTYPE html><html lang="${printLang()}" dir="${printDir()}"><head>
  <meta charset="utf-8"/>
  <title>${tr("reports.annualReport.title") || "Rapport annuel"} ${annee} — ${nomEcole}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
    ${PRINT_RESET}
    *{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
    body{font-family:'Inter',Arial,sans-serif;color:#1e293b;font-size:11px;line-height:1.5;background:#fff;padding:12mm}

    .header{display:flex;align-items:center;gap:14px;padding-bottom:10px;border-bottom:3px solid ${c1};margin-bottom:14px}
    .header-logo{width:56px;height:56px;flex-shrink:0;object-fit:contain}
    .header-logo-ph{width:56px;height:56px;flex-shrink:0;background:${c1};border-radius:8px;display:flex;align-items:center;justify-content:center;color:${c2};font-size:14px;font-weight:900}
    .header-text{flex:1}
    .header-ecole{font-size:17px;font-weight:900;color:${c1}}
    .header-sub{font-size:10px;color:#64748b;margin-top:2px}
    .header-badge{background:${c1};color:#fff;padding:6px 14px;border-radius:8px;text-align:center;min-width:90px}
    .header-badge-title{font-size:9px;text-transform:uppercase;letter-spacing:.08em;opacity:.7}
    .header-badge-val{font-size:13px;font-weight:900}

    .kpi-row{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin-bottom:14px}
    .kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px;text-align:center}
    .kpi-val{font-size:18px;font-weight:900;color:${c1};line-height:1.1}
    .kpi-label{font-size:8.5px;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-top:3px}
    .kpi-sub{font-size:9px;color:#94a3b8;margin-top:1px}
    .kpi.vert .kpi-val{color:#059669}
    .kpi.rouge .kpi-val{color:#dc2626}
    .kpi.amber .kpi-val{color:#d97706}

    .section-title{font-size:11px;font-weight:800;color:${c1};text-transform:uppercase;letter-spacing:.06em;margin:14px 0 6px;padding-left:8px;border-left:3px solid ${c2}}
    .section-title.page-break{page-break-before:always}

    table{width:100%;border-collapse:collapse;margin-bottom:10px;font-size:10px}
    thead tr{background:${c1};color:#fff}
    th{padding:5px 7px;text-align:left;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em}
    td{padding:4px 7px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
    tr:nth-child(even) td{background:#f8fafc}
    tfoot tr{background:#eef2f7;font-weight:800}
    .num{text-align:right;font-variant-numeric:tabular-nums}

    .bar{display:inline-block;height:6px;border-radius:3px;background:${c2};vertical-align:middle;margin-right:4px}

    .footer{margin-top:18px;padding-top:8px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:9px;color:#94a3b8}
    .sigs{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:24px}
    .sig{border-top:1.5px solid ${c1};padding-top:8px;text-align:center;font-size:10px;color:#475569;font-weight:600}

    @media print{button{display:none}}
    ${WATERMARK_CSS}
  </style></head><body>
  ${watermarkHtml(schoolInfo)}

  <div class="header">
    ${logo
      ? `<img src="${logo}" class="header-logo"/>`
      : `<div class="header-logo-ph">${nomEcole.slice(0, 2).toUpperCase()}</div>`}
    <div class="header-text">
      <div class="header-ecole">${nomEcole}</div>
      <div class="header-sub">${tr("reports.annualReport.title") || "Rapport annuel"} · ${tr("reports.schoolYear") || "Année scolaire"} <strong>${annee}</strong></div>
    </div>
    <div class="header-badge">
      <div class="header-badge-title">${tr("reports.period") || "Période"}</div>
      <div class="header-badge-val">${annee}</div>
    </div>
  </div>

  <div class="kpi-row">
    <div class="kpi"><div class="kpi-val">${totEleves}</div><div class="kpi-label">Élèves actifs</div><div class="kpi-sub">${totC}C · ${totL}L · ${totP}P</div></div>
    <div class="kpi"><div class="kpi-val">${totEnseignants}</div><div class="kpi-label">Enseignants</div><div class="kpi-sub">${ensC.length}C · ${ensL.length}L · ${ensP.length}P</div></div>
    <div class="kpi vert"><div class="kpi-val">${fmtMoney(totRecAnnuel)}</div><div class="kpi-label">Recettes</div></div>
    <div class="kpi rouge"><div class="kpi-val">${fmtMoney(totDepAnnuel + totSalAnnuel)}</div><div class="kpi-label">Dépenses+Salaires</div><div class="kpi-sub">${fmtMoney(totDepAnnuel)} + ${fmtMoney(totSalAnnuel)}</div></div>
    <div class="kpi ${soldeAnnuel >= 0 ? "vert" : "rouge"}"><div class="kpi-val">${fmtMoney(soldeAnnuel)}</div><div class="kpi-label">Solde annuel</div></div>
    <div class="kpi ${tauxRecouvrement >= 80 ? "vert" : tauxRecouvrement >= 50 ? "amber" : "rouge"}"><div class="kpi-val">${tauxRecouvrement}%</div><div class="kpi-label">Recouvrement</div><div class="kpi-sub">${totalPercu}/${totalDu}</div></div>
  </div>

  <div class="section-title">Effectifs par classe</div>
  <table>
    <thead><tr><th>Classe</th><th>Section</th><th class="num">Effectif</th><th class="num">%</th></tr></thead>
    <tbody>
      ${lignesEffectif.map((l) => `<tr>
        <td><strong>${l.classe}</strong></td>
        <td>${l.section}</td>
        <td class="num">${l.effectif}</td>
        <td class="num">${totEleves > 0 ? Math.round((l.effectif / totEleves) * 100) : 0}%</td>
      </tr>`).join("")}
    </tbody>
    <tfoot><tr><td>Total</td><td>—</td><td class="num">${totEleves}</td><td class="num">100%</td></tr></tfoot>
  </table>

  <div class="section-title">Finances mensuelles (${moisAnnee.length} mois)</div>
  <table>
    <thead><tr>
      <th>Mois</th>
      <th class="num">Recettes</th>
      <th class="num">Dépenses</th>
      <th class="num">Salaires</th>
      <th class="num">Solde</th>
      <th>Tendance</th>
    </tr></thead>
    <tbody>
      ${lignesFinance.map((l) => `<tr>
        <td><strong>${l.mois}</strong></td>
        <td class="num" style="color:#059669">${fmtMoney(l.recettes)}</td>
        <td class="num" style="color:#dc2626">${fmtMoney(l.depenses)}</td>
        <td class="num" style="color:#7c3aed">${fmtMoney(l.salaires)}</td>
        <td class="num" style="font-weight:800;color:${l.solde >= 0 ? "#059669" : "#dc2626"}">${fmtMoney(l.solde)}</td>
        <td><span class="bar" style="width:${barreLargeur(l.recettes, maxFinance)}%;background:#059669"></span><span class="bar" style="width:${barreLargeur(l.depenses + l.salaires, maxFinance)}%;background:#dc2626"></span></td>
      </tr>`).join("")}
    </tbody>
    <tfoot><tr>
      <td>Total annuel</td>
      <td class="num">${fmtMoney(totRecAnnuel)}</td>
      <td class="num">${fmtMoney(totDepAnnuel)}</td>
      <td class="num">${fmtMoney(totSalAnnuel)}</td>
      <td class="num" style="color:${soldeAnnuel >= 0 ? "#059669" : "#dc2626"}">${fmtMoney(soldeAnnuel)}</td>
      <td></td>
    </tr></tfoot>
  </table>

  <div class="section-title page-break">Performance pédagogique par classe</div>
  ${lignesPedagogie.length === 0
    ? `<p style="font-size:11px;color:#94a3b8;font-style:italic;margin:6px 0">Aucune note enregistrée sur l'année.</p>`
    : `<table>
        <thead><tr>
          <th>Classe</th>
          <th>Section</th>
          <th class="num">Effectif</th>
          <th class="num">Notés</th>
          <th class="num">Moy. classe</th>
          <th class="num">% réussite</th>
        </tr></thead>
        <tbody>
          ${lignesPedagogie.map((p) => `<tr>
            <td><strong>${p.classe}</strong></td>
            <td>${p.section}</td>
            <td class="num">${p.effectif}</td>
            <td class="num">${p.nbAvecNotes}</td>
            <td class="num" style="font-weight:800;color:${p.moyClasse == null ? "#94a3b8" : p.moyClasse >= (p.max / 2) ? "#059669" : "#dc2626"}">${p.moyClasse == null ? "—" : `${p.moyClasse.toFixed(2)} / ${p.max}`}</td>
            <td class="num" style="font-weight:700;color:${p.tauxReussite == null ? "#94a3b8" : p.tauxReussite >= 60 ? "#059669" : p.tauxReussite >= 40 ? "#d97706" : "#dc2626"}">${p.tauxReussite == null ? "—" : `${p.tauxReussite}%`}</td>
          </tr>`).join("")}
        </tbody>
      </table>
      <p style="font-size:9px;color:#94a3b8;font-style:italic;margin:4px 0 0">Moyenne indicative (arithmétique non pondérée). Le bulletin officiel reste la référence pour la moyenne par coefficient.</p>`}

  <div class="section-title">Mensualités — recouvrement par classe</div>
  ${lignesMens.length === 0
    ? `<p style="font-size:11px;color:#94a3b8;font-style:italic;margin:6px 0">Aucune donnée de mensualité.</p>`
    : `<table>
        <thead><tr>
          <th>Classe</th>
          <th>Section</th>
          <th class="num">Effectif</th>
          <th class="num">Mois dus</th>
          <th class="num">Mois payés</th>
          <th class="num">Impayés</th>
          <th class="num">Taux</th>
        </tr></thead>
        <tbody>
          ${lignesMens.map((m) => `<tr>
            <td><strong>${m.classe}</strong></td>
            <td>${m.section}</td>
            <td class="num">${m.effectif}</td>
            <td class="num">${m.due}</td>
            <td class="num" style="color:#059669">${m.paye}</td>
            <td class="num" style="color:#dc2626">${m.due - m.paye}</td>
            <td class="num" style="font-weight:800;color:${m.taux >= 80 ? "#059669" : m.taux >= 50 ? "#d97706" : "#dc2626"}">${m.taux}%</td>
          </tr>`).join("")}
        </tbody>
        <tfoot><tr>
          <td>Total annuel</td><td>—</td>
          <td class="num">${totEleves}</td>
          <td class="num">${totalDu}</td>
          <td class="num">${totalPercu}</td>
          <td class="num">${totalDu - totalPercu}</td>
          <td class="num">${tauxRecouvrement}%</td>
        </tr></tfoot>
      </table>`}

  <div class="section-title page-break">Masse salariale par section</div>
  ${lignesSalSection.length === 0
    ? `<p style="font-size:11px;color:#94a3b8;font-style:italic;margin:6px 0">Aucune fiche de paie enregistrée.</p>`
    : `<table>
        <thead><tr>
          <th>Section</th>
          <th class="num">Effectif distinct</th>
          <th class="num">Masse annuelle</th>
          <th class="num">% du total</th>
        </tr></thead>
        <tbody>
          ${lignesSalSection.map((sec) => `<tr>
            <td><strong>${sec.section}</strong></td>
            <td class="num">${sec.effectif}</td>
            <td class="num">${fmtMoney(sec.masse)}</td>
            <td class="num">${masseTotale > 0 ? Math.round((sec.masse / masseTotale) * 100) : 0}%</td>
          </tr>`).join("")}
        </tbody>
        <tfoot><tr>
          <td>Total</td><td class="num">—</td>
          <td class="num">${fmtMoney(masseTotale)}</td>
          <td class="num">100%</td>
        </tr></tfoot>
      </table>`}

  <div class="section-title">Absences — Top 10 classes</div>
  ${topAbsences.length === 0
    ? `<p style="font-size:11px;color:#94a3b8;font-style:italic;margin:6px 0">Aucune absence enregistrée sur l'année.</p>`
    : `<table>
        <thead><tr><th>Classe</th><th class="num">Total</th><th class="num">Justifiées</th><th class="num">Non justifiées</th></tr></thead>
        <tbody>
          ${topAbsences.map((a) => `<tr>
            <td><strong>${a.classe}</strong></td>
            <td class="num">${a.total}</td>
            <td class="num" style="color:#059669">${a.justif}</td>
            <td class="num" style="color:#dc2626">${a.nonJust}</td>
          </tr>`).join("")}
        </tbody>
        <tfoot><tr><td>Total annuel (toutes classes)</td><td class="num">${totAbsences}</td><td class="num">—</td><td class="num">—</td></tr></tfoot>
      </table>`}

  <div class="section-title">Absences — Top 10 élèves</div>
  ${topElevesAbsents.length === 0
    ? `<p style="font-size:11px;color:#94a3b8;font-style:italic;margin:6px 0">Aucun élève absentéiste détecté.</p>`
    : `<table>
        <thead><tr><th>Élève</th><th>Classe</th><th class="num">Total</th><th class="num">Justifiées</th><th class="num">Non justifiées</th></tr></thead>
        <tbody>
          ${topElevesAbsents.map((e) => `<tr>
            <td><strong>${e.nom}</strong></td>
            <td>${e.classe}</td>
            <td class="num" style="font-weight:800;color:${e.total >= 10 ? "#dc2626" : "#1e293b"}">${e.total}</td>
            <td class="num" style="color:#059669">${e.justif}</td>
            <td class="num" style="color:#dc2626">${e.nonJust}</td>
          </tr>`).join("")}
        </tbody>
      </table>`}

  <div class="sigs">
    <div class="sig">Directeur Général<br/><br/><br/>Signature & Cachet</div>
    <div class="sig">Fondateur / Conseil d'administration<br/><br/><br/>Signature</div>
  </div>

  <div class="footer">
    <span>${nomEcole} · ${tr("reports.annualReport.title") || "Rapport annuel"} ${annee}</span>
    <span>Édité le ${today()}</span>
  </div>

  <script>${PRINT_TRIGGER}</script>
  </body></html>`);
  w.document.close();
};
