import { useTranslation } from "react-i18next";
import { C } from "../constants";
import { GlobalStyles } from "../styles";
import { PortailHeader } from "./portail-enseignant/PortailHeader";
import { PortailTabContent } from "./portail-enseignant/PortailTabContent";
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
        <PortailTabContent p={p} schoolInfo={schoolInfo} utilisateur={utilisateur} t={t} />

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
