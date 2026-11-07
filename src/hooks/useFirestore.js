// Hook de collection de l'école (lecture, temps réel, écritures). Le nom
// `useFirestore` est historique (première version sur Firebase) : tout passe
// par Supabase et le miroir hors ligne PowerSync (backend/data-supabase).
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
import { creerRelectureGroupee } from "./relecture-groupee";

const initialState = {
  items: [],
  chargement: true,
  erreur: null,
};

// Horodatage de la dernière lecture complète, par collection : borne le
// rafraîchissement au retour sur l'onglet.
const dernierServeur = new Map(); // clé (schoolId|collection|annee) → timestamp
const cleFraicheur = (schoolId, collection, annee) => `${schoolId}|${collection}|${annee || ""}`;

// ── Instantanéité ──────────────────────────────────────────────
// Un changement écrit par un AUTRE poste doit apparaître sans remontage :
//   • Temps réel Supabase (WebSocket, aucune requête facturée) → rechargement
//     quasi immédiat, avec coalescence des rafales : une grille de 30 notes
//     enregistrée d'un coup ne déclenche qu'UN rechargement.
//   • Filet : retour sur l'onglet ou reconnexion réseau → rafraîchissement,
//     borné pour qu'un alt-tab répété ne relance pas la requête à chaque
//     va-et-vient.
const RT_DEBOUNCE_MS = 600;
const FOCUS_MIN_MS = 15 * 1000;

// ── Lecture en échec ───────────────────────────────────────────
// chargerCollection ne lève pas : il renvoie `{ items: [], erreur }`. Pris
// pour un succès, ce tableau vide remplaçait la liste affichée — un retour
// d'onglet hors réseau suffisait à faire « disparaître » élèves et notes.
// Une lecture en échec garde donc les items déjà là et remonte l'erreur.
export function actionLecture(resultat) {
  if (resultat?.erreur) return { type: "erreur", erreur: resultat.erreur };
  return { type: "success", items: resultat?.items || [] };
}

// Toutes les collections montées échouent ensemble quand le réseau tombe :
// un seul message pour la rafale, pas un par collection.
const TOAST_ERREUR_MIN_MS = 30 * 1000;
let dernierToastErreur = 0;

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

