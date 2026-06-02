import { EcoleRow } from "./EcoleRow";

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
              {ecolesFiltrees.map(ecole => (
                <EcoleRow
                  key={ecole._id}
                  ecole={ecole}
                  st={stats[ecole._id] || {}}
                  now={now}
                  S={S}
                  planModal={planModal}
                  setPlanModal={setPlanModal}
                  setPlanChoix={setPlanChoix}
                  setPlanDuree={setPlanDuree}
                  setConfirmDowngrade={setConfirmDowngrade}
                  planPanelRef={planPanelRef}
                  ouvrirConfirmation={ouvrirConfirmation}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
