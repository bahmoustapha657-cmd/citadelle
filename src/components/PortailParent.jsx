import { C } from "../constants";
import { GlobalStyles } from "../styles";
import { Chargement } from "./ui";
import { usePortailParent } from "./portail-parent/use-portail-parent";
import { PortailHeader } from "./portail-parent/PortailHeader";
import { EleveBar } from "./portail-parent/EleveBar";
import { TabNav } from "./portail-parent/TabNav";
import { DashboardTab } from "./portail-parent/DashboardTab";
import { NotesTab } from "./portail-parent/NotesTab";
import { AbsencesTab } from "./portail-parent/AbsencesTab";
import { BulletinsTab } from "./portail-parent/BulletinsTab";
import { PaiementsTab } from "./portail-parent/PaiementsTab";
import { MessagesTab } from "./portail-parent/MessagesTab";

// Portail parent : logique dans usePortailParent, en-tête / barre élève /
// onglets et contenus dans portail-parent/.
function PortailParent({ utilisateur, deconnecter, annee, schoolInfo }) {
  const p = usePortailParent({ utilisateur, schoolInfo });
  const c1 = schoolInfo.couleur1 || C.blue;
  const c2 = schoolInfo.couleur2 || C.green;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      <GlobalStyles />
      <PortailHeader schoolInfo={schoolInfo} annee={annee} utilisateur={utilisateur} deconnecter={deconnecter} c1={c1} c2={c2} />
      <EleveBar
        eleve={p.eleve}
        eleveNom={p.eleveNom}
        eleves={p.eleves}
        eleveId={p.eleveId}
        setEleveActifId={p.setEleveActifId}
        mesNotes={p.mesNotes}
        mesAbsences={p.mesAbsences}
        nonLus={p.nonLus}
        c1={c1}
        c2={c2}
      />
      <TabNav tabs={p.tabs} tab={p.tab} setTab={p.setTab} c1={c1} />

      <div style={{ padding: "24px", maxWidth: 1000, margin: "0 auto" }}>
        {p.chargement ? (
          <Chargement rows={5} />
        ) : (
          <>
            {p.tab === "dashboard" && (
              <DashboardTab
                annonces={p.annonces}
                mesNotes={p.mesNotes}
                mesAbsences={p.mesAbsences}
                matieres={p.matieres}
                eleve={p.eleve}
                c1={c1}
                onVoirNotes={() => p.setTab("notes")}
              />
            )}

            {p.tab === "notes" && (
              <NotesTab
                accesBloqueParPaiement={p.accesBloqueParPaiement}
                moisImpayes={p.moisImpayes}
                schoolInfo={schoolInfo}
                onPaiements={() => p.setTab("paiements")}
                mesNotes={p.mesNotes}
                matieres={p.matieres}
                eleve={p.eleve}
                eleveNom={p.eleveNom}
                c1={c1}
              />
            )}

            {p.tab === "absences" && (
              <AbsencesTab mesAbsences={p.mesAbsences} c1={c1} />
            )}

            {p.tab === "bulletins" && (
              <BulletinsTab
                accesBloqueParPaiement={p.accesBloqueParPaiement}
                moisImpayes={p.moisImpayes}
                schoolInfo={schoolInfo}
                onPaiements={() => p.setTab("paiements")}
                periodes={p.periodes}
                mesNotes={p.mesNotes}
                eleve={p.eleve}
                eleveNom={p.eleveNom}
                section={p.section}
                c1={c1}
                c2={c2}
              />
            )}

            {p.tab === "paiements" && (
              <PaiementsTab
                eleve={p.eleve}
                moisAnnee={p.moisAnnee}
                estReinscription={p.estReinscription}
                montantInscription={p.montantInscription}
                montantAutre={p.montantAutre}
                montantMensuel={p.montantMensuel}
                c1={c1}
                c2={c2}
              />
            )}

            {p.tab === "messages" && (
              <MessagesTab
                mesMessages={p.mesMessages}
                sujet={p.sujet}
                setSujet={p.setSujet}
                corps={p.corps}
                setCorps={p.setCorps}
                envoi={p.envoi}
                envoyer={p.envoyer}
                c1={c1}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export { PortailParent };
