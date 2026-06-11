import { useContext, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { getAnnee, peutModifierEleves, peutModifier } from "../../constants";
import { SchoolContext } from "../../contexts/SchoolContext";
import { useFirestore } from "../../hooks/useFirestore";
import { db } from "../../firebaseDb";
import { toggleFraisAnnexe as toggleFraisAnnexeAction, toggleMens as toggleMensAction } from "./payment-actions";
import { ensureClasse as ensureClasseHelper, sortAlphaEleves } from "./eleves-helpers";
import { useComptaSalaires } from "./useComptaSalaires";
import { getPeriodesForSchool } from "../../period-utils";
import { getMensualiteOverview, getTarifMensuelForClasse } from "../../mensualite-utils";
import { buildTarifGetters, buildTarifData } from "./compta-tarifs";
import { saveSalaireAction, savePersonnelAction } from "./compta-saves";

// Toute la logique du module Comptabilité : chargement Firestore de
// toutes les collections (filtrées par année consultée), permissions,
// totaux, tarifs, et les handlers d'enregistrement avec gardes anti-doublon.
export function useComptabilite({ readOnly, annee, userRole, verrouOuvert = false }) {
  // readOnly=true → admin/direction : zéro action
  // canEdit → modifier/supprimer des enregistrements existants (verrou admin requis sauf admin lui-même — mais admin est readOnly)
  // canCreate → ajouter de nouveaux enregistrements (toujours permis si !readOnly)
  const anneeCourante = annee || getAnnee();
  const [anneeConsultee, setAnneeConsultee] = useState(anneeCourante);
  // Vue archive : filtre lecture mais désactive la création (les écritures iraient sur l'année courante).
  const enModeArchive = anneeConsultee !== anneeCourante;
  const anneeFiltre = enModeArchive ? anneeConsultee : null;
  const canCreate = !readOnly && !enModeArchive;
  const canEdit = !readOnly && !enModeArchive && (peutModifier(userRole) || verrouOuvert);
  const canEditEleves = !readOnly && !enModeArchive && (peutModifierEleves(userRole) || verrouOuvert);
  const { schoolId, schoolInfo, moisAnnee, moisSalaire, toast, logAction, envoyerPush } = useContext(SchoolContext);
  const { items: recettes, chargement: cR, ajouter: ajR, modifier: modR, supprimer: supR } = useFirestore("recettes", { annee: anneeFiltre });
  const { items: depenses, chargement: cD, ajouter: ajD, modifier: modD, supprimer: supD } = useFirestore("depenses", { annee: anneeFiltre });
  const { items: salaires, chargement: cS, ajouter: ajS, modifier: modS, supprimer: supS } = useFirestore("salaires", { annee: anneeFiltre });
  const { items: bons, ajouter: ajBon, modifier: modBon, supprimer: supBon } = useFirestore("bons", { annee: anneeFiltre });
  const { items: personnel, chargement: cPers, ajouter: ajPers, modifier: modPers, supprimer: supPers } = useFirestore("personnel");
  const { items: versements, chargement: cV, ajouter: ajV, modifier: modV, supprimer: supV } = useFirestore("versements", { annee: anneeFiltre });
  const { items: elevesC, chargement: cEC, ajouter: ajEC, modifier: modEC_full, supprimer: supEC, modifierChamp: modEC } = useFirestore("elevesCollege");
  const { items: elevesP, chargement: cEP, ajouter: ajEP, modifier: modEP_full, supprimer: supEP, modifierChamp: modEP } = useFirestore("elevesPrimaire");
  const { items: elevesL, chargement: cEL, ajouter: ajEL, modifier: modEL_full, supprimer: supEL, modifierChamp: modEL } = useFirestore("elevesLycee");
  const { items: tarifsClasses, ajouter: ajTarif, modifier: modTarif } = useFirestore("tarifs");
  const { items: classesCollegeList, ajouter: ajClasseCollege } = useFirestore("classesCollege");
  const { items: classesPrimaireList, ajouter: ajClassePrimaire } = useFirestore("classesPrimaire");
  const { items: classesLyceeList, ajouter: ajClasseLycee } = useFirestore("classesLycee");
  // Enseignants — création/édition de la paie depuis Compta (vue hybride)
  const { items: ensCollege, ajouter: ajEnsCol, modifier: modEnsCol, supprimer: supEnsCol } = useFirestore("ensCollege");
  const { items: ensLycee, ajouter: ajEnsLyc, modifier: modEnsLyc, supprimer: supEnsLyc } = useFirestore("ensLycee");
  const { items: ensPrimaire, ajouter: ajEnsPrim, modifier: modEnsPrim, supprimer: supEnsPrim } = useFirestore("ensPrimaire");
  const { items: emploisCollege } = useFirestore("classesCollege_emplois");
  const { items: emploisLycee } = useFirestore("classesLycee_emplois");
  const { items: engCollege } = useFirestore("ensCollege_enseignements");
  const { items: engLycee } = useFirestore("ensLycee_enseignements");

  const [tab, setTab] = useState("bilan");
  const [sousTabSal, setSousTabSal] = useState("etats");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [niveau, setNiveau] = useState("college");
  const [filtClasse, setFiltClasse] = useState("all");
  const [moisSel, setMoisSel] = useState(() => moisSalaire[0] || "Octobre");
  const [primeDefaut, setPrimeDefaut] = useState(0);
  const [filtrePrimNom, setFiltrePrimNom] = useState("");
  const [filtrePrimClasse, setFiltrePrimClasse] = useState("all");

  const elevesParNiveau = { college: elevesC, lycee: elevesL, primaire: elevesP };
  const modChampParNiveau = { college: modEC, lycee: modEL, primaire: modEP };
  const ajoutParNiveau = { college: ajEC, lycee: ajEL, primaire: ajEP };
  const suppressionParNiveau = { college: supEC, lycee: supEL, primaire: supEP };
  const modifParNiveau = { college: modEC_full, lycee: modEL_full, primaire: modEP_full };
  // Wrappers : injectent les listes de classes + ajouts Firestore au helper.
  const sortAlpha = (arr) => sortAlphaEleves(arr, schoolInfo.triEleves);
  const ensureClasse = (nom, niv, dejaCreees) => {
    const cfg = niv === "primaire" ? { classesList: classesPrimaireList, ajClasse: ajClassePrimaire }
      : niv === "lycee" ? { classesList: classesLyceeList, ajClasse: ajClasseLycee }
        : { classesList: classesCollegeList, ajClasse: ajClasseCollege };
    return ensureClasseHelper(nom, { ...cfg, dejaCreees });
  };

  const totR = recettes.reduce((s, x) => s + Number(x.montant), 0);
  const totD = depenses.reduce((s, x) => s + Number(x.montant), 0);
  const totVers = versements.reduce((s, x) => s + Number(x.montant), 0);

  const eleves = elevesParNiveau[niveau] || elevesC;
  const modEleves = modChampParNiveau[niveau] || modEC;
  const classesU = [...new Set(eleves.map((e) => e.classe))].filter(Boolean);
  const tousElevesScolarite = [...elevesC, ...elevesL, ...elevesP];

  const {
    getTarifConfig, getTarif, getTarifBase, getTarifRevision, getTarifAutre,
    getTarifIns, getTarifReinsc, getTarifInscriptionEleve,
  } = buildTarifGetters(tarifsClasses);
  const saveTarif = async (classe, montant, inscription = null, reinscription = null, revision = null, autre = null) => {
    const existing = getTarifConfig(classe);
    const data = buildTarifData(montant, { inscription, reinscription, revision, autre });
    if (existing) await modTarif({ _id: existing._id, ...data });
    else await ajTarif({ classe, ...data });
  };
  const elevesFiltres = sortAlpha(filtClasse === "all" ? eleves : eleves.filter((e) => e.classe === filtClasse));

  // Wrappers : injectent les deps (modEleves, readOnly, canEdit, toast,
  // envoyerPush) à chaque appel. Le helper extrait porte la logique métier.
  const toggleFraisAnnexe = (_id, opts) => toggleFraisAnnexeAction(_id, opts, {
    readOnly, canEdit, toast, modEleves,
  });
  const toggleMens = (_id, mois, mensActuels, mensDatesActuels, nomEleve) => {
    // Fige le tarif en vigueur au moment du paiement (mensMontants[mois]) :
    // les totaux perçus ne bougent plus si le tarif change en cours d'année.
    const eleve = tousElevesScolarite.find((e) => e._id === _id);
    return toggleMensAction(_id, mois, mensActuels, mensDatesActuels, nomEleve, {
      readOnly, canEdit, toast, modEleves, envoyerPush,
      montantMois: getTarifMensuelForClasse(tarifsClasses, eleve?.classe || ""),
      mensMontantsActuels: eleve?.mensMontants || null,
    });
  };

  const enreg = (aj, mod, extra = {}) => {
    if (readOnly) return;
    const r = { ...form, ...extra };
    if (modal.startsWith("add")) aj({ ...r, annee: annee || anneeConsultee }); else mod(r);
    setModal(null);
  };

  const saveSalaire = async (extra = {}) => {
    if (readOnly) return;
    const r = { ...form, ...extra };
    const ok = await saveSalaireAction(r, {
      isEdit: modal === "edit_s", salaires, toast, modS, ajS,
      anneeRecord: annee || anneeConsultee,
    });
    if (ok) setModal(null);
  };

  const savePersonnel = async () => {
    if (readOnly) return;
    const r = { ...form, salaireBase: Number(form.salaireBase || 0) };
    const ok = await savePersonnelAction(r, {
      isEdit: modal === "edit_p", personnel, toast, ajPers, modPers,
    });
    if (ok) setModal(null);
  };

  // Domaine paie : état dérivé (filtrage mois/section, totaux) + actions
  // (génération auto, application des bons, impression). Voir useComptaSalaires.
  const salairesDomaine = useComptaSalaires({
    salaires, bons, moisSel, moisSalaire,
    ensCollege, ensLycee, ensPrimaire, personnel,
    emploisCollege, emploisLycee, engCollege, engLycee,
    primeDefaut, annee, anneeConsultee, schoolInfo,
    modS, ajS, supS, readOnly, toast, logAction,
  });
  const {
    moisLabel, totNetSec, totNetPrim, totNetPers, salairesMois,
  } = salairesDomaine;

  const mensualiteOverview = getMensualiteOverview(tousElevesScolarite, moisAnnee, tarifsClasses);
  const periodes = getPeriodesForSchool(schoolInfo, moisAnnee);
  const defaultPeriode = periodes[0] || "T1";
  const impaye = mensualiteOverview.totalDu - mensualiteOverview.totalPercu;
  const pctImpaye = mensualiteOverview.totalDu > 0
    ? ((impaye / mensualiteOverview.totalDu) * 100).toFixed(1)
    : 0;

  const anneeBase = Number(String(anneeCourante).split("-")[0]) || new Date().getFullYear();
  const anneesDispo = Array.from({ length: 7 }, (_, i) => `${anneeBase - i}-${anneeBase - i + 1}`);

  const toggleBlocage = async () => {
    const blocage = !!schoolInfo.blocageParentImpaye;
    if (!canCreate) { toast("Action réservée au comptable ou à l'administrateur.", "warning"); return; }
    try {
      await updateDoc(doc(db, "ecoles", schoolId), { blocageParentImpaye: !blocage });
      toast(blocage ? "🔓 Accès parents rétabli" : "🔒 Accès parents bloqué pour les impayés", "success");
    } catch (e) {
      console.error("toggleBlocage error:", e);
      toast("Impossible de modifier le blocage. Vérifiez vos droits ou réessayez.", "error");
    }
  };

  return {
    schoolInfo, moisAnnee, moisSalaire, toast, logAction,
    anneeCourante, anneeConsultee, setAnneeConsultee, enModeArchive,
    canCreate, canEdit, canEditEleves, anneesDispo, toggleBlocage,
    recettes, cR, ajR, modR, supR,
    depenses, cD, ajD, modD, supD,
    salaires, cS, ajS, modS, supS,
    bons, ajBon, modBon, supBon,
    personnel, cPers, supPers,
    versements, cV, ajV, modV, supV,
    elevesC, elevesP, elevesL, cEC, cEP, cEL,
    tarifsClasses,
    ensCollege, ensLycee, ensPrimaire,
    ajEnsCol, ajEnsLyc, ajEnsPrim, modEnsCol, modEnsLyc, modEnsPrim, supEnsCol, supEnsLyc, supEnsPrim,
    tab, setTab, sousTabSal, setSousTabSal, modal, setModal, form, setForm,
    niveau, setNiveau, filtClasse, setFiltClasse, moisSel, setMoisSel,
    primeDefaut, setPrimeDefaut, filtrePrimNom, setFiltrePrimNom, filtrePrimClasse, setFiltrePrimClasse,
    ajoutParNiveau, suppressionParNiveau, modifParNiveau, ensureClasse, sortAlpha,
    totR, totD, totVers, eleves, classesU, tousElevesScolarite, elevesFiltres,
    getTarif, getTarifBase, getTarifRevision, getTarifAutre, getTarifIns, getTarifReinsc,
    getTarifInscriptionEleve, saveTarif,
    toggleFraisAnnexe, toggleMens, enreg, saveSalaire, savePersonnel,
    salairesDomaine, moisLabel, totNetSec, totNetPrim, totNetPers, salairesMois,
    mensualiteOverview, periodes, defaultPeriode, impaye, pctImpaye,
  };
}
