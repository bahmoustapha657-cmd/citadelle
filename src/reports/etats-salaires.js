// ══════════════════════════════════════════════════════════════
//  États de salaires — Impression mensuelle
// ══════════════════════════════════════════════════════════════
// Document mensuel récapitulant les fiches de paie par section
// (Secondaire / Primaire / Personnel) avec totaux et signatures.
// Extrait de Comptabilite.jsx au refactor découpage 2026-05-20.

import { fmtN, today } from "../constants.js";
import { PRINT_RESET, enteteDoc } from "./print-helpers.js";

// Récupère les heures exécutées (logique reprise depuis salary-utils
// pour ne pas dupliquer ; appelé par le parent qui passe des helpers).
// Cette fonction est pure : tout ce dont elle a besoin arrive en params.
//
// Args :
//  - moisSel : "Octobre" | … (mois ciblé)
//  - anneeConsultee : "2025-2026"
//  - schoolInfo : info école pour l'en-tête + couleurs
//  - salairesSec/Prim/Pers : fiches du mois, déjà filtrées par section
//  - totals : { totMontantGlobal, totBonGlobal, totNetGlobal,
//      totMontantSec/Prim/Pers, totBonSec/Prim/Pers, totNetSec/Prim/Pers }
//  - calcs : { calcExecute, calcMontant, calcNet } — wrappers d'accès
//    aux helpers salary-utils (laissés en params pour rester découplé).
export function imprimerEtatsSalaires({
  moisSel,
  anneeConsultee,
  schoolInfo,
  salairesSec,
  salairesPrim,
  salairesPers,
  totals,
  calcExecute,
  calcMontant,
  calcNet,
}) {
  const {
    totMontantGlobal, totBonGlobal, totNetGlobal,
    totMontantSec, totBonSec, totNetSec,
    totMontantPrim, totBonPrim, totNetPrim,
    totMontantPers, totBonPers, totNetPers,
  } = totals;

  const c1 = schoolInfo?.couleur1 || "#0A1628";

  // Couleurs par section (palette cohérente, lisible aussi à l'impression couleur)
  const SEC_COLORS = {
    secondaire: { primary: "#1D4ED8", soft: "#DBEAFE", line: "#BFDBFE" },  // bleu royal
    primaire:   { primary: "#15803D", soft: "#DCFCE7", line: "#BBF7D0" },  // vert
    personnel:  { primary: "#B45309", soft: "#FEF3C7", line: "#FDE68A" },  // ambre
  };

  const totRevSec  = salairesSec.reduce((sum,s)=>sum+Number(s.revision||0),0);
  const totRevPrim = salairesPrim.reduce((sum,s)=>sum+Number(s.revision||0),0);
  const totRevPers = salairesPers.reduce((sum,s)=>sum+Number(s.revision||0),0);

  const sectionHeader = (label, color, count) => `
    <div class="section-header" style="border-left:5px solid ${color.primary};background:linear-gradient(90deg, ${color.soft} 0%, transparent 100%);padding:9px 14px;margin:18px 0 8px;display:flex;justify-content:space-between;align-items:center;border-radius:0 6px 6px 0">
      <div style="font-size:12px;font-weight:900;color:${color.primary};letter-spacing:0.06em;text-transform:uppercase">${label}</div>
      <div style="font-size:10px;color:${color.primary};font-weight:700">${count} ${count > 1 ? "personnes" : "personne"}</div>
    </div>`;

  const tableHead = (cols, color) => `
    <thead><tr>${cols.map((c, i) => `<th style="background:linear-gradient(180deg, ${color.primary} 0%, ${color.primary}dd 100%);color:#fff;padding:7px 6px;font-size:9.5px;text-align:${i===1?"left":"center"};border:1px solid ${color.primary};font-weight:800;letter-spacing:0.02em">${c}</th>`).join("")}</tr></thead>`;

  const totalRow = (label, color, montant, bon, rev, net, colspan) => `
    <tr class="total-row">
      <td colspan="${colspan}" style="background:${color.soft};color:${color.primary};font-weight:900;text-align:right;padding:8px 10px;font-size:11px;letter-spacing:0.04em">${label}</td>
      <td style="background:#DBEAFE;color:#1D4ED8;font-weight:900;text-align:center;padding:8px;font-size:11px">${fmtN(montant)}</td>
      <td style="background:#FEE2E2;color:#B91C1C;font-weight:800;text-align:center;padding:8px;font-size:11px">${bon ? "-"+fmtN(bon) : "0"}</td>
      <td style="background:#FEF3C7;color:#B45309;font-weight:800;text-align:center;padding:8px;font-size:11px">${rev ? "+"+fmtN(rev) : "0"}</td>
      <td style="background:#DCFCE7;color:#166534;font-weight:900;text-align:center;padding:8px;font-size:12px">${fmtN(net)}</td>
    </tr>`;

  const w = window.open("","_blank");
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <title>États de Salaires — ${moisSel} ${anneeConsultee}</title>
  <style>
    ${PRINT_RESET}
    *{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}
    body{font-family:'Inter',Arial,sans-serif;padding:12mm 10mm;font-size:11px;margin:0;color:#1f2937;background:#fff}
    .titre-wrap{text-align:center;margin:6px 0 18px;padding:14px 12px;border-radius:10px;background:linear-gradient(135deg, ${c1} 0%, ${c1}dd 100%);color:#fff}
    .titre-wrap .titre{font-size:16px;font-weight:900;letter-spacing:0.04em}
    .titre-wrap .sous-titre{font-size:11px;opacity:0.9;margin-top:3px;font-weight:600;letter-spacing:0.06em}
    .stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:18px}
    .stat-card{padding:10px 12px;border-radius:8px;border:1px solid #e2e8f0;background:#fff}
    .stat-card .lib{font-size:9px;text-transform:uppercase;letter-spacing:0.07em;font-weight:700;color:#6b7280;margin-bottom:3px}
    .stat-card .val{font-size:14px;font-weight:900}
    .stat-card.brut{border-top:3px solid #1D4ED8} .stat-card.brut .val{color:#1D4ED8}
    .stat-card.bons{border-top:3px solid #B91C1C} .stat-card.bons .val{color:#B91C1C}
    .stat-card.rev{border-top:3px solid #B45309} .stat-card.rev .val{color:#B45309}
    .stat-card.net{border-top:3px solid #166534;background:linear-gradient(180deg, #DCFCE7 0%, #fff 100%)} .stat-card.net .val{color:#166534;font-size:15px}
    table{width:100%;border-collapse:collapse;margin:0 0 12px}
    td{padding:5px 6px;border:1px solid #e5e7eb;font-size:10.5px;vertical-align:middle}
    tbody tr:nth-child(odd) td{background:#fafbfc}
    tbody tr:hover td{background:#f1f5f9}
    td.left{text-align:left;font-weight:600;color:#0f172a}
    td.right{text-align:right;font-variant-numeric:tabular-nums}
    td.center{text-align:center}
    td.net{font-weight:900;color:#166534;background:#F0FDF4;font-variant-numeric:tabular-nums}
    td.bon-val{color:#B91C1C;font-weight:600;font-variant-numeric:tabular-nums}
    td.rev-val{color:#B45309;font-weight:600;font-variant-numeric:tabular-nums}
    .global-totaux{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px;padding-top:14px;border-top:2px dashed #cbd5e1}
    .global-total{border-radius:10px;padding:14px 16px;color:#fff;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,0.08)}
    .global-total .lib{font-size:10px;text-transform:uppercase;letter-spacing:0.08em;opacity:0.9;margin-bottom:5px;font-weight:700}
    .global-total .val{font-size:18px;font-weight:900;letter-spacing:0.02em}
    .global-total.montant{background:linear-gradient(135deg,#1E40AF,#1D4ED8)}
    .global-total.bon{background:linear-gradient(135deg,#991B1B,#B91C1C)}
    .global-total.net{background:linear-gradient(135deg,#15803D,#166534)}
    .signatures{display:grid;grid-template-columns:1fr 1fr 1fr;gap:18px;margin-top:32px;page-break-inside:avoid}
    .sig{border-top:1.5px solid #1f2937;padding-top:6px;text-align:center;font-size:10px;color:#475569;font-weight:600}
    .footer-note{text-align:center;margin-top:14px;font-size:9px;color:#94a3b8;font-style:italic}
  </style></head><body>
    ${enteteDoc(schoolInfo, schoolInfo?.logo)}
    <div class="titre-wrap">
      <div class="titre">ÉTATS DE SALAIRES</div>
      <div class="sous-titre">MOIS DE ${moisSel.toUpperCase()} — ANNÉE SCOLAIRE ${anneeConsultee}</div>
    </div>

    <div class="stats-row">
      <div class="stat-card brut"><div class="lib">Total brut</div><div class="val">${fmtN(totMontantGlobal)}</div></div>
      <div class="stat-card bons"><div class="lib">Total bons</div><div class="val">-${fmtN(totBonGlobal)}</div></div>
      <div class="stat-card rev"><div class="lib">Total révisions</div><div class="val">+${fmtN(totRevSec+totRevPrim+totRevPers)}</div></div>
      <div class="stat-card net"><div class="lib">Net à payer</div><div class="val">${fmtN(totNetGlobal)} GNF</div></div>
    </div>

    ${sectionHeader("Section Secondaire", SEC_COLORS.secondaire, salairesSec.length)}
    <table>
      ${tableHead(["N°","Prénoms et Nom","Matière","Niveau","V.H. Hebdo","V.H. Prévu","5è Sem","Non Exé.","Exécuté","Prime/h","Montant","Bon","Révision","Net à Payer"], SEC_COLORS.secondaire)}
      <tbody>
      ${salairesSec.length === 0
        ? `<tr><td colspan="14" class="center" style="color:#9ca3af;font-style:italic;padding:18px">Aucun enseignant secondaire pour ce mois</td></tr>`
        : salairesSec.map((s,i)=>`<tr>
          <td class="center" style="color:#94a3b8;font-weight:700">${i+1}</td>
          <td class="left">${s.nom||""}</td>
          <td class="center">${s.matiere||"—"}</td>
          <td class="center">${s.niveau||"—"}</td>
          <td class="center">${s.vhHebdo||0}</td>
          <td class="center">${s.vhPrevu||0}</td>
          <td class="center">${s.cinqSem||0}</td>
          <td class="center">${s.nonExecute||0}</td>
          <td class="center" style="background:#EFF6FF;font-weight:800;color:#1D4ED8">${calcExecute(s)}</td>
          <td class="right">${s.primesVariables?'<span style="color:#9a3412;font-weight:700;font-size:9.5px">Variable</span>':fmtN(s.primeHoraire)}</td>
          <td class="right">${fmtN(calcMontant(s))}</td>
          <td class="right bon-val">${s.bon?"-"+fmtN(s.bon):"—"}</td>
          <td class="right rev-val">${s.revision?"+"+fmtN(s.revision):"—"}</td>
          <td class="right net">${fmtN(calcNet(s))}</td>
        </tr>`).join("")}
      ${salairesSec.length > 0 ? totalRow("TOTAL SECONDAIRE", SEC_COLORS.secondaire, totMontantSec, totBonSec, totRevSec, totNetSec, 10) : ""}
      </tbody>
    </table>

    ${sectionHeader("Section Primaire", SEC_COLORS.primaire, salairesPrim.length)}
    <table>
      ${tableHead(["N°","Prénoms et Nom","Classe","Montant","Bon","Révision","Net à Payer"], SEC_COLORS.primaire)}
      <tbody>
      ${salairesPrim.length === 0
        ? `<tr><td colspan="7" class="center" style="color:#9ca3af;font-style:italic;padding:18px">Aucun enseignant primaire pour ce mois</td></tr>`
        : salairesPrim.map((s,i)=>`<tr>
          <td class="center" style="color:#94a3b8;font-weight:700">${i+1}</td>
          <td class="left">${s.nom||""}</td>
          <td class="center">${s.niveau||"—"}</td>
          <td class="right">${fmtN(s.montantForfait||0)}</td>
          <td class="right bon-val">${s.bon?"-"+fmtN(s.bon):"—"}</td>
          <td class="right rev-val">${s.revision?"+"+fmtN(s.revision):"—"}</td>
          <td class="right net">${fmtN(Number(s.montantForfait||0)-Number(s.bon||0)+Number(s.revision||0))}</td>
        </tr>`).join("")}
      ${salairesPrim.length > 0 ? totalRow("TOTAL PRIMAIRE", SEC_COLORS.primaire, totMontantPrim, totBonPrim, totRevPrim, totNetPrim, 3) : ""}
      </tbody>
    </table>

    ${sectionHeader("Administration & Personnel", SEC_COLORS.personnel, salairesPers.length)}
    <table>
      ${tableHead(["N°","Prénoms et Nom","Poste","Catégorie","Montant","Bon","Révision","Net à Payer"], SEC_COLORS.personnel)}
      <tbody>
      ${salairesPers.length === 0
        ? `<tr><td colspan="8" class="center" style="color:#9ca3af;font-style:italic;padding:18px">Aucun membre du personnel pour ce mois</td></tr>`
        : salairesPers.map((s,i)=>`<tr>
          <td class="center" style="color:#94a3b8;font-weight:700">${i+1}</td>
          <td class="left">${s.nom||""}</td>
          <td class="center">${s.poste||"—"}</td>
          <td class="center">${s.categorie||"—"}</td>
          <td class="right">${fmtN(s.montantForfait||0)}</td>
          <td class="right bon-val">${s.bon?"-"+fmtN(s.bon):"—"}</td>
          <td class="right rev-val">${s.revision?"+"+fmtN(s.revision):"—"}</td>
          <td class="right net">${fmtN(Number(s.montantForfait||0)-Number(s.bon||0)+Number(s.revision||0))}</td>
        </tr>`).join("")}
      ${salairesPers.length > 0 ? totalRow("TOTAL ADMINISTRATION", SEC_COLORS.personnel, totMontantPers, totBonPers, totRevPers, totNetPers, 4) : ""}
      </tbody>
    </table>

    <div class="global-totaux">
      <div class="global-total montant"><div class="lib">Total brut à payer</div><div class="val">${fmtN(totMontantGlobal)} GNF</div></div>
      <div class="global-total bon"><div class="lib">Total bons</div><div class="val">${fmtN(totBonGlobal)} GNF</div></div>
      <div class="global-total net"><div class="lib">Total net à payer</div><div class="val">${fmtN(totNetGlobal)} GNF</div></div>
    </div>

    <div class="signatures">
      <div class="sig">Le Comptable<br/><br/><br/>Signature</div>
      <div class="sig">Le Directeur<br/><br/><br/>Signature</div>
      <div class="sig">Le Fondateur<br/><br/><br/>Signature</div>
    </div>

    <div class="footer-note">État émis le ${today()} — ${schoolInfo?.nom||"École"} — Tous montants en Francs Guinéens (GNF)</div>

    <script>window.onload=()=>window.print();</script>
  </body></html>`);
  w.document.close();
}
