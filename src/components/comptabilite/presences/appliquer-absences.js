// « ✔ Appliquer les absences » : reporte sur chaque fiche de paie au forfait
// du mois la retenue calculée depuis le registre des présences — comme
// « Appliquer les bons » reporte les bons. Une fiche dont la retenue tombe à
// zéro (absence justifiée depuis) est remise à zéro.
import { calculerRetenue, moisDeDate, reglagesPresences, SECTIONS_FORFAIT } from "./presences-utils";

// Pur : les fiches à modifier, avec leurs nouvelles valeurs, et le nombre de
// faits encore en attente de décision (non retenus).
export function retenuesDuMois({ salairesMois = [], presences = [], anneeScolaire, schoolInfo }) {
  const reglages = reglagesPresences(schoolInfo);
  const majs = [];
  let enAttente = 0;
  for (const sal of salairesMois) {
    if (!SECTIONS_FORFAIT.has(sal.section)) continue;
    const r = calculerRetenue(sal, presences, { anneeScolaire, reglages });
    enAttente += r.enAttente;
    if (r.montant !== Number(sal.retenueAbsences || 0) || (r.detail || "") !== (sal.detailAbsences || "")) {
      majs.push({ ...sal, retenueAbsences: r.montant, detailAbsences: r.detail });
    }
  }
  return { majs, enAttente };
}

// Faits du secondaire du mois : non retenus ici (paie à l'heure).
const faitsSecondaire = (presences, mois) =>
  presences.filter((p) => p.section === "Secondaire" && moisDeDate(p.date) === mois);

export async function appliquerAbsences({ moisSel, salairesMois, presences, anneeScolaire, schoolInfo, readOnly, toast, modS }) {
  if (readOnly) return;
  if (moisSel === "__TOUS__") { toast("Sélectionnez un mois précis pour appliquer les absences.", "warning"); return; }
  const { majs, enAttente } = retenuesDuMois({ salairesMois, presences, anneeScolaire, schoolInfo });
  const nbSec = faitsSecondaire(presences, moisSel).length;
  const avertissements = [
    enAttente ? `⚠️ ${enAttente} absence(s)/retard(s) encore « en attente » : ils ne seront PAS retenus tant qu'ils ne sont pas déclarés injustifiés.` : "",
    nbSec ? `ℹ️ Secondaire : ${nbSec} fait(s) du registre non retenus ici — la paie à l'heure retire déjà les heures « Absent » saisies dans Enseignements.` : "",
  ].filter(Boolean).join("\n\n");
  if (!majs.length) {
    toast(enAttente ? `Rien à changer. ${enAttente} fait(s) en attente de décision.` : "Retenues déjà à jour pour ce mois.", enAttente ? "warning" : "info");
    return;
  }
  if (!confirm(`Appliquer les retenues pour absences/retards du mois de ${moisSel} ?\n\n${majs.length} fiche(s) de paie seront mises à jour.${avertissements ? `\n\n${avertissements}` : ""}`)) return;
  for (const sal of majs) await modS(sal);
  toast(`${majs.length} fiche(s) de paie mise(s) à jour.`, "success");
}
