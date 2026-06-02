import { C } from "../constants";
import { GlobalStyles } from "../styles";
import { usePortailParent } from "./portail-parent/use-portail-parent";
import { PortailHeader } from "./portail-parent/PortailHeader";
import { EleveBar } from "./portail-parent/EleveBar";
import { TabNav } from "./portail-parent/TabNav";
import { PortailTabContent } from "./portail-parent/PortailTabContent";

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
        <PortailTabContent p={p} schoolInfo={schoolInfo} c1={c1} c2={c2} />
      </div>
    </div>
  );
}

export { PortailParent };
