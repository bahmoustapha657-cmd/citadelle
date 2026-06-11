import { useContext, useEffect, useReducer } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebaseDb";
import { safeOnSnapshot } from "../firestore-safe";
import { SchoolContext } from "../contexts/SchoolContext";

const initialState = {
  items: [],
  chargement: true,
};

// ── Trace d'audit des suppressions ─────────────────────────────
// Toute suppression passant par ce hook laisse dans `historique` le
// contenu intégral du document supprimé (cliquable dans l'écran
// Historique pour le détail). Le DG contrôle le DROIT de supprimer via
// les verrous ; ici on garantit que l'acte laisse toujours une trace.
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
// Collections techniques : pas de trace (et surtout pas le journal lui-même).
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

  useEffect(() => {
    dispatch({ type: "loading" });
    const ref = collection(db, "ecoles", schoolId, nomCollection);
    const q = anneeFiltre ? query(ref, where("annee", "==", anneeFiltre)) : ref;
    const unsub = safeOnSnapshot(q, (snap) => {
      dispatch({
        type: "success",
        items: snap.docs.map((item) => ({ ...item.data(), _id: item.id })),
      });
    });

    return () => unsub();
  }, [nomCollection, schoolId, anneeFiltre]);

  const ajouter = async (item) => {
    const { id: _idIgnored, _id, ...data } = item;
    return addDoc(collection(db, "ecoles", schoolId, nomCollection), {
      ...data,
      createdAt: Date.now(),
    });
  };

  const supprimer = async (id) => {
    // Snapshot AVANT la suppression : c'est lui qui part dans la trace.
    const snapshot = items.find((item) => item._id === id) || null;
    await deleteDoc(doc(db, "ecoles", schoolId, nomCollection, id));
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
  };

  const modifierChamp = async (_id, champs) => {
    await updateDoc(doc(db, "ecoles", schoolId, nomCollection, _id), champs);
  };

  return { items, chargement, ajouter, modifier, supprimer, modifierChamp };
}
