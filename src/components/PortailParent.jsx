import { C } from "../constants";
import { GlobalStyles } from "../styles";
import { usePortailParent } from "./portail-parent/use-portail-parent";
import { PortailHeader } from "./portail-parent/PortailHeader";
import { EleveBar } from "./portail-parent/EleveBar";
import { TabNav } from "./portail-parent/TabNav";
import { PortailTabContent } from "./portail-parent/PortailTabContent";
import { BandeauLectureSeule } from "./app/BandeauLectureSeule";
import { MessagerieProvider } from "./messagerie/MessagerieContext";
import { BandeauAnnonces } from "./messagerie/BandeauAnnonces";
import { useMessagerie } from "./messagerie/messagerie-contexte";
import { RetourPaiement } from "./paiement-en-ligne/RetourPaiement";

// Onglet « Messages » : non-lus de la messagerie (discussions + annonces)
// dès qu'elle est active ; sinon, ceux de l'ancien fil avec l'école.
function OngletsParent({ tabs, ...props }) {
  const m = useMessagerie();
  const nonLus = m ? (m.nonLusDiscussions || 0) + (m.annoncesNonLues || 0) : 0;
  const onglets = m ? tabs.map((item) => (item.id === "messages"
    ? { ...item, label: `${item.labelBase}${nonLus > 0 ? ` (${nonLus})` : ""}` } : item)) : tabs;
  return <TabNav tabs={onglets} {...props} />;
}

function codeEcole(utilisateur) {
  if (utilisateur?.schoolId) return utilisateur.schoolId;
  try { return localStorage.getItem("LC_schoolId"); } catch { return null; }
}

// Portail parent : logique dans usePortailParent, en-tête / barre élève /
// onglets et contenus dans portail-parent/. La messagerie (discussions avec
// la direction, le responsable de section, le comptable ; annonces ; appels)
// vit dans l'onglet « Messages ».
function PortailParent({ utilisateur, deconnecter, annee, schoolInfo }) {
  const p = usePortailParent({ utilisateur, schoolInfo });
  const c1 = schoolInfo.couleur1 || C.blue;
  const c2 = schoolInfo.couleur2 || C.green;

  return (
    <MessagerieProvider utilisateur={utilisateur} onOuvrir={() => p.setTab("messages")} schoolCode={codeEcole(utilisateur)}>
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      <GlobalStyles />
      <PortailHeader schoolInfo={schoolInfo} annee={annee} utilisateur={utilisateur} deconnecter={deconnecter} c1={c1} c2={c2} />
      <BandeauLectureSeule />
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
      <OngletsParent tabs={p.tabs} tab={p.tab} setTab={p.setTab} c1={c1} />
      {p.tab !== "messages" && <BandeauAnnonces />}

      <div style={{ padding: "24px", maxWidth: 1000, margin: "0 auto" }}>
        <PortailTabContent p={p} schoolInfo={schoolInfo} utilisateur={utilisateur} c1={c1} c2={c2} />
      </div>
      {/* Retour de la page de paiement de l'opérateur (?paiement=…). */}
      <RetourPaiement onTermine={() => { p.setTab("paiements"); p.chargerPortail(); }} />
    </div>
    </MessagerieProvider>
  );
}

export { PortailParent };
