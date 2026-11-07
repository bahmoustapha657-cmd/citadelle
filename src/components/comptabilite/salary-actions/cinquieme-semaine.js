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
import i18n from "../../../i18n";
import { libelleJour, libelleMois } from "../../../i18n/libelles";

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
  if (!jours.length) { toast(i18n.t("accounting.sal.fifth.none"), "info"); return; }
  const { majs, ignorees } = fichesCinquiemeSemaine({ salairesSec, appliquer, secondaire, presences, anneeScolaire });
  const noteManuelles = ignorees
    ? ` ${i18n.t("accounting.sal.fifth.manualNote", { count: ignorees })}`
    : "";
  if (!majs.length) {
    toast(`${i18n.t("accounting.sal.fifth.nothing")}${noteManuelles}`, ignorees ? "warning" : "info");
    return;
  }
  // Journal en français (liste) ; fenêtres et messages dans la langue choisie.
  const liste = jours.join(", ");
  const libelles = { days: jours.map(libelleJour).join(", "), month: libelleMois(moisSel) };
  const question = i18n.t(appliquer ? "accounting.sal.fifth.askApply" : "accounting.sal.fifth.askRemove", libelles);
  const detail = `\n\n${i18n.t("accounting.sal.fifth.detail", { count: majs.length })}`;
  if (!confirm(question + detail)) return;
  for (const sal of majs) await modS(sal);
  toast(`${i18n.t(appliquer ? "accounting.sal.fifth.doneApplied" : "accounting.sal.fifth.doneRemoved", { count: majs.length })}${noteManuelles}`, ignorees ? "warning" : "success");
  logAction(appliquer ? "5ème semaine appliquée" : "5ème semaine retirée", `Mois : ${moisSel} · ${liste} · ${majs.length} fiche(s)`); // i18n-ignore
}
