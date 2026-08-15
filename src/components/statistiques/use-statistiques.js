import { useContext, useMemo, useState } from "react";
import { SchoolContext } from "../../contexts/SchoolContext";
import { useFirestore } from "../../hooks/useFirestore";
import { getAnnee } from "../../constants";
import { getPeriodesForSection } from "../../period-utils";
import { matieresForClasse as matieresForClasseFn } from "../ecole/ecole-logic";
import { statsAssiduite, statsEffectifs, statsEnseignants, statsFinances } from "./stats-logic";

// Le module croise TOUTES les sections : c'est ce qui le distingue de
// l'Aperçu, qui ne voit qu'un cycle. D'où ce chargement large — assumé, il
// n'a lieu que si la direction ouvre l'écran, et le module est premium.
const SECTIONS = [
  { cle: "prescolaire", label: "Préscolaire", eleves: "elevesPrescolaire", notes: "notesPrescolaire", matieres: "classesPrescolaire_matieres", absences: "elevesPrescolaire_absences", ens: "ensPrescolaire", emplois: "classesPrescolaire_emplois", periodeSection: "prescolaire", maxNote: 10, seuil: 5 },
  { cle: "primaire", label: "Primaire", eleves: "elevesPrimaire", notes: "notesPrimaire", matieres: "classesPrimaire_matieres", absences: "elevesPrimaire_absences", ens: "ensPrimaire", emplois: "classesPrimaire_emplois", periodeSection: "primaire", maxNote: 10, seuil: 5 },
  { cle: "college", label: "Collège", eleves: "elevesCollege", notes: "notesCollege", matieres: "classesCollege_matieres", absences: "elevesCollege_absences", ens: "ensCollege", emplois: "classesCollege_emplois", periodeSection: "college", maxNote: 20, seuil: 10 },
  { cle: "lycee", label: "Lycée", eleves: "elevesLycee", notes: "notesLycee", matieres: "classesLycee_matieres", absences: "elevesLycee_absences", ens: "ensLycee", emplois: "classesLycee_emplois", periodeSection: "lycee", maxNote: 20, seuil: 10 },
];

export function useStatistiques({ annee }) {
  const { schoolInfo, moisAnnee } = useContext(SchoolContext);
  const anneeCourante = annee || getAnnee();
  const [sectionCle, setSectionCle] = useState("primaire");
  const [tab, setTab] = useState("resultats");

  const section = SECTIONS.find((s) => s.cle === sectionCle) || SECTIONS[1];
  const periodes = getPeriodesForSection(schoolInfo, section.periodeSection, moisAnnee);
  const [periode, setPeriode] = useState("");
  const periodeActive = periode || periodes[0] || "";

  // Effectifs et finances portent sur TOUTE l'école : on charge les quatre
  // sections d'élèves. Les notes, en revanche, ne servent qu'à la section
  // examinée — les charger toutes coûterait cher pour rien.
  const elevesPre = useFirestore("elevesPrescolaire").items;
  const elevesPri = useFirestore("elevesPrimaire").items;
  const elevesCol = useFirestore("elevesCollege").items;
  const elevesLyc = useFirestore("elevesLycee").items;

  const { items: notes, chargement: cN } = useFirestore(section.notes, { annee: anneeCourante });
  const { items: matieres } = useFirestore(section.matieres);
  const { items: absences } = useFirestore(section.absences);
  const { items: enseignants } = useFirestore(section.ens);
  const { items: emplois } = useFirestore(section.emplois);
  const { items: tarifsClasses } = useFirestore("tarifs");
  const { items: paiements } = useFirestore("paiements", { annee: anneeCourante });

  const elevesSection = useMemo(
    () => ({ prescolaire: elevesPre, primaire: elevesPri, college: elevesCol, lycee: elevesLyc }[sectionCle] || []),
    [sectionCle, elevesPre, elevesPri, elevesCol, elevesLyc],
  );
  const tousEleves = useMemo(
    () => [...elevesPre, ...elevesPri, ...elevesCol, ...elevesLyc],
    [elevesPre, elevesPri, elevesCol, elevesLyc],
  );

  // Matières d'une classe : on appelle LA fonction de l'école, pas une
  // variante. Toute divergence ici ferait afficher au module des moyennes
  // différentes de celles de l'Aperçu et des bulletins, pour les mêmes élèves.
  const matieresForClasse = useMemo(
    () => (classe) => matieresForClasseFn(matieres, classe),
    [matieres],
  );

  const classes = useMemo(
    () => [...new Set(elevesSection.map((e) => e.classe).filter(Boolean))]
      .sort((a, b) => String(a).localeCompare(String(b), "fr", { numeric: true }))
      .map((nom) => ({ nom })),
    [elevesSection],
  );

  const actifs = useMemo(() => elevesSection.filter((e) => (e.statut || "Actif") === "Actif"), [elevesSection]);

  return {
    SECTIONS, section, sectionCle, setSectionCle,
    tab, setTab,
    periodes, periode: periodeActive, setPeriode,
    schoolInfo, anneeCourante, moisAnnee,
    notes, cN, matieres, matieresForClasse, classes,
    eleves: actifs, tousEleves,
    assiduite: useMemo(() => statsAssiduite(absences, actifs), [absences, actifs]),
    finances: useMemo(() => statsFinances(tousEleves, moisAnnee, tarifsClasses, paiements), [tousEleves, moisAnnee, tarifsClasses, paiements]),
    effectifs: useMemo(() => statsEffectifs(tousEleves), [tousEleves]),
    enseignants: useMemo(() => statsEnseignants(enseignants, emplois, notes), [enseignants, emplois, notes]),
  };
}
