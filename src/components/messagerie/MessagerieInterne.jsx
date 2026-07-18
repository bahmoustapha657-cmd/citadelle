import { C } from "../../constants";
import { Btn } from "../ui";
import { useMessagerie } from "./use-messagerie";

// Libellé du/des destinataire(s) d'un message pour l'affichage.
function libelleCible(message, destinataires) {
  if (message.a_tous) return "Tout le personnel";
  if (message.a_compte_id) {
    const compte = destinataires.comptes.find((c) => c.id === message.a_compte_id);
    return compte ? `${compte.nom} (${compte.login})` : "Un compte";
  }
  if (message.a_postes?.length) {
    const noms = message.a_postes.map((cle) =>
      destinataires.postes.find((p) => p.cle === cle)?.label || cle);
    return noms.join(", ");
  }
  return "";
}

const fmtDate = (iso) => {
  try {
    return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
};

// ══════════════════════════════════════════════════════════════
//  Messagerie interne du personnel — icône 💬 de l'en-tête
// ══════════════════════════════════════════════════════════════
// Individuel (un compte), en masse (postes) ou tout le personnel.
// La RLS (messagerie-interne.sql) restreint chaque message à son
// expéditeur et ses destinataires.
export function MessagerieInterne({ utilisateur, actif = true }) {
  const m = useMessagerie({ utilisateur, actif });
  if (!actif) return null;

  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <button onClick={m.basculer} title="Messagerie interne du personnel"
        style={{ position: "relative", background: "#f0f4f0", border: "1px solid #e0ebf8", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>
        💬
        {m.nonLus > 0 && (
          <span style={{ position: "absolute", top: -6, insetInlineEnd: -6, background: "#dc2626", color: "#fff", borderRadius: 10, fontSize: 10, fontWeight: 800, padding: "1px 5px", minWidth: 16 }}>
            {m.nonLus > 9 ? "9+" : m.nonLus}
          </span>
        )}
      </button>

      {m.ouvert && (
        <div onClick={(e) => e.stopPropagation()}
          style={{ position: "absolute", top: "calc(100% + 8px)", insetInlineEnd: 0, width: 380, maxWidth: "92vw", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, boxShadow: "0 10px 40px rgba(0,0,0,0.15)", zIndex: 200, overflow: "hidden" }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <strong style={{ fontSize: 13, color: C.blueDark }}>💬 Messagerie interne</strong>
            {m.vue === "boite"
              ? <Btn sm v="primary" onClick={() => m.setVue("nouveau")}>✍️ Nouveau</Btn>
              : <Btn sm v="ghost" onClick={() => m.setVue("boite")}>← Boîte</Btn>}
          </div>

          {m.erreur && <div style={{ padding: "8px 14px", background: "#fee2e2", color: "#991b1b", fontSize: 12, fontWeight: 600 }}>{m.erreur}</div>}

          {m.vue === "nouveau" && (
            <div style={{ padding: "12px 14px" }}>
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                {[["tous", "Tout le personnel"], ["poste", "Des postes"], ["compte", "Un compte"]].map(([type, label]) => (
                  <button key={type} type="button" onClick={() => m.chg("cibleType")({ target: { value: type } })}
                    style={{ flex: 1, padding: "6px 4px", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer",
                      border: m.form.cibleType === type ? `2px solid ${C.green}` : "1px solid #e2e8f0",
                      background: m.form.cibleType === type ? "#ecfdf5" : "#f8fafc",
                      color: m.form.cibleType === type ? "#065f46" : "#64748b" }}>
                    {label}
                  </button>
                ))}
              </div>

              {m.form.cibleType === "poste" && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
                  {m.destinataires.postes.map((poste) => (
                    <button key={poste.cle} type="button" onClick={() => m.basculerPoste(poste.cle)}
                      style={{ padding: "4px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700, cursor: "pointer",
                        border: m.form.posteCles.includes(poste.cle) ? `2px solid ${C.green}` : "1px solid #e2e8f0",
                        background: m.form.posteCles.includes(poste.cle) ? "#ecfdf5" : "#fff",
                        color: m.form.posteCles.includes(poste.cle) ? "#065f46" : "#64748b" }}>
                      {poste.label}
                    </button>
                  ))}
                </div>
              )}

              {m.form.cibleType === "compte" && (
                <select value={m.form.compteId} onChange={m.chg("compteId")}
                  style={{ width: "100%", padding: "7px 10px", borderRadius: 7, border: "1px solid #cbd5e1", fontSize: 12, marginBottom: 8 }}>
                  <option value="">— Choisir un compte —</option>
                  {m.destinataires.comptes.filter((c) => c.id !== m.moi).map((c) => (
                    <option key={c.id} value={c.id}>{c.nom} — {c.label || c.role} ({c.login})</option>
                  ))}
                </select>
              )}

              <input value={m.form.sujet} onChange={m.chg("sujet")} placeholder="Sujet (optionnel)"
                style={{ width: "100%", boxSizing: "border-box", padding: "7px 10px", borderRadius: 7, border: "1px solid #cbd5e1", fontSize: 12, marginBottom: 8 }} />
              <textarea value={m.form.corps} onChange={m.chg("corps")} placeholder="Votre message…" rows={4}
                style={{ width: "100%", boxSizing: "border-box", padding: "7px 10px", borderRadius: 7, border: "1px solid #cbd5e1", fontSize: 12, resize: "vertical", marginBottom: 8 }} />
              <Btn sm v="primary" disabled={m.envoiEnCours} onClick={m.envoyer}>
                {m.envoiEnCours ? "Envoi…" : "📨 Envoyer"}
              </Btn>
            </div>
          )}

          {m.vue === "boite" && (
            <div style={{ maxHeight: 420, overflowY: "auto" }}>
              {m.messages.length === 0 && (
                <p style={{ padding: "18px 14px", fontSize: 12, color: "#94a3b8", textAlign: "center" }}>
                  Aucun message. Écrivez le premier avec ✍️ Nouveau.
                </p>
              )}
              {m.messages.map((message) => {
                const deMoi = message.de_compte_id === m.moi;
                const nonLu = !deMoi && !m.lusIds.has(message.id);
                const ouvert = m.messageOuvertId === message.id;
                return (
                  <div key={message.id} onClick={() => m.ouvrirMessage(message)}
                    style={{ padding: "10px 14px", borderBottom: "1px solid #f1f5f9", cursor: "pointer", background: nonLu ? "#eff6ff" : "#fff" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                      {nonLu && <span style={{ width: 8, height: 8, borderRadius: 4, background: "#2563eb", flexShrink: 0 }} />}
                      <strong style={{ color: C.blueDark, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {deMoi ? `À : ${libelleCible(message, m.destinataires)}` : `${message.de_nom}${message.de_poste ? ` · ${message.de_poste}` : ""}`}
                      </strong>
                      <span style={{ fontSize: 10, color: "#94a3b8", flexShrink: 0 }}>{fmtDate(message.created_at)}</span>
                    </div>
                    {message.sujet && <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginTop: 2 }}>{message.sujet}</div>}
                    <div style={{ fontSize: 12, color: "#475569", marginTop: 2, ...(ouvert ? { whiteSpace: "pre-wrap" } : { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }) }}>
                      {message.corps}
                    </div>
                    {ouvert && deMoi && (
                      <div style={{ marginTop: 6 }}>
                        <Btn sm v="red" onClick={(e) => { e.stopPropagation(); m.supprimer(message); }}>Retirer</Btn>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
