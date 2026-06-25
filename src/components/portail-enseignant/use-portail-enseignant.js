import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { SchoolContext } from "../../contexts/SchoolContext";
import { C } from "../../constants";
import { getPeriodesForSection } from "../../period-utils";
import { getActiveNoteForms } from "../../evaluation-forms";
import { imprimerEdtEnseignant, imprimerPaiesEnseignant } from "../../reports";
import {
  construireGrille as construireGrilleHelper,
  enregistrerGrille as enregistrerGrilleAction,
  enregistrerNote as enregistrerNoteAction,
  supprimerNote as supprimerNoteAction,
} from "./notes-actions";
import {
  enregistrerIncident as enregistrerIncidentAction,
  supprimerIncident as supprimerIncidentAction,
} from "./incidents-actions";
import { fetchTeacherPortal } from "./portail-api";
import { saveNotesApi } from "./notes-api";
import { draftKey, loadDraft, saveDraft, clearDraft } from "./notes-draft";
import { enqueue, queueCount, processQueue } from "./notes-sync-queue";
import {
  formatEmploiHeure,
  buildFormNoteCreation,
  buildFormNoteEdition,
  buildFormIncidentCreation,
  buildFormIncidentEdition,
} from "./portail-forms";

// Toute la logique du portail enseignant : chargement des données via
// /teacher-portal, état des modales notes/incidents, et les wrappers
// qui injectent le contexte aux actions notes/incidents.
export function usePortailEnseignant({ utilisateur, annee, schoolInfo }) {
  const { moisAnnee, toast, envoyerPush } = useContext(SchoolContext);
  const c1 = schoolInfo.couleur1 || C.blue;
  const c2 = schoolInfo.couleur2 || C.green;
  const noteForms = getActiveNoteForms(schoolInfo, utilisateur.section || "secondaire");
  const defaultNoteType = noteForms[0]?.value || "Devoir";
  // Périodicité selon la section enseignée par le prof (primaire = trimestre, secondaire = trimestre ou semestre selon le DG).
  const sectionPeriode = (utilisateur.section === "primaire") ? "primaire" : "secondaire";
  const periodes = getPeriodesForSection(schoolInfo, sectionPeriode, moisAnnee);

  const [tab, setTab] = useState("dashboard");
  const [periodeN, setPeriodeN] = useState(periodes[0] || "");
  const [chargement, setChargement] = useState(true);
  const [portalData, setPortalData] = useState({
    section: utilisateur.section || "college",
    emplois: [],
    eleves: [],
    notes: [],
    matieres: [],
    enseignements: [],
    salaires: [],
    incidents: [],
  });
  const [modalNote, setModalNote] = useState(null);
  const [formNote, setFormNote] = useState({});
  const [gridForm, setGridForm] = useState({ classe: "", type: "", periode: "", notes: {} });
  const [gridProgress, setGridProgress] = useState({ done: 0, total: 0 });
  const [modalIncident, setModalIncident] = useState(null);
  const [formIncident, setFormIncident] = useState({});
  const [enregistrement, setEnregistrement] = useState(false);

  const nomEns = utilisateur.enseignantNom || utilisateur.nom || "";
  const matiere = utilisateur.matiere || "";
  // Au primaire, le titulaire saisit TOUTES les matières de sa classe : la
  // grille propose un sélecteur de matière (matières renvoyées par le portail).
  const isPrimaire = (portalData.section || utilisateur.section) === "primaire";
  const matieresDispo = portalData.matieres || [];
  const matiereParDefaut = isPrimaire ? (matieresDispo[0]?.nom || "") : matiere;
  const emplois = portalData.emplois || [];
  const eleves = portalData.eleves || [];
  const notes = portalData.notes || [];
  const enseignements = portalData.enseignements || [];
  const salaires = portalData.salaires || [];
  const incidents = portalData.incidents || [];
  const enseignantId = utilisateur.enseignantId || null;

  // Classes du prof = union de l'emploi du temps ET des classes des élèves
  // renvoyés par le serveur (qui couvre titulaire/enseignements/EDT). Sans
  // cela, un titulaire du primaire (sans EDT) avait mesClasses vide → pas de
  // bouton « Saisie en grille » ni de sélecteur de classe dans la grille.
  const mesClasses = [...new Set([
    ...emplois.map((item) => item.classe),
    ...eleves.map((item) => item.classe),
  ].filter(Boolean))];
  const mesNotes = [...notes].sort((left, right) => Number(right.updatedAt || right.createdAt || 0) - Number(left.updatedAt || left.createdAt || 0));
  const mesEvenements = [...enseignements].sort((left, right) => Number(right.date || 0) - Number(left.date || 0));

  const chargerPortail = async () => {
    setChargement(true);
    try {
      setPortalData(await fetchTeacherPortal(utilisateur));
    } catch (error) {
      toast(error.message || "Erreur de chargement du portail enseignant.", "error");
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    chargerPortail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ouvrirCreationNote = () => {
    setFormNote(buildFormNoteCreation({ defaultNoteType, periodeN }));
    setModalNote("add");
  };

  // Noms des matières disponibles (colonnes du mode multi-matières au primaire).
  const nomsMatieres = matieresDispo.map((m) => m.nom).filter(Boolean);

  // Wrapper : injecte eleves/notes/schoolInfo/utilisateur au helper.
  const construireGrille = (classe, type, periode, multiPeriode = false, matiereSel = "", multiMatiere = false) => construireGrilleHelper({
    classe, type, periode, matiere: matiereSel,
    periodes, matieres: nomsMatieres, multiPeriode, multiMatiere,
    eleves: portalData.eleves || [],
    mesNotes, schoolInfo, utilisateur,
  });

  // Identité de l'enseignant pour la clé de brouillon local (par appareil).
  const ownerId = utilisateur.enseignantId || utilisateur.login || utilisateur.uid || "";
  const cleBrouillon = (ctx) => draftKey({ ownerId, ...ctx });

  // Préremplit la grille depuis le serveur PUIS superpose l'éventuel brouillon
  // local (la saisie en cours non encore enregistrée gagne sur le prérempli).
  const construireGrilleAvecBrouillon = (ctx) => {
    const base = ctx.classe
      ? construireGrille(ctx.classe, ctx.type, ctx.periode, ctx.multiPeriode, ctx.matiere, ctx.multiMatiere)
      : {};
    const brouillon = loadDraft(cleBrouillon(ctx));
    return brouillon ? { ...base, ...brouillon.notes } : base;
  };

  const ouvrirGrille = () => {
    const ctx = {
      classe: mesClasses[0] || "",
      type: defaultNoteType,
      periode: periodeN,
      matiere: matiereParDefaut,
      multiPeriode: false,
      multiMatiere: false,
    };
    setGridForm({ ...ctx, notes: construireGrilleAvecBrouillon(ctx) });
    setGridProgress({ done: 0, total: 0 });
    setModalNote("grid");
  };

  const majGrid = (patch) => {
    setGridForm((current) => {
      const next = { ...current, ...patch };
      // Reconstruit le tableau si classe/type/période/matière/mode change.
      if (patch.classe !== undefined || patch.type !== undefined || patch.periode !== undefined
          || patch.matiere !== undefined || patch.multiPeriode !== undefined || patch.multiMatiere !== undefined) {
        next.notes = next.classe ? construireGrilleAvecBrouillon(next) : {};
      }
      return next;
    });
  };

  // Autosave du brouillon au fil de la frappe (anti-rebond 400 ms). Ne touche
  // au stockage que tant que la grille est ouverte.
  useEffect(() => {
    if (modalNote !== "grid" || !gridForm.classe) return undefined;
    const key = cleBrouillon(gridForm);
    const id = setTimeout(() => saveDraft(key, gridForm.notes), 400);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridForm, modalNote, ownerId]);

  // ── File de synchro hors-ligne (étape B) ───────────────────────────────
  const [pendingSync, setPendingSync] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const synchroniser = async () => {
    if (!ownerId || syncing) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    if (queueCount(ownerId) === 0) return;
    setSyncing(true);
    try {
      const r = await processQueue(ownerId, (notes) => saveNotesApi(notes));
      setPendingSync(queueCount(ownerId));
      if (r.saved > 0) {
        await chargerPortail();
        toast(`${r.saved} note(s) synchronisée(s).`, "success");
      }
      if (r.failed > 0) {
        toast(`${r.failed} note(s) non synchronisées (rejetées par le serveur).`, "warning");
      }
    } finally {
      setSyncing(false);
    }
  };

  // Ref vers la dernière version de synchroniser : l'effet de montage n'a ainsi
  // pas à dépendre de la fonction (recréée à chaque render), ce qui évite une
  // ré-exécution en boucle.
  const synchroniserRef = useRef(synchroniser);
  synchroniserRef.current = synchroniser;

  // Au montage : reflète la file et tente une synchro ; rejoue au retour réseau.
  useEffect(() => {
    setPendingSync(queueCount(ownerId));
    const onOnline = () => synchroniserRef.current();
    if (typeof window !== "undefined") window.addEventListener("online", onOnline);
    synchroniserRef.current();
    return () => {
      if (typeof window !== "undefined") window.removeEventListener("online", onOnline);
    };
  }, [ownerId]);

  const enregistrerGrille = () => enregistrerGrilleAction({
    gridForm, mesNotes, schoolInfo, utilisateur,
    setEnregistrement, setGridProgress, setModalNote, chargerPortail, toast,
    // Enregistrement complet réussi → le brouillon local n'a plus de raison d'être.
    onSuccess: () => clearDraft(cleBrouillon(gridForm)),
    // Hors-ligne → mise en file pour synchro auto ; le brouillon devient inutile
    // (les données sont dans la file persistante).
    onQueued: (notesPayload) => {
      setPendingSync(enqueue(ownerId, notesPayload));
      clearDraft(cleBrouillon(gridForm));
    },
  });

  const ouvrirEditionNote = (note) => {
    setFormNote(buildFormNoteEdition(note, { defaultNoteType, periodeN }));
    setModalNote("edit");
  };

  const enregistrerNote = () => enregistrerNoteAction({
    formNote, defaultNoteType, schoolInfo, utilisateur,
    setEnregistrement, setModalNote, chargerPortail, toast,
  });
  const supprimerNote = (noteId) => supprimerNoteAction(noteId, {
    setEnregistrement, chargerPortail, toast,
  });

  const ouvrirSignalementEleve = (eleve) => {
    setFormIncident(buildFormIncidentCreation(eleve));
    setModalIncident("add");
  };

  const ouvrirEditionIncident = (inc) => {
    setFormIncident(buildFormIncidentEdition(inc));
    setModalIncident("edit");
  };

  const enregistrerIncident = () => enregistrerIncidentAction({
    formIncident, envoyerPush, setEnregistrement, setModalIncident, chargerPortail, toast,
  });
  const supprimerIncident = (incidentId) => supprimerIncidentAction(incidentId, {
    setEnregistrement, chargerPortail, toast,
  });

  const notesPeriode = useMemo(
    () => mesNotes.filter((item) => item.periode === periodeN),
    [mesNotes, periodeN],
  );

  const imprimerEdt = () => imprimerEdtEnseignant({ emplois, nomEns, matiere, schoolInfo, annee });
  const imprimerPaies = () => imprimerPaiesEnseignant({ salaires, nomEns, matiere, schoolInfo, annee });

  return {
    c1, c2, nomEns, matiere, noteForms, defaultNoteType, periodes,
    isPrimaire, matieresDispo,
    tab, setTab, periodeN, setPeriodeN, chargement, portalData,
    emplois, eleves, salaires, incidents, enseignantId,
    mesClasses, mesNotes, mesEvenements, notesPeriode,
    modalNote, setModalNote, formNote, setFormNote,
    gridForm, setGridForm, gridProgress,
    modalIncident, setModalIncident, formIncident, setFormIncident,
    enregistrement,
    pendingSync, syncing, synchroniser,
    formatEmploiHeure,
    ouvrirCreationNote, ouvrirGrille, majGrid, enregistrerGrille,
    ouvrirEditionNote, enregistrerNote, supprimerNote,
    ouvrirSignalementEleve, ouvrirEditionIncident, enregistrerIncident, supprimerIncident,
    imprimerEdt, imprimerPaies,
  };
}
