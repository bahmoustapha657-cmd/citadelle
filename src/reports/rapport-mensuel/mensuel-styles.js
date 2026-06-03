// CSS du document « Rapport mensuel ». Paramétré par les couleurs de l'école.
import { PRINT_RESET, WATERMARK_CSS } from "../print-helpers.js";

export function mensuelCss(c1, c2) {
  return `
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
    ${WATERMARK_CSS}`;
}
