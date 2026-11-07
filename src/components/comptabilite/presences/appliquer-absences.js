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
  if (moisSel === "__TOUS__") { toast("Sélectionnez un mois précis pour appliquer les absences.", "warning"); return; }
  const { majs, enAttente } = retenuesDuMois({ salairesMois, presences, anneeScolaire, schoolInfo, secondaire });
  const avertissement = enAttente
    ? `\n\n⚠️ ${enAttente} absence(s)/retard(s) encore « en attente » : ils ne seront PAS retenus tant qu'ils ne sont pas déclarés injustifiés.`
    : "";
  if (!majs.length) {
    toast(enAttente ? `Rien à changer. ${enAttente} fait(s) en attente de décision.` : "Retenues déjà à jour pour ce mois.", enAttente ? "warning" : "info");
    return;
  }
  const nbSec = majs.filter((s) => s.section === "Secondaire").length;
  const noteSec = nbSec ? `\n\nSecondaire : ${nbSec} fiche(s) recalculée(s) depuis l'emploi du temps et les heures « Absent » du mois (comme 🔄 Actualiser) ; bons et révisions conservés.` : "";
  if (!confirm(`Appliquer les retenues pour absences/retards du mois de ${moisSel} ?\n\n${majs.length} fiche(s) de paie seront mises à jour.${noteSec}${avertissement}`)) return;
  for (const sal of majs) await modS(sal);
  toast(`${majs.length} fiche(s) de paie mise(s) à jour.`, "success");
}
