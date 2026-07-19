import { useState } from "react";
import { C } from "../../constants";
import { demanderReinitialisation } from "../../backend/password-reset-supabase";

// Modale « Mot de passe oublié » : code école + identifiant (ou e-mail) →
// l'Edge Function envoie un lien par e-mail (si e-mail réel) ou notifie la
// Direction. Réponse volontairement générique (anti-énumération).
export function MotDePasseOublieModal({ codeEcoleInitial = "", onClose }) {
  const [code, setCode] = useState(codeEcoleInitial);
  const [identifiant, setIdentifiant] = useState("");
  const [chargement, setChargement] = useState(false);
  const [resultat, setResultat] = useState(null); // { method, emailMasque? }

  const envoyer = async () => {
    if (!code.trim() || identifiant.trim().length < 2) return;
    setChargement(true);
    try {
      const r = await demanderReinitialisation({ schoolId: code.trim().toLowerCase(), identifiant: identifiant.trim() });
      setResultat(r || { method: "generic" });
    } finally {
      setChargement(false);
    }
  };

  const inputStyle = { width: "100%", border: "1px solid #cbd5e1", borderRadius: 9, padding: "11px 13px", fontSize: 14, boxSizing: "border-box" };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(6,15,31,0.55)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 420, padding: "24px 26px", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 800, color: C.blueDark }}>🔑 Mot de passe oublié</h3>

        {!resultat ? (
          <>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>
              Indiquez votre code école et votre identifiant (ou votre e-mail si vous en avez enregistré un).
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code école (ex. citadelle)" style={inputStyle} autoFocus={!codeEcoleInitial} />
              <input value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} placeholder="Identifiant ou e-mail"
                style={inputStyle} autoFocus={!!codeEcoleInitial}
                onKeyDown={(e) => e.key === "Enter" && envoyer()} />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={envoyer} disabled={chargement || !code.trim() || identifiant.trim().length < 2}
                style={{ flex: 1, background: `linear-gradient(90deg, ${C.blue}, ${C.green})`, color: "#fff", border: "none", padding: "12px", borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: chargement ? "not-allowed" : "pointer", opacity: chargement ? 0.7 : 1 }}>
                {chargement ? "Envoi…" : "Réinitialiser"}
              </button>
              <button onClick={onClose} style={{ background: "#f1f5f9", color: "#334155", border: "none", padding: "12px 16px", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                Annuler
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ background: "#ecfdf5", border: "1px solid #6ee7b7", borderRadius: 10, padding: "14px 16px", margin: "12px 0 16px", fontSize: 13.5, color: "#065f46", lineHeight: 1.6 }}>
              {resultat.method === "email" && (
                <>✉️ Un lien de réinitialisation a été envoyé à votre adresse e-mail{resultat.emailMasque ? ` (${resultat.emailMasque})` : ""}. Ouvrez-le pour choisir un nouveau mot de passe. Pensez à vérifier les indésirables.</>
              )}
              {resultat.method === "direction" && (
                <>📩 Votre Direction a été notifiée dans sa messagerie interne. Elle réinitialisera votre mot de passe depuis « Comptes & Postes » et vous communiquera le nouveau.</>
              )}
              {(resultat.method === "generic" || !resultat.method) && (
                <>Si ce compte existe, la marche à suivre a été déclenchée : un e-mail de réinitialisation, ou une notification à votre Direction. Rapprochez-vous de la Direction si vous ne recevez rien.</>
              )}
            </div>
            <button onClick={onClose} style={{ width: "100%", background: C.blue, color: "#fff", border: "none", padding: "12px", borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: "pointer" }}>
              Fermer
            </button>
          </>
        )}
      </div>
    </div>
  );
}
