import React from "react";
import { useTranslation } from "react-i18next";
import { Btn, Card, Champ, Input, Vide } from "../ui";
import { localeCourante } from "../../i18n";

// Ancien fil « Messages avec l'école » (table messages). `lectureSeule` :
// simple historique sous la messagerie, sans formulaire d'envoi.
export function MessagesTab({ mesMessages, sujet, setSujet, corps, setCorps, envoi, envoyer, c1, lectureSeule = false }) {
  const { t } = useTranslation();
  return (
    <>
      <h2 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 900, color: c1 }}>
        {lectureSeule ? t("parent.oldMsg.titleOld") : t("parent.oldMsg.title")}
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
        {mesMessages.length === 0 && <Vide icone="💬" msg={t("parent.oldMsg.none")} />}
        {mesMessages.map((message, index) => {
          const estParent = message.expediteur === "parent";
          return (
            <div key={index} style={{ display: "flex", flexDirection: "column", alignItems: estParent ? "flex-end" : "flex-start" }}>
              <div style={{ maxWidth: "75%", background: estParent ? `${c1}15` : "#fff", border: `1px solid ${estParent ? `${c1}33` : "#e2e8f0"}`, borderRadius: estParent ? "16px 16px 4px 16px" : "16px 16px 16px 4px", padding: "12px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: estParent ? c1 : "#64748b" }}>{estParent ? t("parent.oldMsg.you") : message.expediteurNom || t("parent.oldMsg.school")}</span>
                  <span style={{ fontSize: 10, color: "#94a3b8", marginInlineStart: "auto" }}>{message.date ? new Date(message.date).toLocaleDateString(localeCourante()) : ""}</span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#0A1628", marginBottom: 4 }}>{message.sujet}</div>
                <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.6 }}>{message.corps}</div>
              </div>
            </div>
          );
        })}
      </div>

      {!lectureSeule && <Card>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9" }}>
          <strong style={{ fontSize: 13, color: c1 }}>{t("parent.oldMsg.send")}</strong>
        </div>
        <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
          <Input label={t("parent.oldMsg.subject")} value={sujet} onChange={(event) => setSujet(event.target.value)} placeholder={t("parent.oldMsg.subjectPlaceholder")} />
          <Champ label={t("parent.oldMsg.message")}>
            <textarea value={corps} onChange={(event) => setCorps(event.target.value)} rows={4} placeholder={t("parent.oldMsg.messagePlaceholder")} style={{ width: "100%", border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "10px 12px", fontSize: 13, resize: "vertical", outline: "none", fontFamily: "inherit" }} />
          </Champ>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Btn onClick={envoyer} disabled={envoi}>{envoi ? t("parent.oldMsg.sending") : t("parent.oldMsg.sendBtn")}</Btn>
          </div>
        </div>
      </Card>}
    </>
  );
}
