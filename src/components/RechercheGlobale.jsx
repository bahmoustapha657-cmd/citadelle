import { useRechercheGlobale } from "./recherche-globale/use-recherche-globale";
import { ResultatsListe } from "./recherche-globale/ResultatsListe";
import { FicheEleve } from "./recherche-globale/FicheEleve";
import { FicheEnseignant } from "./recherche-globale/FicheEnseignant";

// ══════════════════════════════════════════════════════════════
//  RECHERCHE GLOBALE (Ctrl+K / ⌘K) — coquille + aiguillage
// ══════════════════════════════════════════════════════════════
function RechercheGlobale({ modules, onNaviguer, onFermer }) {
  const {
    moisAnnee, q, setQ, inputRef, selIdx, setSelIdx, fiche, setFiche, resultats, executer, onKey,
  } = useRechercheGlobale({ modules, onNaviguer, onFermer });

  return (
    <div onClick={onFermer} onKeyDown={onKey} tabIndex={-1}
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(10,22,40,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "8vh", outline: "none" }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#fff", borderRadius: 16, width: "min(640px,95vw)",
        boxShadow: "0 24px 80px rgba(0,0,0,0.35)", overflow: "hidden",
        animation: "fadeUp .15s ease", maxHeight: "85vh", display: "flex", flexDirection: "column",
      }}>
        {/* Barre de recherche */}
        {!fiche && <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: "1px solid #f1f5f9", flexShrink: 0 }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>🔍</span>
          <input
            ref={inputRef}
            value={q}
            onChange={e => { setQ(e.target.value); setSelIdx(0); }}
            onKeyDown={onKey}
            placeholder="Rechercher un élève, enseignant, module…"
            style={{ flex: 1, border: "none", outline: "none", fontSize: 16, color: "#0f172a", background: "transparent" }}
          />
          {q && <button onClick={() => setQ("")} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 18, padding: "2px", lineHeight: 1 }}>✕</button>}
          <kbd style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 6, padding: "2px 8px", fontSize: 11, color: "#64748b", flexShrink: 0 }}>ESC</kbd>
        </div>}

        {/* En-tête fiche (retour) */}
        {fiche && <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid #f1f5f9", flexShrink: 0 }}>
          <button onClick={() => setFiche(null)}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "#f1f5f9", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, color: "#334155", cursor: "pointer" }}>
            ← Retour
          </button>
          <span style={{ fontSize: 13, color: "#64748b" }}>{fiche.label}</span>
          <button onClick={onFermer} style={{ marginLeft: "auto", background: "none", border: "none", color: "#94a3b8", fontSize: 18, cursor: "pointer", lineHeight: 1 }}>✕</button>
        </div>}

        {/* Résultats */}
        {!fiche && <ResultatsListe resultats={resultats} selIdx={selIdx} setSelIdx={setSelIdx} executer={executer} q={q} />}

        {/* Fiche détaillée */}
        {fiche && <div style={{ flex: 1, overflowY: "auto" }}>
          {fiche.type === "élève" && <FicheEleve data={fiche.data} section={fiche.section} moisAnnee={moisAnnee} onNaviguer={onNaviguer} onFermer={onFermer} />}
          {fiche.type === "enseignant" && <FicheEnseignant data={fiche.data} section={fiche.section} onNaviguer={onNaviguer} onFermer={onFermer} />}
        </div>}

        {/* Footer */}
        {!fiche && <div style={{ padding: "8px 20px", borderTop: "1px solid #f1f5f9", display: "flex", gap: 16, fontSize: 11, color: "#94a3b8", flexShrink: 0 }}>
          <span>↑↓ naviguer</span><span>↵ ouvrir</span><span>Échap fermer</span>
          <span style={{ marginLeft: "auto" }}>Ctrl+K pour rouvrir</span>
        </div>}
      </div>
    </div>
  );
}

export { RechercheGlobale };
