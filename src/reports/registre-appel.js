// ══════════════════════════════════════════════════════════════
//  Registre d'appel du mois — feuille A4 paysage
// ══════════════════════════════════════════════════════════════
// Pour chaque classe : une page de garde, puis la grille élèves × jours de
// classe (A / J / R), qui court sur autant de pages qu'il faut (seul l'en-tête
// des colonnes se répète). À la fin seulement, après le dernier élève :
// présents et absents par jour, arrêté du mois (présences possibles,
// effectives, taux de fréquentation) et signatures, gardés ensemble. Imprimé par le chef de section (module
// École → Discipline) ; l'enseignant n'en voit qu'un aperçu dans son portail.
// Calcul : components/portail-enseignant/registre-mensuel.js.
import {
  PRINT_TRIGGER, WATERMARK_CSS, enteteDoc, printDir, printLang, printResetFor, tr, watermarkHtml,
} from "./print-helpers.js";
import {
  dernierJour, formaterTaux, libelleDate, libelleMois,
} from "../components/portail-enseignant/registre-mensuel.js";

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
const nombre = (n, langue) => Number(n || 0).toLocaleString(langue);

// Page de garde : l'école, le titre, la classe et le mois en grand.
function pageDeGarde({ registre, classe = "", schoolInfo = {}, annee = "", nomEns = "", matiere = "" }, langue) {
  const champs = [
    ["teacher.register.coverYear", annee],
    ["teacher.register.coverStudents", nombre(registre.lignes.length, langue)],
    ["teacher.register.coverDays", nombre(registre.jours.length, langue)],
    ["teacher.register.coverTeacher", [nomEns, matiere].filter(Boolean).join(" — ")],
  ].filter(([, valeur]) => valeur !== "" && valeur != null)
    .map(([cle, valeur]) => `<tr><th>${echapper(tr(cle))}</th><td>${echapper(valeur)}</td></tr>`).join("");
  return `<section class="page couverture">
  ${enteteDoc(schoolInfo, schoolInfo.logo)}
  <div class="garde">
    <div class="garde-titre">${echapper(tr("teacher.register.coverTitle"))}</div>
    <div class="garde-mois">${echapper(libelleMois(registre.mois, langue))}</div>
    ${classe ? `<div class="garde-classe">${echapper(classe)}</div>` : ""}
    <table class="garde-champs">${champs}</table>
  </div>
  <div class="imprime">${echapper(tr("teacher.register.printedOn", { date: new Date().toLocaleDateString(langue) }))}</div>
  </section>`;
}

