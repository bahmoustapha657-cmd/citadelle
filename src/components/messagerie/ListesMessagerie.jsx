import { Avatar } from "./Avatar";
import {
  annonceAConfirmer, annonceNonLue, autresMembres, formatDateBoite, PRIORITES, titreConversation,
} from "./messagerie-logic";
import { badge, texteDiscret } from "./styles-messagerie";

const ligne = (active) => ({
  display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "start", cursor: "pointer",
  padding: "10px 12px", border: "none", borderBottom: "1px solid var(--lc-border-soft)",
  background: active ? "var(--sc1-lt)" : "var(--lc-surface)", color: "var(--lc-text)",
});

const ellipse = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

export function ListeConversations({ m, conversations, activeId, onOuvrir }) {
  if (!conversations.length) {
    return <p style={{ padding: "26px 16px", margin: 0, textAlign: "center", fontSize: 12.5, color: "var(--lc-text-faint)" }}>Aucune discussion.</p>;
  }
  return conversations.map((c) => {
    const titre = titreConversation(c, m.annuaire, m.moi);
    const autre = c.type === "direct" ? autresMembres(c, m.moi)[0] : null;
    const nonLus = c.non_lus || 0;
    return (
      <button key={c.id} type="button" style={ligne(c.id === activeId)} onClick={() => onOuvrir(c.id)}>
        <Avatar id={autre?.id || c.id} nom={titre} groupe={c.type === "groupe"} taille={42}
          presence={autre ? m.presences?.get(autre.id) : null} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ ...ellipse, flex: 1, fontSize: 13.5, fontWeight: nonLus ? 800 : 700 }}>
              {c.epingle && "📌 "}{titre}
            </span>
            <span style={{ ...texteDiscret, color: nonLus ? "var(--sc1)" : texteDiscret.color, fontWeight: nonLus ? 800 : 400 }}>
              {c.dernier_apercu ? formatDateBoite(c.dernier_message_at) : ""}
            </span>
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
            <span style={{ ...ellipse, flex: 1, fontSize: 12, color: nonLus ? "var(--lc-text)" : "var(--lc-text-muted)", fontWeight: nonLus ? 600 : 400 }}>
              {c.dernier_apercu || (c.type === "groupe" ? "Groupe créé" : "Nouvelle discussion")}
            </span>
            {m.reunions?.actives.some((a) => a.conversation_id === c.id) && (
              <span title="Appel de groupe en cours" style={{ fontSize: 10, fontWeight: 800, color: "#fff", background: "#059669", borderRadius: 8, padding: "1px 6px" }}>📞 en cours</span>
            )}
            {c.sourdine && <span style={{ fontSize: 11 }}>🔕</span>}
            {nonLus > 0 && <span style={{ ...badge, background: c.sourdine ? "var(--lc-text-faint)" : badge.background }}>{nonLus > 99 ? "99+" : nonLus}</span>}
          </span>
        </span>
      </button>
    );
  });
}

export function ListeAnnonces({ m, annonces, activeId, onOuvrir }) {
  if (!annonces.length) {
    return <p style={{ padding: "26px 16px", margin: 0, textAlign: "center", fontSize: 12.5, color: "var(--lc-text-faint)" }}>Aucune annonce.</p>;
  }
  return annonces.map((a) => {
    const p = PRIORITES[a.priorite] || PRIORITES.normale;
    const nonLue = annonceNonLue(a, m.lusAnnonces, m.moi);
    const aConfirmer = annonceAConfirmer(a, m.lusAnnonces, m.moi);
    const stats = m.statsAnnonces.get(a.id);
    return (
      <button key={a.id} type="button" style={{ ...ligne(a.id === activeId), alignItems: "flex-start", borderInlineStart: `4px solid ${a.priorite === "normale" ? "transparent" : p.couleur}` }}
        onClick={() => onOuvrir(a.id)}>
        <span style={{ fontSize: 20, lineHeight: "24px" }}>{p.icone}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ ...ellipse, flex: 1, fontSize: 13.5, fontWeight: nonLue ? 800 : 700 }}>
              {a.epinglee && "📌 "}{a.titre || "Annonce"}{(a.pieces_jointes || []).length > 0 && " 📎"}
            </span>
            <span style={texteDiscret}>{formatDateBoite(a.created_at)}</span>
          </span>
          <span style={{ ...ellipse, display: "block", fontSize: 12, color: "var(--lc-text-muted)", marginTop: 2 }}>
            {a.de_compte_id === m.moi ? "Vous" : a.de_nom} · {a.corps}
          </span>
          <span style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
            {nonLue && <span style={{ ...badge, background: "var(--sc1)" }}>Nouveau</span>}
            {aConfirmer && <span style={{ ...badge, background: "#b45309" }}>À confirmer</span>}
            {stats && <span style={{ ...texteDiscret, fontWeight: 700 }}>👁 {stats.lus}/{stats.total}{a.accuse_requis ? ` · ✅ ${stats.confirmes}/${stats.total}` : ""}</span>}
          </span>
        </span>
      </button>
    );
  });
}
