import { C } from "../../../constants";

// Bloc inline de confirmation d'une action cycle de vie (désactiver /
// réactiver / supprimer) avec saisie du mot de confirmation.
export function ConfirmationCycleVie({
  confirmation, setConfirmation,
  confirmationValue, setConfirmationValue,
  confirmationLoading,
  executerCycleVie,
  lifecycleLabels,
  S,
}) {
  const lbl = lifecycleLabels[confirmation.action];
  return (
    <div style={{ background: lbl.bg, border: `1px solid ${lbl.border}`, borderRadius: 12, padding: "20px 24px", marginTop: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>
      <h3 style={{ margin: "0 0 8px", color: C.blueDark, fontSize: 16, fontWeight: 800 }}>
        {lbl.title}
      </h3>
      <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
        {lbl.description}
      </p>
      <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 8px" }}>
        Tapez <strong>{lbl.confirmation}</strong> pour continuer sur <strong>{confirmation.ecole.nom}</strong>.
      </p>
      <input
        value={confirmationValue}
        onChange={(e) => setConfirmationValue(e.target.value)}
        placeholder={lbl.confirmation}
        style={{ ...S.input, width: "100%", marginBottom: 12 }}
      />
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={() => setConfirmation(null)}
          style={{ background: "#f3f4f6", border: "none", padding: "9px 18px", borderRadius: 8, cursor: "pointer", fontWeight: 600, color: "#6b7280", fontSize: 13 }}>
          Annuler
        </button>
        <button onClick={executerCycleVie}
          disabled={confirmationLoading || confirmationValue.trim().toUpperCase() !== lbl.confirmation}
          style={{
            background: confirmation.action === "delete" ? "#ef4444" : `linear-gradient(90deg,${C.blue},${C.green})`,
            border: "none", color: "#fff", padding: "9px 18px", borderRadius: 8, cursor: confirmationLoading ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 13,
            opacity: confirmationLoading || confirmationValue.trim().toUpperCase() !== lbl.confirmation ? 0.6 : 1,
          }}>
          {confirmationLoading ? "Traitement..." : lbl.button}
        </button>
      </div>
    </div>
  );
}
