import { useContext, useState } from "react";
import { getAnnee, peutCreerComptesParent, peutModifier } from "../../constants";
import { getDefaultPeriodeForSection, getPeriodesForSection } from "../../period-utils";
import { SchoolContext } from "../../contexts/SchoolContext";
import { useFirestore } from "../../hooks/useFirestore";
import { getActiveNoteForms } from "../../evaluation-forms";
import {
  sortAlphaEcole as sortAlphaEcoleFn,
  matieresForClasse as matieresForClasseFn,
  effectifReel as effectifReelFn,
  computeMoyenne,
  computeAnneesDispo,
} from "./ecole-logic";
import { saveClasseAction, saveEnseignantAction, saveAppreciationAction } from "./ecole-saves";

// Toute la logique du module École (générique primaire/collège/lycée) :
// chargement Firestore des collections dérivées des clés passées en props,
// permissions, périodes scolaires, tri des élèves et handlers de sauvegarde.
export function useEcole({
  cleClasses, cleEns, cleNotes, cleEleves,
  userRole, annee, readOnly = false, verrouOuvert = false,
}) {
  const isPrimarySection = cleEns === "ensPrimaire";
  const anneeCourante = annee || getAnnee();
  const [anneeConsultee, setAnneeConsultee] = useState(anneeCourante);
  // Vue archive : filtre les notes (les autres collections restent persistantes).
  const enModeArchive = anneeConsultee !== anneeCourante;
  const anneeFiltre = enModeArchive ? anneeConsultee : null;
  const { items: classes, chargement: cC, ajouter: ajC, modifier: modC, supprimer: supC } = useFirestore(cleClasses);
  const { items: ens, chargement: cEns, ajouter: ajEns, modifier: modEns, supprimer: supEns } = useFirestore(cleEns);
  const { items: notes, chargement: cN, ajouter: ajN, supprimer: supN } = useFirestore(cleNotes, { annee: anneeFiltre });
  const { items: eleves, chargement: cE, modifier: modE } = useFirestore(cleEleves);
  const { items: absences, chargement: cAbs, ajouter: ajAbs, supprimer: supAbs } = useFirestore(cleEleves + "_absences");
  const { items: enseignements, chargement: cEng, ajouter: ajEng, modifier: modEng, supprimer: supEng } = useFirestore(cleEns + "_enseignements");
  const { items: matieres, chargement: cMat, ajouter: ajMat, modifier: modMat, supprimer: supMat } = useFirestore(cleClasses + "_matieres");
  const { items: emplois, chargement: cEmp, ajouter: ajEmp, modifier: modEmp, supprimer: supEmp } = useFirestore(cleClasses + "_emplois");
  const cleAppreciations = cleNotes.replace("notes", "appreciations");
  const { items: appreciations, ajouter: ajApp, modifier: modApp } = useFirestore(cleAppreciations);
  const getAppreciation = (eleveId, periode) => appreciations.find((a) => a.eleveId === eleveId && a.periode === periode);
  const saveAppreciation = (eleveId, periode, texte) =>
    saveAppreciationAction(eleveId, periode, texte, { getAppreciation, ajApp, modApp });
  const appreciationsParEleveB = (periode) => Object.fromEntries(
    appreciations.filter((a) => a.periode === periode && a.texte).map((a) => [a.eleveId, a.texte]),
  );

  const [tab, setTab] = useState("apercu");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [filtreClasse, setFiltreClasse] = useState("all");
  // Matières filtrées par classe : si la matière a des classes assignées, on filtre ; sinon elle s'applique à tout
  const matieresForClasse = (classe) => matieresForClasseFn(matieres, classe);
  const [rechercheMatricule, setRechercheMatricule] = useState("");
  const [ensCompte, setEnsCompte] = useState(null);
  const [formC, setFormC] = useState({});
  const [parentEleve, setParentEleve] = useState(null);
  const [formP, setFormP] = useState({});
  const [importPreview, setImportPreview] = useState(null);
  const [importEnCours, setImportEnCours] = useState(false);
  const [notesVue, setNotesVue] = useState("liste"); // "liste" | "grille"
  const [grilleClasse, setGrilleClasse] = useState("all");
  const [grilleChanges, setGrilleChanges] = useState({}); // {"eleveId|matiere": note}
  const [grilleSaving, setGrilleSaving] = useState(false);
  const chg = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const { schoolId, schoolInfo, moisAnnee, toast, logAction, envoyerPush } = useContext(SchoolContext);
  const sectionPeriode = isPrimarySection ? "primaire" : "secondaire";
  const periodes = getPeriodesForSection(schoolInfo, sectionPeriode, moisAnnee);
  const defaultPeriode = periodes[0] || getDefaultPeriodeForSection(schoolInfo, sectionPeriode);
  const [periodeB, setPeriodeB] = useState(defaultPeriode);
  const [grillePeriode, setGrillePeriode] = useState(defaultPeriode);
  const noteForms = getActiveNoteForms(schoolInfo, isPrimarySection ? "primaire" : "secondaire");
  const defaultNoteType = noteForms[0]?.value || "Devoir";
  const [grilleType, setGrilleType] = useState(defaultNoteType);
  const canCreate = !readOnly && !enModeArchive;
  const canEdit = !readOnly && !enModeArchive && (peutModifier(userRole) || verrouOuvert);
  // Création de compte parent : gate plus large que canEdit pour inclure
  // le comptable (front-line inscription/paiement). Ignore le verrou car
  // c'est une action de service au tuteur, pas une édition de données scolaires.
  const canCreateParent = !readOnly && !enModeArchive && peutCreerComptesParent(userRole);
  const moy = computeMoyenne(notes);
  const classesUniq = [...new Set(eleves.map((e) => e.classe))].filter(Boolean);
  const sortAlphaEcole = (arr) => sortAlphaEcoleFn(arr, schoolInfo.triEleves || "prenom_nom");
  const elevesFiltres = sortAlphaEcole(filtreClasse === "all" ? eleves : eleves.filter((e) => e.classe === filtreClasse));
  const effectifReel = (nomClasse) => effectifReelFn(eleves, nomClasse);

  const saveClasse = () => {
    saveClasseAction({ form, modal, classes, eleves, ajC, modC, modE });
    setModal(null);
  };

  const saveEnseignant = async () => {
    const ok = await saveEnseignantAction({ form, modal, ens, classes, toast, ajEns, modEns, ajC, modC });
    if (ok) setModal(null);
  };

  const anneesDispo = computeAnneesDispo(anneeCourante);

  return {
    isPrimarySection, anneeCourante, anneeConsultee, setAnneeConsultee, enModeArchive,
    classes, cC, ajC, modC, supC,
    ens, cEns, ajEns, modEns, supEns,
    notes, cN, ajN, supN,
    eleves, cE, modE,
    absences, cAbs, ajAbs, supAbs,
    enseignements, cEng, ajEng, modEng, supEng,
    matieres, cMat, ajMat, modMat, supMat,
    emplois, cEmp, ajEmp, modEmp, supEmp,
    getAppreciation, saveAppreciation, appreciationsParEleveB,
    tab, setTab, modal, setModal, form, setForm, chg,
    filtreClasse, setFiltreClasse, matieresForClasse,
    rechercheMatricule, setRechercheMatricule,
    ensCompte, setEnsCompte, formC, setFormC,
    parentEleve, setParentEleve, formP, setFormP,
    importPreview, setImportPreview, importEnCours, setImportEnCours,
    notesVue, setNotesVue, grilleClasse, setGrilleClasse,
    grilleChanges, setGrilleChanges, grilleSaving, setGrilleSaving,
    schoolId, schoolInfo, moisAnnee, toast, logAction, envoyerPush,
    periodes, defaultPeriode, periodeB, setPeriodeB, grillePeriode, setGrillePeriode,
    noteForms, defaultNoteType, grilleType, setGrilleType,
    canCreate, canEdit, canCreateParent, moy, classesUniq,
    elevesFiltres, effectifReel, saveClasse, saveEnseignant, anneesDispo,
  };
}
