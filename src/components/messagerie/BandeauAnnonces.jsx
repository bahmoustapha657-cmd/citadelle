import { useState } from "react";
import { useMessagerie } from "./messagerie-contexte";
import { annonceAConfirmer, PRIORITES } from "./messagerie-logic";

// Bandeau d'alerte sous l'en-tête : annonce urgente non lue, ou annonce dont
// la lecture doit être confirmée. Masquable pour la session ; revient tant
// que la confirmation manque (au rechargement).
export function BandeauAnnonces() {
  const m = useMessagerie();
  const [masquees, setMasquees] = useState(() => new Set());
  if (!m) return null;
  const alertes = m.alertes.filter((a) => !masquees.has(a.id));
  if (!alertes.length) return null;
  const a = alertes[0];
  const p = PRIORITES[a.priorite] || PRIORITES.normale;
  const confirmer = annonceAConfirmer(a, m.lusAnnonces, m.moi);

  return (
    <div role="alert" style={{ textAlign: "start", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "8px 14px", background: p.fond, borderBottom: `2px solid ${p.couleur}`, color: p.couleur, fontSize: 13 }}>
      <span style={{ fontSize: 16 }}>{p.icone}</span>
      <span style={{ flex: 1, minWidth: 200, fontWeight: 700 }}>
        {confirmer ? "Lecture à confirmer" : "Annonce urgente"} — {a.titre || "Annonce"}
        <span style={{ fontWeight: 500 }}> · {a.de_nom}</span>
        {alertes.length > 1 && <span style={{ fontWeight: 500 }}> (+{alertes.length - 1})</span>}
      </span>
      <button type="button" onClick={() => m.ouvrirMessagerie({ onglet: "annonces", id: a.id })}
        style={{ background: p.couleur, color: "#fff", border: "none", borderRadius: 8, padding: "5px 12px", fontWeight: 800, cursor: "pointer", fontSize: 12 }}>
        Lire
      </button>
      <button type="button" onClick={() => setMasquees((s) => new Set(s).add(a.id))} aria-label="Masquer"
        style={{ background: "none", border: "none", color: p.couleur, cursor: "pointer", fontSize: 16 }}>✕</button>
    </div>
  );
}
