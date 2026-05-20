// ══════════════════════════════════════════════════════════════
//  Bulletins — version 2 (refonte 2026-05-02)
// ══════════════════════════════════════════════════════════════
// Bulletin individuel + groupé par classe + fiche de compositions.
// Helpers internes (mention, rang, stats, évolution) consolidés ici.

import { getAnnee } from "../constants.js";
import { getGeneralAverage, getSubjectAverage } from "../note-utils.js";
import { getPeriodesForSection } from "../period-utils.js";
import {
  getOfficialLegalFooterHTML,
  legalProfileMock,
  mapNiveauToCycle,
} from "../legal-utils.js";
import {
  PRINT_RESET,
  PRINT_TRIGGER,
  WATERMARK_CSS,
  enteteDoc,
  printDir,
  printLang,
  tr,
  watermarkHtml,
} from "./print-helpers.js";

function getMention(moy, maxNote) {
  if (moy === "—" || moy == null || moy === "") return "Non évalué";
  const v = Number(moy);
  if (!Number.isFinite(v)) return "Non évalué";
  if (v >= maxNote * 0.8) return "Très Bien";
  if (v >= maxNote * 0.7) return "Bien";
  if (v >= maxNote * 0.6) return "Assez Bien";
  if (v >= maxNote * 0.5) return "Passable";
  return "Insuffisant";
}

function getMentionColors(mention) {
  switch (mention) {
    case "Très Bien":  return { bg: "#dcfce7", color: "#166534", border: "#86efac" };
    case "Bien":       return { bg: "#dbeafe", color: "#1e40af", border: "#93c5fd" };
    case "Assez Bien": return { bg: "#fef3c7", color: "#92400e", border: "#fcd34d" };
    case "Passable":   return { bg: "#e0f2fe", color: "#0369a1", border: "#7dd3fc" };
    case "Insuffisant":return { bg: "#fee2e2", color: "#991b1b", border: "#fca5a5" };
    default:           return { bg: "#f3f4f6", color: "#6b7280", border: "#d1d5db" };
  }
}

function getInitiales(eleve = {}) {
  const p = (eleve.prenom || "").trim()[0] || "";
  const n = (eleve.nom || "").trim()[0] || "";
  return (p + n).toUpperCase() || "•";
}

function getNumeroBulletin(eleve, periode, schoolInfo, annee) {
  const code = String(schoolInfo.nom || "ECO").replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase() || "ECO";
  const an = String(annee || getAnnee()).split("-")[0].slice(-2);
  const per = String(periode).replace(/[^A-Z0-9]/gi, "").toUpperCase();
  const ref = eleve.matricule || (String(eleve._id || "").slice(-6).toUpperCase());
  return `BUL-${code}-${an}-${per}-${ref}`;
}

function ordinalFr(rang) {
  return rang === 1 ? "er" : "e";
}

function getStatsClasse(elevesClasse, notes, matieres, periode, classe, niveau) {
  const moyennes = elevesClasse
    .map((e) => {
      const notesE = notes.filter((n) => n.eleveId === e._id && n.periode === periode);
      return getGeneralAverage(notesE, matieres, classe, niveau);
    })
    .filter((v) => v != null);
  if (moyennes.length === 0) return null;
  const sum = moyennes.reduce((s, v) => s + v, 0);
  return {
    effectif: elevesClasse.length,
    nbEvalues: moyennes.length,
    moyenneClasse: sum / moyennes.length,
    min: Math.min(...moyennes),
    max: Math.max(...moyennes),
  };
}

function getMoyenneClasseParMatiere(elevesClasse, notes, matiereNom, periode, classe, niveau) {
  const moyennes = elevesClasse
    .map((e) => {
      const nm = notes.filter((n) => n.eleveId === e._id && n.periode === periode && n.matiere === matiereNom);
      return getSubjectAverage(nm, classe, niveau);
    })
    .filter((v) => v != null);
  return moyennes.length ? moyennes.reduce((s, v) => s + v, 0) / moyennes.length : null;
}

function getRangEleve(eleve, elevesClasse, notes, matieres, periode, classe, niveau) {
  const avecMoy = elevesClasse
    .map((e) => {
      const notesE = notes.filter((n) => n.eleveId === e._id && n.periode === periode);
      return { id: e._id, moy: getGeneralAverage(notesE, matieres, classe, niveau) };
    })
    .filter((x) => x.moy != null);
  if (avecMoy.length === 0) return null;
  avecMoy.sort((a, b) => b.moy - a.moy);
  let rang = 1;
  for (let i = 0; i < avecMoy.length; i++) {
    if (i > 0 && avecMoy[i].moy < avecMoy[i - 1].moy) rang = i + 1;
    if (avecMoy[i].id === eleve._id) return { rang, effectif: avecMoy.length };
  }
  return null;
}

