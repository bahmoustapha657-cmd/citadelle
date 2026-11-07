import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMessagerie } from "./messagerie-contexte";
import { titreConversation } from "./messagerie-logic";

// Bandeau « Appel de groupe en cours · Rejoindre » pour les discussions de
// l'utilisateur où un appel a lieu sans lui. Masquable pour la session.
export function BandeauReunions() {
  const { t } = useTranslation();
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
        {t("msg.meet.inProgressIn", { name: conv ? titreConversation(conv, m.annuaire, m.moi) : t("msg.meet.aGroup") })}
        <span style={{ fontWeight: 500 }}> · {t(nb > 1 ? "msg.meet.participants" : "msg.meet.participant", { count: nb })}</span>
      </span>
      <button type="button" onClick={() => m.reunions.rejoindre(a.conversation_id)}
        style={{ background: "#059669", color: "#fff", border: "none", borderRadius: 8, padding: "5px 12px", fontWeight: 800, cursor: "pointer", fontSize: 12 }}>
        {t("msg.meet.join")}
      </button>
      <button type="button" onClick={() => setMasquees((s) => new Set(s).add(a.id))} aria-label={t("auth.hide")}
        style={{ background: "none", border: "none", color: "#065f46", cursor: "pointer", fontSize: 16 }}>✕</button>
    </div>
  );
}
