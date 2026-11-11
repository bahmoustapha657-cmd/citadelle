import React from "react";
import { Trans, useTranslation } from "react-i18next";
import { Badge, Btn, Card, TD, THead, TR } from "../ui";
import { COULEUR_TYPE_INCIDENT, libelleTypeIncident } from "./incidents-actions";
import { RegistreMoisCard } from "./RegistreMoisCard";

// Onglet « Registre d'appel » du Portail Enseignant : statistique du mois
// (imprimable), puis les signalements.
// Affiche les signalements faits par cet enseignant (avec actions
// d'édition/suppression sur les siens uniquement) et les événements
// d'enseignement saisis par la comptabilité (cours effectués/absents/…).
export function AbsencesTab({
  c1, matiere,
  incidents, mesEvenements,
  enseignantId,
  ouvrirEditionIncident, supprimerIncident, ouvrirAppel = null,
  mesClasses = [], eleves = [], joursOuvrables, annee = "", schoolInfo = {}, nomEns = "",
}) {
  const { t } = useTranslation();
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", margin: "0 0 16px" }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: c1, flex: 1 }}>{t("teacher.abs.title")}</h2>
        {ouvrirAppel && <Btn sm v="blue" onClick={ouvrirAppel}>✅ {t("teacher.rollCall.start")}</Btn>}
      </div>

      <RegistreMoisCard c1={c1} mesClasses={mesClasses} eleves={eleves} incidents={incidents}
        joursOuvrables={joursOuvrables} annee={annee} schoolInfo={schoolInfo} nomEns={nomEns} matiere={matiere} />

      <Card style={{ marginBottom: 16 }}>
        <div style={{ padding: "12px 18px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <strong style={{ fontSize: 13, color: c1 }}>{t("teacher.abs.myReports", { count: incidents.length })}</strong>
          <span style={{ fontSize: 11, color: "#64748b" }}>{t("teacher.abs.visibleTo")}</span>
        </div>
        {incidents.length === 0 ? (
          <div style={{ padding: "20px", textAlign: "center", color: "#9ca3af", fontSize: 12 }}>
            <Trans i18nKey="teacher.abs.none" components={{ b: <strong /> }} />
          </div>
        ) : (
          <div className="lc-sticky-wrap"><table className="lc-sticky-table" data-fix-left="1">
            <THead cols={[t("teacher.cols.date"), t("teacher.cols.student"), t("teacher.cols.class"), t("teacher.cols.type"), t("teacher.cols.justified"), t("teacher.cols.reason"), t("teacher.cols.action")]} />
            <tbody>
              {incidents.map((inc) => {
                const mine = enseignantId && inc.signaledByEnseignantId === enseignantId;
                const typeColor = COULEUR_TYPE_INCIDENT[inc.type] || "blue";
                return (
                  <TR key={inc._id}>
                    <TD>{inc.date || "-"}</TD>
                    <TD bold>{inc.eleveNom || "-"}</TD>
                    <TD><Badge color="blue">{inc.classe || "-"}</Badge></TD>
                    <TD><Badge color={typeColor}>{inc.type ? libelleTypeIncident(inc.type) : "-"}</Badge></TD>
                    <TD><Badge color={inc.justifie === "Oui" ? "vert" : "gray"}>{inc.justifie === "Oui" ? t("common.yes") : t("common.no")}</Badge></TD>
                    <TD>{inc.motif || "-"}</TD>
                    <TD>
                      {mine ? (
                        <div style={{ display: "flex", gap: 4 }}>
                          <Btn sm v="ghost" onClick={() => ouvrirEditionIncident(inc)}>✏️</Btn>
                          <Btn sm v="danger" onClick={() => supprimerIncident(inc._id)}>🗑</Btn>
                        </div>
                      ) : (
                        <span title={t("teacher.abs.reportedBy", { name: inc.signaledByEnseignantNom || t("teacher.abs.theManagement") })} style={{ fontSize: 10, color: "#9ca3af", fontStyle: "italic" }}>
                          {inc.signaledByEnseignantNom ? t("teacher.abs.by", { name: inc.signaledByEnseignantNom.split(" ").slice(-1)[0] }) : t("teacher.abs.management")}
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
          <strong style={{ fontSize: 13, color: c1 }}>{t("teacher.abs.myEvents", { count: mesEvenements.length })}</strong>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{t("teacher.abs.eventsHint")}</div>
        </div>
        {mesEvenements.length === 0 ? (
          <div style={{ padding: "20px", textAlign: "center", color: "#9ca3af", fontSize: 12 }}>{t("teacher.abs.noEvent")}</div>
        ) : (
          <div className="lc-sticky-wrap"><table className="lc-sticky-table" data-fix-left="1">
            <THead cols={[t("teacher.cols.date"), t("teacher.cols.class"), t("teacher.cols.subject"), t("teacher.cols.status"), t("teacher.cols.reason")]} />
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
