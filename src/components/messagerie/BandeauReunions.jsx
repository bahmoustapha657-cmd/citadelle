import { useState } from "react";
import { useMessagerie } from "./messagerie-contexte";
import { titreConversation } from "./messagerie-logic";

// Bandeau « Appel de groupe en cours · Rejoindre » pour les discussions de
// l'utilisateur où un appel a lieu sans lui. Masquable pour la session.
export function BandeauReunions() {
  const m = useMessagerie();
  const [masquees, setMasquees] = useState(() => new Set());
  if (!m?.reunions) return null;
  const courante = m.reunions.reunion?.id;
  const visibles = m.reunions.actives.filter((a) => a.id !== courante && !masquees.has(a.id)
    && !(a.presents || []).includes(m.moi));
  if (!visibles.length) return null;
  const a = visibles[0];
  const conv = m.boiteParId.get(a.conversation_id);
  const nb = (a.presents || []).length;

  return (
    <div role="status" style={{ textAlign: "start", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "8px 14px", background: "#ecfdf5", borderBottom: "2px solid #059669", color: "#065f46", fontSize: 13 }}>
      <span style={{ fontSize: 16 }}>📞</span>
      <span style={{ flex: 1, minWidth: 200, fontWeight: 700 }}>
        Appel de groupe en cours — {conv ? titreConversation(conv, m.annuaire, m.moi) : "un groupe"}
        <span style={{ fontWeight: 500 }}> · {nb} participant{nb > 1 ? "s" : ""}</span>
      </span>
      <button type="button" onClick={() => m.reunions.rejoindre(a.conversation_id)}
        style={{ background: "#059669", color: "#fff", border: "none", borderRadius: 8, padding: "5px 12px", fontWeight: 800, cursor: "pointer", fontSize: 12 }}>
        Rejoindre
      </button>
      <button type="button" onClick={() => setMasquees((s) => new Set(s).add(a.id))} aria-label="Masquer"
        style={{ background: "none", border: "none", color: "#065f46", cursor: "pointer", fontSize: 16 }}>✕</button>
    </div>
  );
}
