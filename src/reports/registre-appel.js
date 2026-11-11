// ══════════════════════════════════════════════════════════════
//  Registre d'appel du mois — feuille A4 paysage (portail enseignant)
// ══════════════════════════════════════════════════════════════
// Grille élèves × jours de classe (A / J / R), totaux par élève, absents par
// jour, signatures. Calcul : components/portail-enseignant/registre-mensuel.js.
import {
  PRINT_TRIGGER, WATERMARK_CSS, enteteDoc, printDir, printLang, printResetFor, tr, watermarkHtml,
} from "./print-helpers.js";
import { libelleMois } from "../components/portail-enseignant/registre-mensuel.js";

// Noms saisis à la main : ni balise injectée ni tableau cassé.
const echapper = (valeur) => String(valeur ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const initialeJour = (date, langue) => {
  try {
    return new Date(`${date}T12:00:00`).toLocaleDateString(langue, { weekday: "narrow" });
  } catch {
    return "";
  }
};

const COULEUR_MARQUE = { A: "#b91c1c", J: "#1d4ed8", R: "#b45309" };

export function registreAppelHTML({ registre, classe = "", schoolInfo = {}, annee = "", nomEns = "", matiere = "" }) {
  const langue = printLang();
  const c1 = schoolInfo.couleur1 || "#0A1628";
  const mois = libelleMois(registre.mois, langue);
  const { jours, lignes, parJour, totaux } = registre;
  const entetesJours = jours.map((j) => `<th class="j">${j.jour}<br/><small>${echapper(initialeJour(j.date, langue))}</small></th>`).join("");
  const corps = lignes.map((l, i) => {
    const cases = jours.map(({ date }) => {
      const m = l.marques[date] || "";
      return `<td class="j"${m ? ` style="color:${COULEUR_MARQUE[m]}"` : ""}>${m}</td>`;
    }).join("");
    return `<tr><td class="n">${i + 1}</td><td class="nom">${echapper(l.eleve.nom)} ${echapper(l.eleve.prenom)}</td>${cases}`
      + `<td class="t">${l.absNJ || ""}</td><td class="t">${l.absJ || ""}</td><td class="t">${l.retards || ""}</td><td class="t tot">${l.total || ""}</td></tr>`;
  }).join("");
  const piedJours = jours.map(({ date }) => `<td class="j">${parJour[date].absents || ""}</td>`).join("");
  const sous = [
    classe && tr("teacher.register.printClass", { classe }),
    nomEns && tr("teacher.register.printTeacher", { name: [nomEns, matiere].filter(Boolean).join(" — ") }),
    annee && tr("teacher.register.printYear", { year: annee }),
  ].filter(Boolean).map(echapper).join(" · ");

  return `<!DOCTYPE html><html lang="${langue}" dir="${printDir()}"><head><meta charset="utf-8"/>
  <title>${echapper(tr("teacher.register.printTitle", { month: mois }))} — ${echapper(classe)}</title>
  <style>${printResetFor("size:A4 landscape;margin:0")}
  body{font-family:Arial,sans-serif;padding:8mm 8mm 6mm;margin:0;color:#111;font-size:10px}
  h2{color:${c1};text-align:center;margin:2px 0;font-size:16px;letter-spacing:.04em;text-transform:uppercase}
  .sous{text-align:center;font-size:11px;color:#475569;font-weight:700;margin-bottom:6px}
  table{width:100%;border-collapse:collapse;table-layout:fixed}
  th{background:${c1};color:#fff;font-size:9px;padding:3px 1px}
  th small{font-weight:400;opacity:.8}
  td{border:1px solid #cbd5e1;padding:1px 3px;height:13px}
  tr:nth-child(even) td{background:#f8fafc}
  td.j,th.j{text-align:center;padding:2px 0;font-weight:900}
  td.n{text-align:center;color:#64748b;width:6mm}
  td.nom{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:700}
  td.t{text-align:center;font-weight:800}
  td.tot{background:#f1f5f9!important}
  tfoot td{background:#f1f5f9!important;font-weight:900}
  .bilan{display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-top:6px;font-size:11px;font-weight:700}
  .legende{text-align:center;font-size:9.5px;color:#64748b;margin-top:3px}
  .pied{margin-top:14px;display:flex;justify-content:space-between;font-size:11px}
  ${WATERMARK_CSS}</style></head><body>
  ${watermarkHtml(schoolInfo)}
  ${enteteDoc(schoolInfo, schoolInfo.logo)}
  <h2>${echapper(tr("teacher.register.printTitle", { month: mois }))}</h2>
  <div class="sous">${sous}</div>
  <table>
    <colgroup><col style="width:7mm"/><col style="width:52mm"/>${jours.map(() => "<col/>").join("")}<col style="width:11mm"/><col style="width:11mm"/><col style="width:11mm"/><col style="width:12mm"/></colgroup>
    <thead><tr><th>${echapper(tr("teacher.register.colNo"))}</th><th>${echapper(tr("teacher.register.colStudent"))}</th>${entetesJours}`
    + `<th>A</th><th>J</th><th>R</th><th>${echapper(tr("teacher.register.colTotal"))}</th></tr></thead>
    <tbody>${corps}</tbody>
    <tfoot><tr><td colspan="2" style="text-align:end">${echapper(tr("teacher.register.absentsPerDay"))}</td>${piedJours}`
    + `<td class="t">${totaux.absNJ}</td><td class="t">${totaux.absJ}</td><td class="t">${totaux.retards}</td><td class="t">${totaux.absNJ + totaux.absJ + totaux.retards}</td></tr></tfoot>
  </table>
  <div class="bilan">
    <span>${echapper(tr("teacher.register.statStudents", { count: lignes.length }))}</span>
    <span>${echapper(tr("teacher.register.statDays", { count: jours.length }))}</span>
    <span style="color:#b91c1c">${echapper(tr("teacher.register.statAbsNJ", { count: totaux.absNJ }))}</span>
    <span style="color:#1d4ed8">${echapper(tr("teacher.register.statAbsJ", { count: totaux.absJ }))}</span>
    <span style="color:#b45309">${echapper(tr("teacher.register.statLate", { count: totaux.retards }))}</span>
    <span>${echapper(tr("teacher.register.statConcerned", { count: totaux.elevesConcernes, total: lignes.length }))}</span>
  </div>
  <div class="legende">${echapper(tr("teacher.register.legend"))}</div>
  <div class="pied">
    <span>${echapper(tr("teacher.register.printedOn", { date: new Date().toLocaleDateString(langue) }))}</span>
    <span><strong>${echapper(tr("teacher.register.signTeacher"))}</strong><br/><br/><br/></span>
    <span><strong>${echapper(tr("teacher.register.signDirection"))}</strong><br/><br/><br/></span>
  </div>
  <script>${PRINT_TRIGGER}</script>
  </body></html>`;
}

// Ouvre la feuille dans une nouvelle fenêtre ; false si le navigateur l'a bloquée.
export function imprimerRegistreAppel(options) {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(registreAppelHTML(options));
  w.document.close();
  return true;
}
