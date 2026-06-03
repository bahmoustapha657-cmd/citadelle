// ══════════════════════════════════════════════════════════════
//  Comptabilité — génération des fiches de paie d'un mois
// ══════════════════════════════════════════════════════════════
// Logique pure : pas d'état React, juste de la transformation Firestore
// via les helpers ajS/modS/supS injectés.

import { getTeacherMonthlyForfait } from "../../../teacher-utils";
import {
  buildPersonnelSalaryRecord,
  buildPrimarySalaryRecord,
  buildSecondarySalaryRecord,
  findExistingSalaryDuplicates,
  findSalaryDuplicate,
  getFifthWeekDays,
  mergeSalaryWithManualFields,
  pickBestSalaryFromGroup,
} from "../../../salary-utils";

// Crée (ou recalcule en resync) une fiche calculée. Met à jour l'accumulateur
// local via noterCree. Renvoie des compteurs 0/1 { cree, resync }.
async function upsertSalaire(salaireCalcule, { resync, annee, trouverExistant, noterCree, modS, ajS }) {
  if (!salaireCalcule) return { cree: 0, resync: 0 };
  const existant = trouverExistant(salaireCalcule);
  if (existant && !resync) return { cree: 0, resync: 0 };
  if (existant) {
    await modS(mergeSalaryWithManualFields(existant, salaireCalcule));
    return { cree: 0, resync: 1 };
  }
  const record = { ...salaireCalcule, bon: 0, revision: 0, annee };
  const ref = await ajS(record);
  noterCree(record, ref);
  return { cree: 1, resync: 0 };
}

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
  const appliquer = async (salaireCalcule) => {
    const r = await upsertSalaire(salaireCalcule, { resync, annee, trouverExistant, noterCree, modS, ajS });
    nbCree += r.cree;
    nbResync += r.resync;
  };

  const tousEns=[
    ...ensCollege.map(e=>({...e,_emplois:emploisCollege,_eng:engCollege})),
    ...ensLycee.map(e=>({...e,_emplois:emploisLycee,_eng:engLycee})),
  ];
  for(const ens of tousEns){
    await appliquer(buildSecondarySalaryRecord(ens, {
      mois,
      emplois: ens._emplois,
      enseignements: ens._eng,
      jours5eme,
      primeDefaut,
    }));
  }

  for(const ens of ensPrimaire){
    await appliquer(buildPrimarySalaryRecord(ens, { mois, getTeacherMonthlyForfait }));
  }

  for(const emp of personnel.filter(e=>(e.statut||"Actif")==="Actif")){
    await appliquer(buildPersonnelSalaryRecord(emp, { mois }));
  }
  return {nbCree, nbResync, nbSupprime};
}
