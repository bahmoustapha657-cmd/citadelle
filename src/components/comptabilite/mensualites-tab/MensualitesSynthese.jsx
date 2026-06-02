import { useTranslation } from "react-i18next";
import { C, fmt } from "../../../constants";
import { Badge } from "../../ui";
import { getMensualiteOverview } from "../../../mensualite-utils";

// Bandeau de synthèse au-dessus de la grille : payés / impayés, total perçu,
// inscriptions et autres frais perçus.
export function MensualitesSynthese({ elevesFiltres, moisAnnee, tarifsClasses }) {
  const { t } = useTranslation();
  const overview = getMensualiteOverview(elevesFiltres, moisAnnee, tarifsClasses);
  return (
    <div style={{ marginBottom: 12, padding: "9px 14px", background: "#e0ebf8", borderRadius: 8, display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
      <span style={{ fontSize: 12, color: C.greenDk, fontWeight: 700 }}>✓ {overview.totalPayes} {t("accounting.paid").toLowerCase()}</span>
      <span style={{ fontSize: 12, color: "#b91c1c", fontWeight: 700 }}>✗ {overview.totalImpayes} {t("accounting.unpaid").toLowerCase()}</span>
      <span style={{ fontSize: 12, color: C.blue, fontWeight: 700 }}>💰 {fmt(overview.totalPercu)}</span>
      <Badge color="purple">{fmt(overview.totalInscriptionsPercues)} inscriptions perçues</Badge>
      <Badge color="gray">{fmt(overview.totalAutresPercus)} autres frais perçus</Badge>
    </div>
  );
}
