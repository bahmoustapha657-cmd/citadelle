import { useState } from "react";
import { C } from "../../constants";
import { Btn, Modale } from "../ui";

// ══════════════════════════════════════════════════════════════
//  Motif d'un décochage / retrait d'encaissement
// ══════════════════════════════════════════════════════════════
// Remplace le simple confirm() : on demande POURQUOI on retire un paiement.
//   • erreur de saisie (par défaut) : la case avait été cochée par erreur,
//     aucun argent n'est entré → la caisse ne compte pas de sortie ;
//   • remboursement : l'argent a été rendu au parent → sortie de caisse.
// L'explication est obligatoire : elle reste au journal des paiements et à
// l'historique des actions, lisible par la direction.
//
// Ouverte par demanderMotifAnnulation (motif-annulation.jsx).

const OPTIONS = [
  {
    id: "erreur_saisie",
    label: "Erreur de saisie — aucun argent n'a été reçu",
    aide: "Ni entrée ni sortie de caisse. La trace reste au journal avec votre explication.",
  },
  {
    id: "remboursement",
    label: "Remboursement — l'argent a été rendu au parent",
    aide: "Compté comme une sortie de caisse.",
  },
];

export function FenetreMotif({ titre, message, fin }) {
  const [motif, setMotif] = useState("erreur_saisie");
  const [explication, setExplication] = useState("");
  const valide = explication.trim().length >= 3;
  const confirmer = () => { if (valide) fin({ motif, explication: explication.trim() }); };

  return (
    <Modale titre={titre} fermer={() => fin(null)}>
      {message && <p style={{ margin: "0 0 14px", fontSize: 13, color: "#334155", whiteSpace: "pre-line" }}>{message}</p>}
      <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 800, color: C.blueDark, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        Pourquoi ?
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
        {OPTIONS.map((o) => (
          <label key={o.id} style={{
            display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", borderRadius: 10, cursor: "pointer",
            border: `1.5px solid ${motif === o.id ? C.blue : "#cbd5e1"}`, background: motif === o.id ? "#e0ebf8" : "var(--lc-surface, #fff)",
          }}>
            <input type="radio" name="motif-annulation" checked={motif === o.id} onChange={() => setMotif(o.id)} style={{ marginTop: 3 }} />
            <span>
              <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: C.blueDark }}>{o.label}</span>
              <span style={{ display: "block", fontSize: 11.5, color: "#64748b", marginTop: 2 }}>{o.aide}</span>
            </span>
          </label>
        ))}
      </div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
        Explication (obligatoire)
      </label>
      <textarea value={explication} autoFocus rows={3} onChange={(e) => setExplication(e.target.value)}
        placeholder="Ex. : coché sur la mauvaise ligne, le parent n'a pas payé ce mois."
        style={{ width: "100%", boxSizing: "border-box", border: "1.5px solid var(--lc-border)", borderRadius: 8, padding: "8px 11px", fontSize: 13, fontFamily: "inherit", resize: "vertical", background: "var(--lc-input-bg)", color: "var(--lc-text)" }} />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
        <Btn v="ghost" onClick={() => fin(null)}>Annuler</Btn>
        <Btn v="danger" onClick={confirmer} disabled={!valide}>Confirmer</Btn>
      </div>
    </Modale>
  );
}
