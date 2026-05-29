// ══════════════════════════════════════════════════════════════
//  Bulletins — point d'entrée (impression individuelle + groupée)
// ══════════════════════════════════════════════════════════════
// Les helpers de calcul vivent dans bulletins/bulletin-helpers.js, le
// gabarit HTML d'une page dans bulletins/bulletin-page.js et la fiche de
// compositions dans bulletins/fiche-compositions.js (réexportée ci-dessous).

import { getAnnee } from "../constants.js";
import {
  PRINT_TRIGGER,
  WATERMARK_CSS,
  printDir,
  printLang,
  tr,
  watermarkHtml,
} from "./print-helpers.js";
import {
  getEvolutionPeriode,
  getMoyenneClasseParMatiere,
  getRangEleve,
  getStatsClasse,
} from "./bulletins/bulletin-helpers.js";
import { buildBulletinPageHTML, getBulletinStyles } from "./bulletins/bulletin-page.js";

export { imprimerFicheCompositions } from "./bulletins/fiche-compositions.js";

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
