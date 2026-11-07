import { useTranslation } from "react-i18next";
import { fmt } from "../../constants";
import { Badge, Card } from "../ui";

// Vue « famille » d'un parent de plusieurs enfants (toutes classes et
// sections) : chaque enfant — classe, absences, messages non lus, reste à
// payer — et le total à payer pour toute la famille. Données :
// resumeFamille (portail-parent-derive.js). Un enfant se choisit d'un clic ;
// « Paiements » ouvre directement son détail.
export function FamilleCard({ famille, eleveId, onVoirEnfant, c1 }) {
  const { t } = useTranslation();
  const { enfants, totalAPayer, aJour } = famille;
  return (
    <Card style={{ marginBottom: 20 }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <strong style={{ fontSize: 14, color: c1 }}>👪 {t("parent.family.title")}</strong>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
            {t("parent.family.children", { count: enfants.length })} · {aJour === enfants.length ? t("parent.family.allUpToDate") : t("parent.family.someUpToDate", { ok: aJour, total: enfants.length })}
          </div>
        </div>
        <div style={{ textAlign: "end" }}>
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>{t("parent.family.totalToPay")}</div>
          <div data-testid="total-famille" style={{ fontSize: 22, fontWeight: 900, color: totalAPayer > 0 ? "#b91c1c" : "#166534" }}>
            {totalAPayer > 0 ? fmt(totalAPayer) : `✅ ${t("parent.family.upToDate")}`}
          </div>
        </div>
      </div>

      {enfants.map((e) => {
        const courant = e.id === eleveId;
        return (
          <div key={e.id} data-testid="enfant-famille"
            style={{ padding: "12px 18px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: courant ? "#f8fbff" : "transparent" }}>
            <button type="button" onClick={() => onVoirEnfant(e.id)} title={t("parent.family.showChild")}
              style={{ flex: "1 1 180px", minWidth: 0, textAlign: "start", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit" }}>
              <div style={{ fontWeight: 800, fontSize: 13.5, color: "#0A1628" }}>
                {e.nom || t("parent.family.student")} {courant && <Badge color="blue">{t("parent.family.shown")}</Badge>}
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>
                {[e.classe, e.parti && t("parent.bar.left")].filter(Boolean).join(" · ") || t("parent.family.noClass")}
              </div>
            </button>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <Badge color={e.absences ? "red" : "gray"}>{t(e.absences > 1 ? "parent.family.absenceMany" : "parent.family.absenceOne", { count: e.absences })}</Badge>
              {e.nonLus > 0 && <Badge color="amber">{t(e.nonLus > 1 ? "parent.family.unreadMany" : "parent.family.unreadOne", { count: e.nonLus })}</Badge>}
              {e.bloque && <Badge color="red">🔒 {t("parent.family.gradesBlocked")}</Badge>}
            </div>
            <div style={{ minWidth: 110, textAlign: "end", marginInlineStart: "auto" }}>
              <div style={{ fontWeight: 900, fontSize: 14, color: e.resteAPayer > 0 ? "#b91c1c" : "#166534" }}>
                {e.resteAPayer > 0 ? fmt(e.resteAPayer) : t("parent.family.upToDate")}
              </div>
              <button type="button" onClick={() => onVoirEnfant(e.id, "paiements")}
                style={{ marginTop: 2, fontSize: 11.5, color: c1, background: "none", border: "none", padding: 0, cursor: "pointer", fontWeight: 700, fontFamily: "inherit" }}>
                {t("parent.family.payments")}
              </button>
            </div>
          </div>
        );
      })}

      <div style={{ padding: "10px 18px", fontSize: 11.5, color: "#94a3b8", lineHeight: 1.5 }}>
        {t("parent.family.footnote")}
      </div>
    </Card>
  );
}
