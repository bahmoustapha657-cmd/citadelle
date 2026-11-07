// ══════════════════════════════════════════════════════════════
//  Comptabilité — « 📅 Appliquer / ↩ Retirer la 5ème semaine »
// ══════════════════════════════════════════════════════════════
// La 5ème semaine (jours présents 5 fois dans le mois) n'est plus ajoutée
// d'office aux salaires du secondaire : le comptable la choisit mois par
// mois. Chaque fiche du secondaire du mois est recalculée comme « 🔄
// Actualiser », avec ou sans les heures de ces jours ; bons, révisions et
// retenues d'absences restent ceux de la fiche.
import { getFifthWeekDays, hasFifthWeekApplied } from "../../../salary-utils";
import { recalculerFicheSecondaire } from "../presences/presences-secondaire";

// Pur : les fiches à réécrire, et celles qu'on ne sait pas recalculer
// (saisies à la main pour un nom absent des fiches enseignants).
// `secondaire` : données de l'emploi du temps (cf. recalculerFicheSecondaire).
export function fichesCinquiemeSemaine({ salairesSec = [], appliquer, secondaire = {}, presences = [], anneeScolaire }) {
  const majs = [];
  let ignorees = 0;
  for (const sal of salairesSec) {
    if (hasFifthWeekApplied(sal) === appliquer) continue;
    const r = recalculerFicheSecondaire(sal, { ...secondaire, presences, anneeScolaire, avec5eme: appliquer });
    if (!r) { ignorees += 1; continue; }
    // La retenue « Abs. » ne change qu'avec « ✔ Appliquer les absences ».
    majs.push({ ...r.fiche, retenueAbsences: Number(sal.retenueAbsences || 0), detailAbsences: sal.detailAbsences || "" });
  }
  return { majs, ignorees };
}

export async function appliquerCinquiemeSemaine({
  appliquer, moisSel, salairesSec, secondaire, presences, anneeScolaire, readOnly, toast, modS, logAction,
}) {
  if (readOnly) return;
  const jours = getFifthWeekDays(moisSel);
  if (!jours.length) { toast("Ce mois n'a pas de 5ème semaine.", "info"); return; }
  const { majs, ignorees } = fichesCinquiemeSemaine({ salairesSec, appliquer, secondaire, presences, anneeScolaire });
  const noteManuelles = ignorees
    ? ` ${ignorees} fiche(s) saisie(s) à la main : corrigez leur colonne « 5è Sem » avec ✏️.`
    : "";
  if (!majs.length) {
    toast(`Rien à changer.${noteManuelles}`, ignorees ? "warning" : "info");
    return;
  }
  const liste = jours.join(", ");
  const question = appliquer
    ? `Appliquer la 5ème semaine (${liste}) aux salaires du secondaire de ${moisSel} ?\n\nLes heures de cours de ces jours seront payées une fois de plus.`
    : `Retirer la 5ème semaine (${liste}) des salaires du secondaire de ${moisSel} ?\n\nLes heures de cours de ces jours ne seront plus payées en plus.`;
  const detail = `\n\n${majs.length} fiche(s) recalculée(s) depuis l'emploi du temps (comme 🔄 Actualiser) ; bons, révisions et retenues conservés.`;
  if (!confirm(question + detail)) return;
  for (const sal of majs) await modS(sal);
  toast(`5ème semaine ${appliquer ? "appliquée" : "retirée"} : ${majs.length} fiche(s) mise(s) à jour.${noteManuelles}`, ignorees ? "warning" : "success");
  logAction(appliquer ? "5ème semaine appliquée" : "5ème semaine retirée", `Mois : ${moisSel} · ${liste} · ${majs.length} fiche(s)`);
}
