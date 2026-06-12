// ══════════════════════════════════════════════════════════════
//  Routeur de modules (mappe page → composant lazy)
// ══════════════════════════════════════════════════════════════
import { C, MATIERES_PRIMAIRE, getClassesForSection, getRoleLabelForSchool, getSystemeScolaire } from "../../constants";
import {
  AdminPanel, Calendrier, Comptabilite, Ecole, Fondation, GestionExamens,
  HistoriqueActions, MessagesParents, ParametresEcole, Secondaire,
  SuperAdminPanel, TableauDeBord,
} from "./lazy-pages";

export function PageRouter({
  page, annee, setAnnee, verrous, schoolId, utilisateur, readOnly,
  schoolInfo, paramInitialTab, setParamInitialTab, setPage, deconnecter,
}) {
  return (
    <>
      {page==="superadmin_panel" && <SuperAdminPanel/>}
      {page==="accueil"         && <TableauDeBord annee={annee} userRole={utilisateur.role} onOpenLegalSettings={()=>{setParamInitialTab("officiel");setPage("parametres");}}/>}
      {page==="historique"      && <HistoriqueActions/>}
      {page==="parametres"      && <ParametresEcole utilisateurRole={utilisateur.role} onSchoolClosed={deconnecter} initialTab={paramInitialTab} onTabConsumed={()=>setParamInitialTab(null)}/>}
      {page==="admin_panel" && <AdminPanel annee={annee} setAnnee={setAnnee} verrous={verrous} schoolId={schoolId} userRole={utilisateur.role}/>}
      {page==="fondation"   && <Fondation readOnly={readOnly} annee={annee} userRole={utilisateur.role}/>}
      {page==="compta"      && <Comptabilite readOnly={readOnly} annee={annee} userRole={utilisateur.role} verrouOuvert={!!verrous.comptable}/>}
      {page==="primaire"    && <Ecole titre={getRoleLabelForSchool("primaire", schoolInfo)} couleur={C.green} cleClasses="classesPrimaire" cleEns="ensPrimaire" cleNotes="notesPrimaire" cleEleves="elevesPrimaire" avecEns={true} userRole={utilisateur.role} annee={annee} classesPredefinies={getClassesForSection("primaire", getSystemeScolaire(schoolInfo))} maxNote={10} matieresPredefinies={MATIERES_PRIMAIRE} readOnly={readOnly} verrouOuvert={!!verrous.primaire}/>}
      {page==="secondaire"  && <Secondaire userRole={utilisateur.role} annee={annee} readOnly={readOnly} verrouOuvert={!!verrous.secondaire} collegeLabel={getRoleLabelForSchool("college", schoolInfo)}/>}
      {page==="calendrier"  && <Calendrier annee={annee}/>}
      {page==="examens"     && <GestionExamens/>}
      {page==="messages"    && <MessagesParents readOnly={readOnly}/>}
    </>
  );
}
