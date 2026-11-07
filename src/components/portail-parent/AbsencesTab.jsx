import React from "react";
import { useTranslation } from "react-i18next";
import { Badge, Card, TD, THead, TR, Vide } from "../ui";
import { estAbsence, estPresence, estRetard } from "./helpers";

export function AbsencesTab({ mesAbsences, c1 }) {
  const { t } = useTranslation();
  return (
    <>
      <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 900, color: c1 }}>{t("parent.absTab.title")}</h2>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ padding: "12px 20px", background: "#fee2e2", borderRadius: 10, textAlign: "center" }}>
          <div style={{ fontWeight: 900, fontSize: 22, color: "#b91c1c" }}>{mesAbsences.filter(estAbsence).length}</div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{t("parent.absTab.absences")}</div>
        </div>
        <div style={{ padding: "12px 20px", background: "#fef3c7", borderRadius: 10, textAlign: "center" }}>
          <div style={{ fontWeight: 900, fontSize: 22, color: "#d97706" }}>{mesAbsences.filter(estRetard).length}</div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{t("parent.absTab.lates")}</div>
        </div>
        <div style={{ padding: "12px 20px", background: "#dcfce7", borderRadius: 10, textAlign: "center" }}>
          <div style={{ fontWeight: 900, fontSize: 22, color: "#166534" }}>{mesAbsences.filter(estPresence).length}</div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{t("parent.absTab.presences")}</div>
        </div>
      </div>
      {mesAbsences.length === 0 ? (
        <Vide icone="📅" msg={t("parent.absTab.none")} />
      ) : (
        <Card>
          <div className="lc-sticky-wrap"><table className="lc-sticky-table" data-fix-left="1">
            <THead cols={[t("parent.cols.date"), t("parent.cols.subject"), t("parent.cols.status"), t("parent.cols.reason")]} />
            <tbody>
              {mesAbsences.map((item, index) => (
                <TR key={index}>
                  <TD>{item.date || "-"}</TD>
                  <TD>{item.matiere || "-"}</TD>
                  {/* Avertissement, sanction… (même registre) : orange, jamais le vert des présences. */}
                  <TD><Badge color={estAbsence(item) ? "red" : estPresence(item) ? "vert" : "amber"}>{item.type || item.statut || "-"}</Badge></TD>
                  <TD>{item.motif || "-"}</TD>
                </TR>
              ))}
            </tbody>
          </table></div>
        </Card>
      )}
    </>
  );
}
