import { useMessagerie } from "./messagerie-contexte";

// Icône 💬 de l'en-tête : badge des non-lus (discussions + annonces), ouvre
// la page Messagerie.
export function MessagerieBouton() {
  const m = useMessagerie();
  if (!m) return null;
  return (
    <button type="button" onClick={() => m.ouvrirMessagerie()} title="Messagerie interne"
      style={{ position: "relative", background: "#f0f4f0", border: "1px solid #e0ebf8", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 16, lineHeight: 1, flexShrink: 0 }}>
      💬
      {m.nonLus > 0 && (
        <span style={{ position: "absolute", top: -6, insetInlineEnd: -6, background: "#dc2626", color: "#fff", borderRadius: 10, fontSize: 10, fontWeight: 800, padding: "1px 5px", minWidth: 16 }}>
          {m.nonLus > 9 ? "9+" : m.nonLus}
        </span>
      )}
    </button>
  );
}
