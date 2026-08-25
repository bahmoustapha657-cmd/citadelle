import { useCallback, useContext, useEffect, useReducer, useRef } from "react";
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
import { isSupabase } from "../backend";
import {
  chargerCollection,
  ajouterDoc,
  modifierDoc,
  modifierChampDoc,
  supprimerDoc,
} from "../backend/data-supabase";
import { subscribeCollection } from "../backend/realtime-supabase";

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
const cleFraicheur = (schoolId, collection, annee) => `${schoolId}|${collection}|${annee || ""}`;

// ── Instantanéité rétablie ─────────────────────────────────────
// Le cache-first ci-dessus protège le quota Firestore, mais il a un effet de
// bord : un changement écrit par un AUTRE poste n'apparaissait qu'au remontage
// du composant. Deux mécanismes le corrigent, sans revenir aux listeners
// permanents qui avaient vidé le quota :
//   • Temps réel Supabase (WebSocket, aucune requête facturée) → rechargement
//     quasi immédiat, avec coalescence des rafales : une grille de 30 notes
//     enregistrée d'un coup ne déclenche qu'UN rechargement.
//   • Filet universel (Firebase compris) : retour sur l'onglet ou reconnexion
//     réseau → rafraîchissement, borné pour qu'un alt-tab répété ne relance pas
//     la requête à chaque va-et-vient.
const RT_DEBOUNCE_MS = 600;
const FOCUS_MIN_MS = 15 * 1000;

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
    // ── Patches temps réel (Supabase) ──
    // Insertion/modification distante : on remplace l'item en place, sinon on
    // l'ajoute. Les écrans trient eux-mêmes, l'ordre d'arrivée est sans effet.
    case "upsert": {
      const i = state.items.findIndex((it) => it._id === action.item._id);
      if (i === -1) return { ...state, items: [...state.items, action.item] };
      const items = state.items.slice();
      items[i] = action.item;
      return { ...state, items };
    }
    case "remove":
      // Id absent : rien à faire — on garde la même référence pour ne pas
      // re-rendre inutilement toute la liste.
      if (!state.items.some((it) => it._id === action.id)) return state;
      return { ...state, items: state.items.filter((it) => it._id !== action.id) };
    default:
      return state;
  }
}

