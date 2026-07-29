import { useContext, useState } from "react";
import { SchoolContext } from "../../../contexts/SchoolContext";
import { COULEURS, niveauRank, genTranchesAdaptatives, makeFindEns } from "./edt-utils";

// État et dérivations de l'onglet emploi du temps : vue grille/liste, plage
// horaire et durée des tranches, classe active, couleurs matières, et la copie
// de l'EDT d'une classe vers une autre.
export function useEdtTab({ maxNote, classes, matieres, ens, emplois, filtreClasse, ajEmp, supEmp }) {
  const { schoolInfo, toast } = useContext(SchoolContext);

  const [edtVueGrille, setEdtVueGrille] = useState(true);
  const [edtCellule, setEdtCellule] = useState(null);
  const [edtDuree, setEdtDuree] = useState(maxNote === 10 ? 60 : 120);
  const [edtGeneralOuvert, setEdtGeneralOuvert] = useState(false);
  const [edtHeureDebut, setEdtHeureDebut] = useState("08:00");
  const [edtHeureFin, setEdtHeureFin] = useState("14:00");

  const duree = maxNote === 10 ? edtDuree : 120;
  const classesTriees = [...classes].sort((a, b) => niveauRank(a.nom) - niveauRank(b.nom));
  const classeEdtActuelle = filtreClasse === "all" && classesTriees.length > 0 ? classesTriees[0].nom : filtreClasse;
  const matCouleur = {};
  matieres.forEach((m, i) => { matCouleur[m.nom] = COULEURS[i % COULEURS.length]; });
  const findEns = makeFindEns(ens);
  const emploisClasse = emplois.filter((e) => e.classe === classeEdtActuelle);
  // Les lignes de la grille suivent les horaires RÉELLEMENT saisis pour cette
  // classe (en plus du pas régulier) : une rubrique de 15 min ou un créneau
  // qui ne tombe pas pile sur une tranche reste visible. `duree` ne sert plus
  // qu'à proposer un pas de départ et la durée par défaut d'un nouveau créneau.
  const TRANCHES = genTranchesAdaptatives(duree, edtHeureDebut, edtHeureFin, emploisClasse);
  const nbTranches = TRANCHES.length - 1;
  const getCreneau = (jour, hd) => emploisClasse.find((e) => e.jour === jour && e.heureDebut === hd);

  const copierEDT = () => {
    const cibles = classes.filter((c) => c.nom !== classeEdtActuelle);
    if (!cibles.length) { toast("Aucune autre classe.", "warning"); return; }
    const dest = window.prompt("Copier l'EDT de \"" + classeEdtActuelle + "\" vers quelle classe ?\n" + cibles.map((c) => c.nom).join(", "));
    if (!dest || !classes.find((c) => c.nom === dest)) { toast("Classe introuvable.", "error"); return; }
    const aSupp = emplois.filter((e) => e.classe === dest);
    Promise.all(aSupp.map((e) => supEmp(e._id))).then(() => {
      emploisClasse.forEach((e) => ajEmp({ ...e, classe: dest, _id: undefined }));
      toast("EDT copié vers " + dest, "success");
    });
  };

  return {
    schoolInfo, toast,
    edtVueGrille, setEdtVueGrille,
    edtCellule, setEdtCellule,
    edtDuree, setEdtDuree,
    edtGeneralOuvert, setEdtGeneralOuvert,
    edtHeureDebut, setEdtHeureDebut,
    edtHeureFin, setEdtHeureFin,
    TRANCHES, nbTranches,
    classesTriees, classeEdtActuelle,
    matCouleur, findEns,
    emploisClasse, getCreneau,
    copierEDT,
  };
}
