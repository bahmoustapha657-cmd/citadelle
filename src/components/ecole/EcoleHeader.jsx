import { useTranslation } from "react-i18next";
import { C } from "../../constants";
import { Badge, LectureSeule } from "../ui";

// En-tête du module École : logo, titre, sélecteur d'année et avis d'archive.
export function EcoleHeader({ e, titre, couleur, readOnly }) {
  const { t } = useTranslation();
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        {e.schoolInfo?.logo && <img src={e.schoolInfo.logo} alt="" style={{ width: 48, height: 48, objectFit: "contain" }} />}
        <div style={{ flex: 1, minWidth: 200 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: C.blueDark }}>{titre}</h2>
          <p style={{ margin: 0, fontSize: 12, color: couleur, fontWeight: 700 }}>{t("school.subtitle")}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>{t("common.yearViewed")} :</label>
          <select value={e.anneeConsultee} onChange={(ev) => e.setAnneeConsultee(ev.target.value)}
            style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${e.enModeArchive ? "#f59e0b" : "#cbd5e1"}`, fontSize: 13, fontWeight: 700,
              background: e.enModeArchive ? "#fef3c7" : "#fff", color: e.enModeArchive ? "#92400e" : C.blueDark, cursor: "pointer" }}>
            {e.anneesDispo.map((a) => <option key={a} value={a}>{a}{a === e.anneeCourante ? ` (${t("common.current")})` : ""}</option>)}
          </select>
          {e.enModeArchive && <Badge color="orange">📚 {t("common.archive")} — {t("common.readOnly")}</Badge>}
        </div>
      </div>
      {readOnly && <LectureSeule />}
      <div style={{ background: "#fef3e0", border: "1px solid #fbbf24", borderRadius: 8, padding: "9px 14px", fontSize: 12, color: "#92400e", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 16 }}>🔒</span>
        <span>{t("school.enrollmentNotice")}</span>
      </div>
    </>
  );
}
