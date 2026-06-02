import { C } from "../../constants";

// Barre de navigation entre les onglets du panel super-admin. Le compteur de
// demandes en attente est calculé ici ; changer d'onglet referme les panneaux
// de plan ouverts.
export function SuperAdminTabs({ ongletSA, setOngletSA, demandes, setPlanModal, setConfirmDowngrade }) {
  const enAttente = demandes.filter(d => d.statut === "en_attente").length;
  const onglets = [
    { id: "ecoles", label: "Ecoles" },
    { id: "plans", label: "Plans" },
    { id: "outils", label: "Comms & Assistant" },
    { id: "demandes", label: `Demandes${enAttente > 0 ? " (" + enAttente + ")" : ""}` },
    { id: "alertes", label: "Alertes Sentry" },
  ];
  return (
    <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
      {onglets.map(o=>(
        <button key={o.id} onClick={()=>{setOngletSA(o.id);setPlanModal(null);setConfirmDowngrade(false);}}
          style={{padding:"9px 18px",borderRadius:9,border:"none",cursor:"pointer",fontWeight:700,fontSize:13,
            background:ongletSA===o.id?C.blue:"#f0f4f8",color:ongletSA===o.id?"#fff":"#6b7280"}}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
