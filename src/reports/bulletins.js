// ══════════════════════════════════════════════════════════════
//  Bulletins — point d'entrée (impression individuelle + groupée)
// ══════════════════════════════════════════════════════════════
// Les helpers de calcul vivent dans bulletins/bulletin-helpers.js, le
// gabarit HTML d'une page dans bulletins/bulletin-page.js et la fiche de
// compositions dans bulletins/fiche-compositions.js (réexportée ci-dessous).

import { getAnnee } from "../constants.js";
import { getPeriodesForSection } from "../period-utils.js";
import { getGeneralAverage } from "../note-utils";
import { notesDeLEleve } from "../note-index.js";
import { tr } from "./print-helpers.js";
import { qrSecuriseImgHtml, qrPayload } from "./qr.js";
import { assiduiteEleve } from "../absences-eleves.js";
import {
  getEvolutionPeriode,
  getMoyenneClasseParMatiere,
  getMoyennesPeriodes,
  getProfesseursParMatiere,
  getRangEleve,
  getRangsParMatiere,
  getStatsClasse,
  ordonnerParClassement,
} from "./bulletins/bulletin-helpers.js";
import { buildBulletinPageHTML, estModeleComplet, getModeleBulletin } from "./bulletins/bulletin-page.js";
import { ouvrirFenetreBulletin } from "./bulletins/bulletin-doc.js";
import { PERIODE_ANNEE, buildBulletinNotesAnnuelles } from "./bulletins/annual-notes.js";

export { imprimerFicheCompositions } from "./bulletins/fiche-compositions.js";
export { PERIODE_ANNEE } from "./bulletins/annual-notes.js";

// QR de vérification d'un bulletin : identité de l'élève + période + moyenne.
async function bulletinQrHtml({ eleve, notes, matieres, periode, niveau, maxNote, schoolInfo }) {
  const notesE = notesDeLEleve(notes, eleve._id, periode);
  const moy = getGeneralAverage(notesE, matieres, eleve.classe, niveau);
  return qrSecuriseImgHtml(qrPayload({
    EduGest: "Bulletin",
    Eleve: `${eleve.nom || ""} ${eleve.prenom || ""}`,
    IEN: eleve.ien,
    Classe: eleve.classe,
    Periode: periode === PERIODE_ANNEE ? "Annee" : periode,
    Moy: moy != null ? `${moy.toFixed(2)}/${maxNote}` : "",
    Annee: getAnnee(),
  }), schoolInfo, { size: getModeleBulletin(schoolInfo) === "compact" ? 68 : 92, alt: "QR bulletin" });
}

// Ce que seuls les modèles complets (Officiel, Prestige, Contemporain)
// impriment en plus. `notesReelles` = notes saisies, jamais les notes
// annuelles synthétiques (les professeurs et les périodes n'y figurent pas).
//
// Par classe : rang et professeur de chaque matière.
function extrasClasse({ classe, eleves, notes, notesReelles, matieres, periode, niveau, emplois }) {
  return {
    rangsParMatiere: eleves.length > 1 ? getRangsParMatiere(eleves, notes, matieres, periode, classe, niveau) : null,
    professeurs: getProfesseursParMatiere({
      classe, matieres, eleveIds: eleves.map((e) => e._id),
      notes: notesReelles, periode: periode === PERIODE_ANNEE ? null : periode, emplois: emplois || [],
    }),
  };
}

// Par élève : moyenne de chaque période, assiduité. Sans la liste des
// absences (portail parent), les cases d'assiduité restent à remplir.
const extrasEleve = ({ eleve, notesReelles, matieres, niveau, periodes, absences }) => ({
  moyennesPeriodes: getMoyennesPeriodes(eleve, notesReelles, matieres, eleve.classe, niveau, periodes),
  assiduite: Array.isArray(absences) ? assiduiteEleve(absences, eleve._id, getAnnee()) : null,
});

