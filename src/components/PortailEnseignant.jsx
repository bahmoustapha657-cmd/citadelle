import { useState } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../constants";
import { GlobalStyles } from "../styles";
import { PortailHeader } from "./portail-enseignant/PortailHeader";
import { PortailMenu } from "./portail-enseignant/PortailMenu";
import { PortailTabContent } from "./portail-enseignant/PortailTabContent";
import { IncidentModal } from "./portail-enseignant/IncidentModal";
import { usePortailEnseignant } from "./portail-enseignant/use-portail-enseignant";
import { useMesFiches } from "./portail-enseignant/use-mes-fiches";
import { useEstMobile } from "../hooks/use-est-mobile";
import { BandeauPremiereSynchro } from "./app/BandeauPremiereSynchro";
import { BandeauLectureSeule } from "./app/BandeauLectureSeule";
import { MessagerieProvider } from "./messagerie/MessagerieContext";
import { BandeauAnnonces } from "./messagerie/BandeauAnnonces";
import { BandeauReunions } from "./messagerie/BandeauReunions";

// Orchestrateur du portail enseignant : la logique vit dans
// usePortailEnseignant, chaque onglet dans portail-enseignant/*Tab.jsx.
// Même disposition que la coquille des autres comptes (app/AppShell) : menu
// latéral fixe, en-tête, puis zone de contenu qui défile seule.
function PortailEnseignant({ utilisateur, deconnecter, annee, schoolInfo, premiereSynchro, estHorsLigne }) {
  const { t } = useTranslation();
  const p = usePortailEnseignant({ utilisateur, annee, schoolInfo });
  const fiches = useMesFiches(utilisateur?.uid);
  const estMobile = useEstMobile();
  const [menuOuvert, setMenuOuvert] = useState(false);
  const ongletMessages = p.tab === "messages";

  // Messagerie interne : l'enseignant écrit, appelle et reçoit les annonces
  // depuis l'entrée « Messages » du menu.
  return (
    <MessagerieProvider utilisateur={utilisateur} onOuvrir={() => p.setTab("messages")}
      schoolCode={utilisateur?.schoolId || localStorage.getItem("LC_schoolId")}>
    <GlobalStyles />
    <div className="lc-app-root" style={{ overflow: "hidden", display: "flex", background: C.bg, fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      <PortailMenu
        schoolInfo={schoolInfo} annee={annee} nomEns={p.nomEns} matiere={p.matiere} c2={p.c2}
        utilisateur={utilisateur} deconnecter={deconnecter} estHorsLigne={estHorsLigne} t={t}
        tab={p.tab} setTab={p.setTab} ouvrirMesFiches={fiches.ouvrir}
        estMobile={estMobile} menuOuvert={menuOuvert} setMenuOuvert={setMenuOuvert}
      />

      <main style={{ flex: 1, marginInlineStart: estMobile ? 0 : 228, minWidth: 0, display: "flex", flexDirection: "column", height: "100dvh", overflow: "hidden" }}>
        <PortailHeader
          schoolInfo={schoolInfo} annee={annee}
          nomEns={p.nomEns} matiere={p.matiere} c1={p.c1} c2={p.c2}
          deconnecter={deconnecter} t={t} estMobile={estMobile} setMenuOuvert={setMenuOuvert}
        />
        {fiches.erreur && (
          <div role="alert" style={{ background: "#fef2f2", color: "#991b1b", padding: "10px 24px", fontSize: 13, fontWeight: 600 }}>
            {fiches.erreur}
          </div>
        )}
        <BandeauPremiereSynchro premiereSynchro={premiereSynchro} estHorsLigne={estHorsLigne} t={t} />
        <BandeauLectureSeule />
        {!ongletMessages && <BandeauAnnonces />}
        <BandeauReunions />

        {/* La messagerie gère son propre défilement (liste / fil) : la zone
            de contenu ne défile pas pour elle. */}
        <div style={{ flex: 1, minHeight: 0, overflowY: ongletMessages ? "hidden" : "auto" }}>
          <div style={{ padding: estMobile ? 12 : 24, maxWidth: 1100, margin: "0 auto", boxSizing: "border-box", height: ongletMessages ? "100%" : undefined }}>
            <PortailTabContent p={p} schoolInfo={schoolInfo} utilisateur={utilisateur} t={t} />

            {p.modalIncident && (
              <IncidentModal
                c1={p.c1} mode={p.modalIncident}
                formIncident={p.formIncident} setFormIncident={p.setFormIncident}
                eleve={(p.eleves || []).find((e) => e._id === p.formIncident.eleveId)}
                enregistrement={p.enregistrement} enregistrerIncident={p.enregistrerIncident}
                fermer={() => p.setModalIncident(null)}
              />
            )}
          </div>
        </div>
      </main>
    </div>
    </MessagerieProvider>
  );
}

export { PortailEnseignant };
