import { useEffect, useMemo, useRef, useState } from "react";
import { useMessagerie } from "./messagerie-contexte";
import { ListeAnnonces, ListeConversations } from "./ListesMessagerie";
import { VueConversation } from "./VueConversation";
import { VueAnnonce } from "./VueAnnonce";
import { NouvelleDiscussionModal } from "./NouvelleDiscussionModal";
import { NouvelleAnnonceModal } from "./NouvelleAnnonceModal";
import { GroupeModal } from "./GroupeModal";
import {
  estParent, filtrerConversations, normaliser, peutCreerGroupe, peutPublierAnnonce, titreConversation, trierAnnonces,
} from "./messagerie-logic";
import { badge, champ } from "./styles-messagerie";

const LARGEUR_ETROITE = 720;

const onglet = (actif) => ({
  flex: 1, padding: "11px 6px", border: "none", cursor: "pointer", background: "none",
  fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
  color: actif ? "var(--sc1)" : "var(--lc-text-muted)",
  borderBottom: actif ? "3px solid var(--sc1)" : "3px solid transparent",
});

// Largeur du conteneur (et non de la fenêtre) : la page vit aussi dans le
// portail enseignant, plus étroit que le shell.
function useLargeur(ref) {
  const [largeur, setLargeur] = useState(() => (typeof window !== "undefined" ? window.innerWidth : 1000));
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const obs = new ResizeObserver(([e]) => setLargeur(e.contentRect.width));
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref]);
  return largeur;
}

