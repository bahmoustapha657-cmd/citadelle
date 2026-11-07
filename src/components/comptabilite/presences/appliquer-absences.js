// « ✔ Appliquer les absences » : reporte sur chaque fiche de paie du mois la
// retenue calculée depuis le registre des présences — comme « Appliquer les
// bons » reporte les bons. Une fiche dont la retenue tombe à zéro (absence
// justifiée depuis) est remise à zéro.
//  - forfait (primaire, personnel) : retenue = forfait ÷ jours ouvrables ;
//  - secondaire (à l'heure) : la fiche est recalculée comme « 🔄 Actualiser »
//    (heures « Absent » du mois, hors jours justifiés) + retenue des absences
//    du registre non saisies en heures et des retards (presences-secondaire).
import { calculerRetenue, reglagesPresences, SECTIONS_FORFAIT } from "./presences-utils";
import { ficheModifiee, recalculerFicheSecondaire } from "./presences-secondaire";
import i18n from "../../../i18n";
import { libelleMois } from "../../../i18n/libelles";

// Pur : les fiches à modifier, avec leurs nouvelles valeurs, et le nombre de
// faits encore en attente de décision (non retenus). `secondaire` : données
// de l'emploi du temps (cf. recalculerFicheSecondaire) ; sans elles, les
// fiches du secondaire ne sont pas touchées.
export function retenuesDuMois({ salairesMois = [], presences = [], anneeScolaire, schoolInfo, secondaire = null }) {
  const reglages = reglagesPresences(schoolInfo);
  const majs = [];
  let enAttente = 0;
  for (const sal of salairesMois) {
    if (SECTIONS_FORFAIT.has(sal.section)) {
      const r = calculerRetenue(sal, presences, { anneeScolaire, reglages });
      enAttente += r.enAttente;
      if (r.montant !== Number(sal.retenueAbsences || 0) || (r.detail || "") !== (sal.detailAbsences || "")) {
        majs.push({ ...sal, retenueAbsences: r.montant, detailAbsences: r.detail });
      }
    } else if (sal.section === "Secondaire" && secondaire) {
      const r = recalculerFicheSecondaire(sal, { ...secondaire, presences, anneeScolaire, reglages });
      if (!r) continue;
      enAttente += r.retenue.enAttente;
      if (ficheModifiee(sal, r.fiche)) majs.push(r.fiche);
    }
  }
  return { majs, enAttente };
}

export async function appliquerAbsences({ moisSel, salairesMois, presences, anneeScolaire, schoolInfo, secondaire, readOnly, toast, modS }) {
  if (readOnly) return;
  if (moisSel === "__TOUS__") { toast(i18n.t("accounting.att.apply.pickMonth"), "warning"); return; }
  const { majs, enAttente } = retenuesDuMois({ salairesMois, presences, anneeScolaire, schoolInfo, secondaire });
  const avertissement = enAttente
    ? `\n\n${i18n.t("accounting.att.apply.pendingWarn", { count: enAttente })}`
    : "";
  if (!majs.length) {
    toast(enAttente ? i18n.t("accounting.att.apply.nothingPending", { count: enAttente }) : i18n.t("accounting.att.apply.upToDate"), enAttente ? "warning" : "info");
    return;
  }
  const nbSec = majs.filter((s) => s.section === "Secondaire").length;
  const noteSec = nbSec ? `\n\n${i18n.t("accounting.att.apply.secNote", { count: nbSec })}` : "";
  if (!confirm(`${i18n.t("accounting.att.apply.confirm", { month: libelleMois(moisSel), count: majs.length })}${noteSec}${avertissement}`)) return;
  for (const sal of majs) await modS(sal);
  toast(i18n.t("accounting.att.apply.done", { count: majs.length }), "success");
}
