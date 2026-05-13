import { useContext, useEffect, useReducer } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
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
    const unsub = onSnapshot(q, (snap) => {
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
    await deleteDoc(doc(db, "ecoles", schoolId, nomCollection, id));
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
