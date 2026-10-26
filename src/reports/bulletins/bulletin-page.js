// ══════════════════════════════════════════════════════════════
//  Bulletins — gabarit HTML d'une page (bulletin individuel) + styles
// ══════════════════════════════════════════════════════════════
import { getAnnee } from "../../constants.js";
import {
  getOfficialLegalFooterHTML,
  legalProfileVide,
  mapNiveauToCycle,
} from "../../legal-utils.js";
import {
  PRINT_RESET,
  WATERMARK_CSS,
  edugestBrandHTML,
  enteteDoc,
  tr,
} from "../print-helpers.js";
import { blocsSignatures } from "../signatures.js";
import { getInitiales, ordinalFr } from "./bulletin-format.js";
import { computeBulletinModel } from "./bulletin-page-data.js";
import { buildLignesRows } from "./bulletin-page-rows.js";
import { PERIODE_ANNEE } from "./annual-notes.js";
import { computeBulletinProModel } from "./bulletin-pro-data.js";
import { PIED_CSS, identiteEcole } from "./bulletin-pro-commun.js";
import { STYLES_OFFICIEL, buildBulletinOfficielHTML } from "./bulletin-officiel.js";
import { STYLES_PRESTIGE, buildBulletinPrestigeHTML } from "./bulletin-prestige.js";
import { STYLES_CONTEMPORAIN, buildBulletinContemporainHTML } from "./bulletin-contemporain.js";

// Modèle de bulletin choisi par l'école (Paramètres → Évaluations) :
//  - classique : gabarit historique (défaut)
//  - compact   : 2 bulletins par feuille A4 (économie papier)
//  - moderne   : bandeau aux deux couleurs de l'école, blocs arrondis
//  - officiel, prestige, contemporain : bulletins complets (note de classe
//    et composition, rang et professeur par matière, total des points,
//    assiduité, décision du conseil) — voir bulletin-pro-*.js
export const MODELES_BULLETIN = [
  { id: "officiel", label: "Officiel", desc: "Le bulletin administratif : tableau quadrillé, encadrés, cases du conseil de classe. Net en noir et blanc, économe en encre." },
  { id: "prestige", label: "Prestige", desc: "L'esprit d'un diplôme : double cadre, filets dorés, sceau de distinction. Pour une image haut de gamme." },
  { id: "contemporain", label: "Contemporain", desc: "Lecture rapide pour les parents : chiffres clés en tête, position face à la classe, courbe de progression." },
  { id: "classique", label: "Classique", desc: "Le gabarit historique — un bulletin par page." },
  { id: "compact", label: "Compact (2 par page)", desc: "Deux bulletins par feuille A4 — économie de papier." },
  { id: "moderne", label: "Moderne", desc: "Bandeau aux couleurs de l'école, blocs arrondis." },
];

const GABARITS_PRO = {
  officiel: { build: buildBulletinOfficielHTML, styles: STYLES_OFFICIEL },
  prestige: { build: buildBulletinPrestigeHTML, styles: STYLES_PRESTIGE },
  contemporain: { build: buildBulletinContemporainHTML, styles: STYLES_CONTEMPORAIN },
};

export const getModeleBulletin = (schoolInfo = {}) =>
  (MODELES_BULLETIN.some((m) => m.id === schoolInfo.modeleBulletin) ? schoolInfo.modeleBulletin : "classique");

// Modèle complet (Officiel, Prestige, Contemporain) : l'impression lui
// calcule en plus rangs par matière, professeurs, assiduité et moyennes des
// périodes, inutiles aux autres modèles.
export const estModeleComplet = (schoolInfo = {}) => !!GABARITS_PRO[getModeleBulletin(schoolInfo)];

// Resserre le tableau quand la classe a beaucoup de matières, pour que le
// bulletin tienne sur sa page A4.
const densite = (nbMatieres) => (nbMatieres >= 13 ? "d2" : nbMatieres >= 10 ? "d1" : "");

function buildBulletinProHTML(modele, {
  eleve, notes, matieres, periode, niveau, maxNote, schoolInfo, rang, evolution, classStats,
  matiereClasseAvg, appreciation, qr, rangsParMatiere, professeurs, moyennesPeriodes, assiduite,
}) {
  const annee = getAnnee();
  const m = computeBulletinProModel({
    eleve, notes, matieres, periode, niveau, maxNote, schoolInfo, annee,
    matiereClasseAvg, rangsParMatiere, professeurs,
  });
  return GABARITS_PRO[modele].build({
    eleve, m, si: schoolInfo, ecole: identiteEcole(schoolInfo), niveau, maxNote, periode, annee,
    rang, classStats, evolution, moyennesPeriodes, assiduite, appreciation, qr,
    estAnnuel: periode === PERIODE_ANNEE,
    densite: densite(m.lignes.length),
    c1: schoolInfo.couleur1 || "#0A1628",
    c2: schoolInfo.couleur2 || "#00C48C",
  });
}

