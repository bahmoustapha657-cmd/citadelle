import { useContext, useEffect, useMemo, useState } from "react";
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
  const emplois = portalData.emplois || [];
  const eleves = portalData.eleves || [];
  const notes = portalData.notes || [];
  const enseignements = portalData.enseignements || [];
  const salaires = portalData.salaires || [];
  const incidents = portalData.incidents || [];
  const enseignantId = utilisateur.enseignantId || null;

  const mesClasses = [...new Set(emplois.map((item) => item.classe).filter(Boolean))];
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

  // Wrapper : injecte eleves/notes/schoolInfo/utilisateur au helper.
  const construireGrille = (classe, type, periode) => construireGrilleHelper({
    classe, type, periode,
    eleves: portalData.eleves || [],
    mesNotes, schoolInfo, utilisateur,
  });

  const ouvrirGrille = () => {
    const classe = mesClasses[0] || "";
    const type = defaultNoteType;
    const periode = periodeN;
    setGridForm({
      classe,
      type,
      periode,
      notes: classe ? construireGrille(classe, type, periode) : {},
    });
    setGridProgress({ done: 0, total: 0 });
    setModalNote("grid");
  };

  const majGrid = (patch) => {
    setGridForm((current) => {
      const next = { ...current, ...patch };
      // Si on change classe/type/période, on reconstruit le tableau
      if (patch.classe !== undefined || patch.type !== undefined || patch.periode !== undefined) {
        next.notes = next.classe ? construireGrille(next.classe, next.type, next.periode) : {};
      }
      return next;
    });
  };

  const enregistrerGrille = () => enregistrerGrilleAction({
    gridForm, mesNotes, schoolInfo, utilisateur,
    setEnregistrement, setGridProgress, setModalNote, chargerPortail, toast,
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
    tab, setTab, periodeN, setPeriodeN, chargement, portalData,
    emplois, eleves, salaires, incidents, enseignantId,
    mesClasses, mesNotes, mesEvenements, notesPeriode,
    modalNote, setModalNote, formNote, setFormNote,
    gridForm, setGridForm, gridProgress,
    modalIncident, setModalIncident, formIncident, setFormIncident,
    enregistrement,
    formatEmploiHeure,
    ouvrirCreationNote, ouvrirGrille, majGrid, enregistrerGrille,
    ouvrirEditionNote, enregistrerNote, supprimerNote,
    ouvrirSignalementEleve, ouvrirEditionIncident, enregistrerIncident, supprimerIncident,
    imprimerEdt, imprimerPaies,
  };
}