// La grille (sur une ou plusieurs pages), puis, à la fin seulement, les
// totaux par jour, le bilan, l'arrêté et les signatures.
function pageRegistre({ registre, classe = "", annee = "", nomEns = "", matiere = "" }, langue) {
  const mois = libelleMois(registre.mois, langue);
  const { jours, lignes, parJour, totaux } = registre;
  const entetesJours = jours.map((j) => `<th class="j">${j.jour}<br/><small>${echapper(initialeJour(j.date, langue))}</small></th>`).join("");
  const corps = lignes.map((l, i) => {
    const cases = jours.map(({ date }) => {
      const m = l.marques[date] || "";
      return `<td class="j"${m ? ` style="color:${COULEUR_MARQUE[m]}"` : ""}>${m}</td>`;
    }).join("");
    return `<tr><td class="n">${i + 1}</td><td class="nom">${echapper(l.eleve.nom)} ${echapper(l.eleve.prenom)}</td>${cases}`
      + `<td class="t">${l.absNJ || ""}</td><td class="t">${l.absJ || ""}</td><td class="t">${l.retards || ""}</td><td class="t tot">${l.presences}</td></tr>`;
  }).join("");
  const ligneJour = (cle, libelle, total) => `<tr class="total"><td colspan="2" class="lib">${echapper(tr(libelle))}</td>`
    + jours.map(({ date }) => `<td class="j">${parJour[date][cle]}</td>`).join("")
    + `<td colspan="3"></td><td class="t tot">${nombre(total, langue)}</td></tr>`;
  const sous = [
    classe && tr("teacher.register.printClass", { classe }),
    nomEns && tr("teacher.register.printTeacher", { name: [nomEns, matiere].filter(Boolean).join(" — ") }),
    annee && tr("teacher.register.printYear", { year: annee }),
  ].filter(Boolean).map(echapper).join(" · ");
  const chiffres = {
    possibles: nombre(totaux.possibles, langue),
    effectives: nombre(totaux.effectives, langue),
    rate: formaterTaux(totaux.taux, langue),
  };
  const arrete = registre.arrete
    ? tr("teacher.register.stopped", { date: libelleDate(dernierJour(registre.mois), langue), ...chiffres })
    : tr("teacher.register.situation", { date: libelleDate(new Date().toISOString().slice(0, 10), langue), ...chiffres });
  const notes = [
    registre.congesRetires > 0 && tr("teacher.register.holidaysNote", { count: registre.congesRetires }),
    registre.horsJours > 0 && tr("teacher.register.outsideDays", { count: registre.horsJours }),
  ].filter(Boolean).map(echapper).join(" · ");

  return `<section class="page">
  <h2>${echapper(tr("teacher.register.printTitle", { month: mois }))}</h2>
  <div class="sous">${sous}</div>
  <table>
    <colgroup><col style="width:7mm"/><col style="width:50mm"/>${jours.map(() => "<col/>").join("")}<col style="width:9mm"/><col style="width:9mm"/><col style="width:9mm"/><col style="width:12mm"/></colgroup>
    <thead><tr><th>${echapper(tr("teacher.register.colNo"))}</th><th>${echapper(tr("teacher.register.colStudent"))}</th>${entetesJours}`
    + `<th>A</th><th>J</th><th>R</th><th>${echapper(tr("teacher.register.colPresences"))}</th></tr></thead>
    <tbody>${corps}
      ${ligneJour("presents", "teacher.register.rowPresent", totaux.effectives)}
      ${ligneJour("absents", "teacher.register.rowAbsent", totaux.absNJ + totaux.absJ)}
    </tbody>
  </table>
  <div class="fin">
  <div class="bilan">
    <span>${echapper(tr("teacher.register.statStudents", { count: lignes.length }))}</span>
    <span>${echapper(tr("teacher.register.statDays", { count: jours.length }))}</span>
    <span>${echapper(tr("teacher.register.statPossible", { count: chiffres.possibles }))}</span>
    <span>${echapper(tr("teacher.register.statEffective", { count: chiffres.effectives }))}</span>
    <span class="taux">${echapper(tr("teacher.register.statRate", { rate: chiffres.rate }))}</span>
    <span style="color:#b91c1c">${echapper(tr("teacher.register.statAbsNJ", { count: totaux.absNJ }))}</span>
    <span style="color:#1d4ed8">${echapper(tr("teacher.register.statAbsJ", { count: totaux.absJ }))}</span>
    <span style="color:#b45309">${echapper(tr("teacher.register.statLate", { count: totaux.retards }))}</span>
  </div>
  <div class="arrete">${echapper(arrete)}</div>
  <div class="legende">${echapper(tr("teacher.register.legend"))}${notes ? `<br/>${notes}` : ""}</div>
  <div class="pied">
    <span><strong>${echapper(tr("teacher.register.signTitular"))}</strong><br/><br/><br/></span>
    <span><strong>${echapper(tr("teacher.register.signHead"))}</strong><br/><br/><br/></span>
    <span><strong>${echapper(tr("teacher.register.signDirection"))}</strong><br/><br/><br/></span>
  </div>
  <div class="imprime">${echapper(tr("teacher.register.printedOn", { date: new Date().toLocaleDateString(langue) }))}</div>
  </div>
  </section>`;
}

