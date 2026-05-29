// ══════════════════════════════════════════════════════════════
//  Rapport annuel — feuille de styles du document imprimable
// ══════════════════════════════════════════════════════════════
import { PRINT_RESET, WATERMARK_CSS } from "../print-helpers.js";

export const getRapportAnnuelStyles = (c1, c2) => `
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
    ${WATERMARK_CSS}`;
