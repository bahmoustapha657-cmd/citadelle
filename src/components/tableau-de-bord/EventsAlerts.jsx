import { useTranslation } from "react-i18next";
import { fmt } from "../../constants";
import { Badge, Card, Vide } from "../ui";

const TYPE_COLORS = { exam: "#ef4444", conge: "#10b981", reunion: "#f59e0b", autre: "#6366f1" };

// `moyenneMensuelle` (affichage lisible, cf. finances-claires.js) : ce qui est
// encaissé en moyenne par mois, scolarité comprise ; `solde` est alors le solde
// réel. Sans elle (null), les règles d'origine : paie comparée aux recettes
// saisies à la main.
export function EventsAlerts({ c1, c2, evAVenir, tauxPay, solde, masseSal, totalRec, moyenneMensuelle = null }) {
  const { t } = useTranslation();
  const clair = moyenneMensuelle !== null;
  const paieElevee = clair
    ? masseSal > 0 && masseSal > moyenneMensuelle * 0.7
    : masseSal > totalRec * 0.7 && masseSal > 0;
  const descPaie = !clair
    ? t("dashboard.alertHighPayrollDesc", { pct: Math.round(masseSal / totalRec * 100) })
    : moyenneMensuelle > 0
      ? t("dashboard.alertHighPayrollDescAvg", { pct: Math.round(masseSal / moyenneMensuelle * 100) })
      : t("dashboard.alertHighPayrollNoIncome");
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <Card><div style={{ padding: "16px 18px" }}>
        <p style={{ margin: "0 0 12px", fontWeight: 800, fontSize: 13, color: c1 }}>{t("dashboard.upcomingEvents")}</p>
        {evAVenir.length === 0
          ? <Vide icone="📅" msg={t("dashboard.noEvents")} />
          : evAVenir.map((ev) => (
            <div key={ev._id} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10, padding: "8px 10px", background: "#f8fafc", borderRadius: 8, borderLeft: `3px solid ${TYPE_COLORS[ev.type] || "#6366f1"}` }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: c1 }}>{ev.titre}</div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>{ev.date} {ev.dateFin && ev.dateFin !== ev.date ? `→ ${ev.dateFin}` : ""}</div>
              </div>
              <Badge color={ev.type === "exam" ? "red" : ev.type === "conge" ? "green" : ev.type === "reunion" ? "orange" : "blue"}>{ev.type || t("dashboard.eventDefaultType")}</Badge>
            </div>
          ))
        }
      </div></Card>

      <Card><div style={{ padding: "16px 18px" }}>
        <p style={{ margin: "0 0 12px", fontWeight: 800, fontSize: 13, color: c1 }}>{t("dashboard.alertsTitle")}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {tauxPay < 60 && (
            <div style={{ padding: "10px 12px", background: "#fef3e0", borderRadius: 8, borderLeft: "3px solid #f59e0b", fontSize: 12 }}>
              <span style={{ fontWeight: 800, color: "#92400e" }}>{t("dashboard.alertLowPayTitle")}</span>
              <div style={{ color: "#92400e", marginTop: 2 }}>{t("dashboard.alertLowPayDesc", { rate: tauxPay })}</div>
            </div>
          )}
          {solde < 0 && (
            <div style={{ padding: "10px 12px", background: "#fef2f2", borderRadius: 8, borderLeft: "3px solid #ef4444", fontSize: 12 }}>
              <span style={{ fontWeight: 800, color: "#991b1b" }}>{t("dashboard.alertNegBalTitle")}</span>
              <div style={{ color: "#991b1b", marginTop: 2 }}>{t(clair ? "dashboard.alertNegBalDescReal" : "dashboard.alertNegBalDesc", { amount: fmt(solde) })}</div>
            </div>
          )}
          {paieElevee && (
            <div style={{ padding: "10px 12px", background: "#fef3e0", borderRadius: 8, borderLeft: "3px solid #f59e0b", fontSize: 12 }}>
              <span style={{ fontWeight: 800, color: "#92400e" }}>{t("dashboard.alertHighPayrollTitle")}</span>
              <div style={{ color: "#92400e", marginTop: 2 }}>{descPaie}</div>
            </div>
          )}
          {tauxPay >= 60 && solde >= 0 && (
            <div style={{ padding: "10px 12px", background: "#f0fdf8", borderRadius: 8, borderLeft: `3px solid ${c2}`, fontSize: 12 }}>
              <span style={{ fontWeight: 800, color: "#065f46" }}>{t("dashboard.alertAllGoodTitle")}</span>
              <div style={{ color: "#065f46", marginTop: 2 }}>{t("dashboard.alertAllGoodDesc")}</div>
            </div>
          )}
        </div>
      </div></Card>
    </div>
  );
}
