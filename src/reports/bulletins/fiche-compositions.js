// ══════════════════════════════════════════════════════════════
//  Fiche de compositions — classement de classe (notes de composition)
// ══════════════════════════════════════════════════════════════
import { getAnnee } from "../../constants.js";
import { getPeriodeLongLabel } from "../../period-utils.js";
import {
  PRINT_RESET,
  PRINT_TRIGGER,
  WATERMARK_CSS,
  enteteDoc,
  printDir,
  printLang,
  tr,
  watermarkHtml,
} from "../print-helpers.js";
import { apprecComposition, computeFicheResultats } from "./fiche-compositions-data.js";
import { PERIODE_ANNEE, buildBulletinNotesAnnuelles } from "./annual-notes.js";

// `format` : "simple" (N°, Rang, Élève, IEN, Moyenne, Mention) ou
// "matieres" (Rang, Élèves, IEN, moyennes par matière, Moyenne, Mention —
// imprimé en paysage pour loger une colonne par matière).
export const imprimerFicheCompositions = (classe, periode, notes, matieres, eleves, maxNote=20, schoolInfo={}, periodes=[], matieresForClasse=null, format="simple") => {
  const mi = maxNote / 2;
  const apprec = (v) => apprecComposition(v, maxNote);
  const mentionColor = (m) => m==="Très Bien"?"#166534":m==="Bien"?"#1e40af":m==="Assez Bien"?"#92400e":m==="Passable"?"#0369a1":"#991b1b";
  const mentionBg    = (m) => m==="Très Bien"?"#dcfce7":m==="Bien"?"#dbeafe":m==="Assez Bien"?"#fef3c7":m==="Passable"?"#e0f2fe":"#fee2e2";

  // Mode « Fin d'année » : notes annuelles synthétiques calculées comme le
  // bulletin (moyenne de matière par période via getSubjectAverage), classées
  // sur PERIODE_ANNEE — pour que fiche et bulletin annuels coïncident.
  const estAnnuel = periode === PERIODE_ANNEE;
  const notesEff = estAnnuel
    ? buildBulletinNotesAnnuelles({ eleves, notes, matsFor: matieresForClasse || (() => matieres), periodes })
    : notes;
  const labelPeriode = estAnnuel ? tr("reports.annual") : periode;

  // Colonnes : matières de la classe quand une classe précise est choisie
  // (sinon liste globale pour la vue « toutes classes »). Le calcul par
  // élève ne compte de toute façon que ses matières de classe. Repli sur la
  // liste globale si la classe n'a aucune matière dédiée (sinon un tableau
  // vide — qui reste « truthy » — masquait toutes les colonnes matières).
  const matsClasse = (classe !== "all" && matieresForClasse) ? matieresForClasse(classe) : null;
  const matieresAff = (matsClasse && matsClasse.length) ? matsClasse : matieres;

  const { resultats, stats } = computeFicheResultats({ classe, periode, notes: notesEff, matieres: matieresAff, eleves, maxNote, matieresForClasse });

  if(resultats.length===0){ alert("Aucun résultat de composition trouvé pour cette sélection."); return; }

  // Stats récapitulatives
  const { nb, moyClasse, plus_haute, plus_basse, admis, dist } = stats;

  // Répartition par genre : effectif, part, moyenne, admis/non-admis, taux de
  // réussite et bornes pour chaque sexe. `sexe` vaut « M » ou « F » (à défaut
  // on classe sur l'initiale). `sansGenre` = élèves au sexe non renseigné.
  const statGenre = (predicat) => {
    const grp = resultats.filter((r) => predicat(String(r.eleve.sexe || "").trim().toUpperCase()));
    const n = grp.length;
    const moy = n ? grp.reduce((s, r) => s + r.moyGene, 0) / n : 0;
    const adm = grp.filter((r) => r.moyGene >= mi).length;
    const haute = n ? Math.max(...grp.map((r) => r.moyGene)) : 0;
    const basse = n ? Math.min(...grp.map((r) => r.moyGene)) : 0;
    return { n, moy, adm, nonAdm: n - adm, haute, basse, taux: n ? (adm / n) * 100 : 0 };
  };
  const garcons = statGenre((s) => s.startsWith("M"));
  const filles = statGenre((s) => s.startsWith("F"));
  const sansGenre = nb - garcons.n - filles.n;
  const pct = (x) => (nb ? Math.round((x / nb) * 100) : 0);

  // Format détaillé : une colonne de moyenne par matière entre l'IEN et la
  // moyenne générale. `notesMat` est calculé sur `matieresAff` (même liste,
  // même ordre) mais on mappe par nom pour rester robuste.
  const detail = format === "matieres";

  // Fin d'année (format 1) : présentation « registre » — N°, Rang, Prénoms et
  // Nom, puis groupe Moyenne (une colonne par période + Annuelle), Mention.
  // Le classement (rang, stats) reste celui de la moyenne annuelle ; les
  // moyennes de période sont recalculées avec les MÊMES règles (mêmes
  // matières de classe, getSubjectAverage) que la fiche de chaque période.
  const annuelSimple = estAnnuel && !detail;
  const moyParPeriode = new Map(); // eleveId → { [periode]: moyenne générale }
  if (annuelSimple) {
    periodes.forEach((p) => {
      const { resultats: resP } = computeFicheResultats({ classe, periode: p, notes, matieres: matieresAff, eleves, maxNote, matieresForClasse });
      resP.forEach((rp) => {
        const cur = moyParPeriode.get(rp.eleve._id) || {};
        cur[p] = rp.moyGene;
        moyParPeriode.set(rp.eleve._id, cur);
      });
    });
  }

  // Lignes élèves : N° (ordre, format simple) + rang (avec gestion des ex æquo).
  let rang=1;
  const rows = resultats.map((r,i)=>{
    if(i>0 && r.moyGene.toFixed(2)!==resultats[i-1].moyGene.toFixed(2)) rang=i+1;
    const m = apprec(r.moyGene.toFixed(2));
    const moyParMat = new Map(r.notesMat.map((nm)=>[nm.nom, nm.moy]));
    const cellMoy = (v) => v===null || v===undefined
      ? `<td style="text-align:center;color:#cbd5e1">—</td>`
      : `<td style="text-align:center;font-weight:600;color:${v>=mi?"#1a6b30":"#b91c1c"}">${v.toFixed(2)}</td>`;
    const cellsMat = detail ? matieresAff.map((mat)=>cellMoy(moyParMat.get(mat.nom))).join("") : "";
    const cellsPeriodes = annuelSimple
      ? periodes.map((p)=>cellMoy((moyParPeriode.get(r.eleve._id) || {})[p])).join("")
      : "";
    return `<tr style="background:${i%2===0?"#fff":"#f9f9f9"}">
      ${detail?"":`<td style="text-align:center;font-size:11px;color:#94a3b8">${i+1}</td>`}
      <td style="text-align:center;font-weight:800;color:${rang===1?"#d97706":rang===2?"#6b7280":rang===3?"#92400e":"#374151"};font-size:14px">${rang===1?"🥇":rang===2?"🥈":rang===3?"🥉":rang}</td>
      <td style="font-weight:700;padding:7px 8px;white-space:nowrap">${r.eleve.prenom||""} ${r.eleve.nom||""}</td>
      ${annuelSimple?"":`<td style="text-align:center;font-size:11px;font-family:monospace;color:#3730a3">${r.eleve.ien||"—"}</td>`}
      ${cellsMat}
      ${cellsPeriodes}
      <td style="text-align:center;font-weight:800;font-size:14px;color:${r.moyGene>=mi?"#1a6b30":"#b91c1c"}">${r.moyGene.toFixed(2)}</td>
      <td style="text-align:center"><span style="padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:${mentionBg(m)};color:${mentionColor(m)}">${m}</span></td>
    </tr>`;
  }).join("");

  // En-tête du tableau selon le format choisi.
  const thead = detail
    ? `<tr>
      <th rowspan="2" style="text-align:center;width:46px;vertical-align:middle">${tr("reports.rank")}</th>
      <th rowspan="2" style="vertical-align:middle">${tr("reports.studentsHeader")}</th>
      <th rowspan="2" style="text-align:center;vertical-align:middle">IEN</th>
      <th colspan="${matieresAff.length}" style="text-align:center;border-bottom:1px solid rgba(255,255,255,.35)">${tr("reports.averagesBySubject")}</th>
      <th rowspan="2" style="text-align:center;vertical-align:middle">${tr("reports.average")}/${maxNote}</th>
      <th rowspan="2" style="text-align:center;vertical-align:middle">${tr("reports.mention")}</th>
    </tr>
    <tr>${matieresAff.map((mat)=>`<th style="text-align:center;font-size:9px;padding:5px 3px">${mat.nom}</th>`).join("")}</tr>`
    : annuelSimple
      ? `<tr>
      <th rowspan="2" style="text-align:center;width:34px;vertical-align:middle">${tr("reports.rowNumber")}</th>
      <th rowspan="2" style="text-align:center;width:46px;vertical-align:middle">${tr("reports.rank")}</th>
      <th rowspan="2" style="vertical-align:middle">${tr("reports.studentFullName")}</th>
      <th colspan="${periodes.length+1}" style="text-align:center;border-bottom:1px solid rgba(255,255,255,.35)">${tr("reports.average")}/${maxNote}</th>
      <th rowspan="2" style="text-align:center;vertical-align:middle">${tr("reports.mention")}</th>
    </tr>
    <tr>${periodes.map((p)=>`<th style="text-align:center;font-size:10px;padding:5px 3px">${getPeriodeLongLabel(p)}</th>`).join("")}<th style="text-align:center;font-size:10px;padding:5px 3px">${tr("reports.annualColumn")}</th></tr>`
      : `<tr>
      <th style="text-align:center;width:34px">${tr("reports.rowNumber")}</th>
      <th style="text-align:center;width:46px">${tr("reports.rank")}</th>
      <th>${tr("reports.studentFullName")}</th>
      <th style="text-align:center">IEN</th>
      <th style="text-align:center">${tr("reports.average")}/${maxNote}</th>
      <th style="text-align:center">${tr("reports.mention")}</th>
    </tr>`;

  const w = window.open("","_blank");
  w.document.write(`<!DOCTYPE html><html lang="${printLang()}" dir="${printDir()}"><head><meta charset="utf-8"/>
  <title>${tr("reports.compositionResults")} — ${labelPeriode}</title>
  <style>
    ${PRINT_RESET}
    ${detail?"@page{size:A4 landscape}":""}
    body{font-family:Arial,sans-serif;padding:14mm 12mm;font-size:12px;color:#1a1a1a;margin:0}
    h2{color:#0A1628;text-align:center;margin:10px 0 4px;font-size:16px}
    h3{text-align:center;margin:0 0 14px;font-size:13px;color:#555;font-weight:normal}
    table{width:100%;border-collapse:collapse;margin-top:10px;font-size:${detail?10:11}px}
    th{background:#0A1628;color:#fff;padding:7px 6px;text-align:left}
    td{padding:6px ${detail?4:8}px;border-bottom:1px solid #eee;vertical-align:middle}
    .recap{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:16px}
    .recap-card{background:#f0f6f2;border-left:4px solid #0A1628;border-radius:6px;padding:10px 14px}
    .recap-card .val{font-size:20px;font-weight:800;color:#0A1628}
    .recap-card .lbl{font-size:10px;color:#555;margin-top:2px}
    .dist{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
    .dist-item{flex:1;min-width:80px;padding:8px;border-radius:6px;text-align:center}
    .dist-item .dv{font-size:18px;font-weight:800}
    .dist-item .dl{font-size:10px;margin-top:2px}
    .genre{margin-top:4px;font-size:11px}
    .genre th{font-size:10px;padding:6px}
    .genre td{padding:6px;border-bottom:1px solid #eee}
    .sigs{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:32px}
    .sig{border-top:2px solid #0A1628;padding-top:8px;text-align:center;font-size:11px;color:#555}
    @media print{button{display:none}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    ${WATERMARK_CSS}
  </style></head><body>
  ${watermarkHtml(schoolInfo)}
  ${enteteDoc(schoolInfo, schoolInfo.logo)}
  <h2>${tr("reports.compositionResults").toUpperCase()} — ${labelPeriode} — ${tr("reports.schoolYear")} ${getAnnee()}</h2>
  <h3>${tr("reports.class")} : <strong>${classe==="all"?tr("common.all"):classe}</strong> &nbsp;|&nbsp; <strong>${nb}</strong></h3>

  <table>
    <thead>${thead}</thead>
    <tbody>${rows}</tbody>
  </table>

  <div style="margin-top:24px;border-top:2px solid #0A1628;padding-top:14px">
    <strong style="font-size:13px;color:#0A1628;display:block;margin-bottom:10px">TABLEAU RÉCAPITULATIF</strong>
    <div class="recap">
      <div class="recap-card"><div class="val">${nb}</div><div class="lbl">Élèves évalués</div></div>
      <div class="recap-card"><div class="val">${moyClasse.toFixed(2)}/${maxNote}</div><div class="lbl">Moyenne de classe</div></div>
      <div class="recap-card"><div class="val">${admis} <small style="font-size:12px">(${Math.round(admis/nb*100)}%)</small></div><div class="lbl">Admis (moy ≥ ${mi})</div></div>
      <div class="recap-card"><div class="val">${nb-admis} <small style="font-size:12px">(${Math.round((nb-admis)/nb*100)}%)</small></div><div class="lbl">Non admis</div></div>
      <div class="recap-card"><div class="val">${plus_haute.toFixed(2)}</div><div class="lbl">Note la plus haute</div></div>
      <div class="recap-card"><div class="val">${plus_basse.toFixed(2)}</div><div class="lbl">Note la plus basse</div></div>
    </div>
    <div class="dist" style="margin-top:12px">
      ${Object.entries(dist).map(([men,cnt])=>`<div class="dist-item" style="background:${mentionBg(men)}"><div class="dv" style="color:${mentionColor(men)}">${cnt}</div><div class="dl" style="color:${mentionColor(men)}">${men}</div></div>`).join("")}
    </div>

    <strong style="font-size:13px;color:#0A1628;display:block;margin:18px 0 8px">RÉPARTITION PAR GENRE</strong>
    <table class="genre">
      <thead><tr>
        <th>Genre</th>
        <th style="text-align:center">Effectif</th>
        <th style="text-align:center">Part</th>
        <th style="text-align:center">Moyenne</th>
        <th style="text-align:center">Admis</th>
        <th style="text-align:center">Non admis</th>
        <th style="text-align:center">Taux de réussite</th>
        <th style="text-align:center">Meilleure</th>
        <th style="text-align:center">Plus basse</th>
      </tr></thead>
      <tbody>
        ${[
          { lbl: "Garçons", c: "#1e40af", bg: "#eff6ff", s: garcons },
          { lbl: "Filles", c: "#9d174d", bg: "#fdf2f8", s: filles },
        ].map(({ lbl, c, bg, s }) => `<tr style="background:${bg}">
          <td style="font-weight:800;color:${c}">${lbl}</td>
          <td style="text-align:center;font-weight:700">${s.n}</td>
          <td style="text-align:center">${pct(s.n)}%</td>
          <td style="text-align:center;font-weight:700">${s.n ? s.moy.toFixed(2) : "—"}</td>
          <td style="text-align:center;color:#1a6b30;font-weight:700">${s.adm}</td>
          <td style="text-align:center;color:#b91c1c;font-weight:700">${s.nonAdm}</td>
          <td style="text-align:center;font-weight:700">${s.n ? s.taux.toFixed(1) + "%" : "—"}</td>
          <td style="text-align:center">${s.n ? s.haute.toFixed(2) : "—"}</td>
          <td style="text-align:center">${s.n ? s.basse.toFixed(2) : "—"}</td>
        </tr>`).join("")}
        <tr style="background:#0A1628;color:#fff;font-weight:800">
          <td>Total</td>
          <td style="text-align:center">${nb}</td>
          <td style="text-align:center">100%</td>
          <td style="text-align:center">${moyClasse.toFixed(2)}</td>
          <td style="text-align:center">${admis}</td>
          <td style="text-align:center">${nb - admis}</td>
          <td style="text-align:center">${nb ? Math.round((admis / nb) * 100) : 0}%</td>
          <td style="text-align:center">${plus_haute.toFixed(2)}</td>
          <td style="text-align:center">${plus_basse.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>
    ${sansGenre > 0 ? `<div style="font-size:10px;color:#94a3b8;margin-top:6px">${sansGenre} élève(s) au sexe non renseigné — comptés dans le total uniquement.</div>` : ""}
  </div>

  <div class="sigs">
    <div class="sig">${tr("reports.director")}<br/><br/><br/>${tr("reports.signature")} & ${tr("reports.stamp")}</div>
    <div class="sig">${tr("reports.headTeacher")}<br/><br/><br/>${tr("reports.signature")}</div>
  </div>
  <script>${PRINT_TRIGGER}</script>
  </body></html>`);
  w.document.close();
};
