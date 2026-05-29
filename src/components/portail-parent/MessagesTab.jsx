import React from "react";
import { Btn, Card, Champ, Input, Vide } from "../ui";

export function MessagesTab({ mesMessages, sujet, setSujet, corps, setCorps, envoi, envoyer, c1 }) {
  return (
    <>
      <h2 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 900, color: c1 }}>Messages avec l'ecole</h2>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
        {mesMessages.length === 0 && <Vide icone="Messages" msg="Aucun message pour le moment" />}
        {mesMessages.map((message, index) => {
          const estParent = message.expediteur === "parent";
          return (
            <div key={index} style={{ display: "flex", flexDirection: "column", alignItems: estParent ? "flex-end" : "flex-start" }}>
              <div style={{ maxWidth: "75%", background: estParent ? `${c1}15` : "#fff", border: `1px solid ${estParent ? `${c1}33` : "#e2e8f0"}`, borderRadius: estParent ? "16px 16px 4px 16px" : "16px 16px 16px 4px", padding: "12px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: estParent ? c1 : "#64748b" }}>{estParent ? "Vous" : message.expediteurNom || "Ecole"}</span>
                  <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: "auto" }}>{message.date ? new Date(message.date).toLocaleDateString("fr-FR") : ""}</span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#0A1628", marginBottom: 4 }}>{message.sujet}</div>
                <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.6 }}>{message.corps}</div>
              </div>
            </div>
          );
        })}
      </div>

      <Card>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9" }}>
          <strong style={{ fontSize: 13, color: c1 }}>Envoyer un message a l'ecole</strong>
        </div>
        <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
          <Input label="Sujet" value={sujet} onChange={(event) => setSujet(event.target.value)} placeholder="Ex : Justification d'absence" />
          <Champ label="Message">
            <textarea value={corps} onChange={(event) => setCorps(event.target.value)} rows={4} placeholder="Ecrivez votre message ici..." style={{ width: "100%", border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "10px 12px", fontSize: 13, resize: "vertical", outline: "none", fontFamily: "inherit" }} />
          </Champ>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Btn onClick={envoyer} disabled={envoi}>{envoi ? "Envoi..." : "Envoyer"}</Btn>
          </div>
        </div>
      </Card>
    </>
  );
}
