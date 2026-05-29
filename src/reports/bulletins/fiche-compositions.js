// ══════════════════════════════════════════════════════════════
//  Fiche de compositions — classement de classe (notes de composition)
// ══════════════════════════════════════════════════════════════
import { getAnnee } from "../../constants.js";
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

export const imprimerFicheCompositions = (classe, periode, notes, matieres, eleves, maxNote=20, schoolInfo={}) => {
  const mi = maxNote / 2;
  const apprec = (v) => Number(v)>=(maxNote*0.8)?"Très Bien":Number(v)>=(maxNote*0.7)?"Bien":Number(v)>=(maxNote*0.6)?"Assez Bien":Number(v)>=mi?"Passable":"Insuffisant";
  const mentionColor = (m) => m==="Très Bien"?"#166534":m==="Bien"?"#1e40af":m==="Assez Bien"?"#92400e":m==="Passable"?"#0369a1":"#991b1b";
  const mentionBg    = (m) => m==="Très Bien"?"#dcfce7":m==="Bien"?"#dbeafe":m==="Assez Bien"?"#fef3c7":m==="Passable"?"#e0f2fe":"#fee2e2";

  const elevesClasse = classe==="all" ? eleves : eleves.filter(e=>e.classe===classe);

  // Calcul des résultats par élève (notes de type Composition)
  const resultats = elevesClasse.map(e => {
    const ne = notes.filter(n=>n.eleveId===e._id && n.periode===periode && n.type==="Composition");
    let tot=0, totC=0;
    const notesMat = matieres.map(mat => {
      const nm = ne.filter(n=>n.matiere===mat.nom);
      const moy = nm.length ? nm.reduce((s,n)=>s+Number(n.note),0)/nm.length : null;
      const coef = mat.coefficient||1;
      totC+=coef; // toutes les matières comptent au dénominateur
      if(moy!==null){ tot+=moy*coef; }
      return {nom:mat.nom, coef, moy};
    });
    const moyGene = totC>0 ? tot/totC : null;
    return {eleve:e, notesMat, moyGene};
  }).filter(r=>r.moyGene!==null).sort((a,b)=>b.moyGene-a.moyGene);

  if(resultats.length===0){ alert("Aucun résultat de composition trouvé pour cette sélection."); return; }

  // Stats récapitulatives
  const nb = resultats.length;
  const moyClasse = resultats.reduce((s,r)=>s+r.moyGene,0)/nb;
  const plus_haute = Math.max(...resultats.map(r=>r.moyGene));
  const plus_basse = Math.min(...resultats.map(r=>r.moyGene));
  const admis = resultats.filter(r=>r.moyGene>=mi).length;
  const dist = {"Très Bien":0,"Bien":0,"Assez Bien":0,"Passable":0,"Insuffisant":0};
  resultats.forEach(r=>{ dist[apprec(r.moyGene.toFixed(2))]++; });

  // Colonnes matières
  const thMat = matieres.map(m=>`<th style="text-align:center;font-size:10px;padding:6px 4px">${m.nom}<br/><small style="font-weight:normal">Coef ${m.coefficient||1}</small></th>`).join("");

  // Lignes élèves avec rang
  let rang=1;
  const rows = resultats.map((r,i)=>{
    if(i>0 && r.moyGene.toFixed(2)!==resultats[i-1].moyGene.toFixed(2)) rang=i+1;
    const m = apprec(r.moyGene.toFixed(2));
    const tdMat = r.notesMat.map(n=>`<td style="text-align:center;font-size:12px">${n.moy!==null?n.moy.toFixed(2):"—"}</td>`).join("");
    return `<tr style="background:${i%2===0?"#fff":"#f9f9f9"}">
      <td style="text-align:center;font-weight:800;color:${rang===1?"#d97706":rang===2?"#6b7280":rang===3?"#92400e":"#374151"};font-size:14px">${rang===1?"🥇":rang===2?"🥈":rang===3?"🥉":rang}</td>
      <td style="font-weight:700;padding:7px 8px">${r.eleve.nom} ${r.eleve.prenom}</td>
      <td style="text-align:center;font-size:11px;color:#555">${r.eleve.matricule||"—"}</td>
      ${tdMat}
      <td style="text-align:center;font-weight:800;font-size:14px;color:${r.moyGene>=mi?"#1a6b30":"#b91c1c"}">${r.moyGene.toFixed(2)}</td>
      <td style="text-align:center"><span style="padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:${mentionBg(m)};color:${mentionColor(m)}">${m}</span></td>
    </tr>`;
  }).join("");

  const w = window.open("","_blank");
  w.document.write(`<!DOCTYPE html><html lang="${printLang()}" dir="${printDir()}"><head><meta charset="utf-8"/>
  <title>${tr("reports.compositionResults")} — ${periode}</title>
  <style>
    ${PRINT_RESET}
    body{font-family:Arial,sans-serif;padding:14mm 12mm;font-size:12px;color:#1a1a1a;margin:0}
    h2{color:#0A1628;text-align:center;margin:10px 0 4px;font-size:16px}
    h3{text-align:center;margin:0 0 14px;font-size:13px;color:#555;font-weight:normal}
    table{width:100%;border-collapse:collapse;margin-top:10px;font-size:11px}
    th{background:#0A1628;color:#fff;padding:7px 6px;text-align:left}
    td{padding:6px 8px;border-bottom:1px solid #eee;vertical-align:middle}
    .recap{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:16px}
    .recap-card{background:#f0f6f2;border-left:4px solid #0A1628;border-radius:6px;padding:10px 14px}
    .recap-card .val{font-size:20px;font-weight:800;color:#0A1628}
    .recap-card .lbl{font-size:10px;color:#555;margin-top:2px}
    .dist{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
    .dist-item{flex:1;min-width:80px;padding:8px;border-radius:6px;text-align:center}
    .dist-item .dv{font-size:18px;font-weight:800}
    .dist-item .dl{font-size:10px;margin-top:2px}
    .sigs{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:32px}
    .sig{border-top:2px solid #0A1628;padding-top:8px;text-align:center;font-size:11px;color:#555}
    @media print{button{display:none}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    ${WATERMARK_CSS}
  </style></head><body>
  ${watermarkHtml(schoolInfo)}
  ${enteteDoc(schoolInfo, schoolInfo.logo)}
  <h2>${tr("reports.compositionResults").toUpperCase()} — ${periode} — ${tr("reports.schoolYear")} ${getAnnee()}</h2>
  <h3>${tr("reports.class")} : <strong>${classe==="all"?tr("common.all"):classe}</strong> &nbsp;|&nbsp; <strong>${nb}</strong></h3>

  <table>
    <thead><tr>
      <th style="text-align:center;width:40px">${tr("reports.rank")}</th>
      <th>${tr("reports.studentName")}</th>
      <th style="text-align:center">${tr("school.bulletins.matricule")}</th>
      ${thMat}
      <th style="text-align:center">${tr("reports.average")}/${maxNote}</th>
      <th style="text-align:center">${tr("reports.mention")}</th>
    </tr></thead>
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
  </div>

  <div class="sigs">
    <div class="sig">${tr("reports.director")}<br/><br/><br/>${tr("reports.signature")} & ${tr("reports.stamp")}</div>
    <div class="sig">${tr("reports.headTeacher")}<br/><br/><br/>${tr("reports.signature")}</div>
  </div>
  <script>${PRINT_TRIGGER}</script>
  </body></html>`);
  w.document.close();
};
