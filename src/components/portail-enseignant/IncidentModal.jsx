import { Btn, Input, Modale, Selec } from "../ui";

export function IncidentModal({ c1, mode, formIncident, setFormIncident, enregistrement, enregistrerIncident, fermer }) {
  return (
    <Modale titre={mode === "edit" ? "Modifier le signalement" : `Signaler — ${formIncident.eleveNom || ""}`} fermer={fermer}>
      <div style={{ marginBottom: 12, padding: "10px 14px", background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 8, fontSize: 12, color: "#92400e" }}>
        Ce signalement sera visible par <strong>la direction</strong> et <strong>les parents</strong> de l'élève.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Selec label="Type" value={formIncident.type || "Absence"} onChange={(e) => setFormIncident((p) => ({ ...p, type: e.target.value }))}>
          <option>Absence</option>
          <option>Retard</option>
          <option>Avertissement</option>
          <option>Sanction</option>
          <option>Renvoi temporaire</option>
        </Selec>
        <Input label="Date" type="date" value={formIncident.date || ""} onChange={(e) => setFormIncident((p) => ({ ...p, date: e.target.value }))} />
        <Selec label="Justifié ?" value={formIncident.justifie || "Non"} onChange={(e) => setFormIncident((p) => ({ ...p, justifie: e.target.value }))}>
          <option>Non</option>
          <option>Oui</option>
        </Selec>
        <div style={{ display: "flex", alignItems: "flex-end", fontSize: 11, color: "#6b7280" }}>
          Classe : <strong style={{ marginLeft: 4 }}>{formIncident.classe || "—"}</strong>
        </div>
      </div>
      <div style={{ height: 10 }} />
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: c1, marginBottom: 4 }}>Motif / Description</label>
      <textarea
        rows={3}
        value={formIncident.motif || ""}
        onChange={(e) => setFormIncident((p) => ({ ...p, motif: e.target.value }))}
        placeholder="Ex : Bavardage répété, n'a pas rendu son devoir, absent sans justification..."
        maxLength={500}
        style={{ width: "100%", border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "8px 11px", fontSize: 13, fontFamily: "inherit", resize: "vertical", outline: "none", boxSizing: "border-box" }}
      />
      <div style={{ fontSize: 11, color: "#6b7280", textAlign: "right", marginTop: 2 }}>{(formIncident.motif || "").length} / 500</div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
        <Btn v="ghost" onClick={fermer}>Annuler</Btn>
        <Btn v="amber" onClick={enregistrerIncident} disabled={enregistrement}>{enregistrement ? "Enregistrement..." : "✅ Enregistrer le signalement"}</Btn>
      </div>
    </Modale>
  );
}
