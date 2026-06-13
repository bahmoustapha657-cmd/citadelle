import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { C } from "../../constants";
import { Card } from "../ui";

export function ChartsRow({ t, c1, c2, elevesC, elevesL, elevesP, tauxPayC, tauxPayL, tauxPayP, tauxPay }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 20 }}>
      {/* Répartition élèves par classe */}
      <Card><div style={{ padding: "16px 18px" }}>
        <p style={{ margin: "0 0 14px", fontWeight: 800, fontSize: 13, color: c1 }}>{t("dashboard.studentDistribution")}</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={[
            { section: t("dashboard.college"), Actifs: elevesC.filter((e) => e.statut === "Actif").length, Inactifs: elevesC.filter((e) => e.statut !== "Actif").length },
            { section: t("dashboard.lycee"), Actifs: elevesL.filter((e) => e.statut === "Actif").length, Inactifs: elevesL.filter((e) => e.statut !== "Actif").length },
            { section: t("dashboard.primary"), Actifs: elevesP.filter((e) => e.statut === "Actif").length, Inactifs: elevesP.filter((e) => e.statut !== "Actif").length },
          ]}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0ebf8" />
            <XAxis dataKey="section" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="Actifs" fill={c2} radius={[4, 4, 0, 0]} name={t("dashboard.chartActive")} />
            <Bar dataKey="Inactifs" fill="#e2e8f0" radius={[4, 4, 0, 0]} name={t("dashboard.chartInactive")} />
          </BarChart>
        </ResponsiveContainer>
      </div></Card>

      {/* Taux de paiement */}
      <Card><div style={{ padding: "16px 18px" }}>
        <p style={{ margin: "0 0 14px", fontWeight: 800, fontSize: 13, color: c1 }}>{t("dashboard.paymentRate")}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 8 }}>
          {[[t("dashboard.college"), tauxPayC], [t("dashboard.lycee"), tauxPayL], [t("dashboard.primary"), tauxPayP]].map(([label, taux]) => (
            <div key={label}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: c1 }}>{label}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: taux >= 60 ? C.greenDk : "#ef4444" }}>{taux}%</span>
              </div>
              <div style={{ background: "#e0ebf8", borderRadius: 6, height: 10 }}>
                <div style={{ background: taux >= 60 ? c2 : "#ef4444", borderRadius: 6, height: 10, width: `${taux}%`, transition: "width 0.5s" }} />
              </div>
            </div>
          ))}
          <div style={{ marginTop: 8, padding: "10px 12px", background: "#f0fdf8", borderRadius: 8, borderLeft: `3px solid ${c2}` }}>
            <div style={{ fontSize: 11, color: "#374151" }}>{t("dashboard.globalRate")}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: c2 }}>{tauxPay}%</div>
          </div>
        </div>
      </div></Card>
    </div>
  );
}