export function useFirestore(nomCollection, options = {}) {
  const { schoolId, auteur } = useContext(SchoolContext);
  const [{ items, chargement }, dispatch] = useReducer(firestoreReducer, initialState);

  const anneeFiltre = options.annee || null;
  // Période à charger EN PREMIER. Volontairement figée au montage (ref) : si
  // elle suivait le sélecteur de l'écran, changer de période relancerait tout
  // le chargement alors que les données sont déjà là.
  const periodePrioritaireRef = useRef(options.periodePrioritaire || null);

  const charger = useCallback(async (forceServer = false) => {
    if (!schoolId) { dispatch({ type: "success", items: [] }); return; }

    // ── Backend Supabase : lecture via l'adaptateur (collection → table+section).
    if (isSupabase) {
      const marquerFrais = () =>
        // Horodate aussi côté Supabase : c'est ce qui borne le rafraîchissement au focus.
        dernierServeur.set(cleFraicheur(schoolId, nomCollection, anneeFiltre), Date.now());

      // Chargement en DEUX TEMPS quand une période est affichée à l'ouverture
      // (les notes d'une année entière pèsent 6 700 lignes, l'écran n'en montre
      // qu'une période) : les deux requêtes partent ENSEMBLE, la petite peint
      // l'écran en ~400 ms, la grosse complète la liste dès qu'elle arrive.
      // Rien n'est perdu : bulletin annuel, moyenne annuelle et grille par
      // élève retrouvent bien toutes les périodes.
      const prioritaire = periodePrioritaireRef.current;
      if (prioritaire) {
        const base = { annee: anneeFiltre };
        const pDabord = chargerCollection(schoolId, nomCollection, { ...base, periode: prioritaire });
        const pReste = chargerCollection(schoolId, nomCollection, { ...base, saufPeriode: prioritaire });
        const dabord = await pDabord;
        dispatch({ type: "success", items: dabord.items });
        const reste = await pReste;
        marquerFrais();
        dispatch({ type: "success", items: [...dabord.items, ...reste.items] });
        return;
      }

      const { items } = await chargerCollection(schoolId, nomCollection, { annee: anneeFiltre });
      marquerFrais();
      dispatch({ type: "success", items });
      return;
    }

    const ref = collection(db, "ecoles", schoolId, nomCollection);
    const q = anneeFiltre ? query(ref, where("annee", "==", anneeFiltre)) : ref;
    const k = cleFraicheur(schoolId, nomCollection, anneeFiltre);
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

  // ── Temps réel (Supabase) ────────────────────────────────────
  // Cas nominal : la ligne reçue est appliquée en mémoire → 0 requête, quelle
  // que soit la taille de la collection. Le rechargement complet n'intervient
  // qu'en repli (payload inexploitable), et coalescé : une rafale de patches
  // dégradés ne déclenche qu'UNE relecture.
  const rechargeTimer = useRef(null);
  useEffect(() => () => clearTimeout(rechargeTimer.current), []);

  useEffect(() => {
    if (!isSupabase || !schoolId) return undefined;
    const programmerRecharge = () => {
      if (rechargeTimer.current) return; // rechargement déjà en attente
      rechargeTimer.current = setTimeout(() => {
        rechargeTimer.current = null;
        charger(true);
      }, RT_DEBOUNCE_MS);
    };
    const appliquer = (patch) => {
      if (patch.type === "upsert") dispatch({ type: "upsert", item: patch.item });
      else if (patch.type === "delete") dispatch({ type: "remove", id: patch.id });
      else programmerRecharge();
    };
    return subscribeCollection(schoolId, nomCollection, { annee: anneeFiltre }, appliquer);
  }, [schoolId, nomCollection, anneeFiltre, charger]);

  // ── Filet : retour sur l'onglet / reconnexion ────────────────
  useEffect(() => {
    if (!schoolId) return undefined;
    const auRetour = () => {
      if (document.visibilityState === "hidden") return;
      const k = cleFraicheur(schoolId, nomCollection, anneeFiltre);
      if (Date.now() - (dernierServeur.get(k) || 0) < FOCUS_MIN_MS) return;
      // Supabase : on force la relecture. Firebase : charger(false) sert le cache
      // et ne va au serveur que si le TTL est dépassé → quota préservé.
      charger(isSupabase);
    };
    document.addEventListener("visibilitychange", auRetour);
    window.addEventListener("focus", auRetour);
    window.addEventListener("online", auRetour);
    return () => {
      document.removeEventListener("visibilitychange", auRetour);
      window.removeEventListener("focus", auRetour);
      window.removeEventListener("online", auRetour);
    };
  }, [schoolId, nomCollection, anneeFiltre, charger]);

  const ajouter = async (item) => {
    if (isSupabase) {
      const cree = await ajouterDoc(schoolId, nomCollection, item);
      await charger(true);
      return { id: cree._id, ...cree };
    }
    const { id: _idIgnored, _id, ...data } = item;
    const ref = await addDoc(collection(db, "ecoles", schoolId, nomCollection), {
      ...data,
      createdAt: Date.now(),
    });
    charger(false); // reflète l'écriture locale (cache) sans lecture serveur
    return ref;
  };

  const supprimer = async (id) => {
    // Snapshot AVANT la suppression : c'est lui qui part dans la trace, et
    // c'est lui que le journal déplie quand on clique sur l'entrée.
    const snapshot = items.find((item) => item._id === id) || null;

    // La trace de suppression était écrite UNIQUEMENT sur la branche Firebase :
    // la branche Supabase sortait par `return` avant d'y arriver. Depuis la
    // migration, plus une seule suppression n'était journalisée — à La
    // Citadelle, la dernière trace date du 7 juillet alors que le reste du
    // journal court jusqu'à aujourd'hui. Supprimer un élève ou une classe ne
    // laissait donc plus rien. Le journal est desormais commun aux deux
    // backends, et porte le nom de la personne connectée.
    const tracer = () => {
      if (COLLECTIONS_SANS_TRACE.has(nomCollection)) return null;
      const libelle = LIBELLES_COLLECTIONS[nomCollection] || nomCollection;
      const { _id: _ignore, ...donnees } = snapshot || {};
      return {
        action: `Suppression — ${libelle}`,
        details: snapshot ? resumeSuppression(snapshot) : `Document ${id}`,
        auteur,
        date: Date.now(),
        suppression: { collection: nomCollection, docId: id, donnees },
      };
    };

    if (isSupabase) {
      await supprimerDoc(schoolId, nomCollection, id);
      await charger(true);
      const trace = tracer();
      // Best-effort : une trace qui échoue ne doit jamais faire croire que la
      // suppression a échoué, elle est déjà faite.
      if (trace) ajouterDoc(schoolId, "historique", trace).catch(() => {});
      return;
    }
    await deleteDoc(doc(db, "ecoles", schoolId, nomCollection, id));
    charger(false);
    const trace = tracer();
    if (!trace) return;
    try {
      addDoc(collection(db, "ecoles", schoolId, "historique"), trace).catch(() => {});
    } catch {
      // Trace best-effort : la suppression elle-même n'est jamais bloquée.
    }
  };

  const modifier = async (item) => {
    if (isSupabase) {
      await modifierDoc(schoolId, nomCollection, item);
      await charger(true);
      return;
    }
    const { _id, ...data } = item;
    await updateDoc(doc(db, "ecoles", schoolId, nomCollection, _id), data);
    charger(false);
  };

  const modifierChamp = async (_id, champs) => {
    if (isSupabase) {
      await modifierChampDoc(schoolId, nomCollection, _id, champs);
      await charger(true);
      return;
    }
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
