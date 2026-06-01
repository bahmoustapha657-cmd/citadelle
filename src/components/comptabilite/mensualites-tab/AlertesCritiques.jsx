import { useTranslation } from "react-i18next";
import { getSectionLabelForClasse } from "../../../constants";
import { Badge, Btn } from "../../ui";
import { exportExcel } from "../../../reports";
import { countUnpaidMonths, getElevesCritiques } from "../../../mensualite-utils";

// Bandeau d'alerte des élèves avec 3 mois ou plus impayés, exportable en Excel.
export function AlertesCritiques({ eleves, moisAnnee }) {
  const { t } = useTranslation();
  const elevesCritiques = getElevesCritiques(eleves, moisAnnee, 3);
  if (elevesCritiques.length === 0) return null;
  return (
    <div style={{ background: "#fce8e8", border: "1px solid #f5c1c1", borderRadius: 10, padding: "12px 16px", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 18 }}>🚨</span>
        <strong style={{ fontSize: 13, color: "#9b2020" }}>Alertes mensualités — {elevesCritiques.length} élève(s) avec 3 mois ou plus impayés</strong>
        <Btn sm v="ghost" style={{ marginInlineStart: "auto" }} onClick={() => exportExcel(
          t("reports.excel.files.paymentAlerts"),
          [t("reports.excel.headers.matricule"), t("reports.excel.headers.lastName"), t("reports.excel.headers.firstName"), t("reports.excel.headers.class"), t("reports.excel.headers.level"), t("reports.excel.headers.unpaidMonths"), t("reports.excel.headers.guardian"), t("reports.excel.headers.contact")],
          elevesCritiques.map(e => {
            const niv = getSectionLabelForClasse(e.classe);
            const nbImp = countUnpaidMonths(e, moisAnnee);
            return [e.matricule || "", e.nom, e.prenom, e.classe, niv, nbImp, e.tuteur || "", e.contactTuteur || ""];
          })
        )}>📥 {t("common.export")}</Btn>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {elevesCritiques.map(e => {
          const nbImp = countUnpaidMonths(e, moisAnnee);
          return <div key={e._id} style={{ background: "#fff", border: "1px solid #f5c1c1", borderRadius: 7, padding: "6px 10px", fontSize: 12 }}>
            <span style={{ fontWeight: 800, color: "#9b2020" }}>{e.nom} {e.prenom}</span>
            <span style={{ color: "#6b7280" }}> · {e.classe} · </span>
            <Badge color="red">{nbImp} impayés</Badge>
          </div>;
        })}
      </div>
    </div>
  );
}
