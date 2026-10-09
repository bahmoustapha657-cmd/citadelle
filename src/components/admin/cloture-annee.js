// ══════════════════════════════════════════════════════════════════════════
//  Clôture d'année scolaire — archivage de la scolarité + remise à zéro
// ══════════════════════════════════════════════════════════════════════════
// Le problème : mens / mensDates / mensMontants / fraisPayes / inscription
// vivent sur la FICHE ÉLÈVE et n'étaient jamais réinitialisés. La promotion
// ne touche que `classe`. À la rentrée suivante, chaque élève arrivait donc
// avec tous les mois de l'année écoulée encore cochés « Payé » — et tout
// décocher effaçait définitivement l'historique des encaissements.
//
// La clôture fige l'état de l'année dans la fiche elle-même
// (eleves.extra.historique[annee]) puis remet les compteurs à zéro. Aucune
// nouvelle table : modifierChampDoc fusionne dans le jsonb `extra`.
//
// RÉVERSIBLE : l'instantané contient tout ce qu'il faut pour restaurer
// l'état d'avant la clôture (annulerCloture).
//
// La logique pure (instantané, état vierge, projection d'une année) vit dans
// cloture-annee-utils.js — ce fichier ne porte que les accès aux données.

import { chargerCollection, modifierChampDoc, sauverParametresEcole } from "../../backend/data-supabase";
import {
  COLLECTIONS_ELEVES, aDesPaiements, champsCloture, champsRestauration, horsAnneeCloturee,
} from "./cloture-annee-utils";

// Nb d'updates lancés en parallèle (modifierChampDoc = 1 par appel).
const SB_PARALLELE = 40;

async function chargerEleves(schoolId) {
  const parCollection = [];
  for (const nom of COLLECTIONS_ELEVES) {
    // Lecture du SERVEUR, jamais du miroir local : sur un appareil dont la
    // synchro n'est pas finie (nouvel appareil, réseau faible), le miroir
    // est incomplet — la clôture a ainsi archivé « 0 fiche sur 0 » tout en
    // faisant passer l'école à l'année suivante (tests e2e, 2026-10-08).
    // Une lecture ratée doit ARRÊTER la clôture, pas la faire sur rien.
    const { items, erreur } = await chargerCollection(schoolId, nom, { reseau: true });
    if (erreur) throw new Error(`lecture des élèves impossible (${nom}) : ${erreur}`);
    parCollection.push({ collection: nom, eleves: items || [] });
  }
  return parCollection;
}

async function appliquerUpdates(schoolId, updates) {
  for (let i = 0; i < updates.length; i += SB_PARALLELE) {
    await Promise.all(updates.slice(i, i + SB_PARALLELE).map(
      // Écrit sur le serveur (lu sur le serveur) ; le miroir suivra.
      (u) => modifierChampDoc(schoolId, u.collection, u.id, u.champs, { reseau: true }),
    ));
  }
}

// Repères de fin d'année sur la fiche ÉCOLE (année officielle, `clotures`,
// `promotions`, `passagesAdmis`) — fusionnés au premier niveau, comme les
// Paramètres : passer l'objet complet d'un repère, pas sa seule nouvelle clé.
export async function majFicheEcole(schoolId, champs) {
  return sauverParametresEcole(schoolId, champs);
}

// Archive l'année `annee` sur chaque fiche puis remet la scolarité à zéro.
// simulate=true : ne calcule que le bilan, sans aucune écriture.
export async function cloturerAnnee({ schoolId, annee, moisAnnee = null, simulate = false }) {
  const sections = await chargerEleves(schoolId);
  const updates = [];
  let total = 0;
  let avecPaiements = 0;
  let dejaArchives = 0;
  let partis = 0;

  for (const { collection: nom, eleves } of sections) {
    for (const eleve of eleves) {
      total++;
      if (horsAnneeCloturee(eleve, annee, moisAnnee)) { partis++; continue; }
      const champs = champsCloture(eleve, annee, { moisAnnee });
      if (!champs) { dejaArchives++; continue; }
      if (aDesPaiements(eleve)) avecPaiements++;
      updates.push({ collection: nom, id: eleve._id, champs });
    }
  }

  if (!simulate && updates.length) await appliquerUpdates(schoolId, updates);

  return { annee, total, archives: updates.length, avecPaiements, dejaArchives, partis, simulation: simulate };
}

// Restaure l'instantané de `annee` sur les fiches et retire l'archive.
// ⚠️ Écrase l'état courant : `ecrases` compte les élèves qui ont déjà des
// encaissements sur la nouvelle année et les perdraient.
export async function annulerCloture({ schoolId, annee, moisAnnee = null, simulate = false }) {
  const sections = await chargerEleves(schoolId);
  const updates = [];
  let ecrases = 0;

  for (const { collection: nom, eleves } of sections) {
    for (const eleve of eleves) {
      const champs = champsRestauration(eleve, annee, { moisAnnee });
      if (!champs) continue;
      if (aDesPaiements(eleve)) ecrases++;
      updates.push({ collection: nom, id: eleve._id, champs });
    }
  }

  if (!simulate && updates.length) await appliquerUpdates(schoolId, updates);

  return { annee, restaures: updates.length, ecrases, simulation: simulate };
}
