// ══════════════════════════════════════════════════════════════
//  Comptabilité — orchestration "auto-générer les salaires"
// ══════════════════════════════════════════════════════════════
// Version pure des side effects UI (toast / confirm / logAction) reçus en
// injection : construit les messages, itère sur les mois cibles et résume.

import { getFifthWeekDays, getMissingSalaryProfiles, monthHasFifthWeek } from "../../../salary-utils";
import i18n from "../../../i18n";
import { libelleJour, libelleMois } from "../../../i18n/libelles";

// Détecte les fiches enseignant/personnel sans paie configurée — leur
// retour permet au caller d'afficher un message pédagogique avant la
// génération auto (sinon ces lignes sortent à 0 GNF).
export function verifierFichesPaie({ ensCollege, ensLycee, ensPrimaire, personnel, primeDefaut }) {
  return getMissingSalaryProfiles({ ensCollege, ensLycee, ensPrimaire, personnel, primeDefaut });
}

// Concatène jusqu'à 3 noms et ajoute "+N" pour les suivants.
// Utilisé dans les messages d'alerte UI (toasts + confirm()).
export function formatNomsListe(liste) {
  const noms = liste.slice(0,3).map(e=>`${e.prenom||""} ${e.nom||""}`.trim()).filter(Boolean).join(", ");
  return noms + (liste.length>3?` +${liste.length-3}`:"");
}

// Orchestrateur "auto-générer les salaires" — itère sur les mois cibles via
// genererPourMois (passé en param) et produit le toast récapitulatif.
//
// Args :
//  - resync : recalcule les fiches existantes plutôt que de skipper
//  - moisSel : mois ciblé ("__TOUS__" → annuel)
//  - moisSalaire : liste des mois de l'année (utile en mode annuel)
//  - genererPourMois : (mois, {resync}) => Promise<{nbCree, nbResync, nbSupprime}>
//  - salaires : fiches existantes (la 5ᵉ semaine suit le choix du mois)
//  - ensCollege/ensLycee/ensPrimaire/personnel/primeDefaut : pour verifierFichesPaie
//  - UI : { toast, confirm, logAction }
export async function autoGenererSalairesAction({
  resync = false,
  moisSel,
  moisSalaire,
  salaires = [],
  genererPourMois,
  ensCollege, ensLycee, ensPrimaire, personnel, primeDefaut,
  toast, confirm, logAction,
}) {
  const {secMissing, primMissing, persMissing} = verifierFichesPaie({
    ensCollege, ensLycee, ensPrimaire, personnel, primeDefaut,
  });
  const totalMissing = secMissing.length + primMissing.length + persMissing.length;
  let warningMissing = "";
  if(totalMissing > 0){
    const lignes = [];
    if(secMissing.length) lignes.push(i18n.t("accounting.sal.gen.secMissing", { names: formatNomsListe(secMissing) }));
    if(primMissing.length) lignes.push(i18n.t("accounting.sal.gen.primMissing", { names: formatNomsListe(primMissing) }));
    if(persMissing.length) lignes.push(i18n.t("accounting.sal.gen.persMissing", { names: formatNomsListe(persMissing) }));
    warningMissing = `\n\n${i18n.t("accounting.sal.gen.missingWarning", { lines: lignes.join("\n") })}`;
  }
  const detailMode = i18n.t(resync ? "accounting.sal.gen.modeRefresh" : "accounting.sal.gen.modeGenerate");
  if(moisSel==="__TOUS__"){
    const question = i18n.t(resync ? "accounting.sal.gen.askYearRefresh" : "accounting.sal.gen.askYearGenerate", { count: moisSalaire.length });
    if(!confirm(`${question}\n\n${detailMode}${warningMissing}`)) return;
    let totalCree=0, totalResync=0, totalSupprime=0;
    for(const m of moisSalaire){
      const r = await genererPourMois(m,{resync});
      totalCree += r.nbCree; totalResync += r.nbResync; totalSupprime += r.nbSupprime;
    }
    const dedupMsg = totalSupprime ? ` · ${i18n.t("accounting.sal.gen.dedup", { count: totalSupprime })}` : "";
    toast(i18n.t("accounting.sal.gen.yearDone", {
      created: i18n.t("accounting.sal.gen.created", { count: totalCree }),
      refreshed: i18n.t("accounting.sal.gen.refreshed", { count: totalResync }),
      dedup: dedupMsg,
      months: moisSalaire.length,
    }),"success");
    logAction("Salaires auto-générés (annuel)",`${totalCree} créés · ${totalResync} rafraîchis · ${totalSupprime} doublons supprimés · ${moisSalaire.join(", ")}`); // i18n-ignore
    return;
  }
  const jours5eme = getFifthWeekDays(moisSel);
  const days = jours5eme.map(libelleJour).join(", ");
  const info5eme = !jours5eme.length ? ""
    : `\n${i18n.t(monthHasFifthWeek(salaires, moisSel) ? "accounting.sal.gen.fifthApplied" : "accounting.sal.gen.fifthNotCounted", { days })}`;
  const question = i18n.t(resync ? "accounting.sal.gen.askMonthRefresh" : "accounting.sal.gen.askMonthGenerate", { month: libelleMois(moisSel) });
  if(!confirm(`${question}${info5eme}\n\n${detailMode}${warningMissing}`)) return;
  const {nbCree, nbResync, nbSupprime} = await genererPourMois(moisSel,{resync});
  const parts = [];
  if(nbSupprime) parts.push(i18n.t("accounting.sal.gen.dedup", { count: nbSupprime }));
  if(nbCree) parts.push(i18n.t("accounting.sal.gen.created", { count: nbCree }));
  if(nbResync) parts.push(i18n.t("accounting.sal.gen.refreshed", { count: nbResync }));
  if(!parts.length) parts.push(i18n.t("accounting.sal.gen.nothing"));
  const baseMsg = i18n.t("accounting.sal.gen.monthDone", { parts: parts.join(", ") });
  const msg = totalMissing > 0
    ? `${baseMsg} ${i18n.t("accounting.sal.gen.missingAfter", { count: totalMissing })}`
    : baseMsg;
  toast(msg, totalMissing > 0 ? "warning" : "success");
  logAction(resync?"Salaires rafraîchis":"Salaires auto-générés",`Mois : ${moisSel} · ${nbCree} créés · ${nbResync} rafraîchis · ${nbSupprime} doublons supprimés`); // i18n-ignore
}
