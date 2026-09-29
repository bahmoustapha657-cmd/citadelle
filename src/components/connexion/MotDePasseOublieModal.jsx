import { C } from "../../constants";
import { annonceEnvoi, dureeLisible } from "../../backend/code-reinitialisation";
import { useMotDePasseOublie } from "./use-mot-de-passe-oublie";

// Modale « Mot de passe oublié » : code école + identifiant (ou e-mail, ou
// numéro de téléphone pour un parent). Selon le compte, l'Edge Function
// password-reset envoie un lien par e-mail, un code par SMS / WhatsApp — saisi
// ici avec le nouveau mot de passe — ou notifie la Direction. Réponse
// générique pour un compte inconnu (anti-énumération). Logique dans
// use-mot-de-passe-oublie.js. `onConnecter(compte)` : mot de passe choisi par
// code → retour à la connexion, identifiant pré-rempli.
const inputStyle = { width: "100%", border: "1px solid #cbd5e1", borderRadius: 9, padding: "11px 13px", fontSize: 14, boxSizing: "border-box" };
const boutonSecondaire = { background: "#f1f5f9", color: "#334155", border: "none", padding: "12px 16px", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" };
const boutonPrincipal = (actif) => ({
  flex: 1, background: `linear-gradient(90deg, ${C.blue}, ${C.green})`, color: "#fff", border: "none", padding: "12px",
  borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: actif ? "pointer" : "not-allowed", opacity: actif ? 1 : 0.7,
});
const encadre = (fond, bord, texte) => ({
  background: fond, border: `1px solid ${bord}`, borderRadius: 10, padding: "12px 14px", fontSize: 13.5, color: texte, lineHeight: 1.6,
});

export function MotDePasseOublieModal({ codeEcoleInitial = "", onClose, onConnecter }) {
  const m = useMotDePasseOublie({ codeEcoleInitial });

  let contenu;
  if (m.compte) contenu = <Succes compte={m.compte} onConnecter={() => (onConnecter ? onConnecter(m.compte) : onClose())} />;
  else if (m.etapeCode) contenu = <EtapeCode m={m} onClose={onClose} />;
  else if (m.resultat) contenu = <Resultat resultat={m.resultat} onClose={onClose} />;
  else contenu = <Demande m={m} codeEcoleInitial={codeEcoleInitial} onClose={onClose} />;

  return (
    // Pendant la saisie du code, un clic à côté ne ferme pas : le code reçu
    // et le mot de passe tapé seraient perdus.
    <div onClick={m.etapeCode ? undefined : onClose} style={{ position: "fixed", inset: 0, background: "rgba(6,15,31,0.55)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div role="dialog" aria-label="Mot de passe oublié" onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 420, padding: "24px 26px", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", maxHeight: "calc(100dvh - 32px)", overflowY: "auto", boxSizing: "border-box" }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 800, color: C.blueDark }}>🔑 Mot de passe oublié</h3>
        {contenu}
      </div>
    </div>
  );
}

function Demande({ m, codeEcoleInitial, onClose }) {
  const actif = !m.chargement && m.peutDemander;
  return (
    <>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>
        Indiquez votre code école et votre identifiant — ou votre e-mail si vous en avez enregistré un. Parent : votre numéro de téléphone suffit.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input value={m.codeEcole} onChange={(e) => m.setCodeEcole(e.target.value)} placeholder="Code école (ex. citadelle)" style={inputStyle} autoFocus={!codeEcoleInitial} />
        <input value={m.identifiant} onChange={(e) => m.setIdentifiant(e.target.value)} placeholder="Identifiant, e-mail ou n° de téléphone"
          style={inputStyle} autoFocus={!!codeEcoleInitial} autoComplete="username"
          onKeyDown={(e) => e.key === "Enter" && m.demander()} />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button onClick={m.demander} disabled={!actif} style={boutonPrincipal(actif)}>
          {m.chargement ? "Envoi…" : "Réinitialiser"}
        </button>
        <button onClick={onClose} style={boutonSecondaire}>Annuler</button>
      </div>
    </>
  );
}

