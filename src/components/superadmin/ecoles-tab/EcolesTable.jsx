import { C, PLANS } from "../../../constants";

// Tableau des écoles avec actions par ligne (gérer plan / désactiver-réactiver /
// supprimer).
export function EcolesTable({
  ecolesFiltrees,
  stats,
  chargement,
  recherche,
  planModal, setPlanModal,
  setPlanChoix, setPlanDuree,
  setConfirmDowngrade,
  planPanelRef,
  ouvrirConfirmation,
  S,
}) {
  // Snapshot du timestamp courant pour le calcul "expired" des badges de plan.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  return (
    <div style={S.card}>
      {chargement ? (
        <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Chargement des ecoles...</div>
      ) : ecolesFiltrees.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
          {recherche ? "Aucune ecole ne correspond a la recherche." : "Aucune ecole enregistree."}
        </div>
      ) : (
        <div className="lc-sticky-wrap" style={{ border: "none", borderRadius: 0 }}>
          <table className="lc-sticky-table" data-fix-left="2" style={{ "--col2-left": "120px" }}>
            <thead>
              <tr>
                {["Code", "Ecole", "Ville/Pays", "Creee le", "Statut", "Plan", "Eleves", "Comptes", "Actions"].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ecolesFiltrees.map(ecole => {
                const st = stats[ecole._id] || {};
                return (
                  <tr key={ecole._id} style={{ transition: "background .15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <td style={S.td}>
                      <code style={{ background: "#f0f4f8", padding: "2px 7px", borderRadius: 4, fontSize: 11, color: C.blue, fontWeight: 700 }}>
                        {ecole._id}
                      </code>
                    </td>
                    <td style={S.td}><strong>{ecole.nom}</strong></td>
                    <td style={S.td}>{ecole.ville}{ecole.pays && ecole.pays !== "Guinee" ? `, ${ecole.pays}` : ""}</td>
                    <td style={S.td}>{ecole.createdAt ? new Date(ecole.createdAt).toLocaleDateString("fr-FR") : "-"}</td>
                    <td style={S.td}>
                      <span style={S.badge(ecole.actif && !ecole.supprime)}>
                        {ecole.supprime ? "Supprimee" : ecole.actif ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td style={S.td}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                        {(() => {
                          const p = PLANS[ecole.plan] || PLANS.gratuit;
                          const expired = ecole.plan !== "gratuit" && ecole.planExpiry && now > ecole.planExpiry;
                          return (<>
                            <span style={{
                              display: "inline-block", padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 800,
                              background: expired ? "#fee2e2" : p.bg, color: expired ? "#991b1b" : p.couleur,
                            }}>
                              {expired ? "Expire" : p.label}
                            </span>
                            {ecole.plan !== "gratuit" && ecole.planExpiry && (
                              <span style={{ fontSize: 9, color: expired ? "#ef4444" : "#9ca3af" }}>
                                Exp. {new Date(ecole.planExpiry).toLocaleDateString("fr-FR")}
                              </span>
                            )}
                          </>);
                        })()}
                      </div>
                    </td>
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
                        <button onClick={() => ouvrirConfirmation(ecole, ecole.actif && !ecole.supprime ? "deactivate" : "reactivate")}
                          style={{ ...S.btn(ecole.actif && !ecole.supprime ? C.blue : C.green), background: ecole.actif && !ecole.supprime ? "#fee2e2" : "#d1fae5", color: ecole.actif && !ecole.supprime ? "#991b1b" : "#065f46" }}>
                          {ecole.actif && !ecole.supprime ? "Desactiver" : "Reactiver"}
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
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