function getEvolutionPeriode(eleve, allNotes, matieres, classe, niveau, periodeActuelle, schoolInfo = {}) {
  const sectionPeriode = niveau === "primaire" ? "primaire" : "secondaire";
  const periodes = getPeriodesForSection(schoolInfo, sectionPeriode);
  const idx = periodes.indexOf(periodeActuelle);
  if (idx <= 0) return null;
  const periodePrec = periodes[idx - 1];
  const notesActu = allNotes.filter((n) => n.eleveId === eleve._id && n.periode === periodeActuelle);
  const notesPrec = allNotes.filter((n) => n.eleveId === eleve._id && n.periode === periodePrec);
  const moyActu = getGeneralAverage(notesActu, matieres, classe, niveau);
  const moyPrec = getGeneralAverage(notesPrec, matieres, classe, niveau);
  if (moyActu == null || moyPrec == null) return null;
  return { periodePrec, moyPrec, moyActu, ecart: moyActu - moyPrec };
}

function buildBulletinPageHTML({
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
}) {
  const c1 = schoolInfo.couleur1 || "#0A1628";
  const c2 = schoolInfo.couleur2 || "#00C48C";
  const annee = getAnnee();

  const notesEleve = notes.filter((n) => n.eleveId === eleve._id && n.periode === periode);
  const lignes = matieres.map((mat) => {
    const noteMat = notesEleve.filter((n) => n.matiere === mat.nom);
    const moyenneMatiere = getSubjectAverage(noteMat, eleve.classe, niveau);
    const moy = moyenneMatiere != null ? moyenneMatiere.toFixed(2) : "—";
    return { mat: mat.nom, coef: mat.coefficient || 1, moy, moyClasse: matiereClasseAvg[mat.nom] };
  });
  const totalCoef = matieres.reduce((s, mat) => s + Number(mat.coefficient || 1), 0);
  const moyenneGenerale = getGeneralAverage(notesEleve, matieres, eleve.classe, niveau);
  const moyGene = moyenneGenerale != null ? moyenneGenerale.toFixed(2) : "—";
  const mention = getMention(moyGene, maxNote);
  const ms = getMentionColors(mention);
  const numero = getNumeroBulletin(eleve, periode, schoolInfo, annee);

  const tbody = lignes.map((l) => {
    const moyVal = l.moy === "—" ? null : Number(l.moy);
    const mLigne = getMention(l.moy, maxNote);
    const lc = getMentionColors(mLigne);
    const pct = moyVal != null ? Math.min(100, Math.max(0, (moyVal / maxNote) * 100)) : 0;
    const compare = (moyVal != null && l.moyClasse != null)
      ? (moyVal > l.moyClasse + 0.05
          ? `<span style="color:#16a34a;font-weight:700">↑ +${(moyVal - l.moyClasse).toFixed(1)}</span>`
          : moyVal < l.moyClasse - 0.05
            ? `<span style="color:#dc2626;font-weight:700">↓ ${(moyVal - l.moyClasse).toFixed(1)}</span>`
            : `<span style="color:#6b7280">=</span>`)
      : "";
    const moyClasseDisplay = l.moyClasse != null ? l.moyClasse.toFixed(1) : "—";
    return `<tr>
      <td>${l.mat}</td>
      <td style="text-align:center">${l.coef}</td>
      <td style="text-align:center">
        <div style="display:inline-flex;align-items:center;gap:6px">
          <strong style="color:${lc.color};min-width:32px;display:inline-block;text-align:right">${l.moy}</strong>
          <div style="width:48px;height:5px;background:#e5e7eb;border-radius:3px;overflow:hidden">
            <div style="width:${pct}%;height:100%;background:${lc.color}"></div>
          </div>
        </div>
      </td>
      <td style="text-align:center">${l.moy !== "—" ? (Number(l.moy) * l.coef).toFixed(2) : "—"}</td>
      <td style="text-align:center;font-size:10px;color:#6b7280">${moyClasseDisplay} ${compare}</td>
      <td style="background:${lc.bg};color:${lc.color};font-weight:600;font-size:10.5px">${mLigne}</td>
    </tr>`;
  }).join("");

  return `
  <div class="page">
    ${enteteDoc(schoolInfo, schoolInfo.logo)}

    <div style="background:linear-gradient(135deg,${c1},${c1}dd);color:#fff;padding:9px 16px;border-radius:8px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-size:13px;font-weight:800;letter-spacing:0.04em">${tr("reports.bulletinTitle").toUpperCase()}</div>
        <div style="font-size:11px;opacity:0.85">${periode} — ${tr("reports.schoolYear")} ${annee}</div>
      </div>
      <div style="font-size:9.5px;opacity:0.78;font-family:monospace;text-align:end">${tr("reports.bulletinNumber")} ${numero}</div>
    </div>

    <div style="display:grid;grid-template-columns:1.55fr 1fr;gap:12px;margin-bottom:12px">
      <div style="border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;display:flex;gap:12px;align-items:center">
        ${eleve.photo
          ? `<img src="${eleve.photo}" alt="" style="width:60px;height:60px;border-radius:8px;object-fit:cover;border:2px solid ${c1};flex-shrink:0"/>`
          : `<div style="width:60px;height:60px;border-radius:8px;background:${c1};color:#fff;font-weight:900;font-size:22px;display:flex;align-items:center;justify-content:center;flex-shrink:0">${getInitiales(eleve)}</div>`}
        <div style="flex:1;font-size:10.5px;line-height:1.6;min-width:0">
          <div style="font-size:14px;font-weight:800;color:${c1};margin-bottom:2px">${eleve.nom || ""} ${eleve.prenom || ""}</div>
          <div><strong>${tr("reports.class")} :</strong> ${eleve.classe || "—"} &nbsp;·&nbsp; <strong>${tr("school.bulletins.matricule")} :</strong> ${eleve.ien || "—"}</div>
          <div><strong>${tr("reports.dateOfBirth")} :</strong> ${eleve.dateNaissance || "—"}${eleve.lieuNaissance ? ` — ${eleve.lieuNaissance}` : ""}</div>
        </div>
      </div>

      <div style="border:2px solid ${ms.border};border-radius:8px;padding:10px 8px;text-align:center;background:${ms.bg}">
        <div style="font-size:8.5px;text-transform:uppercase;letter-spacing:0.08em;color:${ms.color};font-weight:700;margin-bottom:1px">${tr("reports.generalAverage")}</div>
        <div style="font-size:30px;font-weight:900;color:${ms.color};line-height:1.05">${moyGene}<span style="font-size:13px;opacity:0.65">/${maxNote}</span></div>
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
      <div class="sig">${tr("reports.director")}<br/><br/><br/>${tr("reports.signature")}</div>
      <div class="sig">${tr("reports.headTeacher")}<br/><br/><br/>${tr("reports.signature")}</div>
      <div class="sig">${tr("school.students.parent")}<br/><br/><br/>${tr("reports.signature")}</div>
    </div>

    <div class="devise" style="color:${c2}">${schoolInfo.devise || "Travail – Rigueur – Réussite"}</div>

    ${getOfficialLegalFooterHTML(schoolInfo.legal || legalProfileMock, mapNiveauToCycle(niveau))}
  </div>`;
}

