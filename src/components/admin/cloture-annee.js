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
// nouvelle table : le même code marche sur Firebase et sur Supabase, où
// modifierChampDoc fusionne dans le jsonb `extra`.
//
// RÉVERSIBLE : l'instantané contient tout ce qu'il faut pour restaurer
// l'état d'avant la clôture (annulerCloture).
//
// La logique pure (instantané, état vierge, projection d'une année) vit dans
// cloture-annee-utils.js — ce fichier ne porte que les accès aux données.

import { collection, doc, getDocs, writeBatch } from "firebase/firestore";
import { db } from "../../firebaseDb";
import { isSupabase } from "../../backend";
import { chargerCollection, modifierChampDoc } from "../../backend/data-supabase";
import {
  COLLECTIONS_ELEVES, aDesPaiements, champsCloture, champsRestauration,
} from "./cloture-annee-utils";

// Limite Firestore : 500 opérations par batch (marge de sécurité à 450).
const BATCH_MAX = 450;
// Supabase : nb d'updates lancés en parallèle (modifierChampDoc = 1 par appel).
const SB_PARALLELE = 40;

async function chargerEleves(schoolId) {
  const parCollection = [];
  for (const nom of COLLECTIONS_ELEVES) {
    if (isSupabase) {
      const { items } = await chargerCollection(schoolId, nom);
      parCollection.push({ collection: nom, eleves: items || [] });
    } else {
      const snap = await getDocs(collection(db, "ecoles", schoolId, nom));
      parCollection.push({ collection: nom, eleves: snap.docs.map((d) => ({ ...d.data(), _id: d.id })) });
    }
  }
  return parCollection;
}

async function appliquerUpdates(schoolId, updates) {
  if (isSupabase) {
    for (let i = 0; i < updates.length; i += SB_PARALLELE) {
      await Promise.all(updates.slice(i, i + SB_PARALLELE).map(
        (u) => modifierChampDoc(schoolId, u.collection, u.id, u.champs),
      ));
    }
    return;
  }
  for (let i = 0; i < updates.length; i += BATCH_MAX) {
    const batch = writeBatch(db);
    for (const u of updates.slice(i, i + BATCH_MAX)) {
      batch.update(doc(db, "ecoles", schoolId, u.collection, u.id), u.champs);
    }
    await batch.commit();
  }
}

// Archive l'année `annee` sur chaque fiche puis remet la scolarité à zéro.
// simulate=true : ne calcule que le bilan, sans aucune écriture.
export async function cloturerAnnee({ schoolId, annee, moisAnnee = null, simulate = false }) {
  const sections = await chargerEleves(schoolId);
  const updates = [];
  let total = 0;
  let avecPaiements = 0;
  let dejaArchives = 0;

  for (const { collection: nom, eleves } of sections) {
    for (const eleve of eleves) {
      total++;
      const champs = champsCloture(eleve, annee, { moisAnnee });
      if (!champs) { dejaArchives++; continue; }
      if (aDesPaiements(eleve)) avecPaiements++;
      updates.push({ collection: nom, id: eleve._id, champs });
    }
  }

  if (!simulate && updates.length) await appliquerUpdates(schoolId, updates);

  return { annee, total, archives: updates.length, avecPaiements, dejaArchives, simulation: simulate };
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
