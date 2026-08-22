import { useTranslation } from "react-i18next";
import { useElevesTab } from "./eleves-tab/use-eleves-tab";
import { ElevesToolbar } from "./eleves-tab/ElevesToolbar";
import { ElevesTable } from "./eleves-tab/ElevesTable";
import { ParentCompteModale } from "./eleves-tab/ParentCompteModale";

export function ElevesTab({
  eleves, elevesFiltres, cE, cleEleves, filtreClasse, setFiltreClasse, classesUniq,
  section = "college", annee, schoolInfo, schoolId, toast, logAction, canEdit, canCreateParent,
  parentEleve, setParentEleve, formP, setFormP, userRole = "",
}) {
  const { t } = useTranslation();
  const { peutCreerParent, chgP, ouvrirCompte, creerCompteParent } = useElevesTab({
    cleEleves, schoolId, toast, logAction, canEdit, canCreateParent, parentEleve, setParentEleve, setFormP,
  });

  return (
    <div>
      <ElevesToolbar
        eleves={eleves} elevesFiltres={elevesFiltres} filtreClasse={filtreClasse}
        setFiltreClasse={setFiltreClasse} classesUniq={classesUniq} section={section}
        annee={annee} schoolInfo={schoolInfo} userRole={userRole}
      />
      <ElevesTable
        cE={cE} elevesFiltres={elevesFiltres} peutCreerParent={peutCreerParent}
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