function getBulletinStyles() {
  return `
    ${PRINT_RESET}
    body{font-family:Arial,sans-serif;padding:0;margin:0;font-size:11px;color:#1f2937}
    .page{padding:14mm 12mm;page-break-after:always;box-sizing:border-box}
    .page:last-child{page-break-after:auto}
    table{width:100%;border-collapse:collapse;margin-top:4px}
    th{color:#fff;padding:7px 9px;font-size:10.5px;text-align:left;border:1px solid rgba(0,0,0,0.05)}
    td{padding:6px 9px;border-bottom:1px solid #f1f5f9;font-size:11px;vertical-align:middle}
    tbody tr:nth-child(odd){background:#fafafa}
    .sigs{display:grid;grid-template-columns:1fr 1fr 1fr;gap:18px;margin-top:18px}
    .sig{border-top:1.5px solid #1f2937;padding-top:6px;text-align:center;font-size:10px;color:#555}
    .devise{text-align:center;font-size:10px;margin-top:8px;font-style:italic;font-weight:700}
    @media print{body{margin:0}button{display:none}.page{padding:18px 22px}}
  `;
}

export const imprimerBulletin = (eleve, notes, matieres, periode, niveau, maxNote = 20, schoolInfo = {}, options = {}) => {
  const allEleves = Array.isArray(options.allEleves) ? options.allEleves : null;
  const allNotes = Array.isArray(options.allNotes) ? options.allNotes : notes;
  const elevesClasse = allEleves ? allEleves.filter((e) => e.classe === eleve.classe) : null;

  const rang = elevesClasse
    ? getRangEleve(eleve, elevesClasse, allNotes, matieres, periode, eleve.classe, niveau)
    : null;
  const classStats = elevesClasse
    ? getStatsClasse(elevesClasse, allNotes, matieres, periode, eleve.classe, niveau)
    : null;
  const matiereClasseAvg = elevesClasse
    ? Object.fromEntries(matieres.map((mat) => [
        mat.nom,
        getMoyenneClasseParMatiere(elevesClasse, allNotes, mat.nom, periode, eleve.classe, niveau),
      ]))
    : {};
  const evolution = allNotes.length > notes.length || allEleves
    ? getEvolutionPeriode(eleve, allNotes, matieres, eleve.classe, niveau, periode, schoolInfo)
    : null;

  const html = buildBulletinPageHTML({
    eleve, notes: allNotes, matieres, periode, niveau, maxNote, schoolInfo,
    rang, classStats, matiereClasseAvg, evolution,
    appreciation: options.appreciation || "",
  });

  const w = window.open("", "_blank");
  w.document.write(`<!DOCTYPE html><html lang="${printLang()}" dir="${printDir()}"><head><meta charset="utf-8"/>
    <title>${tr("reports.bulletinTitle")} — ${eleve.nom || ""} ${eleve.prenom || ""} — ${periode}</title>
    <style>${getBulletinStyles()}${WATERMARK_CSS}</style>
  </head><body>${watermarkHtml(schoolInfo)}${html}<script>${PRINT_TRIGGER}</script></body></html>`);
  w.document.close();
};

