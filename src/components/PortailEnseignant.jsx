import { useTranslation } from "react-i18next";
import { C } from "../constants";
import { GlobalStyles } from "../styles";
import { Chargement } from "./ui";
import { NotesTab } from "./portail-enseignant/NotesTab";
import { AbsencesTab } from "./portail-enseignant/AbsencesTab";
import { SalaireTab } from "./portail-enseignant/SalaireTab";
import { PortailHeader } from "./portail-enseignant/PortailHeader";
import { DashboardTab } from "./portail-enseignant/DashboardTab";
import { EdtTab } from "./portail-enseignant/EdtTab";
import { ElevesTab } from "./portail-enseignant/ElevesTab";
import { IncidentModal } from "./portail-enseignant/IncidentModal";
import { usePortailEnseignant } from "./portail-enseignant/use-portail-enseignant";

// Orchestrateur du portail enseignant : la logique vit dans
// usePortailEnseignant, chaque onglet dans portail-enseignant/*Tab.jsx.
function PortailEnseignant({ utilisateur, deconnecter, annee, schoolInfo }) {
  const { t } = useTranslation();
  const p = usePortailEnseignant({ utilisateur, annee, schoolInfo });

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      <GlobalStyles />
      <PortailHeader
        schoolInfo={schoolInfo} annee={annee}
        nomEns={p.nomEns} matiere={p.matiere} c1={p.c1} c2={p.c2}
        deconnecter={deconnecter} t={t} tab={p.tab} setTab={p.setTab}
      />

      <div style={{ padding: "24px", maxWidth: 1100, margin: "0 auto" }}>
        {p.chargement ? (
          <Chargement rows={6} />
        ) : (
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
                eleves={p.eleves} portalData={p.portalData}
                modalNote={p.modalNote} setModalNote={p.setModalNote}
                formNote={p.formNote} setFormNote={p.setFormNote}
                gridForm={p.gridForm} setGridForm={p.setGridForm}
                gridProgress={p.gridProgress}
                enregistrement={p.enregistrement}
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
        )}

        {p.modalIncident && (
          <IncidentModal
            c1={p.c1} mode={p.modalIncident}
            formIncident={p.formIncident} setFormIncident={p.setFormIncident}
            enregistrement={p.enregistrement} enregistrerIncident={p.enregistrerIncident}
            fermer={() => p.setModalIncident(null)}
          />
        )}
      </div>
    </div>
  );
}

export { PortailEnseignant };
