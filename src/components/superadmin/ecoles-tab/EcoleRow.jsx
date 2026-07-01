import { C } from "../../../constants";
import { EcolePlanBadge } from "./EcolePlanBadge";

// Une ligne du tableau des écoles (infos + actions plan/statut/suppression).
export function EcoleRow({
  ecole, st, now, S,
  planModal, setPlanModal, setPlanChoix, setPlanDuree, setConfirmDowngrade,
  planPanelRef, ouvrirConfirmation,
}) {
  const actif = ecole.actif && !ecole.supprime;
  return (
    <tr style={{ transition: "background .15s" }}
      onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
      <td style={S.td}>
        <code style={{ background: "#f0f4f8", padding: "2px 7px", borderRadius: 4, fontSize: 11, color: C.blue, fontWeight: 700 }}>
          {ecole._id}
        </code>
      </td>
      <td style={S.td}>
        <strong>{ecole.nom}</strong>
        {ecole.responsable && (
          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
            {ecole.responsable}{ecole.telephone ? ` · ${ecole.telephone}` : ""}{ecole.email ? ` · ${ecole.email}` : ""}
          </div>
        )}
      </td>
      <td style={S.td}>{ecole.ville}{ecole.pays && ecole.pays !== "Guinee" ? `, ${ecole.pays}` : ""}</td>
      <td style={S.td}>{ecole.createdAt ? new Date(ecole.createdAt).toLocaleDateString("fr-FR") : "-"}</td>
      <td style={S.td}>
        <span style={S.badge(actif)}>
          {ecole.supprime ? "Supprimee" : ecole.actif ? "Active" : "Inactive"}
        </span>
      </td>
      <td style={S.td}><EcolePlanBadge ecole={ecole} now={now} /></td>
      <td style={{ ...S.td, textAlign: "center", fontWeight: 700, color: C.blue }}>{st.eleves ?? "..."}</td>
      <td style={{ ...S.td, textAlign: "center", fontWeight: 700, color: C.green }}>{st.comptes ?? "..."}</td>
      <td style={S.td}>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => {
            if (planModal?._id === ecole._id) { setPlanModal(null); setConfirmDowngrade(false); }
            else {
              setPlanModal(ecole);
              setPlanChoix(ecole.plan || "gratuit");
              setPlanDuree(365);
              setTimeout(() => planPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
            }
          }}
            style={{ ...S.btn(C.blue), background: planModal?._id === ecole._id ? "#0369a1" : "#e0f2fe", color: planModal?._id === ecole._id ? "#fff" : "#0369a1" }}>
            {planModal?._id === ecole._id ? "Fermer" : "Gerer le plan"}
          </button>
          <button onClick={() => ouvrirConfirmation(ecole, actif ? "deactivate" : "reactivate")}
            style={{ ...S.btn(actif ? C.blue : C.green), background: actif ? "#fee2e2" : "#d1fae5", color: actif ? "#991b1b" : "#065f46" }}>
            {actif ? "Desactiver" : "Reactiver"}
          </button>
          <button onClick={() => ouvrirConfirmation(ecole, "delete")}
            disabled={!!ecole.supprime}
            style={{ ...S.btn("#ef4444"), background: "#fee2e2", color: "#991b1b", opacity: ecole.supprime ? 0.5 : 1, cursor: ecole.supprime ? "not-allowed" : "pointer" }}>
            Supprimer
          </button>
        </div>
      </td>
    </tr>
  );
}
