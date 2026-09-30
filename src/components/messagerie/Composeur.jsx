import { useEffect, useRef, useState } from "react";
import { enregistrementDisponible, useEnregistreur } from "./audio/use-enregistreur";
import { apercuMessage, formatChrono } from "./messagerie-logic";
import { ACCEPT_DOCUMENTS, formatTaille, iconeFichier, typeFichier } from "./documents";
import { boutonIcone } from "./styles-messagerie";

const ecranTactile = () => typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

const rond = (fond) => ({
  width: 42, height: 42, borderRadius: "50%", border: "none", cursor: "pointer", flexShrink: 0,
  background: fond, color: "#fff", fontSize: 17, display: "flex", alignItems: "center", justifyContent: "center",
});

// Zone de saisie : texte (Entrée pour envoyer sur ordinateur), réponse à un
// message, correction d'un message, message vocal (🎤) et documents (📎 ;
// le texte saisi sert alors de légende).
export function Composeur({ annuaire, reponse, onAnnulerReponse, edition, onAnnulerEdition, onEnvoyerTexte, onEnvoyerVocal, onEnvoyerFichiers, onValiderEdition }) {
  const [texte, setTexte] = useState("");
  const [fichiers, setFichiers] = useState([]);
  const choixRef = useRef(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const zoneRef = useRef(null);
  const enregistreur = useEnregistreur({ dureeMax: 120 });

  // Passage en mode correction : le texte du message est repris.
  useEffect(() => {
    if (edition) { setTexte(edition.corps || ""); zoneRef.current?.focus(); }
  }, [edition]);
  useEffect(() => { if (reponse) zoneRef.current?.focus(); }, [reponse]);

  // Hauteur ajustée au contenu (jusqu'à ~6 lignes).
  useEffect(() => {
    const z = zoneRef.current;
    if (!z) return;
    z.style.height = "auto";
    // scrollHeight exclut la bordure (box-sizing: border-box) : on l'ajoute.
    const voulue = z.scrollHeight + z.offsetHeight - z.clientHeight;
    z.style.height = `${Math.min(voulue, 140)}px`;
    z.style.overflowY = voulue > 140 ? "auto" : "hidden";
  }, [texte]);

  const executer = async (fn) => {
    setEnvoi(true);
    setErreur("");
    try { await fn(); return true; } catch (e) { setErreur(e.message || "Envoi impossible."); return false; } finally { setEnvoi(false); }
  };

  const envoyer = async () => {
    const contenu = texte.trim();
    if (envoi) return;
    if (fichiers.length && !edition) {
      const ok = await executer(() => onEnvoyerFichiers(fichiers, contenu));
      // En cas d'échec partiel, les fichiers partis sont dans le fil : on vide.
      setFichiers([]);
      if (ok) setTexte("");
      return;
    }
    if (!contenu) return;
    const ok = await executer(() => (edition ? onValiderEdition(contenu) : onEnvoyerTexte(contenu)));
    if (ok) setTexte("");
  };

  const ajouterFichiers = (liste) => {
    setErreur("");
    setFichiers((actuels) => [...actuels, ...Array.from(liste || [])].slice(0, 10));
  };

  const surTouche = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !ecranTactile()) { e.preventDefault(); envoyer(); }
    if (e.key === "Escape") { if (edition) { onAnnulerEdition(); setTexte(""); } else if (reponse) onAnnulerReponse(); }
  };

  const envoyerVocal = async () => {
    const resultat = await enregistreur.arreter();
    if (!resultat || resultat.duree < 1) { setErreur("Message vocal trop court."); return; }
    await executer(() => onEnvoyerVocal(resultat));
  };

  const bandeau = edition ? { titre: "✏️ Modifier le message", texte: apercuMessage(edition), annuler: () => { onAnnulerEdition(); setTexte(""); } }
    : reponse ? { titre: `↩️ Réponse à ${annuaire.get(reponse.de_compte_id)?.nom || "un message"}`, texte: apercuMessage(reponse), annuler: onAnnulerReponse }
      : null;

  return (
    <div style={{ borderTop: "1px solid var(--lc-border)", background: "var(--lc-surface)", padding: "8px 10px" }}>
      {(erreur || enregistreur.erreur) && (
        <div style={{ fontSize: 12, color: "#b91c1c", fontWeight: 600, marginBottom: 6 }}>{erreur || enregistreur.erreur}</div>
      )}
      {bandeau && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--lc-surface-alt)", borderInlineStart: "3px solid var(--sc1)", borderRadius: 8, padding: "6px 10px", marginBottom: 7 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--sc1)" }}>{bandeau.titre}</div>
            <div style={{ fontSize: 12, color: "var(--lc-text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{bandeau.texte}</div>
          </div>
          <button type="button" onClick={bandeau.annuler} style={boutonIcone} aria-label="Annuler">✕</button>
        </div>
      )}

      {enregistreur.enCours ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button type="button" onClick={enregistreur.annuler} style={{ ...boutonIcone, color: "#dc2626" }} aria-label="Annuler l'enregistrement">🗑️</button>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 13, color: "var(--lc-text)" }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#dc2626", animation: "lc-rec 1s ease-in-out infinite" }} />
            <style>{"@keyframes lc-rec{50%{opacity:.25}}"}</style>
            Enregistrement… {formatChrono(enregistreur.secondes)}
            <span style={{ fontSize: 11, fontWeight: 500, color: "var(--lc-text-faint)" }}>/ {formatChrono(enregistreur.dureeMax)}</span>
          </div>
          <button type="button" onClick={envoyerVocal} disabled={envoi} style={rond("var(--sc1)")} aria-label="Envoyer le message vocal">➤</button>
        </div>
      ) : (
        <>
        {fichiers.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 7 }}>
            {fichiers.map((f, i) => (
              <span key={`${f.name}-${i}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, maxWidth: 240, background: "var(--lc-surface-alt)", border: `1px solid ${typeFichier(f) ? "var(--lc-border)" : "#f87171"}`, borderRadius: 14, padding: "3px 6px 3px 10px", fontSize: 11.5, color: "var(--lc-text)" }}>
                {iconeFichier(typeFichier(f))}
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                <span style={{ color: "var(--lc-text-faint)" }}>{formatTaille(f.size)}</span>
                <button type="button" onClick={() => setFichiers((l) => l.filter((_, j) => j !== i))} aria-label={`Retirer ${f.name}`}
                  style={{ ...boutonIcone, fontSize: 12, padding: 2 }}>✕</button>
              </span>
            ))}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
          {!edition && (
            <>
              <button type="button" onClick={() => choixRef.current?.click()} disabled={envoi}
                style={{ ...boutonIcone, fontSize: 20, padding: "9px 4px" }} aria-label="Joindre un document" title="Joindre un document ou une photo (10 Mo max)">📎</button>
              <input ref={choixRef} type="file" multiple accept={ACCEPT_DOCUMENTS} style={{ display: "none" }}
                onChange={(e) => { ajouterFichiers(e.target.files); e.target.value = ""; }} />
            </>
          )}
          <textarea ref={zoneRef} value={texte} rows={1} onChange={(e) => setTexte(e.target.value)} onKeyDown={surTouche}
            placeholder={edition ? "Corrigez votre message…" : fichiers.length ? "Ajouter une légende (facultatif)…" : "Écrire un message…"} maxLength={4000}
            style={{
              flex: 1, resize: "none", border: "1.5px solid var(--lc-border)", borderRadius: 20, padding: "10px 14px",
              fontSize: 13.5, lineHeight: 1.4, background: "var(--lc-input-bg)", color: "var(--lc-text)", outline: "none",
              fontFamily: "inherit", maxHeight: 140,
            }} />
          {texte.trim() || fichiers.length || edition || !enregistrementDisponible() ? (
            <button type="button" onClick={envoyer} disabled={envoi || (!texte.trim() && !fichiers.length)} style={{ ...rond("var(--sc1)"), opacity: texte.trim() || fichiers.length ? 1 : 0.5 }}
              aria-label={edition ? "Enregistrer la correction" : "Envoyer"}>
              {envoi ? "…" : edition ? "✓" : "➤"}
            </button>
          ) : (
            <button type="button" onClick={enregistreur.demarrer} disabled={envoi} style={rond("var(--sc1)")}
              aria-label="Enregistrer un message vocal" title="Message vocal (2 min max)">
              {envoi ? "…" : "🎤"}
            </button>
          )}
        </div>
        </>
      )}
    </div>
  );
}
