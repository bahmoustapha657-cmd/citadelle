import React from "react";
import { Badge, Card, TD, THead, TR, Vide } from "../ui";
import { normalizeText } from "./helpers";

export function AbsencesTab({ mesAbsences, c1 }) {
  return (
    <>
      <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 900, color: c1 }}>Absences et presences</h2>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ padding: "12px 20px", background: "#fee2e2", borderRadius: 10, textAlign: "center" }}>
          <div style={{ fontWeight: 900, fontSize: 22, color: "#b91c1c" }}>{mesAbsences.filter((item) => normalizeText(item.statut) === "absent").length}</div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Absences</div>
        </div>
        <div style={{ padding: "12px 20px", background: "#fef3c7", borderRadius: 10, textAlign: "center" }}>
          <div style={{ fontWeight: 900, fontSize: 22, color: "#d97706" }}>{mesAbsences.filter((item) => normalizeText(item.statut) === "retard").length}</div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Retards</div>
        </div>
        <div style={{ padding: "12px 20px", background: "#dcfce7", borderRadius: 10, textAlign: "center" }}>
          <div style={{ fontWeight: 900, fontSize: 22, color: "#166534" }}>{mesAbsences.filter((item) => normalizeText(item.statut) === "present").length}</div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Presences</div>
        </div>
      </div>
      {mesAbsences.length === 0 ? (
        <Vide icone="Absences" msg="Aucune absence enregistree" />
      ) : (
        <Card>
          <div className="lc-sticky-wrap"><table className="lc-sticky-table" data-fix-left="1">
            <THead cols={["Date", "Matiere", "Statut", "Motif"]} />
            <tbody>
              {mesAbsences.map((item, index) => (
                <TR key={index}>
                  <TD>{item.date || "-"}</TD>
                  <TD>{item.matiere || "-"}</TD>
                  <TD><Badge color={normalizeText(item.statut) === "absent" ? "red" : normalizeText(item.statut) === "retard" ? "amber" : "vert"}>{item.statut || "-"}</Badge></TD>
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
