// ══════════════════════════════════════════════════════════════
//  Bulletins — point d'entrée (impression individuelle + groupée)
// ══════════════════════════════════════════════════════════════
// Les helpers de calcul vivent dans bulletins/bulletin-helpers.js, le
// gabarit HTML d'une page dans bulletins/bulletin-page.js et la fiche de
// compositions dans bulletins/fiche-compositions.js (réexportée ci-dessous).

import { getAnnee } from "../constants.js";
import { getPeriodesForSection } from "../period-utils.js";
import { tr } from "./print-helpers.js";
import {
  getEvolutionPeriode,
  getMoyenneClasseParMatiere,
  getRangEleve,
  getStatsClasse,
} from "./bulletins/bulletin-helpers.js";
import { buildBulletinPageHTML, getModeleBulletin } from "./bulletins/bulletin-page.js";
import { ouvrirFenetreBulletin } from "./bulletins/bulletin-doc.js";
import { PERIODE_ANNEE, buildBulletinNotesAnnuelles } from "./bulletins/annual-notes.js";

export { imprimerFicheCompositions } from "./bulletins/fiche-compositions.js";
export { PERIODE_ANNEE } from "./bulletins/annual-notes.js";

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

  ouvrirFenetreBulletin({
    title: `${tr("reports.bulletinTitle")} — ${eleve.nom || ""} ${eleve.prenom || ""} — ${periode}`,
    body: html,
    schoolInfo,
  });
};

// ── IMPRESSION GROUPÉE : tous les bulletins d'une classe en un seul PDF ──
export const imprimerBulletinsGroupes = (eleves, notes, matieres, periode, niveau, maxNote = 20, schoolInfo = {}, classe = "", matieresParClasseFn = null, appreciationsParEleve = {}) => {
  if (!eleves.length) { alert("Aucun élève pour cette sélection."); return; }
  const getMat = (eleve) => (matieresParClasseFn ? matieresParClasseFn(eleve.classe) : matieres);

  // Mode « Fin d'année » : on remplace les notes par des notes annuelles
  // synthétiques (moyenne des périodes), puis le pipeline normal calcule
  // moyennes, rang et mention sur la période sentinelle PERIODE_ANNEE.
  if (periode === PERIODE_ANNEE) {
    const periodesReelles = getPeriodesForSection(schoolInfo, niveau === "primaire" ? "primaire" : "secondaire");
    notes = buildBulletinNotesAnnuelles({ eleves, notes, matsFor: getMat, periodes: periodesReelles, niveau });
  }

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

  const pagesListe = eleves.map((eleve) => {
    const matsEleve = getMat(eleve);
    const cache = getCacheClasse(eleve.classe);
    const rang = getRangEleve(eleve, cache.elevesClasse, notes, matsEleve, periode, eleve.classe, niveau);
    const evolution = getEvolutionPeriode(eleve, notes, matsEleve, eleve.classe, niveau, periode, schoolInfo);
    return buildBulletinPageHTML({
      eleve, notes, matieres: matsEleve, periode, niveau, maxNote, schoolInfo,
      rang, classStats: cache.stats, matiereClasseAvg: cache.matieresAvg, evolution,
      appreciation: (appreciationsParEleve && appreciationsParEleve[eleve._id]) || "",
    });
  });

  // Modèle compact : deux bulletins par feuille A4 — on apparie les pages
  // dans des conteneurs .feuille qui portent le saut de page.
  let pages;
  if (getModeleBulletin(schoolInfo) === "compact") {
    const feuilles = [];
    for (let i = 0; i < pagesListe.length; i += 2) {
      feuilles.push(`<div class="feuille">${pagesListe.slice(i, i + 2).join("")}</div>`);
    }
    pages = feuilles.join("");
  } else {
    pages = pagesListe.join("");
  }

  const titrePeriode = periode === PERIODE_ANNEE ? tr("reports.annual") : periode;
  ouvrirFenetreBulletin({
    title: `${tr("reports.bulletinTitle")} ${classe || niveau} — ${titrePeriode} — ${tr("reports.schoolYear")} ${getAnnee()}`,
    body: pages,
    schoolInfo,
  });
};
