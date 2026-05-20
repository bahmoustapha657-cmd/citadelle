// ══════════════════════════════════════════════════════════════
//  Comptabilité — actions de génération automatique des salaires
// ══════════════════════════════════════════════════════════════
// Extrait de Comptabilite.jsx au refactor découpage 2026-05-20.
// Logique pure : pas d'état React, juste de la transformation Firestore
// via les helpers ajS/modS/supS injectés.

import { getTeacherMonthlyForfait } from "../../teacher-utils";
import {
  buildPersonnelSalaryRecord,
  buildPrimarySalaryRecord,
  buildSecondarySalaryRecord,
  findExistingSalaryDuplicates,
  findSalaryDuplicate,
  getFifthWeekDays,
  getMissingSalaryProfiles,
  mergeSalaryWithManualFields,
  pickBestSalaryFromGroup,
} from "../../salary-utils";

// Génère ou rafraîchit les fiches de paie d'UN mois donné.
// Le caller (parent React) injecte les datasets + les Firestore mutators.
//
// Algorithme :
// 1. Récupère les salaires actuels du mois.
// 2. Nettoie les doublons préexistants (legacy/race conditions) via un
//    pickBest + supS sur les autres.
// 3. Pour chaque enseignant secondaire / primaire / personnel actif :
//    - Calcule la fiche attendue (buildXxxSalaryRecord)
//    - Si déjà présente : skip (sauf resync → modS avec merge des manuels)
//    - Sinon : ajS la nouvelle fiche.
//
// Retourne { nbCree, nbResync, nbSupprime } pour reporting UI.
export async function genererSalairesPourMois(mois, {
  // Datasets
  salaires,
  ensCollege, ensLycee, ensPrimaire, personnel,
  emploisCollege, emploisLycee, engCollege, engLycee,
  primeDefaut,
  // Annee à stocker sur les nouveaux records
  annee,
  // Mutators Firestore
  modS, ajS, supS,
  // Options
  resync = false,
}) {
  const jours5eme = getFifthWeekDays(mois);
  // Accumulateur local mis à jour à chaque ajS pour que les itérations
  // suivantes voient les fiches tout juste créées. Sinon la liste
  // `salaires` (réactive) n'est rafraîchie qu'après le retour du
  // listener Firestore, ce qui peut arriver après la fin de la boucle
  // et produit des doublons (notamment quand un même nom apparait
  // plusieurs fois dans ensPrimaire, ou entre collège+lycée).
  let acc = salaires.filter(s=>s.mois===mois).slice();

  // ── Nettoyage des doublons préexistants ──
  // Le dédup à la saisie/auto-gen empêche les nouveaux doublons, mais
  // des fiches en double peuvent subsister (data legacy, race conditions
  // d'une ancienne version, import). On fusionne par (nom normalisé,
  // mois, section) : on garde la fiche avec saisie manuelle (bon ou
  // revision > 0) ou à défaut la plus récente, et on supprime les autres.
  let nbSupprime = 0;
  const dupGroups = findExistingSalaryDuplicates(acc);
  if (dupGroups.size > 0) {
    const toDeleteIds = new Set();
    for (const group of dupGroups.values()) {
      const best = pickBestSalaryFromGroup(group);
      for (const fiche of group) {
        if (fiche._id && fiche._id !== best?._id) toDeleteIds.add(fiche._id);
      }
    }
    for (const id of toDeleteIds) {
      await supS(id);
      nbSupprime++;
    }
    acc = acc.filter((s) => !toDeleteIds.has(s._id));
  }

  // findSalaryDuplicate matche par nom+mois+section (normalisation
  // accents/casse/suffixe legacy). Une même personne dans 2 sections
  // distinctes (ex: prof secondaire + agent administratif) ne déclenche
  // donc PAS de faux doublon.
  const trouverExistant = (record) => findSalaryDuplicate(record, acc);
  const noterCree = (record, ref) => acc.push({...record, _id: ref?.id});
  let nbCree = 0, nbResync = 0;

  const tousEns=[
    ...ensCollege.map(e=>({...e,_emplois:emploisCollege,_eng:engCollege})),
    ...ensLycee.map(e=>({...e,_emplois:emploisLycee,_eng:engLycee})),
  ];
  for(const ens of tousEns){
    const salaireCalcule = buildSecondarySalaryRecord(ens, {
      mois,
      emplois: ens._emplois,
      enseignements: ens._eng,
      jours5eme,
      primeDefaut,
    });
    if(!salaireCalcule) continue;
    const existant=trouverExistant(salaireCalcule);
    if(existant && !resync) continue;
    if(existant){
      await modS(mergeSalaryWithManualFields(existant, salaireCalcule));
      nbResync++;
    } else {
      const record = {...salaireCalcule,bon:0,revision:0,annee};
      const ref = await ajS(record);
      noterCree(record, ref);
      nbCree++;
    }
  }

  for(const ens of ensPrimaire){
    const salaireCalcule = buildPrimarySalaryRecord(ens, {
      mois,
      getTeacherMonthlyForfait,
    });
    if(!salaireCalcule) continue;
    const existant=trouverExistant(salaireCalcule);
    if(existant && !resync) continue;
    if(existant){
      await modS(mergeSalaryWithManualFields(existant, salaireCalcule));
      nbResync++;
    } else {
      const record = {...salaireCalcule,bon:0,revision:0,annee};
      const ref = await ajS(record);
      noterCree(record, ref);
      nbCree++;
    }
  }

  for(const emp of personnel.filter(e=>(e.statut||"Actif")==="Actif")){
    const salaireCalcule = buildPersonnelSalaryRecord(emp, { mois });
    if(!salaireCalcule) continue;
    const existant=trouverExistant(salaireCalcule);
    if(existant && !resync) continue;
    if(existant){
      await modS(mergeSalaryWithManualFields(existant, salaireCalcule));
      nbResync++;
    } else {
      const record = {...salaireCalcule,bon:0,revision:0,annee};
      const ref = await ajS(record);
      noterCree(record, ref);
      nbCree++;
    }
  }
  return {nbCree, nbResync, nbSupprime};
}

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

// Orchestrateur "auto-générer les salaires" — version pure des side
// effects UI (toast / confirm / logAction) reçus en injection. Construit
// le message de confirmation détaillé (avec liste des fiches incomplètes),
// itère sur les mois cibles via genererPourMois (passé en param), et
// produit le toast récapitulatif.
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