function EtapeCode({ m, onClose }) {
  const type = m.voir ? "text" : "password";
  return (
    <>
      <div style={{ ...encadre("#eff6ff", "#bfdbfe", "#1e3a8a"), margin: "12px 0 14px" }}>
        📱 {annonceEnvoi(m.resultat)}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input value={m.code} onChange={(e) => m.setCode(e.target.value)} placeholder="Code à 6 chiffres" aria-label="Code reçu"
          inputMode="numeric" autoComplete="one-time-code" maxLength={9} autoFocus
          style={{ ...inputStyle, fontSize: 20, fontWeight: 800, letterSpacing: 6, textAlign: "center" }} />
        <input type={type} value={m.mdp} onChange={(e) => m.setMdp(e.target.value)} placeholder="Nouveau mot de passe (8 caractères min.)"
          aria-label="Nouveau mot de passe" autoComplete="new-password" style={inputStyle} />
        <input type={type} value={m.confirmation} onChange={(e) => m.setConfirmation(e.target.value)} placeholder="Confirmer le mot de passe"
          aria-label="Confirmer le mot de passe" autoComplete="new-password" style={inputStyle}
          onKeyDown={(e) => e.key === "Enter" && m.enregistrer()} />
        <label style={{ fontSize: 12, color: "#64748b", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <input type="checkbox" checked={m.voir} onChange={(e) => m.setVoir(e.target.checked)} /> Afficher le mot de passe
        </label>
      </div>
      {m.erreur && (
        <div role="alert" style={{ background: "#fce8e8", border: "1px solid #f5c1c1", borderRadius: 9, padding: "10px 13px", fontSize: 13, color: "#9b2020", fontWeight: 600, marginTop: 12 }}>
          {m.erreur.message}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button onClick={m.enregistrer} disabled={m.chargement} style={boutonPrincipal(!m.chargement)}>
          {m.chargement ? "Enregistrement…" : "Enregistrer le mot de passe"}
        </button>
        <button onClick={onClose} style={boutonSecondaire}>Annuler</button>
      </div>
      <p style={{ margin: "14px 0 0", fontSize: 12.5, color: "#64748b", textAlign: "center", lineHeight: 1.6 }}>
        {m.erreur?.redemander ? "Il vous faut un nouveau code." : "Code pas reçu ?"}{" "}
        <button type="button" onClick={m.demander} disabled={m.chargement || m.attente > 0}
          style={{ background: "none", border: "none", padding: 0, fontSize: "inherit", fontFamily: "inherit", fontWeight: 700,
            color: m.attente > 0 ? "#94a3b8" : C.blue, cursor: m.chargement || m.attente > 0 ? "default" : "pointer" }}>
          {m.attente > 0 ? `Renvoyer le code (dans ${dureeLisible(m.attente)})` : "Renvoyer le code"}
        </button>
      </p>
    </>
  );
}

function Resultat({ resultat, onClose }) {
  return (
    <>
      <div style={{ ...encadre("#ecfdf5", "#6ee7b7", "#065f46"), margin: "12px 0 16px" }}>
        {resultat.method === "email" && (
          <>✉️ Un lien de réinitialisation a été envoyé à votre adresse e-mail{resultat.emailMasque ? ` (${resultat.emailMasque})` : ""}. Ouvrez-le pour choisir un nouveau mot de passe. Pensez à vérifier les indésirables.</>
        )}
        {resultat.method === "direction" && (
          <>📩 Votre Direction a été notifiée dans sa messagerie interne. Elle réinitialisera votre mot de passe depuis « Comptes & Postes » et vous communiquera le nouveau.</>
        )}
        {resultat.method !== "email" && resultat.method !== "direction" && (
          <>Si ce compte existe, la marche à suivre a été déclenchée : un e-mail de réinitialisation, un code par SMS, ou une notification à votre Direction. Rapprochez-vous de la Direction si vous ne recevez rien.</>
        )}
      </div>
      <button onClick={onClose} style={{ ...boutonPrincipal(true), width: "100%", background: C.blue }}>Fermer</button>
    </>
  );
}

function Succes({ compte, onConnecter }) {
  return (
    <>
      <div style={{ ...encadre("#ecfdf5", "#6ee7b7", "#065f46"), margin: "12px 0 16px" }}>
        ✅ Mot de passe enregistré.
        {compte.login && (
          <> Connectez-vous avec le code école <strong>{compte.schoolId}</strong> et l'identifiant <strong>{compte.login}</strong>.</>
        )}
      </div>
      <button onClick={onConnecter} style={{ ...boutonPrincipal(true), width: "100%" }}>Se connecter</button>
    </>
  );
}