// ── IMPRESSION GROUPÉE : tous les bulletins d'une classe en un seul PDF ──
export const imprimerBulletinsGroupes = (eleves, notes, matieres, periode, niveau, maxNote = 20, schoolInfo = {}, classe = "", matieresParClasseFn = null, appreciationsParEleve = {}) => {
  if (!eleves.length) { alert("Aucun élève pour cette sélection."); return; }
  const getMat = (eleve) => (matieresParClasseFn ? matieresParClasseFn(eleve.classe) : matieres);

  // Cache par classe : stats + moyennes par matière
  const classCache = new Map();
  const getCacheClasse = (cl) => {
    if (!classCache.has(cl)) {
      const matsCl = matieresParClasseFn ? matieresParClasseFn(cl) : matieres;
      const elevesClasse = eleves.filter((e) => e.classe === cl);
      classCache.set(cl, {
        stats: getStatsClasse(elevesClasse, notes, matsCl, periode, cl, niveau),
        matieresAvg: Object.fromEntries(matsCl.map((mat) => [
          mat.nom,
          getMoyenneClasseParMatiere(elevesClasse, notes, mat.nom, periode, cl, niveau),
        ])),
        elevesClasse,
      });
    }
    return classCache.get(cl);
  };

  const pages = eleves.map((eleve) => {
    const matsEleve = getMat(eleve);
    const cache = getCacheClasse(eleve.classe);
    const rang = getRangEleve(eleve, cache.elevesClasse, notes, matsEleve, periode, eleve.classe, niveau);
    const evolution = getEvolutionPeriode(eleve, notes, matsEleve, eleve.classe, niveau, periode, schoolInfo);
    return buildBulletinPageHTML({
      eleve, notes, matieres: matsEleve, periode, niveau, maxNote, schoolInfo,
      rang, classStats: cache.stats, matiereClasseAvg: cache.matieresAvg, evolution,
      appreciation: (appreciationsParEleve && appreciationsParEleve[eleve._id]) || "",
    });
  }).join("");

  const w = window.open("", "_blank");
  w.document.write(`<!DOCTYPE html><html lang="${printLang()}" dir="${printDir()}"><head>
  <meta charset="utf-8"/>
  <title>${tr("reports.bulletinTitle")} ${classe || niveau} — ${periode} — ${tr("reports.schoolYear")} ${getAnnee()}</title>
  <style>${getBulletinStyles()}${WATERMARK_CSS}</style>
  </head><body>${watermarkHtml(schoolInfo)}${pages}<script>${PRINT_TRIGGER}</script></body></html>`);
  w.document.close();
};

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