// Document complet : pour chaque classe, page de garde puis registre. `apercu` : sans impression
// automatique, barré « APERÇU » (portail enseignant).
export function registresAppelHTML(feuilles = [], { schoolInfo = {}, apercu = false } = {}) {
  const langue = printLang();
  const c1 = schoolInfo.couleur1 || "#0A1628";
  const premiere = feuilles[0];
  const titre = premiere
    ? `${tr("teacher.register.printTitle", { month: libelleMois(premiere.registre.mois, langue) })}${feuilles.length === 1 && premiere.classe ? ` — ${premiere.classe}` : ""}`
    : "";
  return `<!DOCTYPE html><html lang="${langue}" dir="${printDir()}"><head><meta charset="utf-8"/>
  <title>${echapper(titre)}</title>
  <style>${printResetFor("size:A4 landscape;margin:7mm 0")}
  body{font-family:Arial,sans-serif;margin:0;color:#111;font-size:10px}
  .page{padding:0 8mm;position:relative}
  .page + .page{break-before:page;page-break-before:always}
  h2{color:${c1};text-align:center;margin:2px 0;font-size:16px;letter-spacing:.04em;text-transform:uppercase}
  .sous{text-align:center;font-size:11px;color:#475569;font-weight:700;margin-bottom:6px}
  table{width:100%;border-collapse:collapse;table-layout:fixed}
  th{background:${c1};color:#fff;font-size:9px;padding:3px 1px}
  th small{font-weight:400;opacity:.8}
  td{border:1px solid #cbd5e1;padding:1px 3px;height:13px}
  thead{display:table-header-group}
  tr{break-inside:avoid;page-break-inside:avoid}
  tbody tr:nth-child(even) td{background:#f8fafc}
  td.j,th.j{text-align:center;padding:1px 0;font-weight:900}
  td.n{text-align:center;color:#64748b}
  td.nom{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:700}
  td.t{text-align:center;font-weight:800}
  td.tot{background:#f1f5f9!important}
  td.lib{text-align:end;font-weight:900}
  tr.total td{background:#f1f5f9!important;font-weight:900;font-size:9px;border-top:1.5px solid #64748b}
  .fin{break-inside:avoid;page-break-inside:avoid}
  .couverture{min-height:192mm;display:flex;flex-direction:column}
  .garde{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;border:3px double ${c1};border-radius:10px;margin:6mm 20mm;padding:10mm}
  .garde-titre{font-size:40px;font-weight:900;color:${c1};letter-spacing:.08em;text-transform:uppercase;text-align:center}
  .garde-mois{font-size:24px;font-weight:800;text-transform:capitalize}
  .garde-classe{font-size:30px;font-weight:900;color:${c1};border-top:2px solid ${c1};border-bottom:2px solid ${c1};padding:4px 24px}
  .garde-champs{width:auto;table-layout:auto;margin-top:8px;font-size:14px}
  .garde-champs th{background:none;color:#475569;font-size:13px;text-align:end;padding:3px 12px;font-weight:700}
  .garde-champs td{border:none;height:auto;padding:3px 12px;font-weight:800;background:none!important}
  .bilan{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;margin-top:6px;font-size:10.5px;font-weight:700}
  .bilan .taux{color:${c1};font-size:12px}
  .arrete{margin:8px auto 0;max-width:230mm;border:1.5px solid ${c1};border-radius:6px;padding:6px 10px;font-size:11.5px;font-weight:700;text-align:center}
  .legende{text-align:center;font-size:9px;color:#64748b;margin-top:4px}
  .pied{margin-top:10px;display:flex;justify-content:space-between;font-size:11px}
  .imprime{font-size:9px;color:#94a3b8;text-align:end}
  .apercu{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:5}
  .apercu span{transform:rotate(-24deg);font-size:110px;font-weight:900;color:rgba(185,28,28,.12);letter-spacing:.1em}
  .bandeau{background:#fef3c7;border-bottom:1px solid #fcd34d;color:#92400e;font-size:12px;font-weight:700;padding:8px 12px;text-align:center}
  ${WATERMARK_CSS}</style></head><body>
  ${watermarkHtml(schoolInfo)}
  ${apercu ? `<div class="bandeau">${echapper(tr("teacher.register.previewNote"))}</div><div class="apercu"><span>${echapper(tr("teacher.register.previewBadge"))}</span></div>` : ""}
  ${feuilles.map((f) => pageDeGarde({ schoolInfo, ...f }, langue) + pageRegistre({ schoolInfo, ...f }, langue)).join("")}
  ${apercu ? "" : `<script>${PRINT_TRIGGER}</script>`}
  </body></html>`;
}

// Une seule classe (compatibilité et tests).
export const registreAppelHTML = ({ schoolInfo = {}, apercu = false, ...feuille }) =>
  registresAppelHTML([feuille], { schoolInfo, apercu });

// Ouvre les registres dans une nouvelle fenêtre ; false si le navigateur l'a bloquée.
export function imprimerRegistresAppel(feuilles, options) {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(registresAppelHTML(feuilles, options));
  w.document.close();
  return true;
}
