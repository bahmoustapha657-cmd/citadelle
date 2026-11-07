import { useTranslation } from "react-i18next";
import { fmt } from "../../constants";
import { Badge, Card } from "../ui";
import { corpsCarte, encadre, grilleSouple, pastille, titreCarte, TONS } from "./tdb-styles";

const TYPE_COLORS = { exam: "#ef4444", conge: "#10b981", reunion: "#f59e0b", autre: "#6366f1" };

// `moyenneMensuelle` (affichage lisible, cf. finances-claires.js) : ce qui est
// encaissé en moyenne par mois, scolarité comprise ; `solde` est alors le solde
// réel. Sans elle (null), les règles d'origine : paie comparée aux recettes
// saisies à la main.
export function EventsAlerts({ evAVenir, tauxPay, solde, masseSal, totalRec, moyenneMensuelle = null }) {
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
  const alerte = (ton, titre, desc) => (
    <div style={encadre(ton)}>
      <span style={pastille(ton)} />
      <div>
        <div style={{ fontWeight: 700 }}>{titre}</div>
        <div style={{ color: "var(--lc-text-muted)", marginTop: 2 }}>{desc}</div>
      </div>
    </div>
  );
  return (
    <div style={grilleSouple(300)}>
      <Card><div style={corpsCarte}>
        <p style={titreCarte}>{t("dashboard.upcomingEvents")}</p>
        {evAVenir.length === 0
          ? <p style={{ margin: 0, padding: "18px 0", fontSize: 13, color: "var(--lc-text-muted)", textAlign: "center" }}>📅 {t("dashboard.noEvents")}</p>
          : <div style={{ display: "flex", flexDirection: "column" }}>
            {evAVenir.map((ev, i) => (
              <div key={ev._id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: i ? "1px solid var(--lc-border-soft)" : "none" }}>
                <span style={pastille(TYPE_COLORS[ev.type] || TYPE_COLORS.autre)} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--lc-text)" }}>{ev.titre}</div>
                  <div style={{ fontSize: 11, color: "var(--lc-text-muted)", marginTop: 1 }}>{ev.date} {ev.dateFin && ev.dateFin !== ev.date ? `→ ${ev.dateFin}` : ""}</div>
                </div>
                <Badge color={ev.type === "exam" ? "red" : ev.type === "conge" ? "green" : ev.type === "reunion" ? "orange" : "blue"}>{ev.type || t("dashboard.eventDefaultType")}</Badge>
              </div>
            ))}
          </div>
        }
      </div></Card>

      <Card><div style={corpsCarte}>
        <p style={titreCarte}>{t("dashboard.alertsTitle")}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {tauxPay < 60 && alerte(TONS.attention, t("dashboard.alertLowPayTitle"), t("dashboard.alertLowPayDesc", { rate: tauxPay }))}
          {solde < 0 && alerte(TONS.danger, t("dashboard.alertNegBalTitle"), t(clair ? "dashboard.alertNegBalDescReal" : "dashboard.alertNegBalDesc", { amount: fmt(solde) }))}
          {paieElevee && alerte(TONS.attention, t("dashboard.alertHighPayrollTitle"), descPaie)}
          {tauxPay >= 60 && solde >= 0 && alerte(TONS.ok, t("dashboard.alertAllGoodTitle"), t("dashboard.alertAllGoodDesc"))}
        </div>
      </div></Card>
    </div>
  );
}