export function buildBulletinPageHTML({
  eleve,
  notes,
  matieres,
  periode,
  niveau,
  maxNote,
  schoolInfo,
  rang = null,
  evolution = null,
  classStats = null,
  matiereClasseAvg = {},
  appreciation = "",
  qr = "",
  // Modèles complets seulement (voir estModeleComplet) :
  rangsParMatiere = null,
  professeurs = null,
  moyennesPeriodes = null,
  assiduite = null,
}) {
  const modeleEcole = getModeleBulletin(schoolInfo);
  if (GABARITS_PRO[modeleEcole]) {
    return buildBulletinProHTML(modeleEcole, {
      eleve, notes, matieres, periode, niveau, maxNote, schoolInfo, rang, evolution, classStats,
      matiereClasseAvg, appreciation, qr, rangsParMatiere, professeurs, moyennesPeriodes, assiduite,
    });
  }
  const c1 = schoolInfo.couleur1 || "#0A1628";
  const c2 = schoolInfo.couleur2 || "#00C48C";
  const annee = getAnnee();
  const modele = getModeleBulletin(schoolInfo);
  const compact = modele === "compact";
  // Dimensions par modèle : le compact réduit photo/typo/espacements pour
  // tenir deux bulletins par feuille ; le moderne change le bandeau (c1→c2)
  // et arrondit les blocs. Les calculs sont strictement identiques.
  const dim = compact
    ? { photo: 42, moyFont: 21, bandPad: "5px 12px", radius: 6, gap: 8, mb: 7 }
    : { photo: 60, moyFont: 30, bandPad: "9px 16px", radius: modele === "moderne" ? 12 : 8, gap: 12, mb: 12 };
  const bandeau = modele === "moderne"
    ? `linear-gradient(135deg,${c1},${c2})`
    : `linear-gradient(135deg,${c1},${c1}dd)`;

  const { lignes, totalCoef, moyGene, mention, ms, numero } = computeBulletinModel({
    eleve, notes, matieres, periode, niveau, maxNote, schoolInfo, annee, matiereClasseAvg,
  });

  const tbody = buildLignesRows(lignes, maxNote);

  const estAnnuel = periode === PERIODE_ANNEE;
  const titreBulletin = estAnnuel ? tr("reports.annualBulletinTitle") : tr("reports.bulletinTitle");
  const labelPeriode = estAnnuel ? tr("reports.annual") : periode;

  return `
  <div class="page">
    ${enteteDoc(schoolInfo, schoolInfo.logo)}

    <div style="background:${bandeau};color:#fff;padding:${dim.bandPad};border-radius:${dim.radius}px;margin-bottom:${dim.mb}px;display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-size:13px;font-weight:800;letter-spacing:0.04em">${titreBulletin.toUpperCase()}</div>
        <div style="font-size:11px;opacity:0.85">${labelPeriode} — ${tr("reports.schoolYear")} ${annee}</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;flex-shrink:0">
        <div style="font-size:9.5px;opacity:0.78;font-family:monospace;text-align:end">${tr("reports.bulletinNumber")} ${numero}</div>
        ${qr ? `<div style="background:#fff;padding:3px;border-radius:5px;line-height:0;flex-shrink:0">${qr}</div>` : ""}
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1.55fr 1fr;gap:12px;margin-bottom:12px">
      <div style="border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;display:flex;gap:12px;align-items:center">
        ${eleve.photo
          ? `<img crossOrigin="anonymous" src="${eleve.photo}" alt="" style="width:${dim.photo}px;height:${dim.photo}px;border-radius:8px;object-fit:cover;border:2px solid ${c1};flex-shrink:0"/>`
          : `<div style="width:${dim.photo}px;height:${dim.photo}px;border-radius:8px;background:${c1};color:#fff;font-weight:900;font-size:22px;display:flex;align-items:center;justify-content:center;flex-shrink:0">${getInitiales(eleve)}</div>`}
        <div style="flex:1;font-size:10.5px;line-height:1.6;min-width:0">
          <div style="font-size:14px;font-weight:800;color:${c1};margin-bottom:2px">${eleve.nom || ""} ${eleve.prenom || ""}</div>
          <div><strong>${tr("reports.class")} :</strong> ${eleve.classe || "—"} &nbsp;·&nbsp; <strong>${tr("school.bulletins.matricule")} :</strong> ${eleve.ien || "—"}</div>
          <div><strong>${tr("reports.dateOfBirth")} :</strong> ${eleve.dateNaissance || "—"}${eleve.lieuNaissance ? ` — ${eleve.lieuNaissance}` : ""}</div>
          ${eleve.filiation ? `<div><strong>${tr("reports.filiation")} :</strong> ${eleve.filiation}</div>` : ""}
        </div>
      </div>

      <div style="border:2px solid ${ms.border};border-radius:8px;padding:10px 8px;text-align:center;background:${ms.bg}">
        <div style="font-size:8.5px;text-transform:uppercase;letter-spacing:0.08em;color:${ms.color};font-weight:700;margin-bottom:1px">${tr("reports.generalAverage")}</div>
        <div style="font-size:${dim.moyFont}px;font-weight:900;color:${ms.color};line-height:1.05">${moyGene}<span style="font-size:13px;opacity:0.65">/${maxNote}</span></div>
        <div style="font-size:11px;font-weight:800;color:${ms.color};margin-top:3px;text-transform:uppercase;letter-spacing:0.04em">${mention}</div>
        ${rang ? `<div style="font-size:10px;margin-top:5px;padding-top:4px;border-top:1px solid ${ms.border};color:${ms.color}"><strong>${tr("reports.rank")} : ${rang.rang}<sup>${ordinalFr(rang.rang)}</sup> / ${rang.effectif}</strong></div>` : ""}
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="background:${c1}">${tr("reports.subject")}</th>
          <th style="background:${c1};text-align:center;width:50px">${tr("reports.coefficient")}</th>
          <th style="background:${c1};text-align:center;width:140px">${tr("reports.average")} /${maxNote}</th>
          <th style="background:${c1};text-align:center;width:80px">${tr("reports.weighted")}</th>
          <th style="background:${c1};text-align:center;width:90px">${tr("reports.average")} ${tr("reports.class")}</th>
          <th style="background:${c1};width:100px">${tr("reports.appreciation")}</th>
        </tr>
      </thead>
      <tbody>
        ${tbody}
        <tr style="background:${c1}1A;font-weight:800">
          <td colspan="2" style="color:${c1}">${tr("reports.generalAverage").toUpperCase()}</td>
          <td style="text-align:center;color:${c1};font-size:14px">${moyGene}/${maxNote}</td>
          <td style="text-align:center;color:${c1}">${totalCoef}</td>
          <td style="text-align:center;font-size:10px;color:#6b7280">${classStats && classStats.moyenneClasse != null ? classStats.moyenneClasse.toFixed(2) : "—"}</td>
          <td style="background:${ms.bg};color:${ms.color}">${mention}</td>
        </tr>
      </tbody>
    </table>

    ${(classStats || evolution) ? `
    <div style="display:flex;gap:8px;margin-top:8px;font-size:10px">
      ${classStats ? `<div style="flex:1;background:#f9fafb;padding:7px 11px;border-radius:6px;border-left:3px solid ${c2}">
        <div style="font-weight:700;color:${c1};text-transform:uppercase;font-size:8.5px;margin-bottom:2px;letter-spacing:0.06em">Statistiques de la classe</div>
        Effectif : <strong>${classStats.effectif}</strong> &nbsp;·&nbsp;
        Moy. classe : <strong>${classStats.moyenneClasse.toFixed(2)}</strong> &nbsp;·&nbsp;
        Min : <strong>${classStats.min.toFixed(1)}</strong> &nbsp;·&nbsp;
        Max : <strong>${classStats.max.toFixed(1)}</strong>
      </div>` : ""}
      ${evolution ? `<div style="flex:1;background:#f9fafb;padding:7px 11px;border-radius:6px;border-left:3px solid ${c2}">
        <div style="font-weight:700;color:${c1};text-transform:uppercase;font-size:8.5px;margin-bottom:2px;letter-spacing:0.06em">Évolution</div>
        ${evolution.periodePrec} : ${evolution.moyPrec.toFixed(2)} → ${periode} : <strong>${evolution.moyActu.toFixed(2)}</strong>
        ${evolution.ecart >= 0
          ? ` <span style="color:#16a34a;font-weight:700">↑ +${evolution.ecart.toFixed(2)}</span>`
          : ` <span style="color:#dc2626;font-weight:700">↓ ${evolution.ecart.toFixed(2)}</span>`}
      </div>` : ""}
    </div>` : ""}

    <div style="margin-top:10px;border:1px dashed #cbd5e1;border-radius:6px;padding:8px 12px;min-height:36px">
      <div style="font-size:8.5px;font-weight:700;color:${c1};text-transform:uppercase;letter-spacing:0.06em;margin-bottom:3px">${tr("reports.appreciation")}</div>
      <div style="font-size:11px;color:#374151;line-height:1.5">${appreciation || `<span style="color:#cbd5e1">__________________________________________________________________________</span>`}</div>
    </div>

    <div class="sigs">
      <div class="sig">${tr("school.students.parent")}<br/><br/><br/>${tr("reports.signature")}</div>
      <div class="sig">${tr("reports.headTeacher")}<br/><br/><br/>${tr("reports.signature")}</div>
      ${blocsSignatures(schoolInfo, "bulletin", (identite, s) => `<div class="sig">${identite}${
        // La signature scannée est unique pour l'école : elle reste au
        // signataire principal, comme avant la matrice.
        s.role === "principal" && schoolInfo.signatureUrl ? `<img crossOrigin="anonymous" src="${schoolInfo.signatureUrl}" alt="" style="display:block;height:34px;object-fit:contain;margin:4px auto 2px"/>` : "<br/><br/><br/>"}${tr("reports.signature")}</div>`,
        { section: niveau })}
    </div>

    <div class="devise" style="color:${c2}">${schoolInfo.devise || "Travail – Rigueur – Réussite"}</div>

    ${getOfficialLegalFooterHTML(schoolInfo.legal || legalProfileVide, mapNiveauToCycle(niveau))}
    ${edugestBrandHTML(schoolInfo)}
  </div>`;
}

