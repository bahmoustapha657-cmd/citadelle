import { useState } from "react";
import { useTranslation } from "react-i18next";
import { estSorti } from "../../constants";
import { useElevesTab } from "./eleves-tab/use-eleves-tab";
import { ElevesToolbar } from "./eleves-tab/ElevesToolbar";
import { ElevesTable } from "./eleves-tab/ElevesTable";
import { ParentCompteModale } from "./eleves-tab/ParentCompteModale";
import { TriElevesSelect } from "../TriElevesSelect";
import { useTriEleves } from "../use-tri-eleves";
import { trierEleves } from "../../tri-eleves";

export function ElevesTab({
  eleves, elevesFiltres, cE, filtreClasse, setFiltreClasse, classesUniq,
  section = "college", annee, schoolInfo, schoolId, toast, logAction, canEdit, canCreateParent,
  parentEleve, setParentEleve, userRole = "",
}) {
  const { t } = useTranslation();
  // Élèves partis : hors de la liste, des cartes et de l'export par défaut —
  // ils n'ont plus de place en classe. Affichables pour retrouver une fiche.
  const [avecPartis, setAvecPartis] = useState(false);
  const nbPartis = eleves.filter(estSorti).length;
  const visibles = (liste) => (avecPartis ? liste : liste.filter((e) => !estSorti(e)));
  const [tri, setTri] = useTriEleves("eleves");
  const listeAffichee = trierEleves(visibles(elevesFiltres), tri);
  const { peutCreerParent, ouvrirCompte } = useElevesTab({ canEdit, canCreateParent, setParentEleve });

  return (
    <div>
      <ElevesToolbar
        eleves={visibles(eleves)} elevesFiltres={listeAffichee} filtreClasse={filtreClasse}
        setFiltreClasse={setFiltreClasse} classesUniq={classesUniq} section={section}
        annee={annee} schoolInfo={schoolInfo} userRole={userRole}
        nbPartis={nbPartis} avecPartis={avecPartis} setAvecPartis={setAvecPartis}
        tri={<TriElevesSelect liste="eleves" value={tri} onChange={setTri} />}
      />
      <ElevesTable
        cE={cE} elevesFiltres={listeAffichee} peutCreerParent={peutCreerParent}
        ouvrirCompte={ouvrirCompte} t={t}
        schoolInfo={schoolInfo} annee={annee} userRole={userRole}
      />
      <ParentCompteModale
        parentEleve={parentEleve} fermer={()=>setParentEleve(null)}
        section={section} schoolId={schoolId} toast={toast} logAction={logAction}
      />
    </div>
  );
}
