// ══════════════════════════════════════════════════════════════
//  Comptabilité — orchestration "auto-générer les salaires"
// ══════════════════════════════════════════════════════════════
// Version pure des side effects UI (toast / confirm / logAction) reçus en
// injection : construit les messages, itère sur les mois cibles et résume.

import { getFifthWeekDays, getMissingSalaryProfiles } from "../../../salary-utils";

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
//  - ensCollege/ensLycee/ensPrimaire/personnel/primeDefaut : pour verifierFichesPaie
//  - UI : { toast, confirm, logAction }
export async function autoGenererSalairesAction({
  resync = false,
  moisSel,
  moisSalaire,
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
    if(secMissing.length) lignes.push(`• Secondaire sans prime horaire ni prime/classe : ${formatNomsListe(secMissing)}`);
    if(primMissing.length) lignes.push(`• Primaire sans forfait mensuel : ${formatNomsListe(primMissing)}`);
    if(persMissing.length) lignes.push(`• Personnel sans salaire de base : ${formatNomsListe(persMissing)}`);
    warningMissing = `\n\n⚠️ Fiches incomplètes (à compléter dans l'onglet Enseignants / Personnel) :\n${lignes.join("\n")}\n\nLeur ligne sera générée à 0 GNF — vous pourrez la corriger après.`;
  }
  const verbeAction = resync ? "Rafraîchir" : "Générer";
  const detailMode = resync
    ? "Les lignes existantes seront RECALCULÉES depuis la fiche enseignant et l'EDT actuels (V/H, prime horaire, observation). Les bons et révisions saisis manuellement seront conservés."
    : "Seuls les nouveaux enseignants seront ajoutés.";
  if(moisSel==="__TOUS__"){
    if(!confirm(`${verbeAction} les salaires pour les ${moisSalaire.length} mois de l'année scolaire ?\n\n${detailMode}${warningMissing}`)) return;
    let totalCree=0, totalResync=0, totalSupprime=0;
    for(const m of moisSalaire){
      const r = await genererPourMois(m,{resync});
      totalCree += r.nbCree; totalResync += r.nbResync; totalSupprime += r.nbSupprime;
    }
    const dedupMsg = totalSupprime ? ` · ${totalSupprime} doublon(s) supprimé(s)` : "";
    toast(`Prévision annuelle : ${totalCree} créé(s), ${totalResync} rafraîchi(s)${dedupMsg} sur ${moisSalaire.length} mois.`,"success");
    logAction("Salaires auto-générés (annuel)",`${totalCree} créés · ${totalResync} rafraîchis · ${totalSupprime} doublons supprimés · ${moisSalaire.join(", ")}`);
    return;
  }
  const jours5eme = getFifthWeekDays(moisSel);
  const info5eme = jours5eme.length ? `\n📅 5ème semaine détectée : ${jours5eme.join(", ")} → heures supplémentaires calculées automatiquement.` : "";
  if(!confirm(`${verbeAction} automatiquement les salaires pour ${moisSel} ?${info5eme}\n\n${detailMode}${warningMissing}`)) return;
  const {nbCree, nbResync, nbSupprime} = await genererPourMois(moisSel,{resync});
  const parts = [];
  if(nbSupprime) parts.push(`${nbSupprime} doublon(s) supprimé(s)`);
  if(nbCree) parts.push(`${nbCree} créé(s)`);
  if(nbResync) parts.push(`${nbResync} rafraîchi(s)`);
  if(!parts.length) parts.push("rien à faire");
  const baseMsg = `Salaires : ${parts.join(", ")}.`;
  const msg = totalMissing > 0
    ? `${baseMsg} ${totalMissing} fiche(s) sans paie — complétez-les dans l'onglet Enseignants/Personnel.`
    : baseMsg;
  toast(msg, totalMissing > 0 ? "warning" : "success");
  logAction(resync?"Salaires rafraîchis":"Salaires auto-générés",`Mois : ${moisSel} · ${nbCree} créés · ${nbResync} rafraîchis · ${nbSupprime} doublons supprimés`);
}
