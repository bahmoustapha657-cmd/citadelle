// ══════════════════════════════════════════════════════════════
//  Documents pour la plateforme du ministère (DGECS) — lot B
// ══════════════════════════════════════════════════════════════
// Trois feuilles A4, calculées par src/dgecs.js :
//  - fiche de notes d'une classe, dans l'ordre de saisie de la plateforme
//    (Matricule | Prénom et Nom | une colonne par matière) : paysage, une
//    case vide = une note à trouver avant la « Clôture » ;
//  - statistiques de rentrée (fiche d'enquête de la DPE/DSEE) ;
//  - liste des candidats à l'examen de fin de cycle (CEE, BEPC, BAC).
// Les `build…HTML` rendent la page (testés) ; les `imprimer…` l'ouvrent.
import { today } from "../constants.js";
import { dateLisible } from "../dgecs.js";
import {
  PRINT_TRIGGER, WATERMARK_CSS, enteteDoc, printDir, printLang, printResetFor, tr, watermarkHtml,
} from "./print-helpers.js";

// Noms saisis à la main : ni balise injectée ni tableau cassé.
const echapper = (valeur) => String(valeur ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const page = ({ titre, schoolInfo = {}, orientation = "portrait", css = "", corps }) => {
  const c1 = schoolInfo.couleur1 || "#0A1628";
  return `<!DOCTYPE html><html lang="${printLang()}" dir="${printDir()}"><head>
  <meta charset="utf-8"/>
  <title>${echapper(titre)}</title>
  <style>${printResetFor(`size:A4 ${orientation};margin:0`)}
  body{font-family:Arial,sans-serif;padding:10mm 9mm;font-size:11px;margin:0;color:#111}
  h2{color:${c1};text-align:center;margin:4px 0 2px;font-size:16px;letter-spacing:.03em;text-transform:uppercase}
  .sous{text-align:center;font-size:11px;color:#334155;font-weight:700;margin-bottom:8px}
  table{width:100%;border-collapse:collapse}
  th{background:${c1};color:#fff;padding:5px 4px;font-size:9.5px;text-align:center;vertical-align:bottom}
  td{padding:4px;border:1px solid #cbd5e1;vertical-align:middle}
  tr:nth-child(even) td{background:#f8fafc}
  td.c{text-align:center} td.mat{font-family:monospace;font-weight:700;white-space:nowrap}
  td.vide{background:#fee2e2!important}
  tfoot td{background:#e2e8f0!important;font-weight:800}
  .legende{margin-top:8px;font-size:9.5px;color:#475569}
  .pied{margin-top:18px;display:flex;justify-content:space-between;font-size:11px}
  ${css}
  ${WATERMARK_CSS}</style></head><body>
  ${watermarkHtml(schoolInfo)}
  ${enteteDoc(schoolInfo, schoolInfo.logo)}
  ${corps}
  <script>${PRINT_TRIGGER}</script>
  </body></html>`;
};

const ouvrir = (html) => {
  const w = window.open("", "_blank");
  if (!w) { alert(tr("dgecs.popupBlocked")); return; }
  w.document.write(html);
  w.document.close();
};

// ── Fiche de notes ─────────────────────────────────────────────
export function buildFicheNotesDgecsHTML(fiche, { schoolInfo = {}, annee = "", periodeLibelle = "", maxNote = 20 } = {}) {
  const titre = tr("dgecs.notes.printTitle", { classe: fiche.classe });
  const entetes = fiche.matieres.map((m) => `<th>${echapper(m.titre)}<br/><span style="font-weight:400">${echapper(tr("dgecs.notes.coef", { coef: m.coefficient }))} · /${maxNote}</span></th>`).join("");
  const lignes = fiche.lignes.map((l) => `<tr>
      <td class="c">${l.numero}</td>
      <td class="mat">${echapper(l.matricule)}</td>
      <td><strong>${echapper(l.nom)}</strong></td>
      ${l.cellules.map((c) => `<td class="c${c.valeur === null ? " vide" : ""}">${echapper(c.texte)}${c.incomplete ? "*" : ""}</td>`).join("")}
    </tr>`).join("");
  const corps = `
  <h2>${echapper(titre)}</h2>
  <div class="sous">${[
    tr("dgecs.notes.printYear", { annee }),
    tr("dgecs.notes.printSubtitle", { periode: periodeLibelle }),
  ].map(echapper).join(" · ")}</div>
  <table>
    <thead><tr><th>${echapper(tr("dgecs.notes.colNumber"))}</th><th>${echapper(tr("dgecs.notes.colMatricule"))}</th><th style="text-align:start">${echapper(tr("dgecs.notes.colName"))}</th>${entetes}</tr></thead>
    <tbody>${lignes}</tbody>
  </table>
  <div class="legende">${echapper(tr("dgecs.notes.printMissingLegend"))}${fiche.notesIncompletes ? ` ${echapper(tr("dgecs.notes.printIncompleteLegend"))}` : ""}</div>
  <div class="pied"><span>${echapper(tr("dgecs.printedOn", { date: today() }))}</span><span><strong>${echapper(tr("dgecs.signature"))}</strong><br/><br/><br/></span></div>`;
  return page({ titre, schoolInfo, orientation: fiche.matieres.length > 6 ? "landscape" : "portrait", corps });
}

export const imprimerFicheNotesDgecs = (fiche, options) => ouvrir(buildFicheNotesDgecsHTML(fiche, options));

// ── Statistiques de rentrée ────────────────────────────────────
export function buildStatistiquesRentreeHTML(stats, { schoolInfo = {}, annee = "" } = {}) {
  const section = tr(`dgecs.sections.${stats.section}`);
  const titre = tr("dgecs.stats.printTitle", { section });
  const cellules = (x) => `<td class="c">${x.garcons}</td><td class="c">${x.filles}</td><td class="c"><strong>${x.total}</strong></td>`;
  const lignes = stats.lignes.map((l) => `<tr>
      <td><strong>${echapper(l.niveau)}</strong></td><td class="c">${l.classes}</td>
      ${cellules(l)}${cellules(l.redoublants)}
    </tr>`).join("");
  const sexes = `<th>${echapper(tr("dgecs.stats.colBoys"))}</th><th>${echapper(tr("dgecs.stats.colGirls"))}</th><th>${echapper(tr("dgecs.stats.colTotal"))}</th>`;
  const ens = stats.enseignants;
  const corps = `
  <h2>${echapper(titre)}</h2>
  <div class="sous">${[tr("dgecs.stats.printYear", { annee }), tr("dgecs.printedOn", { date: today() })].map(echapper).join(" · ")}</div>
  <table>
    <thead>
      <tr><th rowspan="2" style="text-align:start">${echapper(tr("dgecs.stats.colLevel"))}</th><th rowspan="2">${echapper(tr("dgecs.stats.colClasses"))}</th>
        <th colspan="3">${echapper(tr("dgecs.stats.enrolled"))}</th><th colspan="3">${echapper(tr("dgecs.stats.repeaters"))}</th></tr>
      <tr>${sexes}${sexes}</tr>
    </thead>
    <tbody>${lignes}</tbody>
    <tfoot><tr><td>${echapper(tr("dgecs.stats.total"))}</td><td class="c">${stats.total.classes}</td>${cellules(stats.total)}${cellules(stats.total.redoublants)}</tr></tfoot>
  </table>
  <p style="margin-top:12px;font-size:12px"><strong>${echapper(tr("dgecs.stats.teachers", { total: ens.total, men: ens.hommes, women: ens.femmes }))}</strong></p>
  <div class="pied"><span></span><span><strong>${echapper(tr("dgecs.signature"))}</strong><br/><br/><br/></span></div>`;
  return page({ titre, schoolInfo, corps });
}

export const imprimerStatistiquesRentree = (stats, options) => ouvrir(buildStatistiquesRentreeHTML(stats, options));

// ── Candidats aux examens ──────────────────────────────────────
// Session : l'année civile où l'examen se passe (2026-2027 → 2027).
export const sessionExamen = (annee = "") => String(annee).split("-")[1] || String(annee);

export function buildCandidatsExamenHTML(candidats, { schoolInfo = {}, annee = "" } = {}) {
  const titre = tr("dgecs.candidates.printTitle", { examen: candidats.examen });
  const lignes = candidats.lignes.map((l) => {
    const e = l.eleve;
    const vide = (piece) => (l.manque.includes(piece) ? " vide" : "");
    return `<tr>
      <td class="c">${l.numero}</td>
      <td class="mat${vide("matricule")}">${echapper(l.matricule)}</td>
      <td><strong>${echapper(String(e.nom || "").toLocaleUpperCase("fr"))}</strong></td>
      <td>${echapper(e.prenom)}</td>
      <td class="c${vide("sexe")}">${echapper(e.sexe)}</td>
      <td class="c${vide("dateNaissance")}">${echapper(dateLisible(e.dateNaissance))}</td>
      <td class="${vide("lieuNaissance").trim()}">${echapper(e.lieuNaissance)}</td>
      <td class="c">${echapper(e.classe)}</td>
    </tr>`;
  }).join("");
  const colonnes = ["colNumber", "colMatricule", "colLastName", "colFirstName", "colSex", "colBirthDate", "colBirthPlace", "colClass"]
    .map((cle) => `<th>${echapper(tr(`dgecs.candidates.${cle}`))}</th>`).join("");
  const corps = `
  <h2>${echapper(titre)}</h2>
  <div class="sous">${[
    tr("dgecs.candidates.printYear", { session: sessionExamen(annee), annee }),
    candidats.niveau,
    tr("dgecs.candidates.count", { count: candidats.lignes.length }),
  ].map(echapper).join(" · ")}</div>
  <table><thead><tr>${colonnes}</tr></thead><tbody>${lignes}</tbody></table>
  ${candidats.incomplets ? `<div class="legende">${echapper(tr("dgecs.candidates.printLegend"))}</div>` : ""}
  <div class="pied"><span>${echapper(tr("dgecs.printedOn", { date: today() }))}</span><span><strong>${echapper(tr("dgecs.signature"))}</strong><br/><br/><br/></span></div>`;
  return page({ titre, schoolInfo, corps });
}

export const imprimerCandidatsExamen = (candidats, options) => ouvrir(buildCandidatsExamenHTML(candidats, options));
