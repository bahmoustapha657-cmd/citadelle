// ══════════════════════════════════════════════════════════════
//  Listes de l'alerte mensualités : élèves ayant payé, non réinscrits
// ══════════════════════════════════════════════════════════════
// Deux feuilles A4 tirées de l'onglet Mensualités (même périmètre section /
// classe que l'alerte ; calculs : components/comptabilite/mensualites-tab/
// alerte-mensualites.js) :
//  • élèves ayant payé : une grille des mois de l'année (✓ payé, ◐ acompte),
//    le nombre de mois payés et ce qui a été perçu ;
//  • élèves présents sans inscription / réinscription encaissée : type,
//    reste à payer, mois déjà payés (preuve qu'ils fréquentent l'école),
//    tuteur et téléphone pour les relancer.

import { TOUS_MOIS_COURTS, TOUS_MOIS_LONGS, fmtN, getMonnaie, today } from "../constants.js";
import {
  PRINT_RESET, PRINT_TRIGGER, WATERMARK_CSS, enteteDoc, printDir, printLang, watermarkHtml,
} from "./print-helpers.js";

// Noms, tuteurs, contacts sont saisis à la main : un « < » ou un « & » ne
// doit ni casser le tableau ni injecter de balise dans la page imprimée.
const echapper = (valeur) => String(valeur ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// « Octobre » → « Oct » : dix colonnes de mois tiennent ainsi sur un A4.
const moisCourt = (mois) => {
  const i = TOUS_MOIS_LONGS.indexOf(mois);
  return i >= 0 ? TOUS_MOIS_COURTS[i] : mois;
};

const celluleEleve = (e) => `<strong>${echapper(e.nom)} ${echapper(e.prenom)}</strong>`
  + (e.matricule ? `<br/><span class="mat">${echapper(e.matricule)}</span>` : "");

// Page commune : en-tête de l'école, titre, périmètre, tableau, signature.
const pageListe = ({ schoolInfo = {}, annee = "", perimetre = "", titre, titreFenetre, note = "", tableau, couleur }) => {
  const c1 = schoolInfo.couleur1 || "#0A1628";
  return `<!DOCTYPE html><html lang="${printLang()}" dir="${printDir()}"><head>
  <meta charset="utf-8"/>
  <title>${titreFenetre} — ${echapper(schoolInfo.nom || "")}</title>
  <style>${PRINT_RESET}
  body{font-family:Arial,sans-serif;padding:12mm 10mm;font-size:11px;margin:0;color:#111}
  h2{color:${c1};text-align:center;margin:4px 0 2px;font-size:17px;letter-spacing:.04em}
  .sous{text-align:center;font-size:11px;color:#475569;font-weight:700}
  .note{text-align:center;font-size:10px;color:#64748b;margin:3px 0 10px}
  table{width:100%;border-collapse:collapse}
  th{background:${c1};color:#fff;padding:6px 4px;font-size:10px;text-align:start}
  th.c,td.c{text-align:center}
  td{padding:4px;border:1px solid #e2e8f0;vertical-align:top}
  tr:nth-child(even) td{background:#f8fafc}
  td.m{text-align:end;font-weight:800;white-space:nowrap;color:${couleur}}
  td.tel{white-space:nowrap} td.obs{min-width:60px}
  td.mois{text-align:center;vertical-align:middle;padding:3px 2px;font-size:11px}
  td.paye{color:#166534;font-weight:900}
  td.acompte{color:#b45309;font-weight:800;font-size:9px}
  .mat{font-size:9px;color:#64748b}
  tfoot td{background:#f1f5f9!important;font-weight:900}
  .pied{margin-top:22px;display:flex;justify-content:space-between;font-size:11px}
  ${WATERMARK_CSS}</style></head><body>
  ${watermarkHtml(schoolInfo)}
  ${enteteDoc(schoolInfo, schoolInfo.logo)}
  <h2>${titre}</h2>
  <div class="sous">${[annee ? `Année scolaire ${echapper(annee)}` : "", echapper(perimetre), `Situation au ${today()}`].filter(Boolean).join(" · ")}</div>
  ${note ? `<div class="note">${note}</div>` : ""}
  ${tableau}
  <div class="pied"><span>Imprimé le ${today()}</span><span><strong>Le Comptable</strong><br/><br/><br/></span></div>
  <script>${PRINT_TRIGGER}</script>
  </body></html>`;
};

/**
 * Élèves ayant payé au moins un mois, avec la grille de leurs mois.
 * @param {{ eleve: Record<string, any>, mois: string[], acomptes: { mois: string, montant: number }[], montant: number }[]} lignes
 * @param {{ schoolInfo?: Record<string, any>, annee?: string, perimetre?: string, moisAnnee?: string[],
 *   tri?: string }} options — `lignes` dans l'ordre voulu ; `tri` : cet ordre, en clair
 */
export function listePayesHTML(lignes = [], { moisAnnee = [], tri = "", ...options } = {}) {
  const monnaie = echapper(options.schoolInfo?.monnaie || getMonnaie());
  const total = lignes.reduce((s, l) => s + l.montant, 0);
  const corps = lignes.map((l, i) => {
    const payes = new Set(l.mois);
    const acomptes = Object.fromEntries(l.acomptes.map((a) => [a.mois, a.montant]));
    const cases = moisAnnee.map((m) => (payes.has(m)
      ? `<td class="mois paye">✓</td>`
      : acomptes[m] ? `<td class="mois acompte">◐<br/>${fmtN(acomptes[m])}</td>` : `<td class="mois"></td>`)).join("");
    return `<tr>
      <td class="c">${i + 1}</td>
      <td>${celluleEleve(l.eleve)}</td>
      <td class="c">${echapper(l.eleve.classe) || "—"}</td>
      ${cases}
      <td class="c"><strong>${l.mois.length}</strong></td>
      <td class="m">${fmtN(l.montant)}</td>
    </tr>`;
  }).join("");
  // Combien d'élèves ont payé chaque mois : la ligne que la Direction lit.
  const parMois = moisAnnee.map((m) => `<td class="c">${lignes.filter((l) => l.mois.includes(m)).length}</td>`).join("");
  const tableau = `<table>
    <thead><tr><th class="c">N°</th><th>Élève</th><th class="c">Classe</th>${moisAnnee.map((m) => `<th class="c">${echapper(moisCourt(m))}</th>`).join("")}<th class="c">Mois</th><th>Perçu (${monnaie})</th></tr></thead>
    <tbody>${corps}</tbody>
    <tfoot><tr><td colspan="3" style="text-align:end">${lignes.length} élève(s) — payé par mois</td>${parMois}<td></td><td class="m">${fmtN(total)}</td></tr></tfoot>
  </table>`;
  return pageListe({
    ...options, couleur: "#166534", tableau,
    titre: "✅ ÉLÈVES AYANT PAYÉ — MOIS PAYÉS", titreFenetre: "Élèves ayant payé",
    note: `${tri ? `<strong>Classement : ${echapper(tri)}</strong><br/>` : ""}✓ mois payé · ◐ acompte versé sur le mois (montant) · Perçu = mensualités encaissées, acomptes compris`,
  });
}

/**
 * Élèves présents dont l'inscription ou la réinscription n'est pas encaissée.
 * @param {{ eleve: Record<string, any>, type: string, reste: number, acompte: number, moisPayes: number }[]} lignes
 * @param {{ schoolInfo?: Record<string, any>, annee?: string, perimetre?: string }} options
 */
export function listeNonReinscritsHTML(lignes = [], options = {}) {
  const monnaie = echapper(options.schoolInfo?.monnaie || getMonnaie());
  const total = lignes.reduce((s, l) => s + l.reste, 0);
  const corps = lignes.map((l, i) => `<tr>
      <td class="c">${i + 1}</td>
      <td>${celluleEleve(l.eleve)}</td>
      <td class="c">${echapper(l.eleve.classe) || "—"}</td>
      <td>${l.type}${l.acompte > 0 ? `<br/><span class="mat">acompte ${fmtN(l.acompte)}</span>` : ""}</td>
      <td class="c">${l.moisPayes || "—"}</td>
      <td class="m">${l.reste > 0 ? fmtN(l.reste) : "—"}</td>
      <td>${echapper(l.eleve.tuteur) || "—"}</td>
      <td class="tel">${echapper(l.eleve.contactTuteur) || "—"}</td>
      <td class="obs"></td>
    </tr>`).join("");
  const tableau = `<table>
    <thead><tr><th class="c">N°</th><th>Élève</th><th class="c">Classe</th><th>À régler</th><th class="c">Mois déjà payés</th><th>Reste dû (${monnaie})</th><th>Tuteur</th><th>Téléphone</th><th>Observation</th></tr></thead>
    <tbody>${corps}</tbody>
    <tfoot><tr><td colspan="5" style="text-align:end">TOTAL — ${lignes.length} élève(s)</td><td class="m">${fmtN(total)}</td><td colspan="3"></td></tr></tfoot>
  </table>`;
  return pageListe({
    ...options, couleur: "#b45309", tableau,
    titre: "📝 ÉLÈVES PRÉSENTS NON RÉINSCRITS", titreFenetre: "Élèves non réinscrits",
    note: "Élèves actifs dont l'inscription ou la réinscription de l'année n'est pas encaissée",
  });
}

const ouvrir = (html) => {
  const w = window.open("", "_blank");
  if (!w) { alert("Autorisez les fenêtres pop-up pour imprimer."); return; }
  w.document.write(html);
  w.document.close();
};

export function imprimerListePayes(lignes, options) {
  if (!lignes.length) { alert("Aucun élève n'a encore payé de mois."); return; }
  ouvrir(listePayesHTML(lignes, options));
}

export function imprimerListeNonReinscrits(lignes, options) {
  if (!lignes.length) { alert("Aucun élève présent sans inscription encaissée."); return; }
  ouvrir(listeNonReinscritsHTML(lignes, options));
}
