import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getSectionLabelForClasse } from "../../../constants";
import { Badge, Btn } from "../../ui";
import { exportExcel } from "../../../reports";
import { countUnpaidMonths, getElevesCritiques } from "../../../mensualite-utils";

// Alertes des élèves avec 3 mois ou plus impayés. Repliées derrière un bouton
// cliquable ; suivent le filtre cycle + classe (via `eleves`, déjà filtré).
export function AlertesCritiques({ eleves, moisAnnee }) {
  const { t } = useTranslation();
  const [ouvert, setOuvert] = useState(false);
  const elevesCritiques = getElevesCritiques(eleves, moisAnnee, 3);
  if (elevesCritiques.length === 0) return null;

  return (
    <div style={{ marginBottom: 14 }}>
      <button type="button" onClick={() => setOuvert((o) => !o)}
        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", cursor: "pointer",
          background: "#fce8e8", border: "1px solid #f5c1c1",
          borderRadius: ouvert ? "10px 10px 0 0" : 10, padding: "10px 14px", textAlign: "start" }}>
        <span style={{ fontSize: 18 }}>🚨</span>
        <strong style={{ fontSize: 13, color: "#9b2020" }}>
          Alertes mensualités — {elevesCritiques.length} élève(s) avec 3 mois ou plus impayés
        </strong>
        <span style={{ marginInlineStart: "auto", fontSize: 12, fontWeight: 700, color: "#9b2020" }}>
          {ouvert ? "▾ Masquer" : "▸ Afficher"}
        </span>
      </button>

      {ouvert && (
        <div style={{ background: "#fff", border: "1px solid #f5c1c1", borderTop: "none", borderRadius: "0 0 10px 10px", padding: "12px 16px" }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
            <Btn sm v="ghost" onClick={() => exportExcel(
              t("reports.excel.files.paymentAlerts"),
              [t("reports.excel.headers.matricule"), t("reports.excel.headers.lastName"), t("reports.excel.headers.firstName"), t("reports.excel.headers.class"), t("reports.excel.headers.level"), t("reports.excel.headers.unpaidMonths"), t("reports.excel.headers.guardian"), t("reports.excel.headers.contact")],
              elevesCritiques.map((e) => {
                const niv = getSectionLabelForClasse(e.classe);
                const nbImp = countUnpaidMonths(e, moisAnnee);
                return [e.matricule || "", e.nom, e.prenom, e.classe, niv, nbImp, e.tuteur || "", e.contactTuteur || ""];
              })
            )}>📥 {t("common.export")}</Btn>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {elevesCritiques.map((e) => {
              const nbImp = countUnpaidMonths(e, moisAnnee);
              return <div key={e._id} style={{ background: "#fff", border: "1px solid #f5c1c1", borderRadius: 7, padding: "6px 10px", fontSize: 12 }}>
                <span style={{ fontWeight: 800, color: "#9b2020" }}>{e.nom} {e.prenom}</span>
                <span style={{ color: "#6b7280" }}> · {e.classe} · </span>
                <Badge color="red">{nbImp} impayés</Badge>
              </div>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}
