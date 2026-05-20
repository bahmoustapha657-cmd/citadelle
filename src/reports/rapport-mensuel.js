// ══════════════════════════════════════════════════════════════
//  Rapport mensuel — Absences + Paiements par classe
// ══════════════════════════════════════════════════════════════
// Bilan de fin de mois (DG/comptable) : taux de paiement, absences
// justifiées/non, liste des élèves avec ≥ 3 absences.

import {
  PRINT_RESET,
  PRINT_TRIGGER,
  WATERMARK_CSS,
  printDir,
  printLang,
  tr,
  watermarkHtml,
} from "./print-helpers.js";

/**
 * Rapport mensuel complet : absences + paiements par classe
 * @param {string} mois  — ex: "Novembre"
 * @param {Array}  eleves — tous les élèves (primaire + collège fusionnés)
 * @param {Array}  absences — collection absences
 * @param {string} annee — ex: "2025-2026"
 * @param {Object} schoolInfo
 * @param {Array}  moisAnnee — liste des mois de l'année scolaire
 */
export const genererRapportMensuel = (mois, eleves, absences, annee, schoolInfo={}, _moisAnnee=[]) => {
  if(!eleves.length){ alert("Aucun élève."); return; }
  void _moisAnnee;
  const c1 = schoolInfo.couleur1||"#0A1628";
  const c2 = schoolInfo.couleur2||"#00C48C";
  const nomEcole = schoolInfo.nom||"École";
  const logo = schoolInfo.logo||"";

  // Absences du mois sélectionné
  const absences_mois = absences.filter(a => a.date && a.date.startsWith
    ? a.date.includes(mois) || (() => {
        try { return new Date(a.date).toLocaleDateString("fr-FR",{month:"long"}).toLowerCase() === mois.toLowerCase(); } catch { return false; }
      })()
    : false
  );

  // Grouper par classe
  const classes = [...new Set(eleves.map(e=>e.classe||"Sans classe"))].sort();

  const lignesClasse = classes.map(classe => {
    const elevesClasse = eleves.filter(e=>(e.classe||"Sans classe")===classe);
    const absClasse = absences_mois.filter(a => elevesClasse.some(e=>e._id===a.eleveId||(e.nom+" "+e.prenom)===a.eleveNom));
    const absJustif = absClasse.filter(a=>a.justifie==="Oui").length;
    const absNonJust = absClasse.filter(a=>a.justifie!=="Oui").length;
    // Paiements : compter payés vs impayés pour ce mois
    const payesMois = elevesClasse.filter(e=>(e.mens||{})[mois]==="Payé").length;
    const tauxPaye = elevesClasse.length ? Math.round(payesMois/elevesClasse.length*100) : 0;
    return { classe, effectif:elevesClasse.length, absJustif, absNonJust, total:absJustif+absNonJust, payesMois, tauxPaye };
  });

  const totEffectif = lignesClasse.reduce((s,l)=>s+l.effectif,0);
  const totAbsJ = lignesClasse.reduce((s,l)=>s+l.absJustif,0);
  const totAbsN = lignesClasse.reduce((s,l)=>s+l.absNonJust,0);
  const totPaye = lignesClasse.reduce((s,l)=>s+l.payesMois,0);
  const tauxGlobal = totEffectif ? Math.round(totPaye/totEffectif*100) : 0;

  // Élèves avec absences répétées (≥ 3 ce mois)
  const elevesConcernes = eleves.map(e => {
    const abs = absences_mois.filter(a=>a.eleveId===e._id||(e.nom+" "+e.prenom)===a.eleveNom);
    return { ...e, nbAbs: abs.length };
  }).filter(e=>e.nbAbs>=3).sort((a,b)=>b.nbAbs-a.nbAbs).slice(0,15);

  const w = window.open("","_blank");
  w.document.write(`<!DOCTYPE html><html lang="${printLang()}" dir="${printDir()}"><head>
  <meta charset="utf-8"/>
  <title>${tr("reports.monthlyReport.title")} ${mois} ${annee} — ${nomEcole}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
    ${PRINT_RESET}
    *{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
    body{font-family:'Inter',Arial,sans-serif;color:#1e293b;font-size:11px;line-height:1.5;background:#fff;padding:15mm 12mm}

    /* En-tête */
    .header{display:flex;align-items:center;gap:14px;padding-bottom:10px;border-bottom:3px solid ${c1};margin-bottom:16px}
    .header-logo{width:52px;height:52px;flex-shrink:0;object-fit:contain}
    .header-logo-ph{width:52px;height:52px;flex-shrink:0;background:${c1};border-radius:8px;display:flex;align-items:center;justify-content:center;color:${c2};font-size:14px;font-weight:900}
    .header-text{flex:1}
    .header-ecole{font-size:16px;font-weight:900;color:${c1}}
    .header-sub{font-size:10px;color:#64748b;margin-top:2px}
    .header-badge{background:${c1};color:${c2};padding:6px 14px;border-radius:8px;text-align:center}
    .header-badge-title{font-size:9px;text-transform:uppercase;letter-spacing:.08em;opacity:.7}
    .header-badge-val{font-size:13px;font-weight:900}

    /* KPI cards */
    .kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px}
    .kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;text-align:center}
    .kpi-val{font-size:22px;font-weight:900;color:${c1};line-height:1}
    .kpi-label{font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-top:3px}
    .kpi-sub{font-size:10px;color:#94a3b8;margin-top:2px}
    .kpi.vert .kpi-val{color:#059669}
    .kpi.rouge .kpi-val{color:#dc2626}
    .kpi.amber .kpi-val{color:#d97706}

    /* Section titre */
    .section-title{font-size:11px;font-weight:800;color:${c1};text-transform:uppercase;letter-spacing:.06em;margin:16px 0 8px;padding-left:8px;border-left:3px solid ${c2}}

    /* Tables */
    table{width:100%;border-collapse:collapse;margin-bottom:12px;font-size:10px}
    thead tr{background:${c1};color:#fff}
    th{padding:6px 8px;text-align:left;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em}
    td{padding:5px 8px;border-bottom:1px solid #f1f5f9}
    tr:nth-child(even) td{background:#f8fafc}
    .pct-bar{display:inline-block;height:6px;border-radius:3px;background:${c2};vertical-align:middle;margin-right:4px}

    /* Alerte */
    .alert-box{background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 14px;margin-bottom:12px}
    .alert-title{font-size:11px;font-weight:800;color:#991b1b;margin-bottom:6px}

    /* Footer */
    .page-footer{margin-top:24px;padding-top:10px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:9px;color:#94a3b8}

    @media print{button{display:none}}
    ${WATERMARK_CSS}
  </style></head><body>
  ${watermarkHtml(schoolInfo)}

  <div class="header">
    ${logo
      ?`<img src="${logo}" class="header-logo"/>`
      :`<div class="header-logo-ph">${nomEcole.slice(0,2).toUpperCase()}</div>`}
    <div class="header-text">
      <div class="header-ecole">${nomEcole}</div>
      <div class="header-sub">${tr("reports.monthlyReport.title")} • ${tr("reports.schoolYear")} ${annee}</div>
    </div>
    <div class="header-badge">
      <div class="header-badge-title">${tr("reports.period")}</div>
      <div class="header-badge-val">${mois}</div>
    </div>
  </div>

  <div class="kpi-row">
    <div class="kpi"><div class="kpi-val">${totEffectif}</div><div class="kpi-label">${tr("reports.monthlyReport.totalStudents")}</div><div class="kpi-sub">${classes.length}</div></div>
    <div class="kpi amber"><div class="kpi-val">${totAbsJ+totAbsN}</div><div class="kpi-label">${tr("reports.absences")}</div><div class="kpi-sub">${totAbsJ} ${tr("reports.justified")} · ${totAbsN} ${tr("reports.unjustified")}</div></div>
    <div class="kpi ${tauxGlobal>=80?"vert":tauxGlobal>=50?"amber":"rouge"}"><div class="kpi-val">${tauxGlobal}%</div><div class="kpi-label">${tr("accounting.rate")}</div><div class="kpi-sub">${totPaye}/${totEffectif}</div></div>
    <div class="kpi"><div class="kpi-val">${elevesConcernes.length}</div><div class="kpi-label">${tr("reports.absences")}</div><div class="kpi-sub">≥ 3</div></div>
  </div>

  <div class="section-title">${tr("reports.monthlyReport.stats")}</div>
  <table>
    <thead><tr>
      <th>${tr("reports.class")}</th><th>${tr("school.classes.students")}</th><th>${tr("reports.absences")} ${tr("reports.justified")}</th><th>${tr("reports.absences")} ${tr("reports.unjustified")}</th><th>${tr("common.total")}</th><th>${tr("accounting.tabs.monthlyFees")}</th><th>${tr("accounting.rate")}</th>
    </tr></thead>
    <tbody>
      ${lignesClasse.map(l=>`<tr>
        <td><strong>${l.classe}</strong></td>
        <td style="text-align:center">${l.effectif}</td>
        <td style="text-align:center;color:#059669">${l.absJustif}</td>
        <td style="text-align:center;color:#dc2626">${l.absNonJust}</td>
        <td style="text-align:center;font-weight:700">${l.total}</td>
        <td style="text-align:center">${l.payesMois}/${l.effectif}</td>
        <td>
          <span class="pct-bar" style="width:${l.tauxPaye*0.5}px"></span>
          <strong style="color:${l.tauxPaye>=80?"#059669":l.tauxPaye>=50?"#d97706":"#dc2626"}">${l.tauxPaye}%</strong>
        </td>
      </tr>`).join("")}
      <tr style="background:#f1f5f9;font-weight:800">
        <td>${tr("common.total").toUpperCase()}</td><td style="text-align:center">${totEffectif}</td>
        <td style="text-align:center;color:#059669">${totAbsJ}</td>
        <td style="text-align:center;color:#dc2626">${totAbsN}</td>
        <td style="text-align:center">${totAbsJ+totAbsN}</td>
        <td style="text-align:center">${totPaye}/${totEffectif}</td>
        <td><strong style="color:${tauxGlobal>=80?"#059669":tauxGlobal>=50?"#d97706":"#dc2626"}">${tauxGlobal}%</strong></td>
      </tr>
    </tbody>
  </table>

  ${elevesConcernes.length>0?`
  <div class="alert-box">
    <div class="alert-title">🚨 Élèves avec absences répétées (≥ 3 ce mois)</div>
    <table style="margin-bottom:0">
      <thead><tr><th>Nom & Prénom</th><th>Classe</th><th>Nb absences</th><th>Tuteur</th><th>Contact</th></tr></thead>
      <tbody>
        ${elevesConcernes.map(e=>`<tr>
          <td><strong>${e.nom} ${e.prenom}</strong></td>
          <td>${e.classe||"—"}</td>
          <td style="text-align:center;font-weight:800;color:#dc2626">${e.nbAbs}</td>
          <td>${e.tuteur||"—"}</td>
          <td>${e.contactTuteur||"—"}</td>
        </tr>`).join("")}
      </tbody>
    </table>
  </div>`:""}

  <div class="page-footer">
    <span>${new Date().toLocaleDateString("fr-FR",{day:"2-digit",month:"long",year:"numeric"})}</span>
    <span>${nomEcole}</span>
    <span>${tr("reports.signature")} ${tr("reports.director")} : ___________________</span>
  </div>

  <script>${PRINT_TRIGGER}</script>
  </body></html>`);
  w.document.close();
};
