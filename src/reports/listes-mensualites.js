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
// Et, depuis le bouton « Situation des paiements » de l'onglet : la liste
// d'un mois (listeMoisHTML) et la situation générale (situationGeneraleHTML).

import { TOUS_MOIS_COURTS, TOUS_MOIS_LONGS, fmtN, getMonnaie, today } from "../constants.js";
import {
  PRINT_RESET, PRINT_TRIGGER, WATERMARK_CSS, enteteDoc, printDir, printLang, tr, watermarkHtml,
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
// `css` : règles propres à une liste, ajoutées aux règles communes.
const pageListe = ({ schoolInfo = {}, annee = "", perimetre = "", titre, titreFenetre, note = "", tableau, couleur, css = "" }) => {
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
  ${css}
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
  // `retires` : non réinscrits au sens strict (aucun paiement de l'année),
  // retirés des classes — la liste des familles à appeler.
  const entete = options.retires ? {
    titre: tr("reports.nonReinscrits.retiresTitre"), titreFenetre: tr("reports.nonReinscrits.retiresFenetre"),
    note: tr("reports.nonReinscrits.retiresNote", { date: options.dateRetrait || "" }),
  } : {
    titre: tr("reports.nonReinscrits.inscriptionTitre"), titreFenetre: tr("reports.nonReinscrits.inscriptionFenetre"),
    note: tr("reports.nonReinscrits.inscriptionNote"),
  };
  return pageListe({ ...options, couleur: "#b45309", tableau, ...entete });
}

// Mois payés d'un élève, abrégés : « Oct · Nov · Déc ».
const moisPayesCourts = (mois = []) => (mois.length ? mois.map((m) => echapper(moisCourt(m))).join(" · ") : "—");

/**
 * Élèves d'UN mois, rangés par classe (calculs : components/comptabilite/
 * mensualites-tab/liste-mois.js) : ceux qui l'ont payé — montant du mois —
 * ou ceux qui ne l'ont pas encore payé — reste dû, tuteur, téléphone. Devant
 * chaque nom : ses mois payés et ce qu'il a payé dans l'année. Sous-total par
 * classe, total général et, à plusieurs classes, un récapitulatif par classe.
 * @param {{ classe: string, lignes: Record<string, any>[], montantMois: number, mensualites: number,
 *   autres: number, total: number }[]} groupes
 * @param {{ mois: string, statut?: string, pageParClasse?: boolean, schoolInfo?: Record<string, any>,
 *   annee?: string, perimetre?: string }} options
 */
export function listeMoisHTML(groupes = [], { mois = "", statut = "payes", pageParClasse = false, ...options } = {}) {
  const monnaie = echapper(options.schoolInfo?.monnaie || getMonnaie());
  const impayes = statut === "impayes";
  const nomMois = echapper(tr(`months.${mois}`, { defaultValue: mois }));
  const titre = tr(impayes ? "reports.listeMois.titreImpayes" : "reports.listeMois.titrePayes", { mois: nomMois.toUpperCase() });
  const nomClasse = (classe) => echapper(classe) || tr("reports.listeMois.sansClasse");
  const colonnes = [
    `<th class="c">${tr("reports.rowNumber")}</th>`,
    `<th>${tr("reports.studentName")}</th>`,
    `<th>${tr("reports.listeMois.moisPayes")}</th>`,
    ...(impayes ? [
      `<th>${tr("reports.listeMois.resteMois", { mois: nomMois, monnaie })}</th>`,
      `<th>${tr("reports.listeMois.totalPaye", { monnaie })}</th>`,
      `<th>${tr("reports.listeMois.tuteur")}</th>`,
      `<th>${tr("reports.listeMois.telephone")}</th>`,
    ] : [
      `<th>${tr("reports.listeMois.montantMois", { mois: nomMois, monnaie })}</th>`,
      `<th>${tr("reports.listeMois.mensualites")}</th>`,
      `<th>${tr("reports.listeMois.autres")}</th>`,
      `<th>${tr("reports.listeMois.totalPaye", { monnaie })}</th>`,
    ]),
  ];
  const nbColonnes = colonnes.length;
  const thead = `<thead><tr>${colonnes.join("")}</tr></thead>`;
  // Cellules chiffrées d'une ligne, d'un sous-total ou du total.
  const montants = (l) => (impayes
    ? `<td class="m">${l.montantMois > 0 ? fmtN(l.montantMois) : "—"}${l.acompte > 0
      ? `<br/><span class="mat">${tr("reports.listeMois.acompte", { montant: fmtN(l.acompte) })}</span>` : ""}</td>
      <td class="m">${fmtN(l.total)}</td>`
    : `<td class="m">${fmtN(l.montantMois)}</td><td class="n">${fmtN(l.mensualites)}</td>
      <td class="n">${fmtN(l.autres)}</td><td class="m">${fmtN(l.total)}</td>`);
  const ligne = (l, i) => `<tr>
      <td class="c">${i + 1}</td>
      <td>${celluleEleve(l.eleve)}</td>
      <td class="mp">${moisPayesCourts(l.moisPayes)}</td>
      ${montants(l)}
      ${impayes ? `<td>${echapper(l.eleve.tuteur) || "—"}</td><td class="tel">${echapper(l.eleve.contactTuteur) || "—"}</td>` : ""}
    </tr>`;
  const vides = impayes ? `<td colspan="2"></td>` : "";
  const effectif = (g) => tr("reports.listeMois.effectif", { n: g.lignes.length });
  const corpsGroupe = (g) => `<tr class="grp"><td colspan="${nbColonnes}">${nomClasse(g.classe)} — ${effectif(g)}</td></tr>
    ${g.lignes.map(ligne).join("")}
    <tr class="st"><td colspan="3">${tr("reports.listeMois.sousTotal", { classe: nomClasse(g.classe) })}</td>${montants(g)}${vides}</tr>`;
  const nbEleves = groupes.reduce((s, g) => s + g.lignes.length, 0);
  const total = ["montantMois", "mensualites", "autres", "total"]
    .reduce((t, cle) => ({ ...t, [cle]: groupes.reduce((s, g) => s + g[cle], 0) }), { acompte: 0 });
  const ligneTotal = `<tr><td colspan="3">${tr("reports.listeMois.totalGeneral", { n: nbEleves })}</td>${montants(total)}${vides}</tr>`;
  // Une page par classe : chaque classe porte son tableau, et rappelle le
  // titre à partir de la deuxième page.
  const tableau = pageParClasse
    ? groupes.map((g, i) => `<div class="${i ? "saut" : ""}">
        ${i ? `<div class="rappel">${titre} · ${echapper(options.annee || "")}</div>` : ""}
        <table>${thead}<tbody>${corpsGroupe(g)}</tbody></table></div>`).join("")
    : `<table>${thead}<tbody>${groupes.map(corpsGroupe).join("")}</tbody><tfoot>${ligneTotal}</tfoot></table>`;
  // Récapitulatif par classe : ce que lit la Direction.
  const recap = groupes.length > 1 ? `<div class="${pageParClasse ? "saut" : ""}">
    <h3>${tr("reports.listeMois.recap")}</h3>
    <table><thead><tr><th>${tr("reports.class")}</th><th class="c">${tr("reports.studentsHeader")}</th>
      <th>${tr(impayes ? "reports.listeMois.resteMois" : "reports.listeMois.montantMois", { mois: nomMois, monnaie })}</th>
      <th>${tr("reports.listeMois.totalPaye", { monnaie })}</th></tr></thead>
    <tbody>${groupes.map((g) => `<tr><td>${nomClasse(g.classe)}</td><td class="c">${g.lignes.length}</td>
      <td class="m">${fmtN(g.montantMois)}</td><td class="m">${fmtN(g.total)}</td></tr>`).join("")}</tbody>
    <tfoot><tr><td>${tr("common.total")}</td><td class="c">${nbEleves}</td><td class="m">${fmtN(total.montantMois)}</td>
      <td class="m">${fmtN(total.total)}</td></tr></tfoot></table></div>` : "";
  return pageListe({
    ...options,
    couleur: impayes ? "#b45309" : "#166534",
    tableau: tableau + recap,
    titre,
    titreFenetre: tr(impayes ? "reports.listeMois.fenetreImpayes" : "reports.listeMois.fenetrePayes", { mois: nomMois }),
    note: tr(impayes ? "reports.listeMois.noteImpayes" : "reports.listeMois.notePayes", { mois: nomMois }),
    css: `td.n{text-align:end;white-space:nowrap}
      td.mp{font-size:9.5px;color:#334155}
      tr.grp td{background:#e2e8f0!important;font-weight:900;font-size:11.5px;padding:5px 6px}
      tr.st td{background:#f1f5f9!important;font-weight:800}
      .saut{break-before:page;page-break-before:always}
      .rappel{text-align:center;font-size:12px;font-weight:800;margin-bottom:8px}
      h3{font-size:13px;margin:18px 0 6px}`,
  });
}

// Case d'un mois dans la situation générale (états : situation-generale.js).
const CASES_SITUATION = {
  paye: () => `<td class="mois paye">✓</td>`,
  acompte: (c) => `<td class="mois acompte">◐<br/>${fmtN(c.acompte)}</td>`,
  impaye: () => `<td class="mois impaye">✗</td>`,
  avenir: () => `<td class="mois avenir">—</td>`,
  nondu: () => `<td class="mois nondu">·</td>`,
};

/**
 * Situation générale des paiements (calculs : components/comptabilite/
 * mensualites-tab/situation-generale.js).
 *  • detail « eleves » : une ligne par élève — une case par mois, mois payés,
 *    total payé dans l'année — rangés par classe, chaque classe avec le
 *    nombre d'élèves ayant payé chaque mois et ce qu'elle a payé ; puis,
 *    à plusieurs classes, le tableau des classes ;
 *  • detail « classes » : le tableau des classes seul — effectif, à jour,
 *    en retard, payé par mois, total payé.
 * @param {{ classe: string, lignes: Record<string, any>[], effectif: number, aJour: number, enRetard: number,
 *   parMois: number[], total: number }[]} groupes
 * @param {{ moisAnnee?: string[], detail?: string, filtre?: string, pageParClasse?: boolean,
 *   schoolInfo?: Record<string, any>, annee?: string, perimetre?: string }} options
 */
export function situationGeneraleHTML(groupes = [], {
  moisAnnee = [], detail = "eleves", filtre = "tous", pageParClasse = false, ...options
} = {}) {
  const monnaie = echapper(options.schoolInfo?.monnaie || getMonnaie());
  const classesSeules = detail === "classes";
  const titre = tr("reports.situation.titre");
  const nomClasse = (classe) => echapper(classe) || tr("reports.listeMois.sansClasse");
  const enTetesMois = moisAnnee.map((m) => `<th class="c">${echapper(moisCourt(m))}</th>`).join("");
  const parMois = (g) => moisAnnee.map((_, i) => `<td class="c">${g.parMois[i] || 0}</td>`).join("");
  const total = groupes.reduce((t, g) => ({
    effectif: t.effectif + g.effectif, aJour: t.aJour + g.aJour, enRetard: t.enRetard + g.enRetard, total: t.total + g.total,
    parMois: moisAnnee.map((_, i) => (t.parMois[i] || 0) + (g.parMois[i] || 0)),
  }), { effectif: 0, aJour: 0, enRetard: 0, total: 0, parMois: [] });

  // Tableau des classes : ce que lit la Direction.
  const tableauClasses = `<table>
    <thead><tr><th>${tr("reports.class")}</th><th class="c">${tr("reports.studentsHeader")}</th>
      <th class="c">${tr("reports.situation.aJour")}</th><th class="c">${tr("reports.situation.enRetard")}</th>
      ${enTetesMois}<th>${tr("reports.listeMois.totalPaye", { monnaie })}</th></tr></thead>
    <tbody>${groupes.map((g) => `<tr><td><strong>${nomClasse(g.classe)}</strong></td><td class="c">${g.effectif}</td>
      <td class="c ok">${g.aJour}</td><td class="c ko">${g.enRetard}</td>${parMois(g)}
      <td class="m">${fmtN(g.total)}</td></tr>`).join("")}</tbody>
    <tfoot><tr><td>${tr("common.total")}</td><td class="c">${total.effectif}</td><td class="c">${total.aJour}</td>
      <td class="c">${total.enRetard}</td>${parMois(total)}<td class="m">${fmtN(total.total)}</td></tr></tfoot>
  </table>`;

  let tableau = tableauClasses;
  if (!classesSeules) {
    const nbColonnes = moisAnnee.length + 4;
    const thead = `<thead><tr><th class="c">${tr("reports.rowNumber")}</th><th>${tr("reports.studentName")}</th>
      ${enTetesMois}<th class="c">${tr("reports.situation.moisPayes")}</th>
      <th>${tr("reports.listeMois.totalPaye", { monnaie })}</th></tr></thead>`;
    const ligne = (l, i) => `<tr>
      <td class="c">${i + 1}</td>
      <td>${celluleEleve(l.eleve)}</td>
      ${l.cases.map((c) => (CASES_SITUATION[c.etat] || CASES_SITUATION.avenir)(c)).join("")}
      <td class="c"><strong>${l.moisPayes}</strong></td>
      <td class="m">${fmtN(l.total)}</td>
    </tr>`;
    const etat = (g) => tr("reports.situation.etatClasse", { n: g.effectif, aJour: g.aJour, retard: g.enRetard });
    const corpsGroupe = (g) => `<tr class="grp"><td colspan="${nbColonnes}">${nomClasse(g.classe)} — ${etat(g)}</td></tr>
      ${g.lignes.map(ligne).join("")}
      <tr class="st"><td colspan="2">${tr("reports.situation.sousTotal", { classe: nomClasse(g.classe) })}</td>${parMois(g)}
        <td></td><td class="m">${fmtN(g.total)}</td></tr>`;
    const ligneTotal = `<tr><td colspan="2">${tr("reports.situation.totalGeneral", { n: total.effectif })}</td>${parMois(total)}
      <td></td><td class="m">${fmtN(total.total)}</td></tr>`;
    // Une page par classe : chaque classe porte son tableau, et rappelle le
    // titre à partir de la deuxième page.
    tableau = pageParClasse
      ? groupes.map((g, i) => `<div class="${i ? "saut" : ""}">
          ${i ? `<div class="rappel">${titre} · ${echapper(options.annee || "")}</div>` : ""}
          <table>${thead}<tbody>${corpsGroupe(g)}</tbody></table></div>`).join("")
      : `<table>${thead}<tbody>${groupes.map(corpsGroupe).join("")}</tbody><tfoot>${ligneTotal}</tfoot></table>`;
    if (groupes.length > 1) {
      tableau += `<div class="${pageParClasse ? "saut" : ""}"><h3>${tr("reports.situation.recap")}</h3>${tableauClasses}</div>`;
    }
  }

  const filtreNote = filtre === "retard" ? tr("reports.situation.filtreRetard")
    : filtre === "ajour" ? tr("reports.situation.filtreAjour") : "";
  return pageListe({
    ...options,
    couleur: "#0f4c81",
    tableau,
    titre,
    titreFenetre: tr("reports.situation.fenetre"),
    note: [
      !classesSeules && filtreNote ? `<strong>${filtreNote}</strong>` : "",
      classesSeules ? "" : tr("reports.situation.legende"),
      tr("reports.situation.noteTotal"),
    ].filter(Boolean).join("<br/>"),
    css: `td{vertical-align:middle} td.mois{min-width:22px}
      td.impaye{color:#b91c1c;font-weight:900}
      td.avenir{color:#94a3b8}
      td.nondu{color:#cbd5e1;background:#f8fafc!important}
      td.ok{color:#166534;font-weight:800} td.ko{color:#b91c1c;font-weight:800}
      tr.grp td{background:#e2e8f0!important;font-weight:900;font-size:11.5px;padding:5px 6px}
      tr.st td{background:#f1f5f9!important;font-weight:800}
      .saut{break-before:page;page-break-before:always}
      .rappel{text-align:center;font-size:12px;font-weight:800;margin-bottom:8px}
      h3{font-size:13px;margin:18px 0 6px}`,
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

export function imprimerListeMois(groupes, options) {
  if (!groupes.length) { alert(tr("reports.listeMois.aucun")); return; }
  ouvrir(listeMoisHTML(groupes, options));
}

export function imprimerSituationGenerale(groupes, options) {
  if (!groupes.length) { alert(tr("reports.situation.aucun")); return; }
  ouvrir(situationGeneraleHTML(groupes, options));
}

export function imprimerListeNonReinscrits(lignes, options) {
  if (!lignes.length) {
    alert(tr(options?.retires ? "reports.nonReinscrits.aucun" : "reports.nonReinscrits.aucuneInscription"));
    return;
  }
  ouvrir(listeNonReinscritsHTML(lignes, options));
}
