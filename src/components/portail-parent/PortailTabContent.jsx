import { Chargement } from "../ui";
import { DashboardTab } from "./DashboardTab";
import { NotesTab } from "./NotesTab";
import { AbsencesTab } from "./AbsencesTab";
import { BulletinsTab } from "./BulletinsTab";
import { PaiementsTab } from "./PaiementsTab";
import { MessagesTab } from "./MessagesTab";

// Aiguillage du contenu de l'onglet actif du portail parent.
export function PortailTabContent({ p, schoolInfo, c1, c2 }) {
  if (p.chargement) return <Chargement rows={5} />;

  return (
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
  );
}
