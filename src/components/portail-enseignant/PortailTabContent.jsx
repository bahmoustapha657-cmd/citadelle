import { Chargement } from "../ui";
import { NotesTab } from "./NotesTab";
import { AbsencesTab } from "./AbsencesTab";
import { SalaireTab } from "./SalaireTab";
import { DashboardTab } from "./DashboardTab";
import { EdtTab } from "./EdtTab";
import { ElevesTab } from "./ElevesTab";

// Aiguillage du contenu des onglets du portail enseignant.
export function PortailTabContent({ p, schoolInfo, utilisateur, t }) {
  if (p.chargement) return <Chargement rows={6} />;
  return (
    <>
      {p.tab === "dashboard" && (
        <DashboardTab
          c1={p.c1} nomEns={p.nomEns} matiere={p.matiere}
          schoolInfo={schoolInfo} utilisateur={utilisateur} t={t}
          mesClasses={p.mesClasses} eleves={p.eleves} mesNotes={p.mesNotes}
          emplois={p.emplois} mesEvenements={p.mesEvenements}
          formatEmploiHeure={p.formatEmploiHeure}
        />
      )}

      {p.tab === "edt" && (
        <EdtTab c1={p.c1} matiere={p.matiere} emplois={p.emplois} formatEmploiHeure={p.formatEmploiHeure} imprimerEdt={p.imprimerEdt} />
      )}

      {p.tab === "notes" && (
        <NotesTab
          c1={p.c1} matiere={p.matiere} schoolInfo={schoolInfo} utilisateur={utilisateur}
          periodeN={p.periodeN} setPeriodeN={p.setPeriodeN} periodes={p.periodes}
          mesClasses={p.mesClasses} notesPeriode={p.notesPeriode}
          noteForms={p.noteForms} defaultNoteType={p.defaultNoteType}
          isPrimaire={p.isPrimaire} matieresDispo={p.matieresDispo}
          eleves={p.eleves} portalData={p.portalData}
          modalNote={p.modalNote} setModalNote={p.setModalNote}
          formNote={p.formNote} setFormNote={p.setFormNote}
          gridForm={p.gridForm} setGridForm={p.setGridForm}
          gridProgress={p.gridProgress}
          enregistrement={p.enregistrement}
          pendingSync={p.pendingSync} syncing={p.syncing} synchroniser={p.synchroniser}
          ouvrirCreationNote={p.ouvrirCreationNote}
          ouvrirGrille={p.ouvrirGrille}
          ouvrirEditionNote={p.ouvrirEditionNote}
          supprimerNote={p.supprimerNote}
          enregistrerNote={p.enregistrerNote}
          enregistrerGrille={p.enregistrerGrille}
          majGrid={p.majGrid}
        />
      )}

      {p.tab === "eleves" && (
        <ElevesTab c1={p.c1} mesClasses={p.mesClasses} eleves={p.eleves} ouvrirSignalementEleve={p.ouvrirSignalementEleve} />
      )}

      {p.tab === "absences" && (
        <AbsencesTab
          c1={p.c1} matiere={p.matiere}
          incidents={p.incidents} mesEvenements={p.mesEvenements}
          enseignantId={p.enseignantId}
          ouvrirEditionIncident={p.ouvrirEditionIncident}
          supprimerIncident={p.supprimerIncident}
        />
      )}

      {p.tab === "salaire" && (
        <SalaireTab c1={p.c1} c2={p.c2} salaires={p.salaires} imprimerPaies={p.imprimerPaies}/>
      )}
    </>
  );
}
