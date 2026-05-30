import { C, S, CONTACTS_PAIEMENT } from "./upgrade-styles";

// Étape 3 : saisie et soumission de la référence de paiement.
export function EtapeSoumission({ form, setForm, chg, erreur, chargement, soumettreDemande, setEtape }) {
  return (
    <>
      <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 900, color: C.blueDark }}>
        📋 Confirmer votre paiement
      </h2>
      <p style={{ margin: "0 0 18px", fontSize: 13, color: "#6b7280" }}>
        Renseignez les informations de votre paiement. Notre équipe vérifiera et activera votre plan dans les 24h.
      </p>

      <label style={S.lbl}>Opérateur utilisé</label>
      <div style={{ display: "flex", gap: 10 }}>
        {CONTACTS_PAIEMENT.map(c => (
          <button key={c.operateur} onClick={() => setForm(p => ({ ...p, operateur: c.operateur }))}
            style={{
              flex: 1, padding: "10px 8px", borderRadius: 9, cursor: "pointer",
              fontWeight: 700, fontSize: 12,
              border: `2px solid ${form.operateur === c.operateur ? c.couleur : "#e5e7eb"}`,
              background: form.operateur === c.operateur ? c.couleur + "22" : "#fff",
              color: form.operateur === c.operateur
                ? (c.couleur === "#ffcc00" ? "#a16207" : c.couleur)
                : "#6b7280",
            }}>
            {c.operateur}
          </button>
        ))}
      </div>

      <label style={S.lbl}>Votre numéro de téléphone *</label>
      <input style={S.inp} value={form.telephone}
        onChange={chg("telephone")} placeholder="Ex. : 622 000 000" type="tel"/>

      <label style={S.lbl}>Référence / Code de transaction *</label>
      <input style={S.inp} value={form.reference}
        onChange={chg("reference")}
        placeholder="Ex. : MP241015.1234.A56789"/>

      <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 14px", marginTop: 12 }}>
        <p style={{ margin: 0, fontSize: 12, color: "#92400e" }}>
          ⚠️ Assurez-vous d'avoir envoyé <strong>500 000 GNF</strong> avant de soumettre.
        </p>
      </div>

      {erreur && (
        <div style={{ background: "#fee2e2", borderRadius: 8, padding: "9px 14px", fontSize: 13, color: "#991b1b", marginTop: 12 }}>
          {erreur}
        </div>
      )}

      <button onClick={soumettreDemande} disabled={chargement} style={{ ...S.btn(), opacity: chargement ? 0.7 : 1 }}>
        {chargement ? "Envoi en cours…" : "✅ Soumettre ma demande"}
      </button>
      <button onClick={() => setEtape("instructions")} style={S.btn("#f3f4f6", "#6b7280")}>
        ← Retour
      </button>
    </>
  );
}
