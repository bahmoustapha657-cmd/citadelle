// CSS du document « États de salaires » (mensuel). Paramétré par la couleur
// principale de l'école ; inclut le reset d'impression.
import { PRINT_RESET } from "../print-helpers.js";

export function etatsCss(c1) {
  return `
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
    .footer-note{text-align:center;margin-top:14px;font-size:9px;color:#94a3b8;font-style:italic}`;
}