export const imprimerBulletin = async (eleve, notes, matieres, periode, niveau, maxNote = 20, schoolInfo = {}, options = {}) => {
  // Fenêtre ouverte AVANT l'await QR (geste utilisateur) pour éviter le blocage.
  const win = window.open("", "_blank");
  const allEleves = Array.isArray(options.allEleves) ? options.allEleves : null;
  let allNotes = Array.isArray(options.allNotes) ? options.allNotes : notes;
  const notesReelles = allNotes;
  const periodesSection = (Array.isArray(options.periodes) && options.periodes.length)
    ? options.periodes
    : getPeriodesForSection(schoolInfo, niveau);

  // Mode « Fin d'année » : on remplace les notes réelles par des notes
  // annuelles synthétiques (comme l'impression groupée), sinon le bulletin
  // individuel annuel serait vide (aucune note taguée sur PERIODE_ANNEE).
  // `options.periodes` = périodes réelles de la section (fournies par l'onglet
  // Bulletins). Le repli déduit la périodicité de `niveau`, qui porte
  // désormais la vraie section — getPeriodesForSection distingue préscolaire,
  // primaire et secondaire, alors que le test « === "primaire" » d'avant
  // rangeait la maternelle avec le collège.
  if (periode === PERIODE_ANNEE) {
    const baseEleves = (allEleves || [eleve]).filter((e) => e.classe === eleve.classe);
    allNotes = buildBulletinNotesAnnuelles({ eleves: baseEleves, notes: allNotes, matsFor: () => matieres, periodes: periodesSection, niveau });
    notes = allNotes;
  }

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

  const qr = await bulletinQrHtml({ eleve, notes: allNotes, matieres, periode, niveau, maxNote, schoolInfo });

  const extras = estModeleComplet(schoolInfo)
    ? {
        ...extrasClasse({
          classe: eleve.classe, eleves: elevesClasse || [eleve], notes: allNotes, notesReelles,
          matieres, periode, niveau, emplois: options.emplois,
        }),
        ...extrasEleve({ eleve, notesReelles, matieres, niveau, periodes: periodesSection, absences: options.absences }),
      }
    : {};

  const html = buildBulletinPageHTML({
    eleve, notes: allNotes, matieres, periode, niveau, maxNote, schoolInfo,
    rang, classStats, matiereClasseAvg, evolution,
    appreciation: options.appreciation || "", qr, ...extras,
  });

  ouvrirFenetreBulletin({
    title: `${tr("reports.bulletinTitle")} — ${eleve.nom || ""} ${eleve.prenom || ""} — ${periode}`,
    body: html,
    schoolInfo,
    win,
  });
};

// ── IMPRESSION GROUPÉE : tous les bulletins d'une classe en un seul PDF ──
// `extras` : { absences, emplois } du module École, pour l'assiduité et les
// professeurs des modèles complets.
export const imprimerBulletinsGroupes = async (eleves, notes, matieres, periode, niveau, maxNote = 20, schoolInfo = {}, classe = "", matieresParClasseFn = null, appreciationsParEleve = {}, periodesSection = null, extras = {}) => {
  if (!eleves.length) { alert("Aucun élève pour cette sélection."); return; }
  // Fenêtre ouverte AVANT tout await QR (geste utilisateur).
  const win = window.open("", "_blank");
  const getMatCl = (cl) => (matieresParClasseFn ? matieresParClasseFn(cl) : matieres);
  const getMat = (eleve) => getMatCl(eleve.classe);
  const complet = estModeleComplet(schoolInfo);
  const notesReelles = notes;
  const periodesReelles = (Array.isArray(periodesSection) && periodesSection.length)
    ? periodesSection
    : getPeriodesForSection(schoolInfo, niveau);

  // Mode « Fin d'année » : on remplace les notes par des notes annuelles
  // synthétiques (moyenne des périodes), puis le pipeline normal calcule
  // moyennes, rang et mention sur la période sentinelle PERIODE_ANNEE.
  // `periodesSection` = périodes réelles de la section (voir imprimerBulletin).
  if (periode === PERIODE_ANNEE) {
    notes = buildBulletinNotesAnnuelles({ eleves, notes, matsFor: getMat, periodes: periodesReelles, niveau });
  }

  // Cache par classe : stats + moyennes par matière (+ rangs et professeurs
  // par matière pour les modèles complets)
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
        extras: complet
          ? extrasClasse({ classe: cl, eleves: elevesClasse, notes, notesReelles, matieres: matsCl, periode, niveau, emplois: extras?.emplois })
          : null,
      });
    }
    return classCache.get(cl);
  };

  // Ordre d'impression : classes regroupées, puis par CLASSEMENT (meilleure
  // moyenne en premier) au sein de chaque classe.
  const { ordonnes: elevesOrdonnes, rangParEleve } = ordonnerParClassement(eleves, notes, getMatCl, periode, niveau);

  const pagesListe = await Promise.all(elevesOrdonnes.map(async (eleve) => {
    const matsEleve = getMat(eleve);
    const cache = getCacheClasse(eleve.classe);
    const rang = rangParEleve.get(eleve._id);
    const evolution = getEvolutionPeriode(eleve, notes, matsEleve, eleve.classe, niveau, periode, schoolInfo);
    const qr = await bulletinQrHtml({ eleve, notes, matieres: matsEleve, periode, niveau, maxNote, schoolInfo });
    const supplements = complet
      ? {
          ...cache.extras,
          ...extrasEleve({ eleve, notesReelles, matieres: matsEleve, niveau, periodes: periodesReelles, absences: extras?.absences }),
        }
      : {};
    return buildBulletinPageHTML({
      eleve, notes, matieres: matsEleve, periode, niveau, maxNote, schoolInfo,
      rang, classStats: cache.stats, matiereClasseAvg: cache.matieresAvg, evolution,
      appreciation: (appreciationsParEleve && appreciationsParEleve[eleve._id]) || "", qr,
      ...supplements,
    });
  }));

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
    win,
  });
};
