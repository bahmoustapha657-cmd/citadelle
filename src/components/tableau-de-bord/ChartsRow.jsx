import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { estSorti, isSectionActive } from "../../constants";
import { Card } from "../ui";
import { axe, corpsCarte, ESPACE, grille, infobulle, titreCarte, TONS } from "./tdb-styles";

export function ChartsRow({ t, c1, schoolInfo = {}, elevesC, elevesL, elevesP, tauxPayC, tauxPayL, tauxPayP, tauxPay }) {
  // Une barre et une jauge par section OUVERTE dans l'école (Paramètres →
  // Identité) : une école sans lycée n'affiche pas un « Lycée » vide.
  const sections = [
    { section: "college", label: t("dashboard.college"), eleves: elevesC, taux: tauxPayC },
    { section: "lycee", label: t("dashboard.lycee"), eleves: elevesL, taux: tauxPayL },
    { section: "primaire", label: t("dashboard.primary"), eleves: elevesP, taux: tauxPayP },
  ].filter((s) => isSectionActive(schoolInfo, s.section));
  const tonTaux = (taux) => (taux >= 60 ? TONS.ok : TONS.danger);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: ESPACE }}>
      {/* Répartition élèves par section */}
      <Card style={{ flex: "2 1 380px", minWidth: 0 }}><div style={corpsCarte}>
        <p style={titreCarte}>{t("dashboard.studentDistribution")}</p>
        <ResponsiveContainer width="100%" height={210}>
          <BarChart barGap={4} margin={{ top: 4, right: 4, left: -18, bottom: 0 }} data={sections.map(({ label, eleves }) => (
            { section: label, Actifs: eleves.filter((e) => e.statut === "Actif").length, Inactifs: eleves.filter((e) => e.statut !== "Actif" && !estSorti(e)).length }
          ))}>
            <CartesianGrid vertical={false} stroke={grille} />
            <XAxis dataKey="section" tick={axe} axisLine={false} tickLine={false} />
            <YAxis tick={axe} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip {...infobulle} />
            <Bar dataKey="Actifs" fill={c1} radius={[6, 6, 0, 0]} maxBarSize={44} name={t("dashboard.chartActive")} />
            <Bar dataKey="Inactifs" fill="rgba(148,163,184,0.35)" radius={[6, 6, 0, 0]} maxBarSize={44} name={t("dashboard.chartInactive")} />
          </BarChart>
        </ResponsiveContainer>
      </div></Card>

      {/* Taux de paiement */}
      <Card style={{ flex: "1 1 260px", minWidth: 0 }}><div style={{ ...corpsCarte, display: "flex", flexDirection: "column", height: "100%", boxSizing: "border-box" }}>
        <p style={titreCarte}>{t("dashboard.paymentRate")}</p>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 18 }}>
          <span style={{ fontSize: 32, fontWeight: 800, color: "var(--lc-text-brand)", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{tauxPay}%</span>
          <span style={{ fontSize: 12, color: "var(--lc-text-muted)" }}>{t("dashboard.globalRate")}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {sections.map(({ label, taux }) => (
            <div key={label}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12 }}>
                <span style={{ fontWeight: 600, color: "var(--lc-text)" }}>{label}</span>
                <span style={{ fontWeight: 700, color: tonTaux(taux), fontVariantNumeric: "tabular-nums" }}>{taux}%</span>
              </div>
              <div style={{ background: "var(--lc-border-soft)", borderRadius: 99, height: 6, overflow: "hidden" }}>
                <div style={{ background: tonTaux(taux), borderRadius: 99, height: 6, width: `${Math.min(100, Math.max(0, taux))}%`, transition: "width 0.5s" }} />
              </div>
            </div>
          ))}
        </div>
      </div></Card>
    </div>
  );
}
