import { useState } from "react";
import { C } from "../../constants";
import { creerRecuperation } from "../../backend/password-reset-supabase";

// Écran de choix d'un nouveau mot de passe, affiché après avoir cliqué le lien
// de réinitialisation reçu par e-mail. Le lien n'est vérifié qu'à
// l'enregistrement ; s'il a expiré ou déjà servi, l'écran le dit et renvoie
// vers la connexion pour refaire une demande. `onTermine(compte|null)` :
// retour à la connexion, avec l'identifiant du compte une fois le mot de
// passe enregistré.
export function ResetPasswordScreen({ retour, onTermine }) {
  const [recuperation] = useState(() => creerRecuperation(retour));
  const [mdp, setMdp] = useState("");
  const [confirm, setConfirm] = useState("");
  const [voir, setVoir] = useState(false);
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(false);
  const [lienInvalide, setLienInvalide] = useState(retour.mode === "erreur");
  const [compte, setCompte] = useState(null); // { login, schoolId } une fois enregistré

  const valider = async () => {
    if (chargement) return; // Entrée pressée deux fois
    setErreur("");
    if (mdp.length < 8) { setErreur("Le mot de passe doit contenir au moins 8 caractères."); return; }
    if (mdp !== confirm) { setErreur("Les deux mots de passe ne correspondent pas."); return; }
    setChargement(true);
    try {
      setCompte(await recuperation.enregistrer(mdp));
    } catch (e) {
      if (e.lienInvalide) setLienInvalide(true);
      setErreur(e.message || "Impossible d'enregistrer le mot de passe. Le lien a peut-être expiré.");
    } finally {
      setChargement(false);
    }
  };

  const inputStyle = { width: "100%", border: "1px solid #cbd5e1", borderRadius: 9, padding: "12px 13px", fontSize: 14, boxSizing: "border-box" };
  const boutonStyle = { width: "100%", marginTop: 16, background: `linear-gradient(90deg, ${C.blue}, ${C.green})`, color: "#fff", border: "none", padding: "13px", borderRadius: 10, fontSize: 15, fontWeight: 800, cursor: "pointer" };

  let contenu;
  if (compte) {
    contenu = (
      <>
        <div style={{ background: "#ecfdf5", border: "1px solid #6ee7b7", borderRadius: 10, padding: "16px", marginTop: 12, fontSize: 14, color: "#065f46", lineHeight: 1.6 }}>
          ✅ Mot de passe enregistré.
          {compte.login && (
            <> Connectez-vous avec le code école <strong>{compte.schoolId}</strong> et l'identifiant <strong>{compte.login}</strong>.</>
          )}
        </div>
        <button onClick={() => onTermine(compte)} style={boutonStyle}>Se connecter</button>
      </>
    );
  } else if (lienInvalide) {
    contenu = (
      <>
        <div style={{ background: "#fce8e8", border: "1px solid #f5c1c1", borderRadius: 10, padding: "16px", marginTop: 12, fontSize: 14, color: "#9b2020", lineHeight: 1.6 }}>
          {erreur || "Ce lien de réinitialisation a expiré ou a déjà été utilisé. Refaites une demande depuis l'écran de connexion (« Mot de passe oublié ? »)."}
        </div>
        <button onClick={() => onTermine(null)} style={boutonStyle}>Retour à la connexion</button>
      </>
    );
  } else {
    contenu = (
      <>
        <p style={{ margin: "0 0 18px", fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>
          Choisissez un nouveau mot de passe pour votre compte EduGest.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input type={voir ? "text" : "password"} value={mdp} onChange={(e) => setMdp(e.target.value)} placeholder="Nouveau mot de passe (8 caractères min.)" style={inputStyle} autoFocus />
          <input type={voir ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirmer le mot de passe" style={inputStyle}
            onKeyDown={(e) => e.key === "Enter" && valider()} />
          <label style={{ fontSize: 12, color: "#64748b", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input type="checkbox" checked={voir} onChange={(e) => setVoir(e.target.checked)} /> Afficher le mot de passe
          </label>
        </div>
        {erreur && (
          <div style={{ background: "#fce8e8", border: "1px solid #f5c1c1", borderRadius: 9, padding: "10px 13px", fontSize: 13, color: "#9b2020", fontWeight: 600, marginTop: 12 }}>{erreur}</div>
        )}
        <button onClick={valider} disabled={chargement}
          style={{ ...boutonStyle, cursor: chargement ? "not-allowed" : "pointer", opacity: chargement ? 0.7 : 1 }}>
          {chargement ? "Enregistrement…" : "Enregistrer le mot de passe"}
        </button>
      </>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(135deg, ${C.blueDark} 0%, #11233f 100%)`, padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: 420, padding: "32px 34px", boxShadow: "0 24px 70px rgba(0,0,0,0.35)" }}>
        <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 800, color: C.blueDark }}>
          {lienInvalide && !compte ? "🔑 Lien de réinitialisation" : "🔑 Nouveau mot de passe"}
        </h2>
        {contenu}
      </div>
    </div>
  );
}
