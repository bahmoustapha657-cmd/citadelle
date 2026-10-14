// ══════════════════════════════════════════════════════════════
//  Fiche d'alerte mensualités
// ══════════════════════════════════════════════════════════════
// Liste A4 des élèves en retard sur des mois échus (règle et réglages :
// components/comptabilite/mensualites-tab/alerte-mensualites.js) : mois en
// retard, reste à payer, tuteur et téléphone — la feuille que le comptable
// garde sous la main pour appeler les familles.

import { fmtN, getMonnaie, today } from "../constants.js";
import {
  PRINT_RESET, PRINT_TRIGGER, WATERMARK_CSS, enteteDoc, printDir, printLang, watermarkHtml,
} from "./print-helpers.js";

// Noms, tuteurs, contacts sont saisis à la main : un « < » ou un « & » ne
// doit ni casser le tableau ni injecter de balise dans la page imprimée.
const echapper = (valeur) => String(valeur ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * @param {{ eleve: Record<string, any>, mois: string[], montant: number }[]} retards
 * @param {{ schoolInfo?: Record<string, any>, annee?: string, perimetre?: string,
 *   reglages: { jourEcheance: number, seuilMois: number } }} options
 */
export function imprimerAlerteMensualites(retards, { schoolInfo = {}, annee = "", perimetre = "", reglages }) {
  if (!retards.length) { alert("Aucun élève en retard à imprimer."); return; }
  const c1 = schoolInfo.couleur1 || "#0A1628";
  const monnaie = echapper(schoolInfo.monnaie || getMonnaie());
  const total = retards.reduce((s, r) => s + r.montant, 0);
  const regle = `Mois compté en retard à partir du ${reglages.jourEcheance === 1 ? "1er" : reglages.jourEcheance} du mois · `
    + `alerte à partir de ${reglages.seuilMois} mois`;
  const lignes = retards.map((r, i) => `<tr>
      <td class="c">${i + 1}</td>
      <td><strong>${echapper(r.eleve.nom)} ${echapper(r.eleve.prenom)}</strong>${r.eleve.matricule ? `<br/><span class="mat">${echapper(r.eleve.matricule)}</span>` : ""}</td>
      <td class="c">${echapper(r.eleve.classe) || "—"}</td>
      <td><strong>${r.mois.length}</strong> : ${r.mois.map(echapper).join(", ")}</td>
      <td class="m">${r.montant > 0 ? fmtN(r.montant) : "—"}</td>
      <td>${echapper(r.eleve.tuteur) || "—"}</td>
      <td class="tel">${echapper(r.eleve.contactTuteur) || "—"}</td>
      <td class="obs"></td>
    </tr>`).join("");

  const w = window.open("", "_blank");
  if (!w) { alert("Autorisez les fenêtres pop-up pour imprimer."); return; }
  w.document.write(`<!DOCTYPE html><html lang="${printLang()}" dir="${printDir()}"><head>
  <meta charset="utf-8"/>
  <title>Alerte mensualités — ${echapper(schoolInfo.nom || "")}</title>
  <style>${PRINT_RESET}
  body{font-family:Arial,sans-serif;padding:12mm 10mm;font-size:11px;margin:0;color:#111}
  h2{color:${c1};text-align:center;margin:4px 0 2px;font-size:17px;letter-spacing:.04em}
  .sous{text-align:center;font-size:11px;color:#475569;font-weight:700}
  .regle{text-align:center;font-size:10px;color:#64748b;margin:3px 0 10px}
  table{width:100%;border-collapse:collapse}
  th{background:${c1};color:#fff;padding:6px 5px;font-size:10px;text-align:start}
  td{padding:5px;border:1px solid #e2e8f0;vertical-align:top}
  tr:nth-child(even) td{background:#f8fafc}
  td.c{text-align:center} td.m{text-align:end;font-weight:800;white-space:nowrap;color:#9b2020}
  td.tel{white-space:nowrap} td.obs{min-width:70px}
  .mat{font-size:9px;color:#64748b}
  tfoot td{background:#fce8e8!important;font-weight:900;color:#9b2020}
  .pied{margin-top:22px;display:flex;justify-content:space-between;font-size:11px}
  ${WATERMARK_CSS}</style></head><body>
  ${watermarkHtml(schoolInfo)}
  ${enteteDoc(schoolInfo, schoolInfo.logo)}
  <h2>🚨 ALERTE MENSUALITÉS</h2>
  <div class="sous">${[annee ? `Année scolaire ${echapper(annee)}` : "", echapper(perimetre), `Situation au ${today()}`].filter(Boolean).join(" · ")}</div>
  <div class="regle">${regle}</div>
  <table>
    <thead><tr><th>N°</th><th>Élève</th><th>Classe</th><th>Mois en retard</th><th>Reste dû (${monnaie})</th><th>Tuteur</th><th>Téléphone</th><th>Observation</th></tr></thead>
    <tbody>${lignes}</tbody>
    <tfoot><tr><td colspan="4" style="text-align:end">TOTAL — ${retards.length} élève(s)</td><td class="m">${fmtN(total)}</td><td colspan="3"></td></tr></tfoot>
  </table>
  <div class="pied"><span>Imprimé le ${today()}</span><span><strong>Le Comptable</strong><br/><br/><br/></span></div>
  <script>${PRINT_TRIGGER}</script>
  </body></html>`);
  w.document.close();
}