// ══════════════════════════════════════════════════════════════
//  Page Messagerie : discussions (directes, groupes) et annonces
// ══════════════════════════════════════════════════════════════
export function MessageriePage({ utilisateur, hauteur = "100%" }) {
  const m = useMessagerie();
  const conteneurRef = useRef(null);
  const etroit = useLargeur(conteneurRef) < LARGEUR_ETROITE;
  const [recherche, setRecherche] = useState("");
  const [archivees, setArchivees] = useState(false);
  const vue = m?.onglet || "discussions";
  const setVue = (v) => m?.setOnglet(v);
  const annonceId = m?.annonceActiveId || null;
  const setAnnonceId = (id) => m?.setAnnonceActiveId(id);
  const [modale, setModale] = useState(null); // discussion | annonce | groupe

  const setVueOuverte = m?.setVueOuverte;
  useEffect(() => {
    if (!setVueOuverte) return undefined;
    setVueOuverte(true);
    return () => setVueOuverte(false);
  }, [setVueOuverte]);

  const conversations = useMemo(() => (m ? filtrerConversations(m.boite, {
    archivees, recherche, moi: m.moi, titre: (c) => titreConversation(c, m.annuaire, m.moi),
  }) : []), [m, archivees, recherche]);
  const nbArchivees = m ? m.boite.filter((c) => c.archive).length : 0;

  const annonces = useMemo(() => {
    if (!m) return [];
    const terme = normaliser(recherche);
    return trierAnnonces(m.annonces, m.lusAnnonces)
      .filter((a) => !terme || normaliser(`${a.titre} ${a.corps} ${a.de_nom}`).includes(terme));
  }, [m, recherche]);

  if (!m) {
    return <p style={{ padding: 24, color: "var(--lc-text-muted)" }}>Messagerie indisponible pour ce compte.</p>;
  }

  const convActive = m.convActiveId ? m.boiteParId.get(m.convActiveId) : null;
  const annonceActive = annonceId ? m.annonces.find((a) => a.id === annonceId) : null;
  const detailOuvert = vue === "discussions" ? !!convActive : !!annonceActive;
  const publier = peutPublierAnnonce(utilisateur);

  const colonneListe = (
    <div style={{ width: etroit ? "100%" : 340, flexShrink: 0, display: "flex", flexDirection: "column", minHeight: 0, borderInlineEnd: etroit ? "none" : "1px solid var(--lc-border)", background: "var(--lc-surface)" }}>
      <div style={{ display: "flex", borderBottom: "1px solid var(--lc-border)" }}>
        <button type="button" style={onglet(vue === "discussions")} onClick={() => setVue("discussions")}>
          💬 Discussions {m.nonLusDiscussions > 0 && <span style={badge}>{m.nonLusDiscussions}</span>}
        </button>
        <button type="button" style={onglet(vue === "annonces")} onClick={() => setVue("annonces")}>
          📣 Annonces {m.annoncesNonLues > 0 && <span style={badge}>{m.annoncesNonLues}</span>}
        </button>
      </div>
      <div style={{ display: "flex", gap: 8, padding: "10px 10px 8px" }}>
        <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="🔍 Rechercher…" style={champ} />
        {(vue === "discussions" || publier) && (
          <button type="button" onClick={() => setModale(vue === "discussions" ? "discussion" : "annonce")}
            title={vue === "discussions" ? "Nouvelle discussion" : "Nouvelle annonce"}
            style={{ flexShrink: 0, border: "none", borderRadius: 9, padding: "0 12px", cursor: "pointer", background: "linear-gradient(135deg,var(--sc1),var(--sc1-dk))", color: "#fff", fontWeight: 800, fontSize: 13 }}>
            {vue === "discussions" ? "✍️" : "📣"}{etroit ? "" : " Nouveau"}
          </button>
        )}
      </div>
      {m.erreur && (
        <div style={{ margin: "0 10px 8px", padding: "7px 10px", background: "#fee2e2", color: "#991b1b", borderRadius: 8, fontSize: 12, fontWeight: 600, display: "flex", gap: 6 }}>
          <span style={{ flex: 1 }}>{m.erreur}</span>
          <button type="button" onClick={() => m.setErreur("")} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit" }}>✕</button>
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {!m.pret ? (
          <p style={{ padding: 20, textAlign: "center", fontSize: 12.5, color: "var(--lc-text-faint)" }}>Chargement…</p>
        ) : vue === "discussions" ? (
          <ListeConversations m={m} conversations={conversations} activeId={m.convActiveId} onOuvrir={m.ouvrirConversation} />
        ) : (
          <ListeAnnonces m={m} annonces={annonces} activeId={annonceId} onOuvrir={setAnnonceId} />
        )}
      </div>
      {vue === "discussions" && (nbArchivees > 0 || archivees) && (
        <button type="button" onClick={() => setArchivees((v) => !v)}
          style={{ border: "none", borderTop: "1px solid var(--lc-border)", background: "var(--lc-surface-alt)", padding: "9px", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "var(--lc-text-muted)" }}>
          {archivees ? "← Discussions" : `🗄️ Archivées (${nbArchivees})`}
        </button>
      )}
    </div>
  );

  const vide = (icone, texte) => (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--lc-text-faint)", background: "var(--lc-surface-alt)", padding: 20, textAlign: "center" }}>
      <div style={{ fontSize: 44, marginBottom: 10 }}>{icone}</div>
      <div style={{ fontSize: 13 }}>{texte}</div>
    </div>
  );

  const colonneDetail = (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
      {vue === "discussions"
        ? (convActive
          ? <VueConversation key={convActive.id} m={m} conv={convActive} etroit={etroit} onRetour={() => m.ouvrirConversation(null)} onGererGroupe={() => setModale("groupe")} />
          : vide("💬", estParent(utilisateur)
            ? "Choisissez une discussion, ou écrivez à l'école avec ✍️."
            : "Choisissez une discussion, ou écrivez à un collègue avec ✍️."))
        : (annonceActive
          ? <VueAnnonce m={m} annonce={annonceActive} utilisateur={utilisateur} etroit={etroit} onRetour={() => setAnnonceId(null)} />
          : vide("📣", publier ? "Les annonces de l'école s'affichent ici. Publiez-en une avec 📣." : "Les annonces de l'école s'affichent ici."))}
    </div>
  );

  return (
    <div ref={conteneurRef} style={{ height: hauteur, minHeight: 0, display: "flex", textAlign: "start", background: "var(--lc-surface)", overflow: "hidden" }}>
      {(!etroit || !detailOuvert) && colonneListe}
      {(!etroit || detailOuvert) && colonneDetail}

      {modale === "discussion" && (
        <NouvelleDiscussionModal m={m} fermer={() => setModale(null)}
          groupes={peutCreerGroupe(utilisateur)} parent={estParent(utilisateur)} />
      )}
      {modale === "annonce" && <NouvelleAnnonceModal m={m} fermer={() => setModale(null)} />}
      {modale === "groupe" && convActive?.type === "groupe" && <GroupeModal m={m} conv={convActive} fermer={() => setModale(null)} />}
    </div>
  );
}
