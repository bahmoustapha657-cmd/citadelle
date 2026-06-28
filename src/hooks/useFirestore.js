import { useCallback, useContext, useEffect, useReducer } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getDocsFromCache,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebaseDb";
import { SchoolContext } from "../contexts/SchoolContext";

const initialState = {
  items: [],
  chargement: true,
};

// ── Stratégie "temps réel économe" (pilier 1.2) ────────────────
// Avant : un listener onSnapshot permanent par collection → re-lectures
// continues (chaque changement) + re-souscription à chaque remontage =
// énorme consommation de lectures Firestore (quota).
// Maintenant : on AFFICHE depuis le cache local (persistance Firestore,
// 0 lecture serveur) et on ne RAFRAÎCHIT depuis le serveur que si le cache
// est périmé (> TTL) ou sur demande explicite (refresh). Les écritures de
// l'utilisateur sont reflétées immédiatement (le cache contient les écritures
// locales en attente).
const dernierServeur = new Map(); // clé (schoolId|collection|annee) → timestamp du dernier fetch serveur
const TTL_MS = 5 * 60 * 1000;

// ── Trace d'audit des suppressions ─────────────────────────────
const LIBELLES_COLLECTIONS = {
  elevesPrimaire: "Élève (Primaire)", elevesCollege: "Élève (Collège)", elevesLycee: "Élève (Lycée)",
  notesPrimaire: "Note (Primaire)", notesCollege: "Note (Collège)", notesLycee: "Note (Lycée)",
  elevesPrimaire_absences: "Absence (Primaire)", elevesCollege_absences: "Absence (Collège)", elevesLycee_absences: "Absence (Lycée)",
  classesPrimaire: "Classe (Primaire)", classesCollege: "Classe (Collège)", classesLycee: "Classe (Lycée)",
  ensPrimaire: "Enseignant (Primaire)", ensCollege: "Enseignant (Collège)", ensLycee: "Enseignant (Lycée)",
  recettes: "Recette", depenses: "Dépense", salaires: "Salaire", bons: "Bon",
  personnel: "Personnel", membres: "Membre (Fondation)", versements: "Versement", tarifs: "Tarif",
  documents: "Document", examens: "Examen", livrets: "Livret", evenements: "Événement",
  annonces: "Annonce", honneurs: "Tableau d'honneur", messages: "Message",
};
const COLLECTIONS_SANS_TRACE = new Set(["historique", "pushSubs"]);
const CHAMPS_RESUME = ["nom", "prenom", "eleveNom", "titre", "matiere", "classe", "mois", "periode", "montant", "note", "date", "type"];

function resumeSuppression(item = {}) {
  return CHAMPS_RESUME
    .filter((cle) => item[cle] !== undefined && item[cle] !== null && item[cle] !== "")
    .slice(0, 4)
    .map((cle) => `${cle} : ${String(item[cle]).slice(0, 60)}`)
    .join(" · ");
}

function firestoreReducer(state, action) {
  switch (action.type) {
    case "loading":
      return { ...state, chargement: true };
    case "success":
      return { items: action.items, chargement: false };
    default:
      return state;
  }
}

export function useFirestore(nomCollection, options = {}) {
  const { schoolId } = useContext(SchoolContext);
  const [{ items, chargement }, dispatch] = useReducer(firestoreReducer, initialState);

  const anneeFiltre = options.annee || null;

  const charger = useCallback(async (forceServer = false) => {
    if (!schoolId) { dispatch({ type: "success", items: [] }); return; }
    const ref = collection(db, "ecoles", schoolId, nomCollection);
    const q = anneeFiltre ? query(ref, where("annee", "==", anneeFiltre)) : ref;
    const k = `${schoolId}|${nomCollection}|${anneeFiltre || ""}`;
    const frais = Date.now() - (dernierServeur.get(k) || 0) < TTL_MS;
    const toItems = (snap) => snap.docs.map((d) => ({ ...d.data(), _id: d.id }));

    // 1) Affichage immédiat depuis le cache (0 lecture serveur).
    let depuisCache = false;
    if (!forceServer) {
      try {
        const c = await getDocsFromCache(q);
        dispatch({ type: "success", items: toItems(c) });
        depuisCache = !c.empty;
      } catch { /* pas de cache disponible */ }
    }

    // 2) Rafraîchissement serveur : forcé, cache périmé, ou cache vide/absent.
    if (forceServer || !frais || !depuisCache) {
      try {
        const s = await getDocs(q);
        dernierServeur.set(k, Date.now());
        dispatch({ type: "success", items: toItems(s) });
      } catch {
        if (!depuisCache) dispatch({ type: "success", items: [] });
      }
    }
  }, [schoolId, nomCollection, anneeFiltre]);

  useEffect(() => {
    dispatch({ type: "loading" });
    charger(false);
  }, [charger]);

  const ajouter = async (item) => {
    const { id: _idIgnored, _id, ...data } = item;
    const ref = await addDoc(collection(db, "ecoles", schoolId, nomCollection), {
      ...data,
      createdAt: Date.now(),
    });
    charger(false); // reflète l'écriture locale (cache) sans lecture serveur
    return ref;
  };

  const supprimer = async (id) => {
    // Snapshot AVANT la suppression : c'est lui qui part dans la trace.
    const snapshot = items.find((item) => item._id === id) || null;
    await deleteDoc(doc(db, "ecoles", schoolId, nomCollection, id));
    charger(false);
    if (COLLECTIONS_SANS_TRACE.has(nomCollection)) return;
    try {
      const libelle = LIBELLES_COLLECTIONS[nomCollection] || nomCollection;
      const { _id: _ignore, ...donnees } = snapshot || {};
      addDoc(collection(db, "ecoles", schoolId, "historique"), {
        action: `Suppression — ${libelle}`,
        details: snapshot ? resumeSuppression(snapshot) : `Document ${id}`,
        auteur: "",
        date: Date.now(),
        suppression: { collection: nomCollection, docId: id, donnees },
      }).catch(() => {});
    } catch {
      // Trace best-effort : la suppression elle-même n'est jamais bloquée.
    }
  };

  const modifier = async (item) => {
    const { _id, ...data } = item;
    await updateDoc(doc(db, "ecoles", schoolId, nomCollection, _id), data);
    charger(false);
  };

  const modifierChamp = async (_id, champs) => {
    await updateDoc(doc(db, "ecoles", schoolId, nomCollection, _id), champs);
    charger(false);
  };

  return {
    items,
    chargement,
    ajouter,
    modifier,
    supprimer,
    modifierChamp,
    refresh: () => charger(true),
  };
}
