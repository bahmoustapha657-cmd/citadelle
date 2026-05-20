import React from "react";
import { C } from "../../constants";
import { groupSalariesByPersonMonth } from "../../salary-utils";
import { Btn, Card, LectureSeule, Vide } from "../ui";

// Onglet "Salaire" du Portail Enseignant.
// Affiche les fiches de paie consolidées par mois (1 carte = 1 mois).
// Si l'enseignant cumule plusieurs fonctions (ex: prof secondaire + agent
// admin), les sous-fiches sont détaillées par section.
export function SalaireTab({ c1, c2, salaires, imprimerPaies }) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: c1 }}>Ma fiche de paie</h2>
        {salaires.length > 0 && <Btn sm v="ghost" onClick={imprimerPaies}>Imprimer fiches</Btn>}
      </div>
      <LectureSeule />
      {salaires.length === 0 ? (
        <Vide icone="Paie" msg="Aucune fiche de paie disponible" />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 12 }}>
          {groupSalariesByPersonMonth(salaires).map((g) => {
            const cumul = g.parts.length > 1;
            return (
              <Card key={`${g.mois}-${g.nom}`} style={{ padding: 0 }}>
                <div style={{ background: `linear-gradient(135deg,${c1},${c1}cc)`, padding: "12px 16px", borderRadius: "14px 14px 0 0" }}>
                  <div style={{ color: c2, fontWeight: 900, fontSize: 13 }}>{g.mois}</div>
                  <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}>
                    {cumul ? `${g.parts.length} fonctions : ${g.sections.join(" + ")}` : `Section ${g.sections[0] || "—"}`}
                  </div>
                </div>
                <div style={{ padding: "14px 16px" }}>
                  {g.parts.map((salaire, idx) => {
                    const heuresExec = Number(salaire.vhPrevu || 0) + Number(salaire.cinqSem || 0) - Number(salaire.nonExecute || 0);
                    return (
                      <div key={salaire._id || idx} style={{ marginBottom: cumul ? 10 : 0, paddingBottom: cumul ? 10 : 0, borderBottom: cumul && idx < g.parts.length - 1 ? "1px dashed #e2e8f0" : "none" }}>
                        {cumul && <div style={{ fontSize: 10, fontWeight: 800, color: c1, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>{salaire.section}</div>}
                        {salaire.section === "Secondaire" ? (
                          <>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                              <span style={{ color: "#64748b" }}>V.H. execute</span>
                              <strong>{heuresExec} h</strong>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                              <span style={{ color: "#64748b" }}>Prime horaire</span>
                              <strong>{salaire.primesVariables ? "Variable" : `${Number(salaire.primeHoraire || 0).toLocaleString("fr-FR")} GNF`}</strong>
                            </div>
                            {salaire.primesVariables && (
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                                <span style={{ color: "#64748b" }}>Montant brut</span>
                                <strong>{Number(salaire.montantBrut || 0).toLocaleString("fr-FR")} GNF</strong>
                              </div>
                            )}
                          </>
                        ) : (
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                            <span style={{ color: "#64748b" }}>Forfait</span>
                            <strong>{Number(salaire.montantForfait || 0).toLocaleString("fr-FR")} GNF</strong>
                          </div>
                        )}
                        {Number(salaire.bon || 0) > 0 && (
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4, color: "#b91c1c" }}>
                            <span>Bon deduit</span>
                            <strong>-{Number(salaire.bon).toLocaleString("fr-FR")} GNF</strong>
                          </div>
                        )}
                        {Number(salaire.revision || 0) > 0 && (
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4, color: C.greenDk }}>
                            <span>Revision</span>
                            <strong>+{Number(salaire.revision).toLocaleString("fr-FR")} GNF</strong>
                          </div>
                        )}
                        {salaire.observation && <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 4, marginBottom: 0 }}>{salaire.observation}</p>}
                      </div>
                    );
                  })}
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", background: `${c1}0d`, borderRadius: 8, marginTop: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: c1 }}>{cumul ? "TOTAL NET A PAYER" : "NET A PAYER"}</span>
                    <strong style={{ fontSize: 15, color: c1 }}>{g.totalNet.toLocaleString("fr-FR")} GNF</strong>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