export function getBulletinStyles(modele = "classique") {
  if (GABARITS_PRO[modele]) {
    // Une page A4 par bulletin ; le pied descend en bas de la feuille. La
    // hauteur est un minimum : un bulletin trop long passe sur une seconde
    // feuille plutôt que d'être coupé.
    return `
    ${PRINT_RESET}
    body{margin:0;padding:0;background:#fff}
    .page.pro{width:210mm;min-height:296mm;box-sizing:border-box;display:flex;flex-direction:column;page-break-after:always;break-after:page;position:relative;background:#fff}
    .page.pro:last-child{page-break-after:auto;break-after:auto}
    .page.pro sup{font-size:.68em;line-height:0}
    @media screen{body{background:#e5e7eb}.page.pro{margin:0 auto 10px;box-shadow:0 1px 4px rgba(0,0,0,.15)}}
    ${GABARITS_PRO[modele].styles}
    ${PIED_CSS}
    `;
  }
  const base = `
    ${PRINT_RESET}
    body{font-family:Arial,sans-serif;padding:0;margin:0;font-size:11px;color:#1f2937}
    .page{padding:14mm 12mm;page-break-after:always;box-sizing:border-box}
    .page:last-child{page-break-after:auto}
    table{width:100%;border-collapse:collapse;margin-top:4px}
    th{color:#fff;padding:7px 9px;font-size:10.5px;text-align:left;border:1px solid rgba(0,0,0,0.05)}
    td{padding:6px 9px;border-bottom:1px solid #f1f5f9;font-size:11px;vertical-align:middle}
    tbody tr:nth-child(odd){background:#fafafa}
    /* Une colonne par bloc : un visa (matrice des signatures) s'aligne. */
    .sigs{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:18px;margin-top:18px}
    .sig{border-top:1.5px solid #1f2937;padding-top:6px;text-align:center;font-size:10px;color:#555}
    .devise{text-align:center;font-size:10px;margin-top:8px;font-style:italic;font-weight:700}
    @media print{body{margin:0}button{display:none}.page{padding:18px 22px}}
  `;
  if (modele === "compact") {
    // Deux bulletins par feuille : chaque .page est bornée à une
    // demi-page A4, le saut de page se fait au niveau de la .feuille
    // (paire de bulletins, assemblée dans bulletins.js).
    return `${base}
    body{font-size:9px}
    .page{padding:5mm 9mm;max-height:138mm;overflow:hidden;page-break-after:auto}
    .feuille{page-break-after:always}
    .feuille:last-child{page-break-after:auto}
    th{padding:4px 7px;font-size:9px}
    td{padding:3px 7px;font-size:9px}
    .sigs{margin-top:8px;gap:12px}
    .sig{font-size:8.5px;padding-top:3px}
    .devise{font-size:8.5px;margin-top:4px}
    @media print{.page{padding:5mm 9mm}}
    `;
  }
  if (modele === "moderne") {
    return `${base}
    td{border-bottom:1px solid #eef2f7}
    tbody tr:nth-child(odd){background:#f7fbf9}
    th:first-child{border-radius:8px 0 0 0}
    th:last-child{border-radius:0 8px 0 0}
    .sig{border-top:1.5px solid #94a3b8;color:#475569}
    `;
  }
  return base;
}
