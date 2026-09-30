import { useEffect, useMemo, useState } from "react";
import * as api from "../../backend/messagerie-supabase";
import { Btn } from "../ui";
import { Avatar } from "./Avatar";
import { formatHeure, libelleCibleAnnonce, libelleJour, peutGererAnnonce, postesDeLAnnuaire, PRIORITES } from "./messagerie-logic";
import { boutonIcone } from "./styles-messagerie";

// Annonce ouverte : texte, confirmation de lecture, et pour son auteur (ou
// la direction) le suivi « qui a lu / confirmé » avec relance.
export function VueAnnonce({ m, annonce, utilisateur, etroit, onRetour }) {
  const [suivi, setSuivi] = useState(null);
  const [message, setMessage] = useState("");
  const [enCours, setEnCours] = useState(false);
  const p = PRIORITES[annonce.priorite] || PRIORITES.normale;
  const deMoi = annonce.de_compte_id === m.moi;
  const gerable = peutGererAnnonce(annonce, utilisateur);
  const lu = m.lusAnnonces.get(annonce.id);
  const stats = m.statsAnnonces.get(annonce.id);
  const postes = useMemo(() => postesDeLAnnuaire(m.annuaireListe), [m.annuaireListe]);

  // Ouvrir une annonce vaut lecture (la confirmation reste un geste explicite).
  useEffect(() => {
    setSuivi(null);
    setMessage("");
    m.lireAnnonce(annonce, false);
    if (gerable) m.chargerAnnonces(); // compteurs « Lu par » à jour
  }, [annonce.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const executer = async (fn) => {
    setEnCours(true);
    setMessage("");
    try { await fn(); } catch (e) { setMessage(`⚠️ ${e.message || "Opération impossible."}`); } finally { setEnCours(false); }
  };

  const chargerSuivi = () => executer(async () => { setSuivi(await api.suiviAnnonce(annonce.id)); m.chargerAnnonces(); });
  const relancer = () => executer(async () => {
    const n = await m.relancerAnnonce(annonce);
    setMessage(n ? `🔔 Rappel envoyé à ${n} personne${n > 1 ? "s" : ""}.` : "Tout le monde a déjà lu.");
  });
  const supprimer = () => window.confirm("Supprimer cette annonce pour tous ses destinataires ?")
    && executer(async () => { await m.supprimerAnnonce(annonce); onRetour(); });

  const nonLus = suivi?.filter((s) => !s.lu_at) || [];
  const nonConfirmes = suivi?.filter((s) => s.lu_at && !s.confirme_at) || [];

  return (
    <div style={{ height: "100%", overflowY: "auto", background: "var(--lc-surface-alt)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: "var(--lc-surface)", borderBottom: "1px solid var(--lc-border)", position: "sticky", top: 0, zIndex: 1 }}>
        {etroit && <button type="button" onClick={onRetour} style={boutonIcone} aria-label="Retour à la liste">←</button>}
        <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 12, color: p.couleur, background: p.fond }}>{p.icone} {p.libelle}</span>
        {annonce.epinglee && <span style={{ fontSize: 12 }}>📌</span>}
        <span style={{ flex: 1 }} />
        {gerable && (
          <>
            <button type="button" style={boutonIcone} title={annonce.epinglee ? "Désépingler" : "Épingler"} disabled={enCours}
              onClick={() => executer(() => m.epinglerAnnonce(annonce, !annonce.epinglee))}>📌</button>
            <button type="button" style={{ ...boutonIcone, color: "#dc2626" }} title="Supprimer" disabled={enCours} onClick={supprimer}>🗑️</button>
          </>
        )}
      </div>

      <div style={{ padding: "18px 20px", maxWidth: 760 }}>
        <h2 style={{ margin: "0 0 10px", fontSize: 18, color: "var(--lc-text-brand)" }}>{annonce.titre || "Annonce"}</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <Avatar id={annonce.de_compte_id} nom={annonce.de_nom} taille={34} />
          <div style={{ fontSize: 12, color: "var(--lc-text-muted)" }}>
            <strong style={{ color: "var(--lc-text)" }}>{deMoi ? "Vous" : annonce.de_nom}</strong>{annonce.de_poste && ` · ${annonce.de_poste}`}
            <div>{libelleJour(annonce.created_at)} à {formatHeure(annonce.created_at)} · → {libelleCibleAnnonce(annonce, m.annuaire, postes)}</div>
          </div>
        </div>
        <div style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.6, color: "var(--lc-text)", background: "var(--lc-surface)", border: "1px solid var(--lc-border)", borderRadius: 12, padding: "14px 16px" }}>
          {annonce.corps}
        </div>

        {!deMoi && annonce.accuse_requis && (
          <div style={{ marginTop: 14 }}>
            {lu?.confirme_at ? (
              <span style={{ fontSize: 13, fontWeight: 700, color: "#15803d" }}>✅ Lecture confirmée le {libelleJour(lu.confirme_at)} à {formatHeure(lu.confirme_at)}</span>
            ) : (
              <Btn v="success" disabled={enCours} onClick={() => executer(() => m.lireAnnonce(annonce, true))}>✅ J'ai lu et compris</Btn>
            )}
          </div>
        )}

        {gerable && (
          <div style={{ marginTop: 20, background: "var(--lc-surface)", border: "1px solid var(--lc-border)", borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <strong style={{ fontSize: 13, color: "var(--lc-text-brand)", flex: 1 }}>
                📊 Lu par {stats?.lus ?? "…"}/{stats?.total ?? "…"}
                {annonce.accuse_requis && ` · Confirmé par ${stats?.confirmes ?? "…"}/${stats?.total ?? "…"}`}
              </strong>
              {!suivi && <Btn sm v="ghost" disabled={enCours} onClick={chargerSuivi}>Voir le détail</Btn>}
              <Btn sm v="amber" disabled={enCours} onClick={relancer}>🔔 Relancer</Btn>
            </div>
            {message && <div style={{ fontSize: 12, marginTop: 8, color: "var(--lc-text-muted)" }}>{message}</div>}
            {suivi && (
              <div style={{ marginTop: 10, fontSize: 12, color: "var(--lc-text)" }}>
                {nonLus.length > 0 && <p style={{ margin: "0 0 6px" }}><strong style={{ color: "#b91c1c" }}>Pas encore lu ({nonLus.length}) :</strong> {nonLus.map((s) => s.nom).join(", ")}</p>}
                {annonce.accuse_requis && nonConfirmes.length > 0 && (
                  <p style={{ margin: "0 0 6px" }}><strong style={{ color: "#b45309" }}>Lu, non confirmé ({nonConfirmes.length}) :</strong> {nonConfirmes.map((s) => s.nom).join(", ")}</p>
                )}
                <p style={{ margin: 0 }}>
                  <strong style={{ color: "#15803d" }}>{annonce.accuse_requis ? "Confirmé" : "Lu"} ({suivi.filter((s) => (annonce.accuse_requis ? s.confirme_at : s.lu_at)).length}) :</strong>{" "}
                  {suivi.filter((s) => (annonce.accuse_requis ? s.confirme_at : s.lu_at)).map((s) => s.nom).join(", ") || "—"}
                </p>
              </div>
            )}
          </div>
        )}
        {!gerable && message && <div style={{ fontSize: 12, marginTop: 8, color: "#b91c1c" }}>{message}</div>}
      </div>
    </div>
  );
}
