import { useCommunicationsAdmin } from "./communications-admin/use-communications-admin";
import { MessageComposer } from "./communications-admin/MessageComposer";
import { MessagesHistorique } from "./communications-admin/MessagesHistorique";

// Orchestrateur des communications superadmin : la logique vit dans
// useCommunicationsAdmin, le composer et l'historique dans communications-admin/.
function CommunicationsAdmin({ ecoles = [], auteur = "superadmin" }) {
  const c = useCommunicationsAdmin({ ecoles, auteur });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <MessageComposer
        titre={c.titre} setTitre={c.setTitre} corps={c.corps} setCorps={c.setCorps}
        niveau={c.niveau} setNiveau={c.setNiveau}
        modeCible={c.modeCible} setModeCible={c.setModeCible}
        planChoisi={c.planChoisi} setPlanChoisi={c.setPlanChoisi}
        schoolsChoisies={c.schoolsChoisies} rolesChoisis={c.rolesChoisis}
        envoiEnCours={c.envoiEnCours} erreur={c.erreur} succes={c.succes}
        ecoles={ecoles} ecolesParPlan={c.ecolesParPlan}
        toggleRole={c.toggleRole} toggleSchool={c.toggleSchool}
        envoyer={c.envoyer} previewCible={c.previewCible}
      />
      <MessagesHistorique
        messages={c.messages}
        statsLectures={c.statsLectures}
        supprimerMessage={c.supprimerMessage}
      />
    </div>
  );
}

export default CommunicationsAdmin;
