import { useState } from "react";
import { useTranslation } from "react-i18next";
import { estSorti } from "../../constants";
import { useElevesTab } from "./eleves-tab/use-eleves-tab";
import { ElevesToolbar } from "./eleves-tab/ElevesToolbar";
import { ElevesTable } from "./eleves-tab/ElevesTable";
import { ParentCompteModale } from "./eleves-tab/ParentCompteModale";

export function ElevesTab({
  eleves, elevesFiltres, cE, filtreClasse, setFiltreClasse, classesUniq,
  section = "college", annee, schoolInfo, schoolId, toast, logAction, canEdit, canCreateParent,
  parentEleve, setParentEleve, formP, setFormP, userRole = "",
}) {
  const { t } = useTranslation();
  // Élèves partis : hors de la liste, des cartes et de l'export par défaut —
  // ils n'ont plus de place en classe. Affichables pour retrouver une fiche.
  const [avecPartis, setAvecPartis] = useState(false);
  const nbPartis = eleves.filter(estSorti).length;
  const visibles = (liste) => (avecPartis ? liste : liste.filter((e) => !estSorti(e)));
  const { peutCreerParent, chgP, ouvrirCompte, creerCompteParent } = useElevesTab({
    section, schoolId, toast, logAction, canEdit, canCreateParent, parentEleve, setParentEleve, setFormP,
  });

  return (
    <div>
      <ElevesToolbar
        eleves={visibles(eleves)} elevesFiltres={visibles(elevesFiltres)} filtreClasse={filtreClasse}
        setFiltreClasse={setFiltreClasse} classesUniq={classesUniq} section={section}
        annee={annee} schoolInfo={schoolInfo} userRole={userRole}
        nbPartis={nbPartis} avecPartis={avecPartis} setAvecPartis={setAvecPartis}
      />
      <ElevesTable
        cE={cE} elevesFiltres={visibles(elevesFiltres)} peutCreerParent={peutCreerParent}
        ouvrirCompte={ouvrirCompte} t={t}
        schoolInfo={schoolInfo} annee={annee} userRole={userRole}
      />
      <ParentCompteModale
        parentEleve={parentEleve} setParentEleve={setParentEleve} formP={formP}
        setFormP={setFormP} chgP={chgP} creerCompteParent={creerCompteParent}
      />
    </div>
  );
}
