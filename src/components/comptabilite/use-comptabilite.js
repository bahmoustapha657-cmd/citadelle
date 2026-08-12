import { useContext, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { getAnnee, peutModifierEleves, peutModifier } from "../../constants";
import { hasWrite } from "../../../shared/postes-config.js";
import { SchoolContext } from "../../contexts/SchoolContext";
import { useFirestore } from "../../hooks/useFirestore";
import { db } from "../../firebaseDb";
import { toggleFraisAnnexe as toggleFraisAnnexeAction, toggleMens as toggleMensAction } from "./payment-actions";
import { ensureClasse as ensureClasseHelper, sortAlphaEleves } from "./eleves-helpers";
import { useComptaSalaires } from "./useComptaSalaires";
import { getPeriodesForSchool } from "../../period-utils";
import { getMensualiteOverview, getTarifMensuelForClasse } from "../../mensualite-utils";
import { buildTarifGetters, buildTarifData } from "./compta-tarifs";
import { scolaritePourAnnee } from "../admin/cloture-annee-utils";
import { saveSalaireAction, savePersonnelAction } from "./compta-saves";

// Toute la logique du module Comptabilité : chargement Firestore de
// toutes les collections (filtrées par année consultée), permissions,
// totaux, tarifs, et les handlers d'enregistrement avec gardes anti-doublon.
export function useComptabilite({ readOnly, annee, userRole, permissions = null, verrouOuvert = false, auteur = "" }) {
  // readOnly=true → admin/direction : zéro action
  // canEdit → modifier/supprimer des enregistrements existants (verrou admin requis sauf admin lui-même — mais admin est readOnly)
  // canCreate → ajouter de nouveaux enregistrements (toujours permis si !readOnly)
  const anneeCourante = annee || getAnnee();
  const [anneeConsultee, setAnneeConsultee] = useState(anneeCourante);
  // Vue archive : désactive la création (les écritures iraient sur l'année
  // courante). La LECTURE, elle, est filtrée sur `anneeConsultee` en toutes
  // circonstances — voir les chargements ci-dessous.
  const enModeArchive = anneeConsultee !== anneeCourante;
  const canCreate = !readOnly && !enModeArchive;
  const canEdit = !readOnly && !enModeArchive && (peutModifier(userRole) || verrouOuvert);
  // Postes flexibles : tout poste qui écrit la compta gère aussi la fiche
  // élève (inscriptions, mensualités) — même périmètre que le comptable.
  const canEditEleves = !readOnly && !enModeArchive
    && (peutModifierEleves(userRole) || hasWrite(permissions, "compta") || verrouOuvert);
  const { schoolId, schoolInfo, moisAnnee, moisSalaire, toast, logAction, envoyerPush } = useContext(SchoolContext);
  // Grands livres filtrés sur l'année consultée en PERMANENCE. Auparavant le
  // filtre ne s'appliquait qu'en mode archive : en mode normal, recettes,
  // dépenses et versements de TOUTES les années étaient chargés, et le Bilan
  // les additionnait. Invisible tant qu'une seule année existe, faux dès la
  // rentrée suivante — d'autant que les graphiques par période raisonnent sur
  // T1/T2/T3 sans regarder l'année, donc deux T1 se seraient confondus.
  const { items: recettes, chargement: cR, ajouter: ajR, modifier: modR, supprimer: supR } = useFirestore("recettes", { annee: anneeConsultee });
  const { items: depenses, chargement: cD, ajouter: ajD, modifier: modD, supprimer: supD } = useFirestore("depenses", { annee: anneeConsultee });
  // Même raison que les bons : les fiches de paie sont regroupées par MOIS,
  // deux exercices se seraient superposés sur le même mois.
  const { items: salaires, chargement: cS, ajouter: ajS, modifier: modS, supprimer: supS } = useFirestore("salaires", { annee: anneeConsultee });
  // Bons filtrés en permanence eux aussi : ils sont appariés par MOIS sur les
  // fiches de paie, donc un bon de « Nov » de l'an dernier se serait cumulé au
  // « Nov » de la nouvelle année pour la même personne.
  const { items: bons, ajouter: ajBon, modifier: modBon, supprimer: supBon } = useFirestore("bons", { annee: anneeConsultee });
  const { items: personnel, chargement: cPers, ajouter: ajPers, modifier: modPers, supprimer: supPers } = useFirestore("personnel");
  const { items: versements, chargement: cV, ajouter: ajV, modifier: modV, supprimer: supV } = useFirestore("versements", { annee: anneeConsultee });
  // Journal des encaissements de scolarité (grand livre, ajout seul) : la
  // source d'historique que les champs de la fiche élève ne peuvent pas être.
  // Filtré sur l'année consultée, TOUJOURS — et pas seulement en mode archive
  // comme les autres grands livres : le journal grossit d'une ligne par
  // encaissement (ordre de 4 500/an pour une école de 500 élèves) et il n'y a
  // aucune raison de charger les exercices passés pour afficher l'exercice en
  // cours.
  const { items: paiements, chargement: cPaie, ajouter: ajPaiement } = useFirestore("paiements", { annee: anneeConsultee });
  const { items: elevesCBrut, chargement: cEC, ajouter: ajEC, modifier: modEC_full, supprimer: supEC, modifierChamp: modEC } = useFirestore("elevesCollege");
  const { items: elevesPBrut, chargement: cEP, ajouter: ajEP, modifier: modEP_full, supprimer: supEP, modifierChamp: modEP } = useFirestore("elevesPrimaire");
  const { items: elevesLBrut, chargement: cEL, ajouter: ajEL, modifier: modEL_full, supprimer: supEL, modifierChamp: modEL } = useFirestore("elevesLycee");
  // Préscolaire : section à part entière, donc scolarité/inscriptions à part.
  const { items: elevesPreBrut, chargement: cEPre, ajouter: ajEPre, modifier: modEPre_full, supprimer: supEPre, modifierChamp: modEPre } = useFirestore("elevesPrescolaire");
  // Vue archive : les élèves ne sont pas dupliqués par année, c'est la clôture
  // d'année qui fige leur scolarité dans la fiche (extra.historique[annee]).
  // On lit donc l'instantané de l'année consultée — repli sur la fiche
  // courante si cette année-là n'a jamais été clôturée.
  const projeterAnnee = (liste) => (enModeArchive
    ? liste.map((e) => scolaritePourAnnee(e, anneeConsultee, anneeCourante))
    : liste);
  const elevesC = projeterAnnee(elevesCBrut);
  const elevesP = projeterAnnee(elevesPBrut);
  const elevesL = projeterAnnee(elevesLBrut);
  const elevesPre = projeterAnnee(elevesPreBrut);
  const { items: tarifsClasses, ajouter: ajTarif, modifier: modTarif } = useFirestore("tarifs");
  const { items: classesCollegeList, ajouter: ajClasseCollege } = useFirestore("classesCollege");
  const { items: classesPrimaireList, ajouter: ajClassePrimaire } = useFirestore("classesPrimaire");
  const { items: classesLyceeList, ajouter: ajClasseLycee } = useFirestore("classesLycee");
  const { items: classesPrescolaireList, ajouter: ajClassePrescolaire } = useFirestore("classesPrescolaire");
  // Enseignants — création/édition de la paie depuis Compta (vue hybride)
  const { items: ensCollege, ajouter: ajEnsCol, modifier: modEnsCol, supprimer: supEnsCol } = useFirestore("ensCollege");
  const { items: ensLycee, ajouter: ajEnsLyc, modifier: modEnsLyc, supprimer: supEnsLyc } = useFirestore("ensLycee");
  const { items: ensPrimaire, ajouter: ajEnsPrim, modifier: modEnsPrim, supprimer: supEnsPrim } = useFirestore("ensPrimaire");
  // Enseignants de maternelle : ils doivent figurer sur la paie comme les autres.
  const { items: ensPrescolaire, ajouter: ajEnsPresco, modifier: modEnsPresco, supprimer: supEnsPresco } = useFirestore("ensPrescolaire");
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

  const elevesParNiveau = { college: elevesC, lycee: elevesL, primaire: elevesP, prescolaire: elevesPre };
  const modChampParNiveau = { college: modEC, lycee: modEL, primaire: modEP, prescolaire: modEPre };
  const ajoutParNiveau = { college: ajEC, lycee: ajEL, primaire: ajEP, prescolaire: ajEPre };
  const suppressionParNiveau = { college: supEC, lycee: supEL, primaire: supEP, prescolaire: supEPre };
  const modifParNiveau = { college: modEC_full, lycee: modEL_full, primaire: modEP_full, prescolaire: modEPre_full };
  // Wrappers : injectent les listes de classes + ajouts Firestore au helper.
  const sortAlpha = (arr) => sortAlphaEleves(arr, schoolInfo.triEleves);
  const ensureClasse = (nom, niv, dejaCreees) => {
    const cfg = niv === "prescolaire" ? { classesList: classesPrescolaireList, ajClasse: ajClassePrescolaire }
      : niv === "primaire" ? { classesList: classesPrimaireList, ajClasse: ajClassePrimaire }
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
  const tousElevesScolarite = [...elevesC, ...elevesL, ...elevesP, ...elevesPre];

  const {
    getTarifConfig, getTarif, getTarifBase, getTarifRevision, getTarifAutre,
    getTarifIns, getTarifReinsc, getTarifInscriptionEleve, getTarifFraisDivers,
  } = buildTarifGetters(tarifsClasses);
  const saveTarif = async (classe, montant, inscription = null, reinscription = null, revision = null, autre = null, fraisDivers = null) => {
    const existing = getTarifConfig(classe);
    const data = buildTarifData(montant, { inscription, reinscription, revision, autre, fraisDivers });
    if (existing) await modTarif({ _id: existing._id, ...data });
    else await ajTarif({ classe, ...data });
  };
  const elevesFiltres = sortAlpha(filtClasse === "all" ? eleves : eleves.filter((e) => e.classe === filtClasse));

  // Wrappers : injectent les deps (modEleves, readOnly, canEdit, toast,
  // envoyerPush) à chaque appel. Le helper extrait porte la logique métier.
  // Année portée par les écritures du journal : celle de l'exercice en cours
  // (on n'écrit jamais en mode archive, canCreate/canEdit y sont faux).
  const anneeEcriture = annee || anneeConsultee;
  // Signature des écritures : le NOM de la personne connectée. Repli sur son
  // poste si le profil n'a pas de nom — mieux vaut « comptable » que rien.
  const signature = auteur || userRole || "";
  const toggleFraisAnnexe = (_id, opts) => toggleFraisAnnexeAction(_id, opts, {
    readOnly, canEdit, toast, modEleves, logAction,
    ajPaiement, annee: anneeEcriture, auteur: signature,
    eleve: tousElevesScolarite.find((e) => e._id === _id) || null,
  });
  const toggleMens = (_id, mois, mensActuels, mensDatesActuels, nomEleve) => {
    // Fige le tarif en vigueur au moment du paiement (mensMontants[mois]) :
    // les totaux perçus ne bougent plus si le tarif change en cours d'année.
    const eleve = tousElevesScolarite.find((e) => e._id === _id);
    return toggleMensAction(_id, mois, mensActuels, mensDatesActuels, nomEleve, {
      readOnly, canEdit, toast, modEleves, envoyerPush, logAction,
      montantMois: getTarifMensuelForClasse(tarifsClasses, eleve?.classe || ""),
      mensMontantsActuels: eleve?.mensMontants || null,
      ajPaiement, annee: anneeEcriture, auteur: signature, eleve: eleve || null,
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
    paiements, cPaie, ajPaiement,
    elevesC, elevesP, elevesL, elevesPre, cEC, cEP, cEL, cEPre,
    tarifsClasses,
    ensCollege, ensLycee, ensPrimaire, ensPrescolaire,
    ajEnsCol, ajEnsLyc, ajEnsPrim, ajEnsPresco, modEnsCol, modEnsLyc, modEnsPrim, modEnsPresco, supEnsCol, supEnsLyc, supEnsPrim, supEnsPresco,
    tab, setTab, sousTabSal, setSousTabSal, modal, setModal, form, setForm,
    niveau, setNiveau, filtClasse, setFiltClasse, moisSel, setMoisSel,
    primeDefaut, setPrimeDefaut, filtrePrimNom, setFiltrePrimNom, filtrePrimClasse, setFiltrePrimClasse,
    ajoutParNiveau, suppressionParNiveau, modifParNiveau, ensureClasse, sortAlpha,
    totR, totD, totVers, eleves, classesU, tousElevesScolarite, elevesFiltres,
    getTarif, getTarifBase, getTarifRevision, getTarifAutre, getTarifIns, getTarifReinsc,
    getTarifInscriptionEleve, getTarifFraisDivers, saveTarif,
    toggleFraisAnnexe, toggleMens, enreg, saveSalaire, savePersonnel,
    salairesDomaine, moisLabel, totNetSec, totNetPrim, totNetPers, salairesMois,
    mensualiteOverview, periodes, defaultPeriode, impaye, pctImpaye,
  };
}
