import React from "react";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";
import { C } from "../../constants";
import { getSubjectAverage } from "../../note-utils";
import { Badge, Card, TD, THead, TR, Vide } from "../ui";
import { normalizeText } from "./helpers";

export function DashboardTab({ annonces, mesNotes, mesAbsences, matieres, eleve, c1, onVoirNotes }) {
  return (
    <>
      {annonces.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          {[...annonces].sort((left, right) => Number(right.date || 0) - Number(left.date || 0)).slice(0, 3).map((annonce, index) => (
            <div key={index} style={{ background: annonce.important ? "linear-gradient(135deg,#fef3c7,#fffbeb)" : "#f8fafc", border: `1px solid ${annonce.important ? "#fcd34d" : "#e2e8f0"}`, borderLeft: `4px solid ${annonce.important ? "#f59e0b" : c1}`, borderRadius: "0 12px 12px 0", padding: "12px 18px", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <strong style={{ fontSize: 13, color: "#0A1628" }}>{annonce.titre}</strong>
                <span style={{ marginLeft: "auto", fontSize: 10, color: "#94a3b8" }}>{annonce.auteur} - {annonce.date ? new Date(annonce.date).toLocaleDateString("fr-FR") : ""}</span>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: "#475569", lineHeight: 1.6 }}>{annonce.corps}</p>
            </div>
          ))}
        </div>
      )}

      {mesNotes.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <strong style={{ fontSize: 13, color: c1 }}>Dernieres notes</strong>
            <button onClick={onVoirNotes} style={{ fontSize: 12, color: c1, background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>Voir tout</button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <div className="lc-sticky-wrap"><table className="lc-sticky-table" data-fix-left="1">
              <THead cols={["Matiere", "Type", "Periode", "Note"]} />
              <tbody>
                {mesNotes.slice(-6).reverse().map((item, index) => (
                  <TR key={index}>
                    <TD bold>{item.matiere}</TD>
                    <TD><Badge color="blue">{item.type}</Badge></TD>
                    <TD>{item.periode}</TD>
                    <TD center><strong style={{ color: Number(item.note) >= 10 ? C.greenDk : "#b91c1c", fontSize: 14 }}>{item.note}/20</strong></TD>
                  </TR>
                ))}
              </tbody>
            </table></div>
          </div>
        </Card>
      )}

      {mesAbsences.filter((item) => normalizeText(item.statut) === "absent").length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9" }}>
            <strong style={{ fontSize: 13, color: "#b91c1c" }}>Absences recentes</strong>
          </div>
          <div style={{ overflowX: "auto" }}>
            <div className="lc-sticky-wrap"><table className="lc-sticky-table" data-fix-left="1">
              <THead cols={["Date", "Matiere", "Statut", "Motif"]} />
              <tbody>
                {mesAbsences.filter((item) => normalizeText(item.statut) === "absent").slice(-5).map((item, index) => (
                  <TR key={index}>
                    <TD>{item.date || "-"}</TD>
                    <TD>{item.matiere || "-"}</TD>
                    <TD><Badge color="red">Absent</Badge></TD>
                    <TD>{item.motif || "-"}</TD>
                  </TR>
                ))}
              </tbody>
            </table></div>
          </div>
        </Card>
      )}

      {mesNotes.length > 0 && matieres.length >= 3 && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ padding: "14px 18px" }}>
            <p style={{ margin: "0 0 8px", fontWeight: 800, fontSize: 13, color: c1 }}>Profil par matiere</p>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={matieres.map((matiere) => {
                const notesMatiere = mesNotes.filter((item) => item.matiere === matiere);
                const moyenne = getSubjectAverage(notesMatiere, eleve.classe) || 0;
                return { matiere: matiere.length > 10 ? `${matiere.slice(0, 10)}...` : matiere, valeur: Math.round(moyenne * 10) / 10, plein: 20 };
              })}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="matiere" tick={{ fontSize: 10 }} />
                <Radar name="Note" dataKey="valeur" stroke={c1} fill={c1} fillOpacity={0.25} />
                <Radar name="Max" dataKey="plein" stroke="transparent" fill="transparent" />
                <Tooltip formatter={(value) => `${value}/20`} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {mesNotes.length === 0 && mesAbsences.length === 0 && <Vide icone="Info" msg="Aucune donnee disponible pour le moment" />}
    </>
  );
}
