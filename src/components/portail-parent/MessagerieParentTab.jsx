import { useState } from "react";
import { useMessagerie } from "../messagerie/messagerie-contexte";
import { MessageriePage } from "../messagerie/MessageriePage";
import { MessagesTab } from "./MessagesTab";

// Onglet « Messages » du portail parent : la messagerie de l'école —
// discussions avec la direction, le responsable de la section de l'enfant et
// le comptable (messages, vocaux, documents, appels), et les annonces.
// L'ancien fil « Messages avec l'école » reste consultable en dessous.
//
// Repli : messagerie indisponible (hors Supabase, ou avant
// supabase/historique/messagerie-parents.sql : l'annuaire d'un parent revient vide)
// → l'ancien formulaire, inchangé.
export function MessagerieParentTab({ p, utilisateur, c1 }) {
  const m = useMessagerie();
  const [historique, setHistorique] = useState(false);
  const ancien = {
    mesMessages: p.mesMessages, sujet: p.sujet, setSujet: p.setSujet, corps: p.corps, setCorps: p.setCorps,
    envoi: p.envoi, envoyer: p.envoyer, c1,
  };
  if (!m || (m.pret && !m.erreur && m.annuaireListe.length === 0 && m.boite.length === 0)) {
    return <MessagesTab {...ancien} />;
  }
  return (
    <>
      <div style={{ border: "1px solid var(--lc-border)", borderRadius: 14, overflow: "hidden", background: "var(--lc-surface)" }}>
        <MessageriePage utilisateur={utilisateur} hauteur="max(440px, calc(100dvh - 300px))" />
      </div>
      {p.mesMessages.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <button type="button" onClick={() => setHistorique((v) => !v)}
            style={{ border: "1px solid var(--lc-border)", background: "var(--lc-surface)", borderRadius: 9, padding: "8px 12px", cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: "var(--lc-text-muted)" }}>
            🗂️ {historique ? "Masquer" : "Voir"} les anciens messages ({p.mesMessages.length})
          </button>
          {historique && <div style={{ marginTop: 14 }}><MessagesTab {...ancien} lectureSeule /></div>}
        </div>
      )}
    </>
  );
}