export function firestoreReducer(state, action) {
  switch (action.type) {
    case "loading":
      return { ...state, chargement: true };
    case "success":
      return { items: action.items, chargement: false, erreur: null };
    case "erreur":
      return { ...state, chargement: false, erreur: action.erreur };
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
  const { schoolId, auteur, toast } = useContext(SchoolContext);
  const [{ items, chargement, erreur }, dispatch] = useReducer(firestoreReducer, initialState);
  // `toast` change à chaque rendu de l'app : via une ref, pour ne pas
  // relancer le chargement à chaque fois.
  const toastRef = useRef(toast);
  useEffect(() => { toastRef.current = toast; }, [toast]);

  const anneeFiltre = options.annee || null;
  // Période à charger EN PREMIER. Volontairement figée au montage (ref) : si
  // elle suivait le sélecteur de l'écran, changer de période relancerait tout
  // le chargement alors que les données sont déjà là.
  const periodePrioritaireRef = useRef(options.periodePrioritaire || null);
  // Numéro de la dernière lecture lancée : une lecture plus ancienne qui
  // aboutit après (ex. premier chargement encore en vol quand la synchro livre
  // les données et relance une lecture) ne doit pas écraser la plus récente.
  const derniereLecture = useRef(0);

  const charger = useCallback(async (forceServer = false) => {
    if (!schoolId) { dispatch({ type: "success", items: [] }); return; }

    // Lecture via l'adaptateur (collection → table+section).
    const lecture = ++derniereLecture.current;
    const aJour = () => lecture === derniereLecture.current;
    const marquerFrais = () =>
      // C'est ce qui borne le rafraîchissement au focus.
      dernierServeur.set(cleFraicheur(schoolId, nomCollection, anneeFiltre), Date.now());
    // Applique un résultat de lecture. Pas de marquerFrais sur un échec : le
    // prochain retour d'onglet doit retenter.
    const appliquer = (resultat) => {
      const action = actionLecture(resultat);
      dispatch(action);
      if (action.type !== "erreur") return true;
      if (Date.now() - dernierToastErreur >= TOAST_ERREUR_MIN_MS) {
        dernierToastErreur = Date.now();
        toastRef.current?.("Lecture impossible, les données affichées peuvent ne pas être à jour.", "warning");
      }
      return false;
    };
    const lire = (opts) =>
      // Filet : une exception (réseau, client) est traitée comme une erreur
      // renvoyée, sans vider la liste.
      chargerCollection(schoolId, nomCollection, opts)
        .catch((err) => ({ items: [], erreur: err?.message || String(err) }));

    // Chargement en DEUX TEMPS quand une période est affichée à l'ouverture
    // (les notes d'une année entière pèsent 6 700 lignes, l'écran n'en montre
    // qu'une période) : les deux requêtes partent ENSEMBLE, la petite peint
    // l'écran en ~400 ms, la grosse complète la liste dès qu'elle arrive.
    // Rien n'est perdu : bulletin annuel, moyenne annuelle et grille par
    // élève retrouvent bien toutes les périodes.
    // Premier chargement seulement : une relecture (après écriture, synchro,
    // retour d'onglet) a déjà la liste à l'écran — la remplacer d'abord par
    // la seule période ferait clignoter compteurs et moyennes annuelles.
    const prioritaire = forceServer ? null : periodePrioritaireRef.current;
    if (prioritaire) {
      const base = { annee: anneeFiltre };
      const pDabord = lire({ ...base, periode: prioritaire });
      const pReste = lire({ ...base, saufPeriode: prioritaire });
      const dabord = await pDabord;
      if (aJour()) appliquer(dabord);
      const reste = await pReste;
      if (!aJour()) return;
      // Les deux moitiés doivent avoir abouti pour remplacer la liste.
      if (dabord.erreur) return;
      if (!appliquer(reste.erreur ? reste : { items: [...dabord.items, ...reste.items] })) return;
      marquerFrais();
      return;
    }

    const resultat = await lire({ annee: anneeFiltre });
    if (!aJour()) return;
    if (appliquer(resultat)) marquerFrais();
  }, [schoolId, nomCollection, anneeFiltre]);

  // Relecture après écriture, partagée entre écritures simultanées
  // (cf. relecture-groupee.js) : la grille de notes en lance des dizaines.
  // Recréée quand `charger` change (autre école, collection ou année).
  const relecture = useRef({ pour: null, relire: null });
  const relireApresEcriture = () => {
    const r = relecture.current;
    if (r.pour !== charger) {
      r.pour = charger;
      r.relire = creerRelectureGroupee(() => charger(true));
    }
    return r.relire();
  };

  useEffect(() => {
    dispatch({ type: "loading" });
    charger(false);
  }, [charger]);

  // ── Temps réel ───────────────────────────────────────────────
  // Cas nominal : la ligne reçue est appliquée en mémoire → 0 requête, quelle
  // que soit la taille de la collection. Le rechargement complet n'intervient
  // qu'en repli (payload inexploitable), et coalescé : une rafale de patches
  // dégradés ne déclenche qu'UNE relecture. Tables en miroir local
  // (PowerSync) : chaque changement du miroir arrive en « reload » — relecture
  // du SQLite local, sans réseau (première synchro, saisies d'autres postes).
  const rechargeTimer = useRef(null);
  useEffect(() => () => clearTimeout(rechargeTimer.current), []);

  useEffect(() => {
    if (!schoolId) return undefined;
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
      charger(true);
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
    await relireApresEcriture();
    return { id: cree._id, ...cree };
  };

  const supprimer = async (id) => {
    // Snapshot AVANT la suppression : c'est lui qui part dans la trace, et
    // c'est lui que le journal déplie quand on clique sur l'entrée.
    const snapshot = items.find((item) => item._id === id) || null;

    // Chaque suppression est journalisée, au nom de la personne connectée
    // (après la migration Supabase, plus aucune ne l'était : supprimer un
    // élève ou une classe ne laissait plus rien).
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
    await relireApresEcriture();
    const trace = tracer();
    // Best-effort : une trace qui échoue ne doit jamais faire croire que la
    // suppression a échoué, elle est déjà faite.
    if (trace) ajouterDoc(schoolId, "historique", trace).catch(() => {});
  };

  const modifier = async (item) => {
    await modifierDoc(schoolId, nomCollection, item);
    await relireApresEcriture();
  };

  const modifierChamp = async (_id, champs) => {
    await modifierChampDoc(schoolId, nomCollection, _id, champs);
    await relireApresEcriture();
  };

  return {
    items,
    chargement,
    // Message de la dernière lecture en échec (null après une lecture réussie).
    // Les items restent ceux de la dernière lecture réussie.
    erreur,
    ajouter,
    modifier,
    supprimer,
    modifierChamp,
    refresh: () => charger(true),
  };
}
