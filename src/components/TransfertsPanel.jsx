import { useTranslation } from "react-i18next";
import { C } from "../constants";
import { useTransferts } from "./transferts/use-transferts";
import { TransfertsSortants } from "./transferts/TransfertsSortants";
import { TransfertsEntrants } from "./transferts/TransfertsEntrants";

// Panneau de transferts : sous-onglets sortants/entrants. Consomme le hook
// useTransferts et aiguille vers la vue active.
function TransfertsPanel({ userRole, annee, setTab }) {
  const { t } = useTranslation();
  const h = useTransferts({ userRole });
  return (
    <div>
      <div style={{ display: "flex", gap: 6, background: "#f1f5f9", borderRadius: 10, padding: 4, marginBottom: 18, width: "fit-content" }}>
        {[["sortants", `📤 ${t("nav.transfers")}`], ["entrants", `📥 ${t("nav.transfers")}`]].map(([id, lbl]) => (
          <button key={id} onClick={() => h.setSousTab(id)}
            style={{ padding: "7px 16px", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 700,
              background: h.sousTab === id ? "#fff" : "transparent",
              color: h.sousTab === id ? C.blueDark : "#64748b",
              boxShadow: h.sousTab === id ? "0 1px 4px rgba(0,0,0,0.08)" : "none" }}>
            {lbl}
          </button>
        ))}
      </div>

      {h.sousTab === "sortants" && <TransfertsSortants h={h} annee={annee} />}
      {h.sousTab === "entrants" && <TransfertsEntrants h={h} setTab={setTab} />}
    </div>
  );
}

export { TransfertsPanel };
