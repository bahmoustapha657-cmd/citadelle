import React from "react";
import { useTranslation } from "react-i18next";
import { C, fmt } from "../../constants";
import { groupSalariesByPersonMonth } from "../../salary-utils";
import { Btn, Card, LectureSeule, Vide } from "../ui";

// Onglet "Salaire" du Portail Enseignant.
// Affiche les fiches de paie consolidées par mois (1 carte = 1 mois).
// Si l'enseignant cumule plusieurs fonctions (ex: prof secondaire + agent
// admin), les sous-fiches sont détaillées par section.
// `indisponible` : les fiches se lisent en ligne et la lecture a échoué — ne
// pas afficher « aucune fiche » à qui en a peut-être.
export function SalaireTab({ c1, c2, salaires, indisponible, imprimerPaies }) {
  const { t } = useTranslation();
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: c1 }}>{t("teacher.pay.title")}</h2>
        {salaires.length > 0 && <Btn sm v="ghost" onClick={imprimerPaies}>{t("teacher.pay.print")}</Btn>}
      </div>
      <LectureSeule />
      {salaires.length === 0 ? (
        <Vide icone="💰" msg={indisponible
          ? t("teacher.pay.onlineOnly")
          : t("teacher.pay.none")} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 12 }}>
          {groupSalariesByPersonMonth(salaires).map((g) => {
            const cumul = g.parts.length > 1;
            return (
              <Card key={`${g.mois}-${g.nom}`} style={{ padding: 0 }}>
                <div style={{ background: `linear-gradient(135deg,${c1},${c1}cc)`, padding: "12px 16px", borderRadius: "14px 14px 0 0" }}>
                  <div style={{ color: c2, fontWeight: 900, fontSize: 13 }}>{t(`months.${g.mois}`, g.mois)}</div>
                  <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}>
                    {cumul ? t("teacher.pay.functions", { count: g.parts.length, sections: g.sections.join(" + ") }) : t("teacher.pay.section", { name: g.sections[0] || "—" })}
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
                              <span style={{ color: "#64748b" }}>{t("teacher.pay.hoursWorked")}</span>
                              <strong>{heuresExec} h</strong>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                              <span style={{ color: "#64748b" }}>{t("teacher.pay.hourlyRate")}</span>
                              <strong>{salaire.primesVariables ? t("teacher.pay.variable") : fmt(salaire.primeHoraire)}</strong>
                            </div>
                            {salaire.primesVariables && (
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                                <span style={{ color: "#64748b" }}>{t("teacher.pay.gross")}</span>
                                <strong>{fmt(salaire.montantBrut)}</strong>
                              </div>
                            )}
                          </>
                        ) : (
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                            <span style={{ color: "#64748b" }}>{t("teacher.pay.flatRate")}</span>
                            <strong>{fmt(salaire.montantForfait)}</strong>
                          </div>
                        )}
                        {Number(salaire.bon || 0) > 0 && (
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4, color: "#b91c1c" }}>
                            <span>{t("teacher.pay.voucher")}</span>
                            <strong>-{fmt(salaire.bon)}</strong>
                          </div>
                        )}
                        {Number(salaire.retenueAbsences || 0) > 0 && (
                          <div style={{ marginBottom: 4, color: "#b91c1c" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                              <span>{t("teacher.pay.absenceDeduction")}</span>
                              <strong>-{fmt(salaire.retenueAbsences)}</strong>
                            </div>
                            {salaire.detailAbsences && <div style={{ fontSize: 10.5, color: "#94a3b8" }}>{salaire.detailAbsences}</div>}
                          </div>
                        )}
                        {Number(salaire.revision || 0) > 0 && (
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4, color: C.greenDk }}>
                            <span>{t("teacher.pay.revision")}</span>
                            <strong>+{fmt(salaire.revision)}</strong>
                          </div>
                        )}
                        {salaire.observation && <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 4, marginBottom: 0 }}>{salaire.observation}</p>}
                      </div>
                    );
                  })}
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", background: `${c1}0d`, borderRadius: 8, marginTop: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: c1 }}>{cumul ? t("teacher.pay.totalNet") : t("teacher.pay.net")}</span>
                    <strong style={{ fontSize: 15, color: c1 }}>{fmt(g.totalNet)}</strong>
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
