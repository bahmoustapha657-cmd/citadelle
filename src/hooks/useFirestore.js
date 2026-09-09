import { useCallback, useContext, useEffect, useReducer, useRef } from "react";
import { SchoolContext } from "../contexts/SchoolContext";
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

// ── Fraîcheur des données ──────────────────────────────────────
// Deux mécanismes, hérités de l'époque où il fallait ménager le quota de
// lectures Firestore, mais qui gardent tout leur sens sur Supabase :
//   • Temps réel (WebSocket) : la ligne reçue est appliquée en mémoire, donc
//     un changement écrit par un AUTRE poste apparaît sans coûter de requête.
//   • Filet : retour sur l'onglet ou reprise réseau → relecture, bornée pour
//     qu'un alt-tab répété ne relance pas la requête à chaque va-et-vient.
//     C'est lui qui rattrape une socket tombée.
const dernierServeur = new Map(); // clé (schoolId|collection|annee) → dernier fetch
const cleFraicheur = (schoolId, collection, annee) => `${schoolId}|${collection}|${annee || ""}`;
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

  const charger = useCallback(async () => {
    if (!schoolId) { dispatch({ type: "success", items: [] }); return; }

    // Horodate la lecture : c'est ce qui borne le rafraîchissement au focus.
    const marquerFrais = () =>
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
  }, [schoolId, nomCollection, anneeFiltre]);

  useEffect(() => {
    dispatch({ type: "loading" });
    charger();
  }, [charger]);

  // ── Temps réel (Supabase) ────────────────────────────────────
  // Cas nominal : la ligne reçue est appliquée en mémoire → 0 requête, quelle
  // que soit la taille de la collection. Le rechargement complet n'intervient
  // qu'en repli (payload inexploitable), et coalescé : une rafale de patches
  // dégradés ne déclenche qu'UNE relecture.
  const rechargeTimer = useRef(null);
  useEffect(() => () => clearTimeout(rechargeTimer.current), []);

  useEffect(() => {
    if (!schoolId) return undefined;
    const programmerRecharge = () => {
      if (rechargeTimer.current) return; // rechargement déjà en attente
      rechargeTimer.current = setTimeout(() => {
        rechargeTimer.current = null;
        charger();
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
      charger();
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
    const cree = await ajouterDoc(schoolId, nomCollection, item);
    await charger();
    return { id: cree._id, ...cree };
  };

  const supprimer = async (id) => {
    // Snapshot AVANT la suppression : c'est lui qui part dans la trace, et
    // c'est lui que le journal déplie quand on clique sur l'entrée.
    const snapshot = items.find((item) => item._id === id) || null;

    // La trace de suppression a longtemps été écrite UNIQUEMENT sur la branche
    // Firebase : la branche Supabase sortait par `return` avant d'y arriver, et
    // plus une seule suppression n'était journalisée depuis la migration. Elle
    // porte le nom de la personne connectée.
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

    await supprimerDoc(schoolId, nomCollection, id);
    await charger();
    const trace = tracer();
    // Best-effort : une trace qui échoue ne doit jamais faire croire que la
    // suppression a échoué, elle est déjà faite.
    if (trace) ajouterDoc(schoolId, "historique", trace).catch(() => {});
  };

  const modifier = async (item) => {
    await modifierDoc(schoolId, nomCollection, item);
    await charger();
  };

  const modifierChamp = async (_id, champs) => {
    await modifierChampDoc(schoolId, nomCollection, _id, champs);
    await charger();
  };

  return {
    items,
    chargement,
    ajouter,
    modifier,
    supprimer,
    modifierChamp,
    refresh: () => charger(),
  };
}
