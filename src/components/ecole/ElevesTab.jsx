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
import { Btn, Chargement } from "../ui";
import { Trombinoscope } from "../identite-enfant/Trombinoscope";
import { SeancePhotoModale } from "../identite-enfant/SeancePhotoModale";
import { BadgesModale } from "../identite-enfant/BadgesModale";

export function ElevesTab({
  eleves, elevesFiltres, cE, filtreClasse, setFiltreClasse, classesUniq,
  section = "college", annee, schoolInfo, schoolId, toast, logAction, canEdit, canCreateParent,
  parentEleve, setParentEleve, userRole = "", modChampE = null, canPhoto = false,
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
  // En maternelle, les enfants se reconnaissent à leur visage avant leur
  // nom : le trombinoscope s'ouvre d'office. Ailleurs, la liste.
  const [vue, setVue] = useState(section === "prescolaire" ? "trombi" : "liste");
  // Séance photo : { classe, eleveId } ouverte, null fermée. Photos et
  // surnoms : direction et chef de section, qui écrit la section (canPhoto,
  // RLS eleves_write) ; le reste de la fiche reste à la Comptabilité.
  const [seance, setSeance] = useState(null);
  // Badges de la liste affichée (vue Liste ; le trombinoscope a son bouton).
  const [badges, setBadges] = useState(null);
  const peutPhotographier = (canEdit || canPhoto) && !!modChampE;

  return (
    <div>
      <ElevesToolbar
        eleves={visibles(eleves)} elevesFiltres={listeAffichee} filtreClasse={filtreClasse}
        setFiltreClasse={setFiltreClasse} classesUniq={classesUniq} section={section}
        annee={annee} schoolInfo={schoolInfo} userRole={userRole}
        nbPartis={nbPartis} avecPartis={avecPartis} setAvecPartis={setAvecPartis}
        tri={<TriElevesSelect liste="eleves" value={tri} onChange={setTri} />}
        onBadges={vue === "liste" ? () => setBadges(listeAffichee) : null}
        vue={<span style={{ display: "inline-flex", gap: 4 }}>
          <Btn sm v={vue === "liste" ? "blue" : "ghost"} onClick={() => setVue("liste")}>📋 Liste</Btn>
          <Btn sm v={vue === "trombi" ? "blue" : "ghost"} onClick={() => setVue("trombi")}>🖼️ Trombinoscope</Btn>
        </span>}
      />
      {vue === "liste" ? (
        <ElevesTable
          cE={cE} elevesFiltres={listeAffichee} peutCreerParent={peutCreerParent}
          ouvrirCompte={ouvrirCompte} t={t}
          schoolInfo={schoolInfo} annee={annee} userRole={userRole}
        />
      ) : cE ? <Chargement/> : (
        <Trombinoscope
          eleves={listeAffichee} schoolInfo={schoolInfo} annee={annee} section={section}
          onSeancePhoto={peutPhotographier ? (classe, eleveId = null) => setSeance({ classe, eleveId }) : null}
          enregistrer={peutPhotographier ? modChampE : null} schoolId={schoolId} toast={toast} logAction={logAction}
        />
      )}
      {badges && <BadgesModale eleves={badges} schoolInfo={schoolInfo} annee={annee} section={section}
        fermer={() => setBadges(null)}/>}
      {seance && <SeancePhotoModale
        eleves={visibles(eleves)} classeInitiale={seance.classe} eleveInitial={seance.eleveId}
        schoolId={schoolId} enregistrer={modChampE} toast={toast} logAction={logAction}
        fermer={() => setSeance(null)}
      />}
      <ParentCompteModale
        parentEleve={parentEleve} fermer={()=>setParentEleve(null)}
        section={section} schoolId={schoolId} toast={toast} logAction={logAction}
      />
    </div>
  );
}
