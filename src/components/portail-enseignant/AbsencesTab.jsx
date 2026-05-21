import React from "react";
import { Badge, Btn, Card, TD, THead, TR } from "../ui";

// Onglet "Absences et événements" du Portail Enseignant.
// Affiche les signalements faits par cet enseignant (avec actions
// d'édition/suppression sur les siens uniquement) et les événements
// d'enseignement saisis par la comptabilité (cours effectués/absents/…).
export function AbsencesTab({
  c1, matiere,
  incidents, mesEvenements,
  enseignantId,
  ouvrirEditionIncident, supprimerIncident,
}) {
  return (
    <>
      <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 900, color: c1 }}>Signalements et événements</h2>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ padding: "12px 18px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <strong style={{ fontSize: 13, color: c1 }}>Mes signalements sur élèves ({incidents.length})</strong>
          <span style={{ fontSize: 11, color: "#64748b" }}>Visibles par la direction et les parents concernés.</span>
        </div>
        {incidents.length === 0 ? (
          <div style={{ padding: "20px", textAlign: "center", color: "#9ca3af", fontSize: 12 }}>
            Aucun signalement. Allez dans <strong>Mes élèves</strong> pour signaler une absence, un retard, une indiscipline.
          </div>
        ) : (
          <div className="lc-sticky-wrap"><table className="lc-sticky-table" data-fix-left="1">
            <THead cols={["Date", "Élève", "Classe", "Type", "Justifié", "Motif", "Action"]} />
            <tbody>
              {incidents.map((inc) => {
                const mine = enseignantId && inc.signaledByEnseignantId === enseignantId;
                const typeColor = inc.type === "Absence" ? "red" : inc.type === "Retard" ? "amber" : inc.type === "Avertissement" ? "amber" : inc.type === "Sanction" ? "red" : inc.type === "Renvoi temporaire" ? "red" : "blue";
                return (
                  <TR key={inc._id}>
                    <TD>{inc.date || "-"}</TD>
                    <TD bold>{inc.eleveNom || "-"}</TD>
                    <TD><Badge color="blue">{inc.classe || "-"}</Badge></TD>
                    <TD><Badge color={typeColor}>{inc.type || "-"}</Badge></TD>
                    <TD><Badge color={inc.justifie === "Oui" ? "vert" : "gray"}>{inc.justifie || "Non"}</Badge></TD>
                    <TD>{inc.motif || "-"}</TD>
                    <TD>
                      {mine ? (
                        <div style={{ display: "flex", gap: 4 }}>
                          <Btn sm v="ghost" onClick={() => ouvrirEditionIncident(inc)}>✏️</Btn>
                          <Btn sm v="danger" onClick={() => supprimerIncident(inc._id)}>🗑</Btn>
                        </div>
                      ) : (
                        <span title={`Signalé par ${inc.signaledByEnseignantNom || "la direction"}`} style={{ fontSize: 10, color: "#9ca3af", fontStyle: "italic" }}>
                          {inc.signaledByEnseignantNom ? `par ${inc.signaledByEnseignantNom.split(" ").slice(-1)[0]}` : "Direction"}
                        </span>
                      )}
                    </TD>
                  </TR>
                );
              })}
            </tbody>
          </table></div>
        )}
      </Card>

      <Card>
        <div style={{ padding: "12px 18px", borderBottom: "1px solid #f1f5f9" }}>
          <strong style={{ fontSize: 13, color: c1 }}>Mes événements d'enseignement ({mesEvenements.length})</strong>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>Cours effectués, absents, non effectués (saisis par la comptabilité).</div>
        </div>
        {mesEvenements.length === 0 ? (
          <div style={{ padding: "20px", textAlign: "center", color: "#9ca3af", fontSize: 12 }}>Aucun événement enregistré.</div>
        ) : (
          <div className="lc-sticky-wrap"><table className="lc-sticky-table" data-fix-left="1">
            <THead cols={["Date", "Classe", "Matière", "Statut", "Motif"]} />
            <tbody>
              {mesEvenements.map((item) => (
                <TR key={item._id}>
                  <TD>{item.date || "-"}</TD>
                  <TD><Badge color="blue">{item.classe || "-"}</Badge></TD>
                  <TD>{item.matiere || matiere || "-"}</TD>
                  <TD><Badge color={item.statut === "Absent" ? "red" : item.statut === "Non effectue" ? "amber" : "vert"}>{item.statut || "-"}</Badge></TD>
                  <TD>{item.motif || "-"}</TD>
                </TR>
              ))}
            </tbody>
          </table></div>
        )}
      </Card>
    </>
  );
}
